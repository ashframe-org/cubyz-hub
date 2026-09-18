import express from "express";
import { db } from "../db/index.js";

const router = express.Router();

const NOTIFICATIONS_LIMIT = 50;

router.get("/api/notifications", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: "Not logged in." });
  }
  try {
    const userId = req.session.user.id;
    const rows = await db.all(
      "SELECT id, type, message, link, read, created_at, data FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, NOTIFICATIONS_LIMIT]
    );
    const notifications = rows.map((row) => {
      let data = null;
      try {
        data = row.data ? JSON.parse(row.data) : null;
      } catch {
        data = null;
      }
      return { ...row, data };
    });
    const unreadRow = await db.get(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0",
      [userId]
    );
    res.json({ ok: true, notifications, unreadCount: unreadRow?.count || 0 });
  } catch (err) {
    console.error("GET /api/notifications ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to load notifications." });
  }
});

router.post("/api/notifications/:id/read", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: "Not logged in." });
  }
  try {
    const notification = await db.get("SELECT * FROM notifications WHERE id = ?", req.params.id);
    if (!notification) return res.status(404).json({ ok: false, error: "Notification not found." });
    if (notification.user_id !== req.session.user.id) {
      return res.status(403).json({ ok: false, error: "Not your notification." });
    }
    await db.run("UPDATE notifications SET read = 1 WHERE id = ?", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to update notification." });
  }
});

router.post("/api/notifications/read-all", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: "Not logged in." });
  }
  try {
    await db.run("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", [req.session.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to update notifications." });
  }
});

router.delete("/api/notifications/:id", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: "Not logged in." });
  }
  try {
    const notification = await db.get("SELECT * FROM notifications WHERE id = ?", req.params.id);
    if (!notification) return res.status(404).json({ ok: false, error: "Notification not found." });
    if (notification.user_id !== req.session.user.id) {
      return res.status(403).json({ ok: false, error: "Not your notification." });
    }
    await db.run("DELETE FROM notifications WHERE id = ?", req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to delete notification." });
  }
});

router.delete("/api/notifications", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: "Not logged in." });
  }
  try {
    await db.run("DELETE FROM notifications WHERE user_id = ?", [req.session.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE ALL NOTIFICATIONS ERROR:", err);
    res.status(500).json({ ok: false, error: "Failed to clear notifications." });
  }
});

export default router;
