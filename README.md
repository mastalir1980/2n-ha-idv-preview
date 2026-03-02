# 2N Panel Bridge

> **Prototype / proof-of-concept** — a LAN-only web dashboard that talks to Home Assistant through a Node.js backend. The browser **never** calls HA directly; all REST and WebSocket traffic goes through the server.

## What It Does

1. **Setup** — enter your HA URL + long-lived access token → saved on the server.
2. **Entity selection** — shows all `switch.*` and `climate.*` entities from HA; pick the ones you want on the dashboard.
3. **Dashboard** —
   - **Switches**: toggle tiles (on/off) with one click.
   - **Climate / Thermostats**: current temperature, target temperature with +/− controls, HVAC mode cycling.
   - **Live updates** via a server-side WebSocket bridge (state changes appear instantly).

## Architecture

```
Browser (React)  ←→  Node.js server  ←→  Home Assistant
                      ├─ REST proxy (/api/ha/*)
                      ├─ WS bridge  (/ws)
                      └─ Serves built React app
```

| Layer    | Stack                        |
| -------- | ---------------------------- |
| Backend  | Node.js · Express · `ws`     |
| Frontend | React 18 · Vite · TypeScript |

## How to Run (for Jan's colleague 😉)

### Prerequisites

- **Node.js ≥ 18** — https://nodejs.org/
- A **Home Assistant** instance reachable on your LAN (default URL pre-filled: `http://192.168.88.28:8123`)
- A **Long-Lived Access Token** from HA:
  1. Open HA → click your profile (bottom-left)
  2. Scroll to **Long-Lived Access Tokens** → Create Token
  3. Copy the token — you'll paste it into the Setup screen

### Development (two terminals)

```bash
# 1) Start the API server (port 3000)
cd server
npm install
npm run dev

# 2) Start the Vite dev server (port 5173)
cd web
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Production (single process)

```bash
# Build the React frontend
cd web && npm install && npm run build

# Build and start the server (serves the UI + API on port 3000)
cd ../server && npm install && npm run build && npm start
```

Open **http://\<server-ip\>:3000** from any device on the LAN.

## Configuration

Stored in **`server/data/config.json`** (auto-created on first run).

| Field              | Type       | Description                       |
| ------------------ | ---------- | --------------------------------- |
| `haBaseUrl`        | `string`   | HA base URL                       |
| `token`            | `string`   | Long-Lived Access Token           |
| `selectedEntityIds`| `string[]` | Entity IDs displayed on dashboard |

> Writes are atomic (write to `.tmp` → rename) so the file can't get corrupted mid-write.

## Supported Entity Types

| Domain    | Dashboard tile                                             |
| --------- | ---------------------------------------------------------- |
| `switch`  | On/off toggle                                              |
| `climate` | Current temp, target temp (+/−), HVAC mode cycle button    |

More domains can be added easily — just add the domain name to `SUPPORTED_DOMAINS` in `SelectionScreen.tsx` and a tile renderer in `DashboardScreen.tsx`.

## API Endpoints

| Method | Path                                   | Description                        |
| ------ | -------------------------------------- | ---------------------------------- |
| GET    | `/api/config`                          | Read config (token excluded)       |
| POST   | `/api/config`                          | Partial update                     |
| POST   | `/api/selected`                        | Update selected entity IDs         |
| GET    | `/api/ha/states`                       | Proxy → HA `/api/states`           |
| POST   | `/api/ha/services/:domain/:service`    | Proxy → HA service call            |
| WS     | `/ws`                                  | Live state events (filtered)       |

## ⚠️ Security Warning

> **The HA access token is stored as plain text in `server/data/config.json`.**
>
> This is a **prototype for LAN use only**. Do **not** expose it to the internet.
> In production you would encrypt the token at rest, use HTTPS, and add proper
> authentication to the web UI.

## Project Structure

```
server/
  src/
    index.ts               – Express entry, static serving, WS setup
    config.ts              – JSON config persistence (atomic writes)
    types.ts               – Shared TypeScript interfaces
    routes/
      configRoutes.ts      – GET/POST /api/config, POST /api/selected
      haProxy.ts           – GET /api/ha/states, POST /api/ha/services/*
    ws/
      haSocket.ts          – HA WS connection (auth, subscribe, reconnect)
      clientBridge.ts      – Browser WS bridge (filter & forward events)
web/
  src/
    main.tsx               – React entry point
    App.tsx                – Screen state machine (setup → selection → dashboard)
    api.ts                 – Typed fetch wrappers for server API
    hooks/
      useWebSocket.ts      – Browser WS hook (live state + HA status)
    screens/
      SetupScreen.tsx      – HA URL + token form
      SelectionScreen.tsx  – Entity list (switches + climate)
      DashboardScreen.tsx  – Toggle tiles + climate controls + live updates
    components/
      StatusIndicator.tsx  – Connection status dot
data/
  config.json              – Created at runtime (gitignored)
```