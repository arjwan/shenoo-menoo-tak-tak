const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const GameRoom = require('./models/GameRoom');
const Group = require('./models/Group');
const { publicState, canSpectate, canVoice, decorate } = require('./routes/game-rooms.routes');
const { blocked, friends } = require('./routes/friends.routes');

function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  const voiceRooms = new Map();
  const groupVoiceRooms = new Map();
  io.use(async (socket, next) => {
    try {
      const authorization = socket.handshake.headers.authorization || '';
      const token = socket.handshake.auth?.token || authorization.replace(/^Bearer\s+/i, '');
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userRoom = `user:${socket.user._id}`;
    socket.join(userRoom);
    User.findByIdAndUpdate(socket.user._id, { $set: { 'profile.online': true } }).catch(() => {});
    socket.emit('presence:online', { userId: socket.user._id });

    const emitSpectators = async (roomId) => {
      const room = await GameRoom.findById(roomId).populate('spectators', 'fullName displayName username profile');
      if (!room) return;
      io.to(`game:${roomId}`).emit('game:spectators', {
        count: room.spectators.length,
        spectators: room.spectators.map((user) => ({ id: user._id, name: user.displayName || user.fullName, username: user.username, avatarUrl: user.profile?.avatarUrl || '' }))
      });
    };
    const getGameRoom = async (id) => {
      const room = await GameRoom.findById(id).catch(() => null);
      return room ? decorate(room) : null;
    };
    socket.on('game:join', async ({ roomId } = {}, ack) => {
      const room = await getGameRoom(roomId);
      if (!room || !room.players.some((id) => String(id) === String(socket.user._id))) return typeof ack === 'function' && ack({ ok: false, message: 'هذه الغرفة لا تخصك' });
      socket.join(`game:${roomId}`);
      io.to(`game:${roomId}`).emit('game:state', publicState(room));
      if (typeof ack === 'function') ack({ ok: true, room: publicState(room) });
    });
    socket.on('game:spectate', async ({ roomId } = {}, ack) => {
      const room = await getGameRoom(roomId);
      if (!room || !(await canSpectate(socket.user, room))) return typeof ack === 'function' && ack({ ok: false, message: 'لا تملك صلاحية مشاهدة هذه المباراة' });
      if (!room.spectators.some((id) => String(id) === String(socket.user._id))) {
        room.spectators.push(socket.user._id);
        await room.save();
      }
      socket.join(`game:${roomId}`);
      socket.emit('game:state', publicState(room));
      await emitSpectators(roomId);
      if (typeof ack === 'function') ack({ ok: true, room: publicState(room) });
    });
    socket.on('game:spectator:leave', async ({ roomId } = {}) => {
      const room = await getGameRoom(roomId);
      if (!room) return;
      room.spectators = room.spectators.filter((id) => String(id) !== String(socket.user._id));
      await room.save();
      socket.leave(`game:${roomId}`);
      await emitSpectators(roomId);
    });
    socket.on('game:move', async ({ roomId, move } = {}, ack) => {
      const room = await getGameRoom(roomId);
      const isPlayer = room && room.players.some((id) => String(id) === String(socket.user._id));
      if (!room || !isPlayer || room.spectators.some((id) => String(id) === String(socket.user._id))) return typeof ack === 'function' && ack({ ok: false, message: 'المشاهد لا يستطيع اللعب' });
      if (room.gameState.turn && String(room.gameState.turn) !== String(socket.user._id)) return typeof ack === 'function' && ack({ ok: false, message: 'ليس دورك' });
      const safeMove = move && typeof move === 'object' ? { tile: String(move.tile || '').slice(0, 20), side: ['left', 'right'].includes(move.side) ? move.side : null } : null;
      if (!safeMove || !safeMove.tile) return typeof ack === 'function' && ack({ ok: false, message: 'حركة غير صالحة' });
      room.gameState.board.push(safeMove);
      room.gameState.moveCount += 1;
      room.gameState.turn = room.players[(room.players.findIndex((id) => String(id) === String(socket.user._id)) + 1) % room.players.length];
      room.gameState.status = 'active';
      room.gameState.updatedAt = new Date();
      await room.save();
      io.to(`game:${roomId}`).emit('game:state', publicState(room));
      if (typeof ack === 'function') ack({ ok: true });
    });
    socket.on('voice:join', async ({ roomId } = {}, ack) => {
      const room = await getGameRoom(roomId);
      const allowed = room && (await canVoice(socket.user, room)) && (room.spectators.some((id) => String(id) === String(socket.user._id)) || room.players.some((id) => String(id) === String(socket.user._id)) || String(room.owner) === String(socket.user._id));
      if (!allowed) return typeof ack === 'function' && ack({ ok: false, message: 'لا تملك صلاحية الانضمام إلى صوت الغرفة' });
      if (!voiceRooms.has(String(roomId))) voiceRooms.set(String(roomId), new Map());
      voiceRooms.get(String(roomId)).set(String(socket.user._id), { id: socket.user._id, name: socket.user.displayName || socket.user.fullName, muted: true });
      socket.join(`voice:${roomId}`);
      const participants = Array.from(voiceRooms.get(String(roomId)).values());
      io.to(`voice:${roomId}`).emit('voice:participants', { roomId, participants });
      if (typeof ack === 'function') ack({ ok: true, participants });
    });
    socket.on('voice:mute-state', async ({ roomId, muted } = {}) => {
      const participants = voiceRooms.get(String(roomId));
      const participant = participants?.get(String(socket.user._id));
      if (!participant) return;
      participant.muted = Boolean(muted);
      io.to(`voice:${roomId}`).emit('voice:mute-state', { roomId, userId: socket.user._id, muted: participant.muted });
    });
    socket.on('voice:leave', ({ roomId } = {}) => {
      const participants = voiceRooms.get(String(roomId));
      if (!participants) return;
      participants.delete(String(socket.user._id));
      socket.leave(`voice:${roomId}`);
      io.to(`voice:${roomId}`).emit('voice:participants', { roomId, participants: Array.from(participants.values()) });
      if (!participants.size) voiceRooms.delete(String(roomId));
    });
    const relayVoiceSignal = (event) => ({ roomId, userId, data } = {}) => {
      const participants = voiceRooms.get(String(roomId));
      if (!participants?.has(String(socket.user._id)) || !participants.has(String(userId))) return;
      io.to(`user:${userId}`).emit(event, { roomId, from: socket.user._id, data });
    };
    socket.on('webrtc:voice-offer', relayVoiceSignal('webrtc:voice-offer'));
    socket.on('webrtc:voice-answer', relayVoiceSignal('webrtc:voice-answer'));
    socket.on('webrtc:voice-ice', relayVoiceSignal('webrtc:voice-ice'));

    const joinConversation = async (id, ack) => {
      const conversation = await Conversation.findOne({ _id: id, participants: socket.user._id }).catch(() => null);
      if (!conversation) return typeof ack === 'function' && ack({ ok: false, message: 'forbidden' });
      socket.join(`conversation:${id}`);
      if (typeof ack === 'function') ack({ ok: true });
    };
    socket.on('private:join', joinConversation);
    socket.on('conversation:join', joinConversation);

    socket.on('group:join', async ({ groupId } = {}, ack) => {
      const group = await Group.findById(groupId).catch(() => null);
      const allowed = group && group.isActive && (group.privacy === 'public' || group.members.some(id => String(id) === String(socket.user._id)) || String(group.owner) === String(socket.user._id));
      if (!allowed) return typeof ack === 'function' && ack({ ok: false, message: 'لا يمكنك دخول هذه الغرفة' });
      socket.join(`group:${groupId}`);
      if (typeof ack === 'function') ack({ ok: true });
    });
    socket.on('group-voice:join', async ({ groupId } = {}, ack) => {
      const group = await Group.findById(groupId).catch(() => null);
      const allowed = group && group.roomType === 'voice' && group.members.some(id => String(id) === String(socket.user._id));
      if (!allowed) return typeof ack === 'function' && ack({ ok: false, message: 'انضم إلى الغرفة الصوتية أولاً' });
      if (!groupVoiceRooms.has(String(groupId))) groupVoiceRooms.set(String(groupId), new Map());
      groupVoiceRooms.get(String(groupId)).set(String(socket.user._id), { id: socket.user._id, name: socket.user.displayName || socket.user.fullName, muted: true });
      socket.join(`group-voice:${groupId}`);
      const participants = Array.from(groupVoiceRooms.get(String(groupId)).values());
      io.to(`group-voice:${groupId}`).emit('group-voice:participants', { groupId, participants });
      if (typeof ack === 'function') ack({ ok: true, participants });
    });
    socket.on('group-voice:mute', ({ groupId, muted } = {}) => {
      const participant = groupVoiceRooms.get(String(groupId))?.get(String(socket.user._id)); if (!participant) return;
      participant.muted = Boolean(muted); io.to(`group-voice:${groupId}`).emit('group-voice:mute', { groupId, userId: socket.user._id, muted: participant.muted });
    });
    socket.on('group-voice:leave', ({ groupId } = {}) => {
      const room = groupVoiceRooms.get(String(groupId)); if (!room) return; room.delete(String(socket.user._id)); socket.leave(`group-voice:${groupId}`);
      io.to(`group-voice:${groupId}`).emit('group-voice:participants', { groupId, participants: Array.from(room.values()) }); if (!room.size) groupVoiceRooms.delete(String(groupId));
    });
    const relayGroupVoice = event => ({ groupId, userId, data } = {}) => {
      const room = groupVoiceRooms.get(String(groupId)); if (!room?.has(String(socket.user._id)) || !room.has(String(userId))) return;
      io.to(`user:${userId}`).emit(event, { groupId, from: socket.user._id, data });
    };
    socket.on('webrtc:group-offer', relayGroupVoice('webrtc:group-offer'));
    socket.on('webrtc:group-answer', relayGroupVoice('webrtc:group-answer'));
    socket.on('webrtc:group-ice', relayGroupVoice('webrtc:group-ice'));

    socket.on('private:typing', async ({ conversationId, active } = {}) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id }).populate('participants', 'blockedUsers');
      if (!conversation) return;
      const other = conversation.participants.find((u) => String(u._id) !== String(socket.user._id));
      if (other && !blocked(socket.user, other)) {
        io.to(`user:${other._id}`).emit('private:typing', { conversationId, active });
      }
    });
    socket.on('typing', (payload) => socket.emit('private:typing', payload));

    socket.on('private:message', async ({ conversationId, message } = {}) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id }).populate('participants', 'blockedUsers');
      if (!conversation) return;
      const other = conversation.participants.find((u) => String(u._id) !== String(socket.user._id));
      if (!other || blocked(socket.user, other)) return;
      io.to(`conversation:${conversationId}`).emit('private:message', { conversationId, message, senderId: socket.user._id });
    });
    socket.on('private:delivered', async ({ conversationId, messageId } = {}) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id });
      if (conversation) io.to(`conversation:${conversationId}`).emit('private:delivered', { messageId, userId: socket.user._id });
    });
    socket.on('private:read', async ({ conversationId, messageId } = {}) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id });
      if (conversation) io.to(`conversation:${conversationId}`).emit('private:read', { messageId, userId: socket.user._id });
    });

    const relayCall = (signal) => async ({ userId, conversationId, type, data } = {}) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id });
      const target = await User.findById(userId);
      const permission = type === 'video' ? target?.privacy?.get('videoCalls') : target?.privacy?.get('audioCalls');
      if (!conversation || !target || blocked(socket.user, target) || permission === 'nobody' || (permission !== 'everyone' && !(await friends(socket.user._id, target._id)))) return;
      io.to(`user:${target._id}`).emit(signal, { conversationId, type, data, from: socket.user._id, signal });
    };
    ['call:invite', 'call:accept', 'call:reject', 'call:end', 'webrtc:offer', 'webrtc:answer', 'webrtc:ice'].forEach((event) => socket.on(event, relayCall(event)));
    socket.on('call:signal', relayCall('call:signal'));

    socket.on('presence:online', () => socket.broadcast.emit('presence:online', { userId: socket.user._id }));
    socket.on('disconnect', async () => {
      for (const [roomId, participants] of voiceRooms) {
        if (participants.delete(String(socket.user._id))) {
          io.to(`voice:${roomId}`).emit('voice:participants', { roomId, participants: Array.from(participants.values()) });
          if (!participants.size) voiceRooms.delete(roomId);
        }
      }
      for (const [groupId, participants] of groupVoiceRooms) {
        if (participants.delete(String(socket.user._id))) {
          io.to(`group-voice:${groupId}`).emit('group-voice:participants', { groupId, participants: Array.from(participants.values()) });
          if (!participants.size) groupVoiceRooms.delete(groupId);
        }
      }
      const lastSeen = new Date();
      await User.findByIdAndUpdate(socket.user._id, { $set: { 'profile.online': false, 'profile.lastSeen': lastSeen } }).catch(() => {});
      socket.broadcast.emit('presence:offline', { userId: socket.user._id, lastSeen });
    });
  });
  return io;
}

module.exports = { attachSocket };
