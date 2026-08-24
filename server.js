import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import crypto from "crypto";

dotenv.config();

function safeMarkdown(md) {
  const rawHtml = marked.parse(md || "");
  return sanitizeHtml(rawHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
                      allowedAttributes: {
                        ...sanitizeHtml.defaults.allowedAttributes,
                        img: ["src", "alt", "title"]
                      },
                      allowedSchemes: ["http", "https", "data"],
                      allowedSchemesByTag: { img: ["http", "https", "data"] }
  });
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.DOMAIN || false, credentials: true }));

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use("/avatars", express.static("avatars"));
app.use("/banners", express.static("banners"));

let db;
(async () => {
  db = await open({
    filename: "./cubyzhub.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    about TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT UNIQUE,
    name TEXT,
    author TEXT,
    version TEXT,
    description TEXT,
    longDescription TEXT,
    tags TEXT,
    compatibility TEXT,
    iconUrl TEXT,
    bannerUrl TEXT,
    creators TEXT,
    screenshots TEXT,
    fileUrl TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Added for Ribbon Calculations
    stars INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    addon_id INTEGER,
    username TEXT,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    addon_id INTEGER,
    version TEXT,
    fileUrl TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    addon_id INTEGER
  );
  `);

  const userColumns = await db.all(`PRAGMA table_info(users);`);
  if (!userColumns.some((col) => col.name === "about")) {
    await db.exec(`ALTER TABLE users ADD COLUMN about TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "avatarUrl")) {
    await db.exec(`ALTER TABLE users ADD COLUMN avatarUrl TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "bannerUrl")) {
    await db.exec(`ALTER TABLE users ADD COLUMN bannerUrl TEXT;`);
  }

  const addonColumns = await db.all(`PRAGMA table_info(addons);`);
  if (!addonColumns.some((col) => col.name === "creators")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN creators TEXT;`);
  }

  if (!addonColumns.some((col) => col.name === "updated_at")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN updated_at TEXT;`);
    await db.exec(`UPDATE addons SET updated_at = created_at WHERE updated_at IS NULL;`);
  }

  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_addon ON likes(user_id, addon_id);`);
})();

app.use(
  session({
    secret: process.env.SESSION_SECRET || "cubyz-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// Lightweight abuse guard for download counters: a client can still
// re-download, but repeated hits from the same user for the same addon
// within the window only bump the counter once, so the number can't be
// trivially inflated by scripting the endpoint in a loop.
const DOWNLOAD_THROTTLE_MS = 60 * 1000;
const recentDownloads = new Map();
function shouldCountDownload(key) {
  const now = Date.now();
  const last = recentDownloads.get(key);
  if (last && now - last < DOWNLOAD_THROTTLE_MS) return false;
  recentDownloads.set(key, now);
  if (recentDownloads.size > 5000) {
    for (const [k, ts] of recentDownloads) {
      if (now - ts > DOWNLOAD_THROTTLE_MS) recentDownloads.delete(k);
    }
  }
  return true;
}

function slugify(name) {
  return String(name || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/--+/g, "-")
  .slice(0, 60);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const baseDir = path.join(process.cwd(), "uploads");
    let folder;

    if (req._uploadFolder) {
      folder = req._uploadFolder;
    } else {
      const identifier = req.body.identifier || req.body.name || "unknown";
      const uniqueSuffix = crypto.randomBytes(4).toString('hex');
      folder = `${slugify(identifier)}-${uniqueSuffix}`;
    }

    const uploadDir = path.join(baseDir, folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    req._uploadFolder = folder;
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});

const allowedImageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'file') {
      if (ext !== '.zip') return cb(new Error('Only .zip files allowed'));
      return cb(null, true);
    }
    if (allowedImageExts.includes(ext)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  }
});

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const userId = req.session?.user?.id;
    if (!userId) return cb(new Error("Not authenticated"));
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${userId}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedImageExts.includes(ext)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  }
});

const bannerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), "banners");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const userId = req.session?.user?.id;
    if (!userId) return cb(new Error("Not authenticated"));
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${userId}${ext}`);
  }
});

const uploadBanner = multer({
  storage: bannerStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedImageExts.includes(ext)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  }
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ ok: false, error: "Missing credentials." });
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashed,
    ]);
    res.json({ ok: true });
  } catch (err) {
    if (err.message.includes("UNIQUE"))
      res.json({ ok: false, error: "Username already exists." });
    else res.json({ ok: false, error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.json({ ok: false, error: "Missing credentials." });
  try {
    const user = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (!user) return res.json({ ok: false, error: "User not found." });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ ok: false, error: "Wrong password." });
    req.session.user = { id: user.id, username: user.username };
    res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.json({ ok: false, error: "Login failed." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/auth/status", async (req, res) => {
  if (req.session.user) {
    try {
      const user = await db.get(
        "SELECT id, username, avatarUrl FROM users WHERE id = ?",
        [req.session.user.id]
      );
      if (user) {
        res.json({ ok: true, user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl } });
      } else {
        res.json({ ok: true, user: req.session.user });
      }
    } catch (err) {
      res.json({ ok: true, user: req.session.user });
    }
  } else {
    res.json({ ok: false });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ ok: false, liked: false });
    }
    const { oldPassword, newPassword } = req.body;
    const username = req.session.user.username;
    if (!oldPassword || !newPassword) {
      return res.json({ ok: false, error: "Missing fields" });
    }
    const user = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (!user) return res.json({ ok: false, error: "User not found" });
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.json({ ok: false, error: "Incorrect current password" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.run(
      "UPDATE users SET password = ? WHERE username = ?",
      [hashed, username]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/change-username", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ ok: false, error: "Not logged in" });
    }
    const { newUsername } = req.body;
    const oldUsername = req.session.user.username;
    if (!newUsername || newUsername.length < 3) {
      return res.json({ ok: false, error: "Invalid username" });
    }
    const exists = await db.get(
      "SELECT 1 FROM users WHERE username = ?",
      newUsername
    );
    if (exists) {
      return res.json({ ok: false, error: "Username already taken" });
    }
    await db.run(
      "UPDATE users SET username = ? WHERE username = ?",
      [newUsername, oldUsername]
    );
    await db.run(
      "UPDATE addons SET author = ? WHERE author = ?",
      [newUsername, oldUsername]
    );
    await db.run(
      "UPDATE comments SET username = ? WHERE username = ?",
      [newUsername, oldUsername]
    );
    req.session.user.username = newUsername;
    res.json({ ok: true, username: newUsername });
  } catch (err) {
    console.error("CHANGE USERNAME ERROR:", err);
    res.json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/upload-avatar", (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: "Not logged in" });
  }
  uploadAvatar.single("avatar")(req, res, function (err) {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!req.file) {
      return res.json({ ok: false, error: "No file uploaded" });
    }
    const avatarUrl = `/avatars/${req.file.filename}`;
    await db.run("UPDATE users SET avatarUrl = ? WHERE id = ?", [avatarUrl, userId]);
    res.json({ ok: true, userId, avatarUrl });
  } catch (err) {
    console.error("UPLOAD AVATAR ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/auth/upload-banner", (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: "Not logged in" });
  }
  uploadBanner.single("banner")(req, res, function (err) {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, error: "No file uploaded" });
    }
    const bannerUrl = `/banners/${req.file.filename}`;
    await db.run("UPDATE users SET bannerUrl = ? WHERE id = ?", [bannerUrl, req.session.user.id]);
    res.json({ ok: true, bannerUrl });
  } catch (err) {
    console.error("UPLOAD BANNER ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post(
  "/api/addons/upload",
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "banner", maxCount: 1 },
    { name: "screenshots", maxCount: 12 },
    { name: "file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ ok: false, error: "Not logged in." });
      }

      const {
        name,
        identifier,
        version,
        description,
        longDescription,
        compatibility,
        tags,
      } = req.body;

      if (!name || !identifier)
        return res.json({ ok: false, error: "Missing name or identifier." });

      const existingAddon = await db.get("SELECT author FROM addons WHERE identifier = ?", identifier);
      if (existingAddon && existingAddon.author !== req.session.user.username) {
        return res.status(409).json({ ok: false, error: "That identifier is already taken by another addon." });
      }

      const finalAuthor = req.session.user.username;
      const folder = req._uploadFolder;

      const iconUrl = req.files?.icon?.[0] ? `/uploads/${folder}/${req.files.icon[0].filename}` : null;
      const bannerUrl = req.files?.banner?.[0] ? `/uploads/${folder}/${req.files.banner[0].filename}` : null;
      const fileUrl = req.files?.file?.[0] ? `/uploads/${folder}/${req.files.file[0].filename}` : null;

      let screenshots = [];
      if (req.files?.screenshots?.length) {
        screenshots = req.files.screenshots.map((f) => `/uploads/${folder}/${f.filename}`);
      }

      const tagArray = typeof tags === "string" ? JSON.parse(tags || "[]") : Array.isArray(tags) ? tags : [];
      const timestampIso = new Date().toISOString();

      await db.run(
        `INSERT OR REPLACE INTO addons
        (identifier, name, author, version, description, longDescription, tags, compatibility, iconUrl, bannerUrl, creators, screenshots, fileUrl, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                   [
                     identifier,
                   name,
                   finalAuthor,
                   version,
                   description,
                   longDescription,
                   JSON.stringify(tagArray),
                   compatibility,
                   iconUrl,
                   bannerUrl,
                   JSON.stringify([]),
                   JSON.stringify(screenshots),
                   fileUrl,
                   timestampIso,
                   timestampIso
                   ]
      );

      const newAddon = await db.get("SELECT * FROM addons WHERE identifier = ?", identifier);

      if (fileUrl) {
        await db.run(
          "INSERT INTO versions (addon_id, version, fileUrl) VALUES (?, ?, ?)",
                     [newAddon.id, version || "", fileUrl]
        );
      }

      res.json({ ok: true, addon: newAddon });
    } catch (err) {
      console.error("Upload failed:", err);
      res.json({ ok: false, error: err.message });
    }
  }
);

