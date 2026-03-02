// ---------------------------------------------------------------------------
// Home Assistant WebSocket connection manager
//
// Connects to the HA WS API, authenticates, subscribes to state_changed
// events, and emits them through callbacks.  Reconnects with exponential
// backoff on disconnect.
// ---------------------------------------------------------------------------

import WebSocket from "ws";
import type { HaWsStatus } from "../types.js";

export type HaEventCallback = (event: unknown) => void;
export type HaStatusCallback = (status: HaWsStatus) => void;

interface HaSocketOptions {
  /** Full WS URL, e.g. ws://192.168.88.28:8123/api/websocket */
  url: string;
  /** Long-lived access token */
  token: string;
}

const MIN_BACKOFF = 1_000;   // 1 s
const MAX_BACKOFF = 30_000;  // 30 s

export class HaSocket {
  private ws: WebSocket | null = null;
  private opts: HaSocketOptions | null = null;
  private eventCb: HaEventCallback | null = null;
  private statusCb: HaStatusCallback | null = null;
  private status: HaWsStatus = "disconnected";
  private backoff = MIN_BACKOFF;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private msgId = 0;

  // ------- public API -------------------------------------------------------

  /** Register a callback for HA state_changed events. */
  onEvent(cb: HaEventCallback): void {
    this.eventCb = cb;
  }

  /** Register a callback for connection status changes. */
  onStatus(cb: HaStatusCallback): void {
    this.statusCb = cb;
  }

  /** Current connection status. */
  getStatus(): HaWsStatus {
    return this.status;
  }

  /** Connect (or reconnect) to Home Assistant. */
  connect(url: string, token: string): void {
    this.destroyed = false;
    this.opts = { url, token };
    this.backoff = MIN_BACKOFF;
    this.doConnect();
  }

  /** Cleanly disconnect and stop reconnecting. */
  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  // ------- internal ---------------------------------------------------------

  private doConnect(): void {
    if (this.destroyed || !this.opts) return;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.setStatus("reconnecting");
    this.msgId = 0;

    const ws = new WebSocket(this.opts.url);
    this.ws = ws;

    ws.on("open", () => {
      console.log("[HA-WS] Connection opened");
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on("close", () => {
      console.log("[HA-WS] Connection closed");
      this.scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[HA-WS] Error:", err.message);
      // 'close' will fire after this
    });
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case "auth_required":
        // Send authentication
        this.ws?.send(JSON.stringify({ type: "auth", access_token: this.opts!.token }));
        break;

      case "auth_ok":
        console.log("[HA-WS] Authenticated");
        this.backoff = MIN_BACKOFF;
        this.setStatus("connected");
        // Subscribe to state_changed events
        this.msgId += 1;
        this.ws?.send(
          JSON.stringify({ id: this.msgId, type: "subscribe_events", event_type: "state_changed" })
        );
        break;

      case "auth_invalid":
        console.error("[HA-WS] Auth invalid:", msg.message);
        this.setStatus("disconnected");
        // Don't reconnect on auth failure – token is wrong
        this.destroyed = true;
        this.ws?.close();
        break;

      case "event":
        this.eventCb?.(msg.event);
        break;

      case "result":
        if (!msg.success) {
          console.warn("[HA-WS] Command failed:", msg.error);
        }
        break;

      default:
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed) {
      this.setStatus("disconnected");
      return;
    }
    this.setStatus("reconnecting");
    console.log(`[HA-WS] Reconnecting in ${this.backoff}ms…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
  }

  private setStatus(s: HaWsStatus): void {
    if (s !== this.status) {
      this.status = s;
      this.statusCb?.(s);
    }
  }
}
