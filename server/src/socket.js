const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const GameRoom = require('./models/GameRoom');
const Group = require('./models/Group');
const { publicState, canSpectate, canVoice, decorate } = require('./routes/game-rooms.routes');
const { blocked, friends } = require('./routes/friends.routes');

class PrivateCallRegistry {
  constructor() {
    this.calls = new Map();
    this.users = new Map();
  }
  invite(call) {
    if (!call.callId || !call.callerId || !call.calleeId || this.calls.has(call.callId) || this.users.has(call.callerId) || this.users.has(call.calleeId)) return false;
    this.calls.set(call.callId, { ...call, state: 'ringing', createdAt: new Date() });
    this.users.set(call.callerId, call.callId);
    this.users.set(call.calleeId, call.callId);
    return true;
  }
  get(callId) { return this.calls.get(callId); }
  accept(callId, calleeSocketId) {
    const call = this.calls.get(callId);
    if (!call || call.state !== 'ringing') return false;
    call.state = 'accepted';
    call.calleeSocketId = calleeSocketId;
    return true;
  }
  end(callId) {
    const call = this.calls.get(callId);
    if (!call) return null;
    this.calls.delete(callId);
    this.users.delete(call.callerId);
    this.users.delete(call.calleeId);
    return call;
  }
  forUser(userId) {
    const callId = this.users.get(String(userId));
    return callId ? this.calls.get(callId) : null;
  }
  ringingFor(userId) {
    const call = this.forUser(userId);
    return call?.state === 'ringing' ? call : null;
  }
}