app.delete("/api/addons/:id", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ ok: false, error: "Not logged in." });
    }

    const addonId = req.params.id;

    const addon = await db.get("SELECT * FROM addons WHERE id = ?", addonId);
    if (!addon) {
      return res.status(404).json({ ok: false, error: "Addon not found." });
    }

    if (addon.author !== req.session.user.username) {
      return res.status(403).json({ ok: false, error: "Not your addon." });
    }

    const versions = await db.all("SELECT fileUrl FROM versions WHERE addon_id = ?", addonId);
    const filesToDelete = versions.map(v => v.fileUrl).concat([addon.fileUrl, addon.iconUrl, addon.bannerUrl]);

    filesToDelete.forEach(fileUrl => {
      if (fileUrl) {
        const filePath = path.join(process.cwd(), fileUrl.replace(/^\/+/, ""));
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.warn("Failed to delete file:", filePath, e);
        }
      }
    });

    await db.run("DELETE FROM versions WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM comments WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM likes WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM addons WHERE id = ?", addonId);

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE ADDON ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/addons/:id/liked", async (req, res) => {
  if (!req.session.user) {
    return res.json({ ok: true, liked: false });
  }
  const userId = req.session.user.id;
  const addonId = req.params.id;
  try {
    const row = await db.get("SELECT 1 FROM likes WHERE user_id = ? AND addon_id = ?", [userId, addonId]);
    res.json({ ok: true, liked: !!row });
  } catch (err) {
    console.error("LIKED CHECK ERROR:", err);
    res.json({ ok: false, liked: false });
  }
});

app.get("/api/addons/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const addon = await db.get(
      `SELECT
      a.id, a.identifier, a.name, a.author, a.version, a.description,
      a.longDescription, a.tags, a.compatibility, a.iconUrl, a.bannerUrl,
      a.creators, a.screenshots, a.fileUrl, a.created_at, a.updated_at,
      a.downloads,
      u.id AS author_id
      FROM addons a
      LEFT JOIN users u ON u.username = a.author
      WHERE a.id = ?`,
      [id]
    );

    if (!addon) {
      return res.json({ ok: false, error: "Addon not found." });
    }

    const likeCountRow = await db.get("SELECT COUNT(*) AS count FROM likes WHERE addon_id = ?", [id]);
    addon.likes = likeCountRow?.count || 0;

    const likedRows = await db.all("SELECT user_id FROM likes WHERE addon_id = ?", [id]);
    addon.likedBy = likedRows.map(r => r.user_id);
    addon.longDescription = addon.longDescription || "";

    res.json({ ok: true, addon });
  } catch (err) {
    console.error("GET /api/addons/:id ERROR:", err);
    res.json({ ok: false, error: "Database error." });
  }
});

