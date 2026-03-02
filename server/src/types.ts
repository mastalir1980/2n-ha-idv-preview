// ---------------------------------------------------------------------------
// Shared type definitions for 2N Panel Bridge server
// ---------------------------------------------------------------------------

/** Persisted configuration stored in ./data/config.json */
export interface Config {
  /** Home Assistant base URL, e.g. http://192.168.88.28:8123 */
  haBaseUrl: string;
  /**
   * Home Assistant Long-Lived Access Token.
   * ⚠️  Stored as plain text – prototype / LAN-only use.
   */
  token: string;
  /** Entity IDs the user has selected for the dashboard */
  selectedEntityIds: string[];
}

/** The subset of Config returned to the browser (token excluded) */
export interface PublicConfig {
  haBaseUrl: string;
  selectedEntityIds: string[];
}

// -- WebSocket envelope types sent from server to browser -------------------

export interface HaEventEnvelope {
  type: "ha_event";
  event: unknown; // raw HA state_changed event
}

export interface StatusEnvelope {
  type: "status";
  haWs: HaWsStatus;
}

export type HaWsStatus = "connected" | "reconnecting" | "disconnected";

export type ServerEnvelope = HaEventEnvelope | StatusEnvelope;
