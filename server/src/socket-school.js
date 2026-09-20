'use strict';

// Socket.IO layer for Shno Mano virtual school classrooms (Canva school
// integration). Attached to the existing authenticated io instance
// (server.js), so the global io.use JWT middleware is inherited: every
// classroom handler only ever sees socket.user of a real active account.
//
// Event contract (client -> server / server -> client):
//   school:join          { roomId }                      -> ack { ok, roomId, joined, participants, you }
//   school:leave         { roomId }                      -> ack { ok, roomId, participants }
//   school:heartbeat     {}                              -> ack { ok, serverTime }
//   school:live          { roomId, kind, text? }         -> broadcast school:live { roomId, kind, text, from, name, at }
//   school:webrtc:offer  { roomId, offer }               -> relay to room (except sender) as school:webrtc:offer { roomId, offer, from }
//   school:webrtc:answer { roomId, answer }              -> relay as school:webrtc:answer { roomId, answer, from }
//   school:webrtc:ice    { roomId, candidate }           -> relay as school:webrtc:ice { roomId, candidate, from }
//   school:participants  { roomId, participants, left? } -> broadcast on membership change
//
// The Canva original speaks a raw WebSocket envelope; the external adapter
// (school-canva-adapter.js) translates each envelope to these Socket.IO
// events and back, so signaling stays on the authenticated socket while the
// original file remains byte-identical.

const { createClassroomRegistry } = require('./services/school-classroom');

function attachSchoolSocket(io) {
  const classrooms = createClassroomRegistry();
  io.__schoolClassrooms = classrooms; // diagnostics/tests handle

  io.on('connection', (socket) => {
    const user = socket.user;
    const namespace = (roomId) => `school-classroom:${roomId}`;

    socket.on('school:join', (payload = {}, ack) => {
      const result = classrooms.join(payload.roomId, user, socket.id);
      if (!result.ok) return typeof ack === 'function' && ack({ ok: false, error: result.error });
      socket.join(namespace(result.roomId));
      io.to(namespace(result.roomId)).emit('school:participants', {
        roomId: result.roomId,
        participants: result.participants
      });
      if (typeof ack === 'function') {
        ack({ ok: true, roomId: result.roomId, joined: result.joined, participants: result.participants, you: result.participant });
      }
    });

    socket.on('school:leave', (payload = {}, ack) => {
      const result = classrooms.leave(payload.roomId, user._id, socket.id);
      if (!result.ok) return typeof ack === 'function' && ack({ ok: false, error: result.error });
      socket.leave(namespace(result.roomId));
      if (result.removed) {
        io.to(namespace(result.roomId)).emit('school:participants', {
          roomId: result.roomId,
          participants: result.participants,
          left: String(user._id)
        });
      }
      if (typeof ack === 'function') ack({ ok: true, roomId: result.roomId, participants: result.participants });
    });

    socket.on('school:heartbeat', (_payload, ack) => {
      if (typeof ack === 'function') ack({ ok: true, serverTime: new Date().toISOString() });
    });

    socket.on('school:live', (payload = {}, ack) => {
      const roomId = classrooms.normalizeRoomId(payload.roomId);
      const kind = String(payload.kind || '').toLowerCase();
      if (!roomId || !classrooms.isMember(roomId, user._id) || !classrooms.isLiveKind(kind)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'forbidden' });
      }
      io.to(namespace(roomId)).except(socket.id).emit('school:live', {
        roomId,
        kind,
        text: String(payload.text || '').slice(0, 500),
        from: String(user._id),
        name: user.displayName || user.fullName || user.username || '',
        at: new Date().toISOString()
      });
      if (typeof ack === 'function') ack({ ok: true });
    });

    const relay = (event, field) => (payload = {}, ack) => {
      const roomId = classrooms.normalizeRoomId(payload.roomId);
      const value = payload ? payload[field] : undefined;
      if (!roomId || value === undefined || value === null || !classrooms.isMember(roomId, user._id)) {
        return typeof ack === 'function' && ack({ ok: false, error: 'forbidden' });
      }
      io.to(namespace(roomId)).except(socket.id).emit(event, { roomId, [field]: value, from: String(user._id) });
      if (typeof ack === 'function') ack({ ok: true });
    };

    socket.on('school:webrtc:offer', relay('school:webrtc:offer', 'offer'));
    socket.on('school:webrtc:answer', relay('school:webrtc:answer', 'answer'));
    socket.on('school:webrtc:ice', relay('school:webrtc:ice', 'candidate'));

    socket.on('disconnect', () => {
      const affected = classrooms.removeSocket(user._id, socket.id);
      for (const roomId of affected) {
        io.to(namespace(roomId)).emit('school:participants', {
          roomId,
          participants: classrooms.participants(roomId),
          left: String(user._id)
        });
      }
    });
  });

  return classrooms;
}

module.exports = { attachSchoolSocket };
