// ---------------------------------------------------------------------------
// SelectionScreen – pick switch.* and climate.* entities for the dashboard
// ---------------------------------------------------------------------------

import { useState, useMemo } from "react";
import { saveSelected, type HaEntity } from "../api";

const SUPPORTED_DOMAINS = ["switch", "climate"] as const;

interface Props {
  entities: HaEntity[];
  initialSelected: string[];
  onSaved: (selectedIds: string[]) => void;
  onBack: () => void;
}

export function SelectionScreen({
  entities,
  initialSelected,
  onSaved,
  onBack,
}: Props) {
  const grouped = useMemo(() => {
    const groups: Record<string, HaEntity[]> = {};
    for (const domain of SUPPORTED_DOMAINS) groups[domain] = [];
    for (const e of entities) {
      const domain = e.entity_id.split(".")[0];
      if (groups[domain]) groups[domain].push(e);
    }
    return groups;
  }, [entities]);

  const allSupported = useMemo(
    () => SUPPORTED_DOMAINS.flatMap((d) => grouped[d]),
    [grouped]
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(allSupported.map((e) => e.entity_id)));
  const clearAll = () => setSelected(new Set());

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      await saveSelected(ids);
      onSaved(ids);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const stateColor = (entity: HaEntity) => {
    if (entity.entity_id.startsWith("climate.")) {
      if (entity.state === "heat") return "#f97316";
      if (entity.state === "cool") return "#38bdf8";
      if (entity.state === "off") return "#94a3b8";
      return "#a78bfa";
    }
    return entity.state === "on" ? "#22c55e" : "#94a3b8";
  };

  const renderGroup = (domain: string, label: string, icon: string) => {
    const list = grouped[domain] ?? [];
    if (list.length === 0) return null;

    return (
      <div key={domain} style={{ marginTop: 20 }}>
        <h2 style={styles.groupTitle}>
          {icon} {label}
          <span style={styles.groupCount}>{list.length}</span>
        </h2>
        <div style={styles.list}>
          {list.map((entity) => {
            const checked = selected.has(entity.entity_id);
            const name =
              (entity.attributes.friendly_name as string) || entity.entity_id;
            const extra =
              domain === "climate" && entity.attributes.current_temperature != null
                ? ` · ${entity.attributes.current_temperature}°`
                : "";

            return (
              <label key={entity.entity_id} style={styles.row}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(entity.entity_id)}
                />
                <span style={styles.name}>{name}</span>
                <span style={{ ...styles.state, color: stateColor(entity) }}>
                  {entity.state}{extra}
                </span>
                <span style={styles.entityId}>{entity.entity_id}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Select Entities</h1>
          <p style={styles.subtitle}>
            {allSupported.length} entities found · {selected.size} selected
          </p>
        </div>
        <button onClick={onBack} style={styles.linkBtn}>
          ← Setup
        </button>
      </div>

      {allSupported.length === 0 && (
        <p style={{ color: "#94a3b8", marginTop: 20 }}>
          No switch or climate entities found in Home Assistant.
        </p>
      )}

      <div style={styles.actions}>
        <button onClick={selectAll} style={styles.smallBtn}>
          Select all
        </button>
        <button onClick={clearAll} style={styles.smallBtn}>
          Clear
        </button>
        <button
          onClick={handleSave}
          style={{ ...styles.smallBtn, backgroundColor: "#3b82f6", color: "#fff" }}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save & Go to Dashboard →"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {renderGroup("switch", "Switches", "🔌")}
      {renderGroup("climate", "Climate / Thermostats", "🌡️")}
    </div>
  );
}

// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 700,
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
  subtitle: { marginTop: 4, color: "#94a3b8", fontSize: 13 },
  actions: { display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" },
  smallBtn: {
    padding: "6px 14px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#60a5fa",
    cursor: "pointer",
    fontSize: 13,
  },
  error: {
    marginTop: 12,
    padding: "8px 12px",
    borderRadius: 6,
    backgroundColor: "#7f1d1d",
    color: "#fca5a5",
    fontSize: 13,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "#cbd5e1",
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  groupCount: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 400,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    maxHeight: "40vh",
    overflowY: "auto",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto 1fr",
    gap: 12,
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    color: "#e2e8f0",
    backgroundColor: "#1e293b",
  },
  name: { fontWeight: 500 },
  state: { textAlign: "center", fontSize: 13 },
  entityId: { color: "#64748b", fontSize: 12, textAlign: "right" },
};
