'use strict';

// ICE configuration for REAL CLASSROOM V1 WebRTC peers: the same env-driven
// STUN/TURN policy as the Canva classroom config (school-canva.routes.js) —
// STUN by default, TURN only when configured server-side (Oracle env). No
// credentials are ever hard-coded in the frontend.
const { canvaIntegrationConfig } = require('../routes/school-canva.routes');

function iceServers(env) {
  const cfg = canvaIntegrationConfig(env || process.env);
  return [{ urls: cfg.stunUrl }].concat(cfg.turnServers || []);
}

module.exports = { iceServers };
