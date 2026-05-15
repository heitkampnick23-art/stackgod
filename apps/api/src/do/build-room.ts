// Durable Object: one BuildRoom instance per app_id.
// Holds the WebSocket connections of everyone currently editing that app and
// broadcasts presence + cursor messages between them. State is purely in-memory
// — peer set rebuilds itself on next connection.

interface PeerMeta { id: string; name: string; color: string; avatar?: string | null; }
interface ClientState { meta: PeerMeta; ws: WebSocket; lastSeen: number; }

export class BuildRoom implements DurableObject {
  state: DurableObjectState;
  clients = new Map<WebSocket, ClientState>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 400 });
    const url = new URL(req.url);
    const meta: PeerMeta = {
      id:     url.searchParams.get('id')     || crypto.randomUUID().slice(0, 8),
      name:   url.searchParams.get('name')   || 'Anonymous',
      color:  url.searchParams.get('color')  || pickColor(),
      avatar: url.searchParams.get('avatar') || null,
    };

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.clients.set(server, { meta, ws: server, lastSeen: Date.now() });

    // Send the joiner the current peer list (excluding themselves).
    const others: PeerMeta[] = [];
    for (const c of this.clients.values()) if (c.ws !== server) others.push(c.meta);
    server.send(JSON.stringify({ kind: 'welcome', you: meta, peers: others }));

    // Tell existing peers someone joined.
    this.broadcast({ kind: 'join', peer: meta }, server);

    server.addEventListener('message', (ev) => {
      let msg: Record<string, unknown> = {};
      try { msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : {}; } catch { return; }
      const c = this.clients.get(server);
      if (!c) return;
      c.lastSeen = Date.now();

      // Annotate every outgoing message with the sender's stable id so the
      // client can render the right name/color without trusting the wire.
      const out = { ...msg, from: c.meta.id };

      // Clamp + sanitize what we'll relay.
      if (msg.kind === 'cursor' || msg.kind === 'select' || msg.kind === 'typing' || msg.kind === 'preview' || msg.kind === 'reaction') {
        this.broadcast(out, server);
      } else if (msg.kind === 'ping') {
        try { server.send(JSON.stringify({ kind: 'pong' })); } catch { /* */ }
      }
    });

    const close = () => {
      this.clients.delete(server);
      this.broadcast({ kind: 'leave', peer: meta });
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(msg: unknown, exclude?: WebSocket): void {
    const text = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.ws === exclude) continue;
      try { c.ws.send(text); } catch { /* */ }
    }
  }
}

const COLORS = ['#ff5b1f', '#d4af37', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#f43f5e'];
function pickColor(): string { return COLORS[Math.floor(Math.random() * COLORS.length)]; }