app.get("/addon/:slugOrId", async (req, res) => {
  try {
    const param = req.params.slugOrId;
    let addon;

    if (/^\d+$/.test(param)) {
      addon = await db.get("SELECT id, name, description, iconUrl FROM addons WHERE id = ?", [param]);
      if (!addon) return res.status(404).send("Addon not found");
      const slug = slugify(addon.name);
      return res.redirect(301, `/addon/${addon.id}-${slug}`);
    }

    const id = param.split("-")[0];
    addon = await db.get("SELECT id, name, description, iconUrl FROM addons WHERE id = ?", [id]);
    if (!addon) return res.status(404).send("Addon not found");

    const esc = (s) => String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

    const slug = slugify(addon.name);
    const correctUrl = `/addon/${addon.id}-${slug}`;

    if (param !== `${addon.id}-${slug}`) {
      return res.redirect(301, correctUrl);
    }

    const title = addon.name || "CubyzHub Addon";
    const description = addon.description || "View this addon on CubyzHub";
    const isAbsolute = addon.iconUrl && addon.iconUrl.startsWith("http");
    const image = addon.iconUrl
    ? (isAbsolute ? addon.iconUrl : `${req.protocol}://${req.get("host")}${addon.iconUrl}`)
    : `${req.protocol}://${req.get("host")}/assets/default_icon.png`;

    const url = `${req.protocol}://${req.get("host")}${correctUrl}`;

    res.send(`
    <!doctype html>
    <html>
    <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="dark">
    <style>html, body { background: #1A1F1C; margin: 0; }</style>
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${url}">
    <link rel="canonical" href="${url}">
    <meta name="twitter:card" content="summary_large_image">
    <title>${esc(title)}</title>
    </head>
    <body>
    <script>window.location.replace("/addon.html?id=${addon.id}");</script>
    </body>
    </html>
    `);
  } catch (err) {
    console.error("OG PREVIEW ERROR:", err);
    res.status(500).send("Error generating preview");
  }
});

app.get("/api/addons", async (req, res) => {
  try {
    const list = await db.all(`
    SELECT
    a.id,
    a.name,
    a.author,
    a.version,
    a.description,
    a.iconUrl,
    a.bannerUrl,
    a.tags,
    a.downloads,
    a.created_at,
    a.updated_at, -- Expose to array lists for frontend calculations
    u.id AS author_id,
    (SELECT COUNT(*) FROM likes l WHERE l.addon_id = a.id) AS stars
    FROM addons a
    LEFT JOIN users u ON u.username = a.author
    ORDER BY a.created_at DESC
    `);
    res.json({ ok: true, addons: list });
  } catch (err) {
    console.error("LIST ADDONS ERROR:", err);
    res.json({ ok: false, error: "Failed to load addons." });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    const type = String(req.query.type || "all").toLowerCase();

    if (!query) {
      return res.json({ ok: true, addons: [], users: [] });
    }

    const safeQuery = query.replace(/[%_]/g, "\\$&");
    const likeQuery = `%${safeQuery}%`;
    const includeAddons = type === "all" || type === "addons";
    const includeUsers = type === "all" || type === "users" || type === "people";

    const [addons, users] = await Promise.all([
      includeAddons
      ? db.all(
        `SELECT id, name, author, description, iconUrl, downloads, stars, created_at, updated_at
        FROM addons
        WHERE name LIKE ? ESCAPE '\\'
        OR description LIKE ? ESCAPE '\\'
        OR author LIKE ? ESCAPE '\\'
        OR tags LIKE ? ESCAPE '\\'
        ORDER BY
        CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
        created_at DESC
        LIMIT 8`,
        [likeQuery, likeQuery, likeQuery, likeQuery, `${safeQuery}%`]
      )
      : [],
      includeUsers
      ? db.all(
        `SELECT username, avatarUrl
        FROM users
        WHERE username LIKE ? ESCAPE '\\'
        ORDER BY
        CASE WHEN username LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
        username
        LIMIT 8`,
        [likeQuery, `${safeQuery}%`]
      )
      : []
    ]);

    res.json({ ok: true, addons, users });
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    res.json({ ok: false, addons: [], users: [], error: "Failed to search." });
  }
});

