import express from "express";
import path from "path";
import { db } from "../db/index.js";
import { slugify } from "../utils/common.js";

const router = express.Router();

router.get("/profile/:username", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "profile.html"));
});

router.get("/changelog", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "changelog.html"));
});

router.get("/addons", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "addons.html"));
});

router.get("/models", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "models.html"));
});

router.get("/servers", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "servers.html"));
});

router.get("/creator", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "creator", "index.html"));
});

router.get("/sitemap.xml", async (req, res) => {
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    const esc = (s) => String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const statics = ["/", "/addons", "/models", "/servers", "/changelog", "/creator"]
      .map((p) => `  <url><loc>${origin}${p}</loc><changefreq>daily</changefreq></url>`)
      .join("\n");
    const addons = await db.all("SELECT id, name, type, updated_at, created_at FROM addons ORDER BY id DESC");
    const urls = addons.map((a) => {
      const prefix = a.type === "mod" ? "/mod" : "/addon";
      const lastmod = (a.updated_at || a.created_at || "").slice(0, 10);
      return `  <url><loc>${origin}${prefix}/${a.id}-${esc(slugify(a.name))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>weekly</changefreq></url>`;
    }).join("\n");
    res.type("application/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${statics}\n${urls}\n</urlset>`
    );
  } catch (err) {
    console.error("SITEMAP ERROR:", err);
    res.status(500).send("Failed to generate sitemap.");
  }
});

export default router;
