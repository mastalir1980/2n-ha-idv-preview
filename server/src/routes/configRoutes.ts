// ---------------------------------------------------------------------------
// Config API routes
//   GET  /api/config      – read (no token exposed)
//   POST /api/config      – partial update
//   POST /api/selected    – shorthand to update selectedEntityIds
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import { readConfig, writeConfig, publicConfig, refreshSelectedSet } from "../config.js";

// Callbacks that other modules can register
let onSelectionChange: ((ids: string[]) => void) | null = null;
let onConfigChange: (() => void) | null = null;

export function setOnSelectionChange(cb: (ids: string[]) => void): void {
  onSelectionChange = cb;
}

export function setOnConfigChange(cb: () => void): void {
  onConfigChange = cb;
}

const router = Router();

// GET /api/config → { haBaseUrl, selectedEntityIds }
router.get("/config", (_req: Request, res: Response) => {
  try {
    const cfg = readConfig();
    res.json(publicConfig(cfg));
  } catch (err) {
    res.status(500).json({ error: "Failed to read config", detail: String(err) });
  }
});

// POST /api/config → partial update { haBaseUrl?, token?, selectedEntityIds? }
router.post("/config", (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof body.haBaseUrl === "string" && body.haBaseUrl.trim()) {
      patch.haBaseUrl = body.haBaseUrl.trim();
    }
    if (typeof body.token === "string") {
      patch.token = body.token;
    }
    if (Array.isArray(body.selectedEntityIds)) {
      const ids = (body.selectedEntityIds as unknown[]).filter(
        (id): id is string => typeof id === "string"
      );
      patch.selectedEntityIds = ids;
    }

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields provided" });
      return;
    }

    const updated = writeConfig(patch as any);
    if (patch.selectedEntityIds) {
      refreshSelectedSet(updated.selectedEntityIds);
      onSelectionChange?.(updated.selectedEntityIds);
    }
    onConfigChange?.();
    res.json(publicConfig(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to write config", detail: String(err) });
  }
});

// POST /api/selected → { selectedEntityIds: string[] }
router.post("/selected", (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!Array.isArray(body.selectedEntityIds)) {
      res.status(400).json({ error: "selectedEntityIds must be an array of strings" });
      return;
    }

    const ids = (body.selectedEntityIds as unknown[]).filter(
      (id): id is string => typeof id === "string"
    );

    const updated = writeConfig({ selectedEntityIds: ids });
    refreshSelectedSet(updated.selectedEntityIds);
    onSelectionChange?.(updated.selectedEntityIds);
    res.json(publicConfig(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to write config", detail: String(err) });
  }
});

export default router;