app.get("/api/game/versions", async (req, res) => {
  try {
    const versions = ["0.0.0", "0.0.1", "0.1.0", "0.1.1", "0.2.0", "0.3.0", "BLEEDING-EDGE", "ALL"];
    res.json({ ok: true, versions });
  } catch (err) {
    console.error("Failed to load game versions:", err);
    res.json({ ok: false, versions: [] });
  }
});

app.get("/api/users/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json({ ok: true, users: [] });

    const safeQuery = query.replace(/[%_]/g, "\\$&");
    const users = await db.all(
      "SELECT username FROM users WHERE username LIKE ? ESCAPE '\\' ORDER BY username LIMIT 20",
      [`%${safeQuery}%`]
    );
    res.json({ ok: true, users: users.map((u) => u.username) });
  } catch (err) {
    console.error("USER SEARCH ERROR:", err);
    res.json({ ok: false, users: [] });
  }
});

app.get("/api/users/:username", async (req, res) => {
  const username = req.params.username;
  try {
    const user = await db.get(
      "SELECT id, username, about, avatarUrl, bannerUrl, created_at FROM users WHERE username = ?",
      [username]
    );

    if (!user) return res.status(404).json({ ok: false, error: "User not found." });

    const addons = await db.all(
      `SELECT
      a.id, a.identifier, a.name, a.author, a.version, a.description,
      a.tags, a.iconUrl, a.bannerUrl, a.compatibility, a.downloads,
      a.created_at, a.updated_at,
      (SELECT COUNT(*) FROM likes l WHERE l.addon_id = a.id) AS stars
      FROM addons a
      WHERE a.author = ?
      ORDER BY a.created_at DESC`,
      [username]
    );

    const downloadsRow = await db.get("SELECT COALESCE(SUM(downloads), 0) AS downloads FROM addons WHERE author = ?", [username]);

    res.json({
      ok: true,
      user,
      about: user.about || "",
      avatarUrl: user.avatarUrl || null,
      bannerUrl: user.bannerUrl || null,
      addons,
      stats: {
        totalAddons: addons.length,
        totalDownloads: downloadsRow?.downloads || 0,
        location: "Earth"
      }
    });
  } catch (err) {
    console.error("GET /api/users/:username ERROR:", err);
    res.json({ ok: false, error: "Failed to load user profile." });
  }
});

app.post("/api/users/about", express.json(), async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in" });
  const about = typeof req.body.about === "string" ? req.body.about.trim() : "";
  const userId = req.session.user.id;
  try {
    await db.run("UPDATE users SET about = ? WHERE id = ?", [about, userId]);
    res.json({ ok: true, about });
  } catch (err) {
    console.error("UPDATE PROFILE ABOUT ERROR:", err);
    res.status(500).json({ ok: false, error: "Unable to update profile." });
  }
});

app.get("/profile/:username", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "profile.html"));
});

app.get("/api/user/addons", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in." });
    const username = req.session.user.username;
    const rows = await db.all(
      "SELECT id, identifier, name, version, description, tags, screenshots, iconUrl, bannerUrl, compatibility, created_at, updated_at FROM addons WHERE author = ? ORDER BY created_at DESC",
      username
    );
    res.json({ ok: true, addons: rows });
  } catch (err) {
    console.error("Failed to load user addons:", err);
    res.json({ ok: false, error: "Failed to load user addons." });
  }
});

