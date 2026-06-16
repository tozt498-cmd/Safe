import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { verifyToken } from '../middleware/auth.js';
import { db } from '../db/index.js';

interface Client {
  socket: WebSocket;
  userId: string;
  email: string;
  role: string;
}

const clients = new Set<Client>();
let wss: WebSocketServer | null = null;

type OutboundMessage =
  | { type: 'welcome'; presence: number }
  | { type: 'presence'; count: number }
  | { type: 'broadcast'; payload: BroadcastPayload };

export interface BroadcastPayload {
  id: string;
  title: string;
  body: string;
  kind: 'info' | 'update' | 'important';
  blocking: boolean;
  createdAt: string;
}

function send(client: Client, msg: OutboundMessage) {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(msg));
  }
}

function presenceCount(): number {
  return clients.size;
}

function broadcastPresence() {
  for (const c of clients) send(c, { type: 'presence', count: presenceCount() });
}

/** Diffuse un message à tous les clients connectés (temps réel). */
export function broadcast(payload: BroadcastPayload) {
  for (const c of clients) send(c, { type: 'broadcast', payload });
}

/** Nombre d'utilisateurs actuellement connectés en temps réel. */
export function onlineCount(): number {
  return presenceCount();
}

export function attachWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token') ?? '';

    let userId: string;
    let hwid: string;
    try {
      const payload = verifyToken(token);
      userId = payload.sub;
      hwid = payload.hwid;
    } catch {
      socket.close(4001, 'Unauthorized');
      return;
    }

    const user = db
      .prepare(`SELECT id, email, role, status, hwid FROM users WHERE id = ?`)
      .get(userId) as
      | { id: string; email: string; role: string; status: string; hwid: string | null }
      | undefined;

    if (!user || user.status !== 'active' || user.hwid !== hwid) {
      socket.close(4003, 'Forbidden');
      return;
    }

    const client: Client = { socket, userId: user.id, email: user.email, role: user.role };
    clients.add(client);

    send(client, { type: 'welcome', presence: presenceCount() });
    broadcastPresence();

    socket.on('close', () => {
      clients.delete(client);
      broadcastPresence();
    });
    socket.on('error', () => {
      clients.delete(client);
    });
  });

  // Ping périodique pour garder les connexions vivantes.
  setInterval(() => {
    for (const c of clients) {
      if (c.socket.readyState === WebSocket.OPEN) c.socket.ping();
    }
  }, 30_000);
}
