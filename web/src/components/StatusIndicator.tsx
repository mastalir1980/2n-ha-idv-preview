// ---------------------------------------------------------------------------
// StatusIndicator – shows HA WebSocket connection status
// ---------------------------------------------------------------------------

import type { HaWsStatus } from "../hooks/useWebSocket";

interface Props {
  haWsStatus: HaWsStatus;
  isConnected: boolean;
}

const STATUS_COLORS: Record<HaWsStatus, string> = {
  connected: "#22c55e",
  reconnecting: "#eab308",
  disconnected: "#ef4444",
  unknown: "#94a3b8",
};

const STATUS_LABELS: Record<HaWsStatus, string> = {
  connected: "HA Connected",
  reconnecting: "Reconnecting…",
  disconnected: "HA Disconnected",
  unknown: "Unknown",
};

export function StatusIndicator({ haWsStatus, isConnected }: Props) {
  const color = STATUS_COLORS[haWsStatus];
  const label = STATUS_LABELS[haWsStatus];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <span style={{ fontSize: 13, color: "#ccc" }}>
        {label}
        {!isConnected && " (WS closed)"}
      </span>
    </div>
  );
}
