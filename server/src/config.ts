// ---------------------------------------------------------------------------
// Configuration persistence – ./data/config.json
// Uses atomic writes (write tmp → rename) to prevent corruption.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import path from "node:path";
import type { Config, PublicConfig } from "./types.js";

const DATA_DIR = path.resolve("data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const CONFIG_TMP = path.join(DATA_DIR, "config.json.tmp");

const DEFAULT_CONFIG: Config = {
  haBaseUrl: "http://192.168.88.28:8123",
  token: "",
  selectedEntityIds: [],
};

// In-memory cache of selectedEntityIds for fast WS filtering
let selectedSet: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Read the current config from disk (creates defaults if missing). */
export function readConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    writeConfigRaw(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    const config: Config = { ...DEFAULT_CONFIG, ...parsed };
    selectedSet = new Set(config.selectedEntityIds);
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Merge partial updates into the existing config and persist. */
export function writeConfig(partial: Partial<Config>): Config {
  const current = readConfig();
  const updated: Config = { ...current, ...partial };
  writeConfigRaw(updated);
  selectedSet = new Set(updated.selectedEntityIds);
  return updated;
}

/** Return a config object safe to send to the browser (no token). */
export function publicConfig(cfg: Config): PublicConfig {
  return {
    haBaseUrl: cfg.haBaseUrl,
    selectedEntityIds: cfg.selectedEntityIds,
  };
}

/** Fast in-memory check used by the WS bridge. */
export function getSelectedEntityIds(): Set<string> {
  return selectedSet;
}

/** Refresh the in-memory set (called after config write). */
export function refreshSelectedSet(ids: string[]): void {
  selectedSet = new Set(ids);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function writeConfigRaw(config: Config): void {
  ensureDataDir();
  const json = JSON.stringify(config, null, 2) + "\n";
  fs.writeFileSync(CONFIG_TMP, json, "utf-8");
  fs.renameSync(CONFIG_TMP, CONFIG_PATH);
}

// Eagerly load the config so the in-memory set is populated at startup.
readConfig();
