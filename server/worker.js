/**
 * Endless Sheet — presence relay (Cloudflare Worker + Durable Object)
 *
 * It holds no game state. Every socket in a room gets a short id, and anything
 * one client sends is forwarded to the others untouched. Positions, names and
 * looks live in the clients; nothing is stored, nothing is persisted.
 *
 * Deploy from the Cloudflare dashboard:
 *   Workers & Pages → Create → Worker → paste this → Deploy
 *   Settings → Bindings → add a Durable Object binding named ROOM,
 *   class name Room, then Deploy again.
 *
 * The client connects to  wss://<your-worker>.workers.dev/room/<name>
 */

const MAX_PEERS = 16;                       // a few friends, not a public server

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("endless-sheet relay: connect to /room/<name>", {
        headers: { "content-type": "text/plain" }
      });
    }

    const match = url.pathname.match(/^\/room\/([\w-]{1,32})$/);
    if (!match) return new Response("not found", { status: 404 });

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    // one Durable Object per room name = one place every socket in that room meets
    const id = env.ROOM.idFromName(match[1]);
    return env.ROOM.get(id).fetch(request);
  }
};

export class Room {
  constructor(state) {
    this.state = state;
    this.peers = new Map();                 // ws -> id
    this.nextId = 1;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  accept(ws) {
    if (this.peers.size >= MAX_PEERS) {
      ws.accept();
      ws.send(JSON.stringify({ t: "full" }));
      ws.close(1013, "room full");
      return;
    }

    ws.accept();
    const id = String(this.nextId++);
    this.peers.set(ws, id);

    ws.send(JSON.stringify({ t: "hello", id, peers: [...this.peers.values()].filter(p => p !== id) }));
    this.broadcast({ t: "join", id }, ws);

    ws.addEventListener("message", ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg !== "object") return;
      msg.id = id;                          // the sender never gets to pick who it is
      this.broadcast(msg, ws);
    });

    const bye = () => {
      if (!this.peers.has(ws)) return;
      this.peers.delete(ws);
      this.broadcast({ t: "left", id }, ws);
    };
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
  }

  broadcast(obj, except) {
    const data = JSON.stringify(obj);
    for (const [ws] of this.peers) {
      if (ws === except) continue;
      try { ws.send(data); } catch (e) { /* dropped sockets clean up on close */ }
    }
  }
}
