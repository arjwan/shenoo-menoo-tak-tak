const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const Message = require('../src/models/Message');
const upload = require('../src/middleware/upload');
const { PrivateCallRegistry } = require('../src/socket');

const id = () => new mongoose.Types.ObjectId();

test('private message accepts supported attachment metadata', () => {
  const message = new Message({
    conversation: id(), sender: id(), type: 'image',
    attachment: { url: '/uploads/photo.png', name: 'photo.png', mimeType: 'image/png', size: 1024 }
  });
  assert.equal(message.validateSync(), undefined);
});

test('private message rejects oversized attachment metadata', () => {
  const message = new Message({
    conversation: id(), sender: id(), type: 'file',
    attachment: { url: '/uploads/file.pdf', name: 'file.pdf', mimeType: 'application/pdf', size: 11 * 1024 * 1024 }
  });
  assert.ok(message.validateSync()?.errors['attachment.size']);
});

test('call registry rejects duplicate and simultaneous calls', () => {
  const calls = new PrivateCallRegistry();
  const first = { callId: 'call-1', callerId: 'a', calleeId: 'b', conversationId: 'c1', type: 'audio' };
  assert.equal(calls.invite(first), true);
  assert.equal(calls.invite(first), false);
  assert.equal(calls.invite({ ...first, callId: 'call-2', calleeId: 'c' }), false);
  assert.equal(calls.invite({ ...first, callId: 'call-3', callerId: 'c' }), false);
});

test('call registry enforces ringing, accepted and cleanup lifecycle', () => {
  const calls = new PrivateCallRegistry();
  calls.invite({ callId: 'call-1', callerId: 'a', calleeId: 'b', conversationId: 'c1', type: 'video' });
  assert.equal(calls.get('call-1').state, 'ringing');
  assert.equal(calls.accept('call-1', 'socket-b'), true);
  assert.equal(calls.get('call-1').calleeSocketId, 'socket-b');
  assert.equal(calls.accept('call-1', 'socket-b'), false);
  assert.equal(calls.forUser('b').callId, 'call-1');
  assert.equal(calls.end('call-1').state, 'accepted');
  assert.equal(calls.forUser('a'), null);
  assert.equal(calls.forUser('b'), null);
});

test('stored attachment validation checks content signature, not MIME alone', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'shno-message-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const validPath = path.join(directory, 'valid.pdf');
  const fakePath = path.join(directory, 'fake.pdf');
  await fs.writeFile(validPath, Buffer.from('%PDF-1.7\n'));
  await fs.writeFile(fakePath, Buffer.from('not a pdf'));
  assert.equal(await upload.validateStoredFile({ path: validPath, mimetype: 'application/pdf', size: 9 }), true);
  assert.equal(await upload.validateStoredFile({ path: fakePath, mimetype: 'application/pdf', size: 9 }), false);
});
