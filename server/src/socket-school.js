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

//
// REAL CLASSROOM V1 (DB-backed live classrooms, models/SchoolClassroom):
//   school:classroom:join    { code }                       -> ack { ok, classroom, you, room, iceServers }; presence online
//   school:classroom:leave   { code }                       -> ack { ok }; presence offline
//   school:classroom:media   { code, camera, mic }          -> ack { ok, media, forced[] } (server can only force OFF)
//   school:classroom:signal  { code, to, type, data }       -> relayed ONLY to that account's sockets inside the room,
//                                                              and only teacher<->student of the same live classroom
//   disconnect                                              -> presence offline for every live classroom of the socket
// Server -> clients: school:classroom:update / peer / hand / mute / kicked / ended / signal
// (see services/school-live-events.js). No media ever reaches the server.

const { createClassroomRegistry } = require('./services/school-classroom');
const Classroom = require('./models/SchoolClassroom');
const VirtualSession = require('./models/VirtualClassroomSession');
const live = require('./services/school-live-classroom');
const vsvc = require('./services/school-virtual-classroom');
const events = require('./services/school-live-events');
const { iceServers } = require('./services/school-live-ice');

function attachSchoolSocket(io) {
  const classrooms = createClassroomRegistry();
  io.__schoolClassrooms = classrooms; // diagnostics/tests handle
  // Presence of live classrooms: which sockets of which account are inside
  // which classroom room (a member stays online until their last socket goes).
  const presence = createClassroomRegistry();
  io.__schoolLivePresence = presence;
  const virtualPresence = createClassroomRegistry();
  io.__schoolVirtualPresence = virtualPresence;

  const ack = (fn, payload) => { if (typeof fn === 'function') fn(payload); };

  io.on('connection', (socket) => {
    const user = socket.user;
    const namespace = (roomId) => `school-classroom:${roomId}`;
    // Per-account room: targeted delivery (signals, kick) without touching socket.js.
    socket.join(events.userRoom(user._id));

    async function loadLive(code) {
      const normalized = live.normalizeCode(code);
      if (!normalized) return { error: 'رمز الحصة غير صالح' };
      const classroom = await Classroom.findOne({ code: normalized });
      if (!classroom) return { error: 'لا توجد حصة بهذا الرمز' };
      return { classroom };
    }

    async function goOffline(classroom) {
      const result = live.setOnline(classroom, user._id, false);
      if (result.ok && result.changed) {
        await classroom.save();
        events.emitToRoom(io, classroom, 'school:classroom:peer', { userId: String(user._id), role: result.participant.role, name: result.participant.name, online: false });
        events.emitUpdate(io, classroom);
      }
    }

    socket.on('school:classroom:join', async (payload = {}, done) => {
      try {
        const { classroom, error } = await loadLive(payload.code);
        if (error) return ack(done, { ok: false, error });
        const result = live.setOnline(classroom, user._id, true);
        if (!result.ok) return ack(done, { ok: false, error: result.error, status: result.status });
        const room = live.roomName(classroom);
        presence.join(room, user, socket.id);
        socket.join(room);
        if (result.changed) {
          await classroom.save();
          socket.to(room).emit('school:classroom:peer', { code: classroom.code, userId: String(user._id), role: result.participant.role, name: result.participant.name, online: true });
        }
        events.emitUpdate(io, classroom);
        ack(done, { ok: true, code: classroom.code, room, you: live.publicParticipant(result.participant), classroom: live.publicClassroom(classroom, { roster: true }), iceServers: iceServers() });
      } catch (e) { ack(done, { ok: false, error: e.message || 'تعذر الانضمام' }); }
    });

    socket.on('school:classroom:leave', async (payload = {}, done) => {
      try {
        const { classroom, error } = await loadLive(payload.code);
        if (error) return ack(done, { ok: false, error });
        const room = live.roomName(classroom);
        presence.leave(room, user._id, socket.id);
        socket.leave(room);
        // Offline once no socket of this account remains in the classroom.
        if (!presence.isMember(room, user._id)) await goOffline(classroom);
        ack(done, { ok: true, code: classroom.code });
      } catch (e) { ack(done, { ok: false, error: e.message || 'تعذر المغادرة' }); }
    });

    socket.on('school:classroom:media', async (payload = {}, done) => {
      try {
        const { classroom, error } = await loadLive(payload.code);
        if (error) return ack(done, { ok: false, error });
        if (!presence.isMember(live.roomName(classroom), user._id)) return ack(done, { ok: false, error: 'انضم إلى الحصة أولاً', status: 403 });
        const result = live.setMedia(classroom, user._id, { camera: payload.camera, mic: payload.mic });
        if (!result.ok) return ack(done, { ok: false, error: result.error, status: result.status });
        if (result.changed) {
          await classroom.save();
          events.emitUpdate(io, classroom);
        }
        ack(done, { ok: true, media: result.media, forced: result.forced });
      } catch (e) { ack(done, { ok: false, error: e.message || 'تعذر تحديث الحالة' }); }
    });

    socket.on('school:classroom:signal', async (payload = {}, done) => {
      try {
        const code = live.normalizeCode(payload.code);
        const to = String(payload.to || '');
        const type = String(payload.type || '');
        if (!code || !to || payload.data === undefined || payload.data === null) return ack(done, { ok: false, error: 'forbidden' });
        // Source of truth is the persisted classroom (roles, presence, kicked,
        // ended); the in-memory presence must agree for BOTH ends.
        const classroom = await Classroom.findOne({ code }).lean();
        if (!classroom || !live.canSignal(classroom, user._id, to, type)) return ack(done, { ok: false, error: 'forbidden' });
        const liveRoom = live.roomName(classroom);
        if (!presence.isMember(liveRoom, user._id) || !presence.isMember(liveRoom, to)) return ack(done, { ok: false, error: 'forbidden' });
        const targets = await events.socketsOfUserInRoom(io, classroom, to);
        for (const s of targets) s.emit('school:classroom:signal', { code, from: String(user._id), type, data: payload.data });
        ack(done, { ok: true, delivered: targets.length });
      } catch (e) { ack(done, { ok: false, error: 'forbidden' }); }
    });

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

    // Virtual Classroom V1 handlers:
    const virtualRoom = (code) => `virtual:${vsvc.normalizeCode(code)}`;

    socket.on('school:virtual:join', async (payload = {}, done) => {
      try {
        const code = vsvc.normalizeCode(payload.code);
        if (!code) return ack(done, { ok: false, error: 'رمز الحصة غير صالح' });
        const session = await VirtualSession.findOne({ code });
        if (!session) return ack(done, { ok: false, error: 'لا توجد حصة بهذا الرمز' });
        const p = vsvc.findParticipant(session, user._id);
        if (!p) return ack(done, { ok: false, error: 'انضم إلى الحصة عبر النظام أولاً' });
        const room = virtualRoom(code);
        virtualPresence.join(room, user, socket.id);
        socket.join(room);
        const res = vsvc.setOnline(session, user._id, true);
        if (res.changed) {
          await session.save();
          io.to(room).emit('school:virtual:update', { code, session: vsvc.publicSession(session, { roster: true }) });
        }
        ack(done, { ok: true, code, session: vsvc.publicSession(session, { roster: true }), you: vsvc.publicParticipant(p) });
      } catch (e) { ack(done, { ok: false, error: e.message || 'تعذر الانضمام' }); }
    });

    socket.on('school:virtual:leave', async (payload = {}, done) => {
      try {
        const code = vsvc.normalizeCode(payload.code);
        if (!code) return ack(done, { ok: false, error: 'رمز الحصة غير صالح' });
        const room = virtualRoom(code);
        virtualPresence.leave(room, user._id, socket.id);
        socket.leave(room);
        if (!virtualPresence.isMember(room, user._id)) {
          const session = await VirtualSession.findOne({ code });
          if (session) {
            const res = vsvc.setOnline(session, user._id, false);
            if (res.changed) {
              await session.save();
              io.to(room).emit('school:virtual:update', { code, session: vsvc.publicSession(session, { roster: true }) });
            }
          }
        }
        ack(done, { ok: true, code });
      } catch (e) { ack(done, { ok: false, error: e.message || 'تعذر المغادرة' }); }
    });

    socket.on('school:virtual:whiteboard', async (payload = {}, done) => {
      try {
        const code = vsvc.normalizeCode(payload.code);
        if (!code) return ack(done, { ok: false, error: 'رمز غير صالح' });
        const session = await VirtualSession.findOne({ code });
        if (!session || !vsvc.canManage(session, user)) return ack(done, { ok: false, error: 'forbidden' });
        if (payload.drawing !== undefined) {
          const idx = session.whiteboardData?.currentSlide || 0;
          if (session.whiteboardData?.slides?.[idx]) {
            session.whiteboardData.slides[idx].drawing = String(payload.drawing).slice(0, 500000);
          }
        }
        if (typeof payload.currentSlide === 'number') {
          session.whiteboardData.currentSlide = payload.currentSlide;
        }
        await session.save();
        io.to(virtualRoom(code)).emit('school:virtual:whiteboard', { code, whiteboardData: session.whiteboardData });
        ack(done, { ok: true });
      } catch (e) { ack(done, { ok: false, error: 'forbidden' }); }
    });

    socket.on('disconnect', async () => {
      const affected = classrooms.removeSocket(user._id, socket.id);
      for (const roomId of affected) {
        io.to(namespace(roomId)).emit('school:participants', {
          roomId,
          participants: classrooms.participants(roomId),
          left: String(user._id)
        });
      }
      // Live classrooms: the account goes offline once its last socket is gone.
      const liveRooms = presence.removeSocket(user._id, socket.id);
      for (const room of liveRooms) {
        const id = String(room).replace(/^live:/, '');
        try {
          const classroom = await Classroom.findById(id);
          if (classroom) await goOffline(classroom);
        } catch (e) { /* presence cleanup is best-effort on disconnect */ }
      }
      // Virtual classrooms cleanup:
      const vRooms = virtualPresence.removeSocket(user._id, socket.id);
      for (const room of vRooms) {
        const code = String(room).replace(/^virtual:/, '');
        try {
          const session = await VirtualSession.findOne({ code });
          if (session) {
            const res = vsvc.setOnline(session, user._id, false);
            if (res.changed) {
              await session.save();
              io.to(room).emit('school:virtual:update', { code, session: vsvc.publicSession(session, { roster: true }) });
            }
          }
        } catch (e) { /* presence cleanup is best-effort */ }
      }
    });
  });

  return classrooms;
}

module.exports = { attachSchoolSocket };
