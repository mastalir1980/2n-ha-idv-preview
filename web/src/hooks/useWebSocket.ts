// ---------------------------------------------------------------------------
// useWebSocket – connects to the server's /ws endpoint, parses envelopes,
// and exposes live entity states + HA connection status.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, useCallback } from "react";

export type HaWsStatus = "connected" | "reconnecting" | "disconnected" | "unknown";

interface StateChangedEvent {
  data: {
    entity_id: string;
    new_state: {
      entity_id: string;
      state: string;
      attributes: Record<string, unknown>;
      last_changed: string;
      last_updated: string;
    } | null;
    old_state: unknown;
  };
}

interface HaEventEnvelope {
  type: "ha_event";
  event: StateChangedEvent;
}

interface StatusEnvelope {
  type: "status";
  haWs: HaWsStatus;
}

type ServerEnvelope = HaEventEnvelope | StatusEnvelope;

export interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface UseWebSocketResult {
  /** Map of entity_id → latest state (updated live). */
  entityStates: Map<string, EntityState>;
  /** HA WebSocket status as reported by the server. */
  haWsStatus: HaWsStatus;
  /** Whether the browser ↔ server WS is open. */
  isConnected: boolean;
}

const RECONNECT_DELAY = 2_000;

export function useWebSocket(): UseWebSocketResult {
  const [entityStates, setEntityStates] = useState<Map<string, EntityState>>(
    () => new Map()
  );
  const [haWsStatus, setHaWsStatus] = useState<HaWsStatus>("unknown");
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerEnvelope;

        if (msg.type === "status") {
          setHaWsStatus(msg.haWs);
        } else if (msg.type === "ha_event") {
          const newState = msg.event?.data?.new_state;
          if (newState) {
            setEntityStates((prev) => {
              const next = new Map(prev);
              next.set(newState.entity_id, {
                entity_id: newState.entity_id,
                state: newState.state,
                attributes: newState.attributes,
              });
              return next;
            });
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      // Auto-reconnect
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      // onclose will follow
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on cleanup
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { entityStates, haWsStatus, isConnected };
}
