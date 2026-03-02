// ---------------------------------------------------------------------------
// DashboardScreen – live tiles for switches and climate/thermostats
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from "react";
import { callService, type HaEntity } from "../api";
import { StatusIndicator } from "../components/StatusIndicator";
import type { EntityState, UseWebSocketResult } from "../hooks/useWebSocket";

interface Props {
  entities: HaEntity[];
  selectedIds: string[];
  ws: UseWebSocketResult;
  onBack: () => void;
  onSetup: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIMATE_MODES: Record<string, { color: string; label: string }> = {
  heat: { color: "#f97316", label: "Heating" },
  cool: { color: "#38bdf8", label: "Cooling" },
  heat_cool: { color: "#a78bfa", label: "Auto" },
  auto: { color: "#a78bfa", label: "Auto" },
  dry: { color: "#facc15", label: "Dry" },
  fan_only: { color: "#94a3b8", label: "Fan" },
  off: { color: "#64748b", label: "Off" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardScreen({
  entities,
  selectedIds,
  ws,
  onBack,
  onSetup,
}: Props) {
  // Build initial state map from REST snapshot
  const [localStates, setLocalStates] = useState<Map<string, EntityState>>(() => {
    const m = new Map<string, EntityState>();
    for (const e of entities) {
      if (selectedIds.includes(e.entity_id)) {
        m.set(e.entity_id, {
          entity_id: e.entity_id,
          state: e.state,
          attributes: e.attributes,
        });
      }
    }
    return m;
  });

  // Merge incoming WS events into local state
  useEffect(() => {
    setLocalStates((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, es] of ws.entityStates) {
        if (selectedIds.includes(id)) {
          const existing = prev.get(id);
          if (
            !existing ||
            existing.state !== es.state ||
            JSON.stringify(existing.attributes) !== JSON.stringify(es.attributes)
          ) {
            next.set(id, es);
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [ws.entityStates, selectedIds]);

  const [busy, setBusy] = useState<Set<string>>(new Set());
  const markBusy = (id: string) => setBusy((p) => new Set(p).add(id));
  const clearBusy = (id: string) =>
    setBusy((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });

  // -- Switch toggle --------------------------------------------------------
  const handleSwitchToggle = useCallback(
    async (entityId: string, currentState: string) => {
      markBusy(entityId);
      try {
        const service = currentState === "on" ? "turn_off" : "turn_on";
        await callService("switch", service, { entity_id: entityId });
      } catch (err) {
        console.error("Toggle failed:", err);
      } finally {
        clearBusy(entityId);
      }
    },
    []
  );

  // -- Climate: set target temperature -------------------------------------
  const handleSetTemp = useCallback(
    async (entityId: string, delta: number) => {
      const es = localStates.get(entityId);
      const current = Number(es?.attributes?.temperature) || 20;
      const next = Math.round((current + delta) * 2) / 2; // 0.5 steps
      markBusy(entityId);
      try {
        await callService("climate", "set_temperature", {
          entity_id: entityId,
          temperature: next,
        });
      } catch (err) {
        console.error("Set temp failed:", err);
      } finally {
        clearBusy(entityId);
      }
    },
    [localStates]
  );

  // -- Climate: cycle HVAC mode --------------------------------------------
  const handleCycleMode = useCallback(
    async (entityId: string) => {
      const es = localStates.get(entityId);
      const modes = (es?.attributes?.hvac_modes as string[]) ?? ["off", "heat"];
      const current = es?.state ?? "off";
      const idx = modes.indexOf(current);
      const next = modes[(idx + 1) % modes.length];
      markBusy(entityId);
      try {
        await callService("climate", "set_hvac_mode", {
          entity_id: entityId,
          hvac_mode: next,
        });
      } catch (err) {
        console.error("Set mode failed:", err);
      } finally {
        clearBusy(entityId);
      }
    },
    [localStates]
  );

  // -- Partition selected IDs by domain ------------------------------------
  const switchIds = selectedIds.filter((id) => id.startsWith("switch."));
  const climateIds = selectedIds.filter((id) => id.startsWith("climate."));

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <StatusIndicator
            haWsStatus={ws.haWsStatus}
            isConnected={ws.isConnected}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onBack} style={styles.linkBtn}>
            ← Selection
          </button>
          <button onClick={onSetup} style={styles.linkBtn}>
            ⚙ Setup
          </button>
        </div>
      </div>

      {selectedIds.length === 0 && (
        <p style={{ color: "#94a3b8", marginTop: 24 }}>
          No entities selected. Go back and pick some.
        </p>
      )}

      {/* ---- Switch tiles ---- */}
      {switchIds.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>🔌 Switches</h2>
          <div style={styles.grid}>
            {switchIds.map((id) => {
              const es = localStates.get(id);
              const state = es?.state ?? "unknown";
              const name = (es?.attributes?.friendly_name as string) || id;
              const isOn = state === "on";
              const isBusy = busy.has(id);

              return (
                <button
                  key={id}
                  onClick={() => handleSwitchToggle(id, state)}
                  disabled={isBusy}
                  style={{
                    ...styles.tile,
                    borderColor: isOn ? "#22c55e" : "#334155",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <span style={styles.tileName}>{name}</span>
                  <span
                    style={{
                      ...styles.tileState,
                      color: isOn ? "#22c55e" : "#94a3b8",
                    }}
                  >
                    {isBusy ? "…" : state}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ---- Climate tiles ---- */}
      {climateIds.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>🌡️ Climate</h2>
          <div style={styles.grid}>
            {climateIds.map((id) => {
              const es = localStates.get(id);
              const state = es?.state ?? "off";
              const name = (es?.attributes?.friendly_name as string) || id;
              const currentTemp = es?.attributes?.current_temperature;
              const targetTemp = es?.attributes?.temperature;
              const unit =
                (es?.attributes?.temperature_unit as string) ??
                "°C";
              const modeInfo = CLIMATE_MODES[state] ?? {
                color: "#94a3b8",
                label: state,
              };
              const isBusy = busy.has(id);

              return (
                <div
                  key={id}
                  style={{
                    ...styles.climateTile,
                    borderColor: modeInfo.color,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <span style={styles.tileName}>{name}</span>

                  {/* Current temperature */}
                  {currentTemp != null && (
                    <span style={styles.currentTemp}>
                      {String(currentTemp)} {unit}
                    </span>
                  )}

                  {/* Target temperature with +/- */}
                  {targetTemp != null && state !== "off" && (
                    <div style={styles.tempRow}>
                      <button
                        style={styles.tempBtn}
                        onClick={() => handleSetTemp(id, -0.5)}
                        disabled={isBusy}
                      >
                        −
                      </button>
                      <span style={styles.targetTemp}>
                        → {String(targetTemp)} {unit}
                      </span>
                      <button
                        style={styles.tempBtn}
                        onClick={() => handleSetTemp(id, 0.5)}
                        disabled={isBusy}
                      >
                        +
                      </button>
                    </div>
                  )}

                  {/* HVAC mode button */}
                  <button
                    style={{ ...styles.modeBtn, color: modeInfo.color }}
                    onClick={() => handleCycleMode(id)}
                    disabled={isBusy}
                  >
                    {isBusy ? "…" : modeInfo.label}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: "40px auto",
    padding: 24,
    fontFamily: "system-ui, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { margin: 0, fontSize: 24, color: "#e2e8f0" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#cbd5e1",
    marginTop: 28,
    marginBottom: 8,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 12,
  },
  // -- Switch tile
  tile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
    borderRadius: 12,
    border: "2px solid",
    backgroundColor: "#1e293b",
    cursor: "pointer",
    transition: "border-color 0.2s, opacity 0.2s",
  },
  tileName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e2e8f0",
    textAlign: "center",
    wordBreak: "break-word",
  },
  tileState: { fontSize: 22, fontWeight: 700, textTransform: "uppercase" },
  // -- Climate tile
  climateTile: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: 16,
    borderRadius: 12,
    border: "2px solid",
    backgroundColor: "#1e293b",
    transition: "border-color 0.2s, opacity 0.2s",
  },
  currentTemp: {
    fontSize: 28,
    fontWeight: 700,
    color: "#f1f5f9",
    marginTop: 4,
  },
  tempRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  targetTemp: {
    fontSize: 14,
    color: "#94a3b8",
    minWidth: 60,
    textAlign: "center",
  },
  tempBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid #475569",
    backgroundColor: "#334155",
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modeBtn: {
    marginTop: 4,
    padding: "4px 14px",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: "1px solid #475569",
    backgroundColor: "#0f172a",
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
};
