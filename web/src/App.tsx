// ---------------------------------------------------------------------------
// App – top-level state machine: setup → selection → dashboard
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { getConfig, getStates, type HaEntity, type PublicConfig } from "./api";
import { useWebSocket } from "./hooks/useWebSocket";
import { SetupScreen } from "./screens/SetupScreen";
import { SelectionScreen } from "./screens/SelectionScreen";
import { DashboardScreen } from "./screens/DashboardScreen";

type Screen = "setup" | "selection" | "dashboard";

export default function App() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [entities, setEntities] = useState<HaEntity[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const ws = useWebSocket();

  // On mount, try to load existing config and jump to the right screen
  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig();
        setConfig(cfg);
        if (cfg.selectedEntityIds.length > 0) {
          // Attempt to fetch states — if HA is reachable, jump to dashboard
          try {
            const states = await getStates();
            setEntities(states);
            setSelectedIds(cfg.selectedEntityIds);
            setScreen("dashboard");
          } catch {
            // HA unreachable — stay on setup
          }
        }
      } catch {
        // No config yet — stay on setup
      }
    })();
  }, []);

  const defaultUrl = config?.haBaseUrl ?? "http://192.168.88.28:8123";

  switch (screen) {
    case "setup":
      return (
        <SetupScreen
          defaultUrl={defaultUrl}
          onConnected={(ents) => {
            setEntities(ents);
            setScreen("selection");
          }}
        />
      );

    case "selection":
      return (
        <SelectionScreen
          entities={entities}
          initialSelected={selectedIds}
          onSaved={(ids) => {
            setSelectedIds(ids);
            setScreen("dashboard");
          }}
          onBack={() => setScreen("setup")}
        />
      );

    case "dashboard":
      return (
        <DashboardScreen
          entities={entities}
          selectedIds={selectedIds}
          ws={ws}
          onBack={() => setScreen("selection")}
          onSetup={() => setScreen("setup")}
        />
      );
  }
}
