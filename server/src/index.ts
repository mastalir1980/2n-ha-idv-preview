// ---------------------------------------------------------------------------
// 2N Panel Bridge – Server entry point
// ---------------------------------------------------------------------------

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import express from "express";
import { readConfig } from "./config.js";
import configRoutes, { setOnSelectionChange, setOnConfigChange } from "./routes/configRoutes.js";
import haProxyRoutes from "./routes/haProxy.js";
import { initClientBridge } from "./ws/clientBridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const app = express();

// ---- Middleware -----------------------------------------------------------
app.use(express.json());

// ---- API routes ----------------------------------------------------------
app.use("/api", configRoutes);
app.use("/api", haProxyRoutes);

// ---- Serve built React app in production ---------------------------------
const webDistPath = path.resolve(__dirname, "../../web/dist");
app.use(express.static(webDistPath));
// SPA fallback – serve index.html for any non-API route
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDistPath, "index.html"), (err) => {
    if (err) next(); // file not found in dev mode – that's fine
  });
});

// ---- HTTP + WebSocket server ---------------------------------------------
const server = createServer(app);
const haSocket = initClientBridge(server);

// ---------------------------------------------------------------------------
// HA WS connection helper
// ---------------------------------------------------------------------------
function connectHaWs(): void {
  const cfg = readConfig();
  if (!cfg.token) {
    console.log("[server] No HA token configured – skipping WS connection");
    return;
  }
  const wsUrl = cfg.haBaseUrl.replace(/^http/, "ws") + "/api/websocket";
  haSocket.disconnect();
  haSocket.connect(wsUrl, cfg.token);
  console.log(`[server] Connecting to HA WS at ${wsUrl}`);
}

// Reconnect to HA when config (URL / token) changes via REST
setOnConfigChange(() => {
  connectHaWs();
});

// Selection changes are handled in-place (the bridge reads the set on each event)
setOnSelectionChange(() => {
  // no-op: getSelectedEntityIds() is already updated in memory
});

// ---- Initial HA connection -----------------------------------------------
connectHaWs();

// ---- Listen --------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`[server] 2N Panel Bridge listening on http://0.0.0.0:${PORT}`);
  console.log(`[server] Web UI: http://localhost:${PORT}`);
});
