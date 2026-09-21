'use strict';

// Socket.IO fan-out helpers for REAL CLASSROOM V1. Both the REST routes and
// the socket handlers publish through these so every client sees one event
// vocabulary:
//   school:classroom:update   { code, classroom (with roster) }   -> room members
//   school:classroom:hand     { code, userId, name, raised }       -> room members
//   school:classroom:mute     { code, userId, muted }              -> room members
//   school:classroom:kicked   { code }                             -> the kicked account only
//   school:classroom:ended    { code, endedAt }                    -> room members
//   school:classroom:peer     { code, userId, role, name, online } -> room members (presence edge)
//   school:classroom:signal   { code, from, type, data }           -> ONE target account inside the room
const { publicClassroom, roomName } = require('./school-live-classroom');

const userRoom = (userId) => `school-user:${String(userId)}`;

function emitUpdate(io, classroom) {
  if (!io) return;
  io.to(roomName(classroom)).emit('school:classroom:update', {
    code: classroom.code,
    classroom: publicClassroom(classroom, { roster: true })
  });
}

function emitToRoom(io, classroom, event, payload) {
  if (!io) return;
  io.to(roomName(classroom)).emit(event, Object.assign({ code: classroom.code }, payload || {}));
}

function emitToUser(io, userId, event, payload) {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload || {});
}

/** Sockets of `userId` that are inside this classroom's room. */
async function socketsOfUserInRoom(io, classroom, userId) {
  if (!io) return [];
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  const room = roomName(classroom);
  return sockets.filter((s) => s.rooms.has(room));
}

/** Force every socket of the account out of the classroom room (kick / end). */
async function evictUser(io, classroom, userId) {
  const sockets = await socketsOfUserInRoom(io, classroom, userId);
  for (const s of sockets) s.leave(roomName(classroom));
  return sockets.length;
}

module.exports = { userRoom, emitUpdate, emitToRoom, emitToUser, socketsOfUserInRoom, evictUser };
