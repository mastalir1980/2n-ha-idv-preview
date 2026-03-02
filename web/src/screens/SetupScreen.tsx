// ---------------------------------------------------------------------------
// SetupScreen – HA base URL + token configuration
// ---------------------------------------------------------------------------

import { useState } from "react";
import { saveConfig, getStates, type HaEntity } from "../api";

interface Props {
  defaultUrl: string;
  onConnected: (entities: HaEntity[]) => void;
}

export function SetupScreen({ defaultUrl, onConnected }: Props) {
  const [haBaseUrl, setHaBaseUrl] = useState(defaultUrl);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!haBaseUrl.trim()) {
      setError("Home Assistant URL is required.");
      return;
    }
    if (!token.trim()) {
      setError("Access token is required.");
      return;
    }

    setLoading(true);
    try {
      await saveConfig({ haBaseUrl: haBaseUrl.trim(), token: token.trim() });
      const entities = await getStates();
      onConnected(entities);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>2N Panel Bridge</h1>
      <p style={styles.subtitle}>Setup – Connect to Home Assistant</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Home Assistant URL
          <input
            type="url"
            value={haBaseUrl}
            onChange={(e) => setHaBaseUrl(e.target.value)}
            placeholder="http://192.168.88.28:8123"
            style={styles.input}
            autoFocus
          />
        </label>

        <label style={styles.label}>
          Long-Lived Access Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOi…"
            style={styles.input}
          />
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Connecting…" : "Save & Connect"}
        </button>
      </form>

      <p style={styles.warning}>
        ⚠️ The token is stored as plain text on the server disk. Use this
        prototype on a trusted LAN only.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (keeps the prototype dependency-free)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 460,
    margin: "60px auto",
    padding: 32,
    fontFamily: "system-ui, sans-serif",
  },
  title: { margin: 0, fontSize: 28, color: "#e2e8f0" },
  subtitle: { marginTop: 4, color: "#94a3b8", fontSize: 14 },
  form: { display: "flex", flexDirection: "column", gap: 16, marginTop: 24 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 14,
    color: "#cbd5e1",
  },
  input: {
    padding: "8px 12px",
    fontSize: 14,
    borderRadius: 6,
    border: "1px solid #475569",
    backgroundColor: "#1e293b",
    color: "#f1f5f9",
    outline: "none",
  },
  button: {
    padding: "10px 0",
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 6,
    border: "none",
    backgroundColor: "#3b82f6",
    color: "#fff",
    cursor: "pointer",
    marginTop: 8,
  },
  error: {
    padding: "8px 12px",
    borderRadius: 6,
    backgroundColor: "#7f1d1d",
    color: "#fca5a5",
    fontSize: 13,
  },
  warning: {
    marginTop: 24,
    fontSize: 12,
    color: "#f59e0b",
    lineHeight: 1.5,
  },
};