app.get("/api/comments/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const comments = await db.all("SELECT * FROM comments WHERE addon_id = ? ORDER BY created_at DESC", id);
    comments.forEach(c => { c.content = sanitizeHtml(c.content || ""); });
    res.json({ ok: true, comments });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post("/api/comments/:id", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ ok: false, error: "You must be logged in to comment." });
  }
  const { id } = req.params;
  const username = req.session.user.username;
  let { content } = req.body;

  if (!content) return res.json({ ok: false, error: "Empty comment." });
  content = String(content).trim();
  if (content.length === 0) return res.json({ ok: false, error: "Empty comment." });
  if (content.length > 2000) return res.json({ ok: false, error: "Comment too long." });

  try {
    const safeContent = sanitizeHtml(content);
    await db.run("INSERT INTO comments (addon_id, username, content) VALUES (?, ?, ?)", [id, username, safeContent]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to insert comment:", err);
    res.json({ ok: false, error: err.message });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in." });
    const commentId = req.params.id;
    const comment = await db.get("SELECT * FROM comments WHERE id = ?", commentId);
    if (!comment) return res.status(404).json({ ok: false, error: "Comment not found." });

    const addon = await db.get("SELECT * FROM addons WHERE id = ?", comment.addon_id);
    if (!addon) return res.status(404).json({ ok: false, error: "Addon not found." });
    if (addon.author !== req.session.user.username) return res.status(403).json({ ok: false, error: "Not your addon." });

    await db.run("DELETE FROM comments WHERE id = ?", commentId);
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE COMMENT ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/versions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const versions = await db.all("SELECT * FROM versions WHERE addon_id = ? ORDER BY created_at DESC", id);
    res.json({ ok: true, versions });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.post("/api/versions/delete", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in." });
    const { versionIds } = req.body;
    if (!Array.isArray(versionIds) || versionIds.length === 0) return res.status(400).json({ ok: false, error: "No versions specified." });

    for (const vid of versionIds) {
      const version = await db.get("SELECT * FROM versions WHERE id = ?", vid);
      if (!version) continue;
      const addon = await db.get("SELECT * FROM addons WHERE id = ?", version.addon_id);
      if (!addon) continue;
      if (addon.author !== req.session.user.username) return res.status(403).json({ ok: false, error: "Not your addon." });

      const wasActive = version.fileUrl === addon.fileUrl;
      if (version.fileUrl) {
        const filePath = path.join(process.cwd(), version.fileUrl.replace(/^\/+/, ""));
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Failed to delete version file:", filePath, e);
        }
      }

      await db.run("DELETE FROM versions WHERE id = ?", vid);

      if (wasActive) {
        const latest = await db.get(`SELECT * FROM versions WHERE addon_id = ? ORDER BY created_at DESC LIMIT 1`, [version.addon_id]);
        if (latest) {
          await db.run("UPDATE addons SET fileUrl = ?, version = ? WHERE id = ?", [latest.fileUrl, latest.version, version.addon_id]);
        } else {
          await db.run("UPDATE addons SET fileUrl = NULL, version = NULL WHERE id = ?", [version.addon_id]);
        }
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE VERSION ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/versions/delete-all/:addonId", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in." });
    const { addonId } = req.params;
    const addon = await db.get("SELECT * FROM addons WHERE id = ?", addonId);
    if (!addon) return res.status(404).json({ ok: false, error: "Addon not found." });
    if (addon.author !== req.session.user.username) return res.status(403).json({ ok: false, error: "Not your addon." });

    const versions = await db.all("SELECT * FROM versions WHERE addon_id = ?", addonId);
    for (const v of versions) {
      if (v.fileUrl === addon.fileUrl) continue;
      if (v.fileUrl) {
        const filePath = path.join(process.cwd(), v.fileUrl.replace(/^\/+/, ""));
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.warn("Failed to delete version file:", filePath, e);
        }
      }
      await db.run("DELETE FROM versions WHERE id = ?", v.id);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE ALL VERSIONS ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post(
  "/api/addons/:id/update",
  async (req, res, next) => {
    try {
      const addon = await db.get("SELECT * FROM addons WHERE id = ?", req.params.id);
      if (addon) {
        const anyUrl = addon.fileUrl || addon.iconUrl || addon.bannerUrl || "";
        if (anyUrl) {
          const folder = path.basename(path.dirname(anyUrl));
          req._uploadFolder = folder;
        }
      }
    } catch (e) {
      console.warn("Failed to resolve upload folder:", e);
    }
    next();
  },
  (req, res, next) => {
    upload.fields([
      { name: "icon", maxCount: 1 },
      { name: "banner", maxCount: 1 },
      { name: "file", maxCount: 1 },
      { name: "screenshots", maxCount: 12 },
    ])(req, res, function (err) {
      if (err) {
        console.error("MULTER ERROR:", err);
        return res.status(400).json({ ok: false, error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const id = req.params.id;
    try {
      if (!req.session.user) return res.status(401).json({ ok: false, error: "Not logged in." });

      const addon = await db.get("SELECT * FROM addons WHERE id = ?", id);
      if (!addon) return res.status(404).json({ ok: false, error: "Addon not found." });
      if (addon.author !== req.session.user.username) return res.status(403).json({ ok: false, error: "Not your addon." });

      const {
        name,
        version,
        description,
        longDescription,
        compatibility,
        tags,
        creators
      } = req.body;

      let updates = {};
      if (name !== undefined) updates.name = name;
      if (version !== undefined) updates.version = version;
      if (description !== undefined) updates.description = description;
      if (longDescription !== undefined) updates.longDescription = longDescription;
      if (compatibility !== undefined) updates.compatibility = compatibility;

      if (tags !== undefined) {
        try {
          const parsed = typeof tags === "string" ? JSON.parse(tags) : tags;
          updates.tags = JSON.stringify(parsed || []);
        } catch {
          updates.tags = JSON.stringify([]);
        }
      }

      if (creators !== undefined) {
        try {
          const parsed = typeof creators === "string" ? JSON.parse(creators) : creators;
          updates.creators = JSON.stringify(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
        } catch {
          updates.creators = JSON.stringify([]);
        }
      }

      const folder = req._uploadFolder;
      if (req.files?.icon?.[0]) updates.iconUrl = `/uploads/${folder}/${req.files.icon[0].filename}`;
      if (req.files?.banner?.[0]) updates.bannerUrl = `/uploads/${folder}/${req.files.banner[0].filename}`;
      if (req.files?.file?.[0]) {
        const fileUrl = `/uploads/${folder}/${req.files.file[0].filename}`;
        updates.fileUrl = fileUrl;
        await db.run(
          "INSERT INTO versions (addon_id, version, fileUrl) VALUES (?, ?, ?)",
                     [id, version || addon.version || "", fileUrl]
        );
      }

      if (req.body.removeScreenshots) {
        let currentScreenshots = [];
        if (addon.screenshots) {
          try {
            currentScreenshots = JSON.parse(addon.screenshots);
            if (!Array.isArray(currentScreenshots)) currentScreenshots = [];
          } catch (e) {
            currentScreenshots = [];
          }
        }

        const targetUrl = req.body.removeScreenshots;

        // Only ever delete a file that is actually one of this addon's own
        // screenshots — targetUrl is client-supplied, so treat it as
        // untrusted and never build a filesystem path from it directly.
        if (currentScreenshots.includes(targetUrl)) {
          const updatedScreenshots = currentScreenshots.filter((src) => src !== targetUrl);
          updates.screenshots = JSON.stringify(updatedScreenshots);

          try {
            const uploadsRoot = path.join(process.cwd(), "uploads");
            const cleanPath = targetUrl.replace(/^\/+/, ""); // strip leading slash
            const filePath = path.join(process.cwd(), cleanPath);
            if (filePath.startsWith(uploadsRoot + path.sep) && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            console.warn("Failed to delete physical screenshot file from storage:", err);
          }
        }
      }

      if (req.files?.screenshots?.length) {
        let currentScreenshots = [];
        if (addon.screenshots) {
          try {
            currentScreenshots = JSON.parse(addon.screenshots);
            if (!Array.isArray(currentScreenshots)) currentScreenshots = [];
          } catch (e) {
            currentScreenshots = [];
          }
        }

        const newPaths = req.files.screenshots.map((f) => `/uploads/${folder}/${f.filename}`);

        updates.screenshots = JSON.stringify([...currentScreenshots, ...newPaths]);
      }

      if (req.files?.file?.[0]) {
        updates.updated_at = new Date().toISOString();
      }


      if (req.files?.banner?.[0]) {
        updates.bannerUrl = `/uploads/${folder}/${req.files.banner[0].filename}`;
      }

      if (req.files?.icon?.[0]) {
        updates.iconUrl = `/uploads/${folder}/${req.files.icon[0].filename}`;
      }

      const keys = Object.keys(updates);
      if (keys.length > 0) {
        const setClause = keys.map(k => `${k} = ?`).join(", ");
        const values = keys.map(k => updates[k]);
        values.push(id);

        await db.run(`UPDATE addons SET ${setClause} WHERE id = ?`, values);
      }

      const updatedAddon = await db.get("SELECT * FROM addons WHERE id = ?", id);
      res.json({ ok: true, addon: updatedAddon });

    } catch (err) {
      console.error("Update failed:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

app.post("/api/addons/:id/like", async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ ok: false, error: "You must be logged in to like addons." });
    }

    const userId = req.session.user.id;
    const addonId = req.params.id;

    const addon = await db.get("SELECT * FROM addons WHERE id = ?", addonId);
    if (!addon) {
      return res.status(404).json({ ok: false, error: "Addon not found." });
    }

    const existingLike = await db.get(
      "SELECT id FROM likes WHERE user_id = ? AND addon_id = ?",
      [userId, addonId]
    );

    let liked = false;
    if (existingLike) {
      await db.run("DELETE FROM likes WHERE id = ?", existingLike.id);
      liked = false;
    } else {
      await db.run("INSERT INTO likes (user_id, addon_id) VALUES (?, ?)", [userId, addonId]);
      liked = true;
    }

    const countRow = await db.get("SELECT COUNT(*) AS count FROM likes WHERE addon_id = ?", [addonId]);
    const totalStars = countRow?.count || 0;

    await db.run("UPDATE addons SET stars = ? WHERE id = ?", [totalStars, addonId]);

    return res.json({ ok: true, liked, stars: totalStars });

  } catch (err) {
    console.error("LIKE API ERROR:", err);
    return res.status(500).json({ ok: false, error: "Database error processing like state." });
  }
});

app.get("/api/addons/:id/download", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("You must be logged in to download addons.");
    }

    const addonId = req.params.id;

    const addon = await db.get("SELECT fileUrl, downloads FROM addons WHERE id = ?", addonId);
    if (!addon || !addon.fileUrl) {
      return res.status(404).send("File not found.");
    }

    if (shouldCountDownload(`addon:${addonId}:${req.session.user.id}`)) {
      const currentDownloads = addon.downloads || 0;
      await db.run("UPDATE addons SET downloads = ? WHERE id = ?", [currentDownloads + 1, addonId]);
    }

    const cleanPath = addon.fileUrl.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), cleanPath);

    if (!fs.existsSync(filePath)) {
      console.error(`Download error: File missing on disk at ${filePath}`);
      return res.status(404).send("The file is missing from the server storage.");
    }

    return res.download(filePath);

  } catch (err) {
    console.error("DOWNLOAD ROUTE ERROR:", err);
    return res.status(500).send("Internal server error handling download.");
  }
});

app.get("/api/versions/download/:versionId", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).send("You must be logged in to download addons.");
    }

    const versionId = req.params.versionId;

    const versionRecord = await db.get("SELECT addon_id, fileUrl FROM versions WHERE id = ?", versionId);
    if (!versionRecord || !versionRecord.fileUrl) {
      return res.status(404).send("Version file not found.");
    }

    if (shouldCountDownload(`version:${versionId}:${req.session.user.id}`)) {
      await db.run(
        "UPDATE addons SET downloads = COALESCE(downloads, 0) + 1 WHERE id = ?",
                   versionRecord.addon_id
      );
    }

    const cleanPath = versionRecord.fileUrl.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), cleanPath);

    if (!fs.existsSync(filePath)) {
      console.error(`Version download error: File missing at ${filePath}`);
      return res.status(404).send("The file is missing from the server storage.");
    }

    return res.download(filePath);

  } catch (err) {
    console.error("VERSION DOWNLOAD ROUTE ERROR:", err);
    return res.status(500).send("Internal server error handling version download.");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running smoothly on port ${PORT}`);
});
