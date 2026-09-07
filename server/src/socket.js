const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const { blocked, friends } = require('./routes/friends.routes');

function attachSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
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

    const joinConversation = async (id, ack) => {
      const conversation = await Conversation.findOne({ _id: id, participants: socket.user._id }).catch(() => null);
      if (!conversation) return typeof ack === 'function' && ack({ ok: false, message: 'forbidden' });
      socket.join(`conversation:${id}`);
      if (typeof ack === 'function') ack({ ok: true });
    };
    socket.on('private:join', joinConversation);
    socket.on('conversation:join', joinConversation);

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
      const lastSeen = new Date();
      await User.findByIdAndUpdate(socket.user._id, { $set: { 'profile.online': false, 'profile.lastSeen': lastSeen } }).catch(() => {});
      socket.broadcast.emit('presence:offline', { userId: socket.user._id, lastSeen });
    });
  });
  return io;
}

module.exports = { attachSocket };