function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
  const voiceRooms = new Map();
  const groupVoiceRooms = new Map();
  const privateCalls = new PrivateCallRegistry();
  const userRoom = (userId) => `user:${String(userId)}`;
  const userSocketCount = (userId) => io.sockets.adapter.rooms.get(userRoom(userId))?.size || 0;
  const onlineUserIds = () => Array.from(io.sockets.adapter.rooms.keys())
    .filter((room) => room.startsWith('user:'))
    .map((room) => room.slice('user:'.length));
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
    const room = userRoom(socket.user._id);
    socket.join(room);
    const firstSocket = userSocketCount(socket.user._id) === 1;
    const userId = String(socket.user._id);
    if (firstSocket) {
      User.findByIdAndUpdate(socket.user._id, { $set: { 'profile.online': true } }).catch(() => {});
      socket.broadcast.emit('presence:online', { userId });
    }
    // A newly connected device also needs the current live state. The room
    // membership, rather than MongoDB's last value, is the source of truth.
    socket.emit('presence:state', { userIds: onlineUserIds().filter((id) => id !== userId) });

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
      const banned = group?.bannedMembers?.some(id => String(id) === String(socket.user._id));
      const allowed = group && group.isActive && !banned && (socket.user.role === 'developer' || group.privacy === 'public' || group.members.some(id => String(id) === String(socket.user._id)) || String(group.owner) === String(socket.user._id));
      if (!allowed) return typeof ack === 'function' && ack({ ok: false, message: 'لا يمكنك دخول هذه الغرفة' });
      socket.join(`group:${groupId}`);
      if (typeof ack === 'function') ack({ ok: true });
    });
    socket.on('group-voice:join', async ({ groupId } = {}, ack) => {
      const group = await Group.findById(groupId).catch(() => null);
      const privileged = group && (socket.user.role === 'developer' || String(group.owner) === String(socket.user._id) || group.admins.some(id => String(id) === String(socket.user._id)) || group.moderators.some(id => String(id) === String(socket.user._id)));
      const allowed = group && group.isActive && ['voice', 'challenge'].includes(group.roomType) && !group.bannedMembers.some(id => String(id) === String(socket.user._id)) && !group.mutedMembers.some(id => String(id) === String(socket.user._id)) && (privileged || (group.allowMemberAudio && group.members.some(id => String(id) === String(socket.user._id))));
      if (!allowed) return typeof ack === 'function' && ack({ ok: false, message: 'انضم إلى الغرفة الصوتية أولاً' });
      if (!groupVoiceRooms.has(String(groupId))) groupVoiceRooms.set(String(groupId), new Map());
      if (!groupVoiceRooms.get(String(groupId)).has(String(socket.user._id)) && groupVoiceRooms.get(String(groupId)).size >= group.maxSpeakers) return typeof ack === 'function' && ack({ ok: false, message: 'اكتمل عدد المتحدثين في الغرفة' });
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

    const authenticatedCallContext = async ({ userId, conversationId, type } = {}) => {
      if (!['audio', 'video'].includes(type) || !userId || !conversationId) return null;
      const conversation = await Conversation.findOne({ _id: conversationId, participants: socket.user._id }).catch(() => null);
      if (!conversation || conversation.participants.length !== 2) return null;
      const otherId = conversation.participants.find((id) => String(id) !== String(socket.user._id));
      if (!otherId || String(otherId) !== String(userId)) return null;
      const target = await User.findById(otherId);
      if (!target || target.status !== 'active' || blocked(socket.user, target) || !(await friends(socket.user._id, target._id))) return null;
      const permission = type === 'video' ? target.privacy?.get('videoCalls') : target.privacy?.get('audioCalls');
      if (permission === 'nobody') return null;
      return { conversation, target };
    };
    const peerIdFor = (call, senderId) => call.callerId === String(senderId) ? call.calleeId : call.callerId;
    const ownsCall = (call, userId) => call && [call.callerId, call.calleeId].includes(String(userId));

    socket.on('call:invite', async (payload = {}, ack) => {
      const callId = String(payload.callId || '').slice(0, 100);
      const context = await authenticatedCallContext(payload);
      if (!context) return typeof ack === 'function' && ack({ ok: false, reason: 'forbidden', message: 'لا يمكن بدء مكالمة مع هذا المستخدم' });
      if (!callId) return typeof ack === 'function' && ack({ ok: false, reason: 'invalid', message: 'معرّف المكالمة غير صالح' });
      const calleeId = String(context.target._id);
      // Do not create a ringing registry entry when the recipient has no live
      // authenticated socket. This keeps the client honest about offline calls.
      if (!userSocketCount(calleeId)) return typeof ack === 'function' && ack({ ok: false, reason: 'offline', message: 'المستخدم غير متصل الآن' });
      const call = { callId, callerId: String(socket.user._id), callerSocketId: socket.id, callerName: socket.user.displayName || socket.user.fullName || socket.user.username || '', calleeId, conversationId: String(context.conversation._id), type: payload.type };
      if (!privateCalls.invite(call)) return typeof ack === 'function' && ack({ ok: false, reason: 'busy', message: 'المستخدم مشغول بمكالمة أخرى' });
      io.to(`user:${call.calleeId}`).emit('call:invite', { callId, conversationId: call.conversationId, type: call.type, from: call.callerId, callerName: socket.user.displayName || socket.user.fullName || socket.user.username });
      setTimeout(() => {
        const pending = privateCalls.get(callId);
        if (!pending || pending.state !== 'ringing') return;
        privateCalls.end(callId);
        io.to(`user:${pending.callerId}`).to(`user:${pending.calleeId}`).emit('call:end', { callId, conversationId: pending.conversationId, type: pending.type, reason: 'no-answer' });
      }, 35000);
      if (typeof ack === 'function') ack({ ok: true, callId });
    });

    socket.on('call:accept', (payload = {}, ack) => {
      const call = privateCalls.get(String(payload.callId || ''));
      if (!ownsCall(call, socket.user._id) || call.calleeId !== String(socket.user._id) || !privateCalls.accept(call.callId, socket.id)) return typeof ack === 'function' && ack({ ok: false, message: 'هذه المكالمة لم تعد متاحة' });
      io.to(`user:${call.callerId}`).emit('call:accept', { callId: call.callId, conversationId: call.conversationId, type: call.type, from: call.calleeId });
      if (typeof ack === 'function') ack({ ok: true });
    });

    const finishPrivateCall = (event) => (payload = {}, ack) => {
      const call = privateCalls.get(String(payload.callId || ''));
      if (!ownsCall(call, socket.user._id)) return typeof ack === 'function' && ack({ ok: false });
      if (call.state === 'accepted' && socket.id !== call.callerSocketId && socket.id !== call.calleeSocketId) return typeof ack === 'function' && ack({ ok: false });
      const peerId = peerIdFor(call, socket.user._id);
      privateCalls.end(call.callId);
      io.to(`user:${peerId}`).emit(event, { callId: call.callId, conversationId: call.conversationId, type: call.type, from: String(socket.user._id), reason: String(payload.reason || '').slice(0, 40) });
      if (typeof ack === 'function') ack({ ok: true });
    };
    socket.on('call:reject', finishPrivateCall('call:reject'));
    socket.on('call:end', finishPrivateCall('call:end'));

    const relayWebRtc = (event) => (payload = {}, ack) => {
      const call = privateCalls.get(String(payload.callId || ''));
      if (!ownsCall(call, socket.user._id) || call.state !== 'accepted') return typeof ack === 'function' && ack({ ok: false });
      if (socket.id !== call.callerSocketId && socket.id !== call.calleeSocketId) return typeof ack === 'function' && ack({ ok: false });
      const peerId = peerIdFor(call, socket.user._id);
      if (String(payload.userId || peerId) !== peerId) return typeof ack === 'function' && ack({ ok: false });
      io.to(`user:${peerId}`).emit(event, { callId: call.callId, conversationId: call.conversationId, type: call.type, data: payload.data, from: String(socket.user._id) });
      if (typeof ack === 'function') ack({ ok: true });
    };
    ['webrtc:offer', 'webrtc:answer', 'webrtc:ice'].forEach((event) => socket.on(event, relayWebRtc(event)));

    // Kept for older clients that explicitly announce themselves. The room
    // count prevents a duplicate online event when another device is active.
    socket.on('presence:online', () => {
      if (userSocketCount(socket.user._id) === 1) socket.broadcast.emit('presence:online', { userId });
    });

    const ringingCall = privateCalls.ringingFor(userId);
    if (ringingCall && ringingCall.calleeId === userId) {
      socket.emit('call:invite', {
        callId: ringingCall.callId,
        conversationId: ringingCall.conversationId,
        type: ringingCall.type,
        from: ringingCall.callerId,
        callerName: ringingCall.callerName || '',
        replay: true
      });
    }

    socket.on('disconnect', async () => {
      const privateCall = privateCalls.forUser(socket.user._id);
      if (privateCall && (socket.id === privateCall.callerSocketId || socket.id === privateCall.calleeSocketId)) {
        const peerId = peerIdFor(privateCall, socket.user._id);
        privateCalls.end(privateCall.callId);
        io.to(`user:${peerId}`).emit('call:end', { callId: privateCall.callId, conversationId: privateCall.conversationId, type: privateCall.type, from: String(socket.user._id), reason: 'disconnected' });
      }
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
      // Socket.IO removes the disconnected socket from its rooms before this
      // event. Check the authenticated user room, not the database flag, so a
      // second device keeps the user online.
      const remainingSockets = await io.in(room).fetchSockets().catch(() => []);
      if (!remainingSockets.length && userSocketCount(userId) === 0) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(socket.user._id, { $set: { 'profile.online': false, 'profile.lastSeen': lastSeen } }).catch(() => {});
        // A new socket may have joined while the database write was pending.
        // Re-check immediately before the event so the last-device rule stays
        // true even during a reconnect race.
        if (userSocketCount(userId) === 0) socket.broadcast.emit('presence:offline', { userId, lastSeen });
      }
    });
  });
  return io;
}

module.exports = { attachSocket, PrivateCallRegistry };
