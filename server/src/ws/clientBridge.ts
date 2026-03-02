// ---------------------------------------------------------------------------
// Client WebSocket bridge
//
// Accepts browser WS connections on /ws and forwards filtered HA events
// and connection-status messages to them.
// ---------------------------------------------------------------------------

import { type Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { HaSocket } from "./haSocket.js";
import { getSelectedEntityIds } from "../config.js";
import type { ServerEnvelope, HaWsStatus } from "../types.js";

const clients = new Set<WebSocket>();
let haSocket: HaSocket | null = null;

/**
 * Initialise the client bridge.
 * @param server  The Node HTTP server (used for WS upgrade on /ws)
 */
export function initClientBridge(server: HttpServer): HaSocket {
  const wss = new WebSocketServer({ server, path: "/ws" });

  const ha = new HaSocket();
  haSocket = ha;

  // --- HA event handler: filter by selectedEntityIds, broadcast ----------
  ha.onEvent((event: any) => {
    const entityId: string | undefined =
      event?.data?.new_state?.entity_id ?? event?.data?.entity_id;
    if (!entityId) return;

    const selected = getSelectedEntityIds();
    if (!selected.has(entityId)) return;

    broadcast({ type: "ha_event", event });
  });

  // --- HA status handler: broadcast to all browsers ----------------------
  ha.onStatus((status: HaWsStatus) => {
    broadcast({ type: "status", haWs: status });
  });

  // --- Browser connections ------------------------------------------------
  wss.on("connection", (ws) => {
    clients.add(ws);

    // Immediately tell the new client the current HA WS status
    send(ws, { type: "status", haWs: ha.getStatus() });

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  return ha;
}

/** Get the active HaSocket instance (for starting connection from index). */
export function getHaSocket(): HaSocket | null {
  return haSocket;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcast(envelope: ServerEnvelope): void {
  const json = JSON.stringify(envelope);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

function send(ws: WebSocket, envelope: ServerEnvelope): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(envelope));
  }
}
