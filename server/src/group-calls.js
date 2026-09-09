const User = require('./models/User');
const { blocked, friends } = require('./routes/friends.routes');

class AdHocGroupCallRegistry {
  constructor() {
    this.sessions = new Map();
    this.pendingByUser = new Map();
  }
  create(groupId, hostId, baseUserId, type) {
    if (!groupId || !hostId || !baseUserId || hostId === baseUserId || this.sessions.has(groupId)) return null;
    const session = {
      groupId,
      hostId: String(hostId),
      type: type === 'video' ? 'video' : 'audio',
      participants: new Map([[String(hostId), null], [String(baseUserId), null]]),
      pending: new Set(),
      createdAt: new Date()
    };
    this.sessions.set(groupId, session);
    return session;
  }
  get(groupId) { return this.sessions.get(String(groupId || '')); }
  invite(groupId, userId) {
    const session = this.get(groupId), id = String(userId || '');
    if (!session || !id || session.participants.has(id) || session.pending.has(id) || this.pendingByUser.has(id)) return false;
    session.pending.add(id);
    this.pendingByUser.set(id, session.groupId);
    return true;
  }
  accept(groupId, userId, socketId) {
    const session = this.get(groupId), id = String(userId || '');
    if (!session || !session.pending.has(id)) return false;
    session.pending.delete(id);
    this.pendingByUser.delete(id);
    session.participants.set(id, socketId || null);
    return true;
  }
  ready(groupId, userId, socketId) {
    const session = this.get(groupId), id = String(userId || '');
    if (!session || !session.participants.has(id)) return false;
    session.participants.set(id, socketId || null);
    return true;
  }
  reject(groupId, userId) {
    const session = this.get(groupId), id = String(userId || '');
    if (!session || !session.pending.delete(id)) return false;
    this.pendingByUser.delete(id);
    return true;
  }
  remove(groupId, userId) {
    const session = this.get(groupId), id = String(userId || '');
    if (!session) return null;
    session.pending.delete(id);
    this.pendingByUser.delete(id);
    if (!session.participants.delete(id)) return session;
    if (id === session.hostId || session.participants.size < 2) this.end(groupId);
    return session;
  }
  end(groupId) {
    const session = this.get(groupId);
    if (!session) return null;
    for (const id of session.pending) this.pendingByUser.delete(id);
    this.sessions.delete(session.groupId);
    return session;
  }
  pendingFor(userId) {
    const id = String(userId || ''), groupId = this.pendingByUser.get(id);
    const session = groupId ? this.get(groupId) : null;
    return session && session.pending.has(id) ? session : null;
  }
  hasParticipant(groupId, userId) {
    return Boolean(this.get(groupId)?.participants.has(String(userId || '')));
  }
}

