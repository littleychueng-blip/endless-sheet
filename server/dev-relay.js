/**
 * The same relay as worker.js, but plain node — for testing on localhost
 * before the Cloudflare Worker exists.
 *
 *   npm i ws && node server/dev-relay.js
 *   → ws://localhost:8787/room/<name>
 *
 * Not deployed anywhere. The Worker is the real thing.
 */

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8787;
const MAX_PEERS = 16;
const rooms = new Map();

// GET /hold answers slowly on purpose: headless Chrome's virtual clock pauses
// while an HTTP fetch is outstanding, which is the only way to give a real
// WebSocket handshake wall-clock time during an automated screenshot run.
const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/hold")) {
    setTimeout(() => {
      res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
      res.end("ok");
    }, 5000);
    return;
  }
  res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
  res.end("relay up");
});

const wss = new WebSocketServer({ server });
server.listen(PORT);

wss.on("connection", (ws, req) => {
  const m = (req.url || "").match(/^\/room\/([\w-]{1,32})$/);
  if (!m) return ws.close(1008, "bad room");

  const name = m[1];
  if (!rooms.has(name)) rooms.set(name, { peers: new Map(), next: 1 });
  const room = rooms.get(name);

  if (room.peers.size >= MAX_PEERS) {
    ws.send(JSON.stringify({ t: "full" }));
    return ws.close(1013, "room full");
  }

  const id = String(room.next++);
  room.peers.set(ws, id);

  const send = (target, obj) => {
    try { target.send(JSON.stringify(obj)); } catch (e) {}
  };
  const broadcast = (obj, except) => {
    for (const [peer] of room.peers) if (peer !== except) send(peer, obj);
  };

  send(ws, { t: "hello", id, peers: [...room.peers.values()].filter(p => p !== id) });
  broadcast({ t: "join", id }, ws);
  console.log(`[${name}] +${id} (${room.peers.size} online)`);

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== "object") return;
    msg.id = id;
    broadcast(msg, ws);
  });

  const bye = () => {
    if (!room.peers.has(ws)) return;
    room.peers.delete(ws);
    broadcast({ t: "left", id }, ws);
    console.log(`[${name}] -${id} (${room.peers.size} online)`);
    if (!room.peers.size) rooms.delete(name);
  };
  ws.on("close", bye);
  ws.on("error", bye);
});

console.log(`relay listening on ws://localhost:${PORT}/room/<name>`);
