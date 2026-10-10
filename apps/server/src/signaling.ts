import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

// Signalisation WebRTC pour la page de visio de secours (plan B).
// Le serveur ne fait que relayer les messages entre les deux pairs d'une salle : la vidéo passe en pair à pair.
export function attachSignaling(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const rooms = new Map<string, Set<WebSocket>>();

  wss.on('connection', (socket) => {
    let room: string | null = null;

    socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'join') {
        const peers = rooms.get(msg.room) ?? new Set<WebSocket>();
        if (peers.size >= 2) {
          socket.send(JSON.stringify({ type: 'room-full' }));
          return;
        }
        room = msg.room as string;
        peers.add(socket);
        rooms.set(room, peers);
        broadcast(peers, socket, { type: 'peer-joined', role: msg.role });
        return;
      }

      if (room) broadcast(rooms.get(room)!, socket, msg);
    });

    socket.on('close', () => {
      if (!room) return;
      const peers = rooms.get(room);
      peers?.delete(socket);
      if (peers && peers.size === 0) rooms.delete(room);
      else if (peers) broadcast(peers, socket, { type: 'peer-left' });
    });
  });
}

function broadcast(peers: Set<WebSocket>, from: WebSocket, msg: unknown): void {
  const data = JSON.stringify(msg);
  for (const peer of peers) {
    if (peer !== from && peer.readyState === WebSocket.OPEN) peer.send(data);
  }
}