function attachGroupCalls(io) {
  const calls = new AdHocGroupCallRegistry();
  const room = (userId) => `user:${String(userId)}`;
  const online = (userId) => io.sockets.adapter.rooms.get(room(userId))?.size > 0;
  const displayName = (user) => user?.displayName || user?.fullName || user?.username || 'مستخدم شنو منو';

  async function allowedTarget(source, targetId, type) {
    const target = await User.findById(targetId).catch(() => null);
    if (!target || target.status !== 'active' || blocked(source, target) || !(await friends(source._id, target._id))) return null;
    const permission = type === 'video' ? target.privacy?.get('videoCalls') : target.privacy?.get('audioCalls');
    if (permission === 'nobody') return null;
    return target;
  }

  io.on('connection', (socket) => {
    const selfId = String(socket.user._id);

    socket.on('call-group:add', async (payload = {}, ack) => {
      const groupId = String(payload.groupId || '').slice(0, 100);
      const baseUserId = String(payload.baseUserId || '').slice(0, 100);
      const targetId = String(payload.userId || '').slice(0, 100);
      const type = payload.type === 'video' ? 'video' : 'audio';
      if (!groupId || !baseUserId || !targetId || baseUserId === targetId || selfId === targetId) {
        return typeof ack === 'function' && ack({ ok: false, message: 'بيانات المشارك غير صالحة' });
      }
      const baseTarget = await allowedTarget(socket.user, baseUserId, type);
      const target = await allowedTarget(socket.user, targetId, type);
      if (!baseTarget || !target) return typeof ack === 'function' && ack({ ok: false, message: 'لا يمكن إضافة هذا المستخدم للمكالمة' });
      if (!online(baseUserId)) return typeof ack === 'function' && ack({ ok: false, message: 'المكالمة الأصلية لم تعد متصلة' });
      if (!online(targetId)) return typeof ack === 'function' && ack({ ok: false, message: 'المستخدم غير متصل الآن' });

      let session = calls.get(groupId);
      if (!session) session = calls.create(groupId, selfId, baseUserId, type);
      if (!session || session.hostId !== selfId || session.type !== type) return typeof ack === 'function' && ack({ ok: false, message: 'جلسة المكالمة الجماعية غير صالحة' });
      calls.ready(groupId, selfId, socket.id);
      if (!calls.invite(groupId, targetId)) return typeof ack === 'function' && ack({ ok: false, message: 'هذا المستخدم مضاف أو لديه دعوة قائمة' });

      io.to(room(baseUserId)).emit('call-group:upgrade', {
        groupId, hostId: selfId, hostName: displayName(socket.user), type, baseUserId: selfId
      });
      io.to(room(targetId)).emit('call-group:invite', {
        groupId, from: selfId, callerName: displayName(socket.user), type, baseUserId
      });
      if (typeof ack === 'function') ack({ ok: true, groupId });
    });

    socket.on('call-group:ready', (payload = {}, ack) => {
      const groupId = String(payload.groupId || '');
      const ok = calls.ready(groupId, selfId, socket.id);
      if (typeof ack === 'function') ack({ ok });
    });

    socket.on('call-group:accept', (payload = {}, ack) => {
      const groupId = String(payload.groupId || '');
      const session = calls.get(groupId);
      if (!session || !calls.accept(groupId, selfId, socket.id)) return typeof ack === 'function' && ack({ ok: false, message: 'الدعوة لم تعد متاحة' });
      const existing = Array.from(session.participants.keys()).filter((id) => id !== selfId);
      for (const peerId of existing) {
        io.to(room(peerId)).emit('call-group:peer', { groupId, peerId: selfId, initiator: true, type: session.type });
        io.to(room(selfId)).emit('call-group:peer', { groupId, peerId, initiator: false, type: session.type });
      }
      for (const id of session.participants.keys()) {
        io.to(room(id)).emit('call-group:participants', { groupId, participants: Array.from(session.participants.keys()), type: session.type });
      }
      if (typeof ack === 'function') ack({ ok: true, participants: Array.from(session.participants.keys()) });
    });

    socket.on('call-group:reject', (payload = {}, ack) => {
      const groupId = String(payload.groupId || '');
      const session = calls.get(groupId);
      const ok = calls.reject(groupId, selfId);
      if (ok && session) io.to(room(session.hostId)).emit('call-group:rejected', { groupId, userId: selfId });
      if (typeof ack === 'function') ack({ ok });
    });

    socket.on('call-group:leave', (payload = {}, ack) => {
      const groupId = String(payload.groupId || '');
      const session = calls.get(groupId);
      if (!session || !calls.hasParticipant(groupId, selfId)) return typeof ack === 'function' && ack({ ok: false });
      const others = Array.from(session.participants.keys()).filter((id) => id !== selfId);
      const wasHost = session.hostId === selfId;
      calls.remove(groupId, selfId);
      for (const id of others) io.to(room(id)).emit(wasHost ? 'call-group:end' : 'call-group:left', { groupId, userId: selfId });
      if (typeof ack === 'function') ack({ ok: true });
    });

    const relay = (event) => (payload = {}, ack) => {
      const groupId = String(payload.groupId || ''), peerId = String(payload.userId || '');
      const session = calls.get(groupId);
      if (!session || !session.participants.has(selfId) || !session.participants.has(peerId) || peerId === selfId) {
        return typeof ack === 'function' && ack({ ok: false });
      }
      io.to(room(peerId)).emit(event, { groupId, from: selfId, data: payload.data, type: session.type });
      if (typeof ack === 'function') ack({ ok: true });
    };
    socket.on('webrtc:call-group-offer', relay('webrtc:call-group-offer'));
    socket.on('webrtc:call-group-answer', relay('webrtc:call-group-answer'));
    socket.on('webrtc:call-group-ice', relay('webrtc:call-group-ice'));

    const pending = calls.pendingFor(selfId);
    if (pending) {
      User.findById(pending.hostId).then((host) => {
        socket.emit('call-group:invite', {
          groupId: pending.groupId,
          from: pending.hostId,
          callerName: displayName(host),
          type: pending.type,
          replay: true
        });
      }).catch(() => {});
    }

    socket.on('disconnect', () => {
      for (const session of Array.from(calls.sessions.values())) {
        if (session.participants.get(selfId) !== socket.id) continue;
        const others = Array.from(session.participants.keys()).filter((id) => id !== selfId);
        const wasHost = session.hostId === selfId;
        calls.remove(session.groupId, selfId);
        for (const id of others) io.to(room(id)).emit(wasHost ? 'call-group:end' : 'call-group:left', { groupId: session.groupId, userId: selfId, reason: 'disconnected' });
      }
    });
  });

  return calls;
}

module.exports = { attachGroupCalls, AdHocGroupCallRegistry };
