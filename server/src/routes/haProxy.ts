// ---------------------------------------------------------------------------
// Home Assistant proxy routes
//   GET  /api/ha/states                        – fetch all entity states
//   POST /api/ha/services/:domain/:service     – call a HA service
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from "express";
import { readConfig } from "../config.js";

const router = Router();

/** Simple validation for domain/service names (lowercase + underscores). */
const SAFE_NAME = /^[a-z][a-z0-9_]*$/;

// GET /api/ha/states
router.get("/ha/states", async (_req: Request, res: Response) => {
  const { haBaseUrl, token } = readConfig();

  if (!token) {
    res.status(400).json({ error: "Home Assistant token is not configured. Go to Setup." });
    return;
  }

  try {
    const haRes = await fetch(`${haBaseUrl}/api/states`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!haRes.ok) {
      const text = await haRes.text().catch(() => "");
      res.status(haRes.status).json({
        error: `Home Assistant returned ${haRes.status}`,
        detail: text.slice(0, 500),
      });
      return;
    }

    const data = await haRes.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Cannot reach Home Assistant",
      detail: String(err),
    });
  }
});

// POST /api/ha/services/:domain/:service
router.post("/ha/services/:domain/:service", async (req: Request, res: Response) => {
  const domain = req.params.domain as string;
  const service = req.params.service as string;

  if (!SAFE_NAME.test(domain) || !SAFE_NAME.test(service)) {
    res.status(400).json({ error: "Invalid domain or service name" });
    return;
  }

  const { haBaseUrl, token } = readConfig();

  if (!token) {
    res.status(400).json({ error: "Home Assistant token is not configured. Go to Setup." });
    return;
  }

  try {
    const haRes = await fetch(`${haBaseUrl}/api/services/${domain}/${service}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!haRes.ok) {
      const text = await haRes.text().catch(() => "");
      res.status(haRes.status).json({
        error: `Home Assistant returned ${haRes.status}`,
        detail: text.slice(0, 500),
      });
      return;
    }

    const data = await haRes.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Cannot reach Home Assistant",
      detail: String(err),
    });
  }
});

export default router;
