'use strict';

// Pure in-memory registry for Shno Mano virtual school classrooms (Canva
// school integration). Deliberately dependency-free (no DB, no I/O) so the
// isolation rules can be unit tested directly. The Socket.IO layer in
// socket-school.js binds authenticated sockets to a registry instance.

const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{3,79}$/;
const LIVE_KINDS = new Set(['raise-hand', 'question', 'answer', 'board-note', 'start', 'end', 'leave']);

function normalizeRoomId(value) {
  const id = String(value == null ? '' : value).trim();
  return ROOM_ID_PATTERN.test(id) ? id : null;
}

function publicMember(member) {
  return {
    id: member.id,
    name: member.name,
    joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : member.joinedAt,
    sockets: member.sockets.size
  };
}

function createClassroomRegistry() {
  const rooms = new Map();

  function room(id) {
    let r = rooms.get(id);
    if (!r) {
      r = { id, members: new Map(), createdAt: new Date() };
      rooms.set(id, r);
    }
    return r;
  }

  const registry = {
    LIVE_KINDS: Array.from(LIVE_KINDS),
    normalizeRoomId,
    isValidRoomId: (value) => normalizeRoomId(value) !== null,
    isLiveKind: (kind) => LIVE_KINDS.has(String(kind || '').toLowerCase()),

    /**
     * Idempotent join: the same user joining twice (e.g. after a reconnect)
     * produces one member entry and only an additional socket handle.
     */
    join(roomIdValue, user, socketId) {
      const id = normalizeRoomId(roomIdValue);
      if (!id || !user || !user._id) return { ok: false, error: 'invalid-room' };
      const r = room(id);
      const userId = String(user._id);
      let member = r.members.get(userId);
      let joined = false;
      if (!member) {
        member = {
          id: userId,
          name: user.displayName || user.fullName || user.username || '',
          joinedAt: new Date(),
          sockets: new Set()
        };
        r.members.set(userId, member);
        joined = true;
      }
      member.sockets.add(String(socketId));
      return {
        ok: true,
        roomId: id,
        joined,
        participant: publicMember(member),
        participants: Array.from(r.members.values()).map(publicMember)
      };
    },

    /**
     * Remove one socket handle; the member stays until their last socket is
     * gone. Returns removed=true when the member fully left the room.
     */
    leave(roomIdValue, userId, socketId) {
      const id = normalizeRoomId(roomIdValue);
      if (!id) return { ok: false, error: 'invalid-room' };
      const r = rooms.get(id);
      const member = r && r.members.get(String(userId));
      if (!r || !member) return { ok: false, error: 'not-a-member', roomId: id };
      member.sockets.delete(String(socketId));
      let removed = false;
      if (member.sockets.size === 0) {
        r.members.delete(member.id);
        removed = true;
        if (r.members.size === 0) rooms.delete(id);
      }
      return {
        ok: true,
        roomId: id,
        removed,
        participants: Array.from(r.members.values()).map(publicMember)
      };
    },

    /** Disconnect path: drop every socket handle of this socket id. */
    removeSocket(userId, socketId) {
      const affected = [];
      const key = String(userId);
      const socketKey = String(socketId);
      for (const [id, r] of Array.from(rooms.entries())) {
        const member = r.members.get(key);
        if (!member || !member.sockets.has(socketKey)) continue;
        member.sockets.delete(socketKey);
        let removed = false;
        if (member.sockets.size === 0) {
          r.members.delete(key);
          removed = true;
        }
        if (r.members.size === 0) {
          rooms.delete(id);
        }
        if (removed) affected.push(id);
      }
      return affected;
    },

    isMember(roomIdValue, userId) {
      const id = normalizeRoomId(roomIdValue);
      if (!id) return false;
      const r = rooms.get(id);
      return Boolean(r && r.members.has(String(userId)));
    },

    participants(roomIdValue) {
      const id = normalizeRoomId(roomIdValue);
      const r = id && rooms.get(id);
      return r ? Array.from(r.members.values()).map(publicMember) : [];
    },

    // Diagnostics (tests/ops only).
    roomIds: () => Array.from(rooms.keys()),
    roomCount: () => rooms.size,
    reset() {
      rooms.clear();
    }
  };

  return registry;
}

module.exports = { createClassroomRegistry, normalizeRoomId, ROOM_ID_PATTERN, LIVE_KINDS: Array.from(LIVE_KINDS) };
