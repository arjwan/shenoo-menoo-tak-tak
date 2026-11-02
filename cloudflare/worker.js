import { Container, getContainer } from "@cloudflare/containers";

/**
 * Runs the original Node/Express application in a Cloudflare Container.
 * The complete Express app remains intact; HTTP and WebSocket upgrades
 * (including Socket.IO) are forwarded to the same Node process.
 */
export class ShenoManoApp extends Container {
  defaultPort = 3000;
  sleepAfter = "15m";
}

export default {
  async fetch(request, env) {
    const instance = getContainer(env.SHENO_MANO_APP, "production");
    return instance.fetch(request);
  },
};
