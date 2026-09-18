import sqlite3 from "sqlite3";
import { open } from "sqlite";

export let db;

export async function initDb() {
  db = await open({
    filename: "./cubyzhub.db",
    driver: sqlite3.Database,
  });

  await db.exec(`PRAGMA journal_mode = WAL;`);
  await db.exec(`PRAGMA busy_timeout = 5000;`);

  setInterval(() => {
    db.exec(`PRAGMA wal_checkpoint(PASSIVE);`).catch((err) => {
      console.error("Periodic WAL checkpoint failed:", err);
    });
  }, 3 * 60 * 1000).unref();

  await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    about TEXT,
    security_question TEXT,
    security_answer_hash TEXT,
    recovery_code_hash TEXT,
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

  CREATE TABLE IF NOT EXISTS passkeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    device_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    addon_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER,
    followed_username TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    message TEXT,
    link TEXT,
    read INTEGER DEFAULT 0,
    dedupe_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS changelog_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_username TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  `);

  const changelogColumns = await db.all(`PRAGMA table_info(changelog_entries);`);
  if (!changelogColumns.some((col) => col.name === "is_test")) {
    await db.exec(`ALTER TABLE changelog_entries ADD COLUMN is_test INTEGER DEFAULT 0;`);
  }
  if (!changelogColumns.some((col) => col.name === "is_draft")) {
    await db.exec(`ALTER TABLE changelog_entries ADD COLUMN is_draft INTEGER DEFAULT 0;`);
  }
  if (!changelogColumns.some((col) => col.name === "tag")) {
    await db.exec(`ALTER TABLE changelog_entries ADD COLUMN tag TEXT;`);
  }
  if (!changelogColumns.some((col) => col.name === "screenshots")) {
    await db.exec(`ALTER TABLE changelog_entries ADD COLUMN screenshots TEXT;`);
  }
  if (!changelogColumns.some((col) => col.name === "sort_order")) {
    await db.exec(`ALTER TABLE changelog_entries ADD COLUMN sort_order INTEGER;`);
    await db.exec(`UPDATE changelog_entries SET sort_order = id WHERE sort_order IS NULL;`);
  }

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
  if (!userColumns.some((col) => col.name === "security_question")) {
    await db.exec(`ALTER TABLE users ADD COLUMN security_question TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "security_answer_hash")) {
    await db.exec(`ALTER TABLE users ADD COLUMN security_answer_hash TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "recovery_code_hash")) {
    await db.exec(`ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "social_links")) {
    await db.exec(`ALTER TABLE users ADD COLUMN social_links TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "notification_prefs")) {
    await db.exec(`ALTER TABLE users ADD COLUMN notification_prefs TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "followers_visibility")) {
    await db.exec(`ALTER TABLE users ADD COLUMN followers_visibility TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "following_visibility")) {
    await db.exec(`ALTER TABLE users ADD COLUMN following_visibility TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "theme_preference")) {
    await db.exec(`ALTER TABLE users ADD COLUMN theme_preference TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "last_seen")) {
    await db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT;`);
  }
  if (!userColumns.some((col) => col.name === "activity_visible")) {
    await db.exec(`ALTER TABLE users ADD COLUMN activity_visible INTEGER;`);
  }

  const addonColumns = await db.all(`PRAGMA table_info(addons);`);
  if (!addonColumns.some((col) => col.name === "creators")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN creators TEXT;`);
  }

  if (!addonColumns.some((col) => col.name === "updated_at")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN updated_at TEXT;`);
    await db.exec(`UPDATE addons SET updated_at = created_at WHERE updated_at IS NULL;`);
  }

  if (!addonColumns.some((col) => col.name === "iconThumbUrl")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN iconThumbUrl TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "bannerThumbUrl")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN bannerThumbUrl TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "author_role")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN author_role TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "githubUrl")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN githubUrl TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "license")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN license TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "type")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN type TEXT NOT NULL DEFAULT 'addon';`);
  }
  if (!addonColumns.some((col) => col.name === "release_url")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN release_url TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "github_mode")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN github_mode TEXT NOT NULL DEFAULT 'manual';`);
  }
  if (!addonColumns.some((col) => col.name === "github_release_cache")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN github_release_cache TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "github_release_fetched_at")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN github_release_fetched_at TEXT;`);
  }
  if (!addonColumns.some((col) => col.name === "ai_usage")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN ai_usage TEXT NOT NULL DEFAULT 'none';`);
  }
  await db.exec(`UPDATE addons SET ai_usage = 'full' WHERE ai_usage = 'partial';`);
  if (!addonColumns.some((col) => col.name === "downloads")) {
    await db.exec(`ALTER TABLE addons ADD COLUMN downloads INTEGER DEFAULT 0;`);
  }

  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_addon ON likes(user_id, addon_id);`);

  const commentColumns = await db.all(`PRAGMA table_info(comments);`);
  if (!commentColumns.some((col) => col.name === "parent_id")) {
    await db.exec(`ALTER TABLE comments ADD COLUMN parent_id INTEGER;`);
  }

  const followColumns = await db.all(`PRAGMA table_info(follows);`);
  if (!followColumns.some((col) => col.name === "created_at")) {
    await db.exec(`ALTER TABLE follows ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP;`);
  }

  const notificationColumns = await db.all(`PRAGMA table_info(notifications);`);
  if (!notificationColumns.some((col) => col.name === "dedupe_key")) {
    await db.exec(`ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;`);
  }
  if (!notificationColumns.some((col) => col.name === "data")) {
    await db.exec(`ALTER TABLE notifications ADD COLUMN data TEXT;`);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      addon_id INTEGER NOT NULL,
      invited_username TEXT NOT NULL,
      role TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT
    );
  `);
  await db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_invites_pending
    ON creator_invites(addon_id, invited_username)
    WHERE status = 'pending';
  `);

  const versionColumns = await db.all(`PRAGMA table_info(versions);`);
  if (!versionColumns.some((col) => col.name === "compatibility")) {
    await db.exec(`ALTER TABLE versions ADD COLUMN compatibility TEXT;`);
    await db.exec(`
      UPDATE versions
      SET compatibility = (SELECT compatibility FROM addons WHERE addons.id = versions.addon_id)
      WHERE compatibility IS NULL;
    `);
  }
  if (!versionColumns.some((col) => col.name === "downloads")) {
    await db.exec(`ALTER TABLE versions ADD COLUMN downloads INTEGER DEFAULT 0;`);
  }
  if (!versionColumns.some((col) => col.name === "changelog")) {
    await db.exec(`ALTER TABLE versions ADD COLUMN changelog TEXT;`);
  }
  if (!versionColumns.some((col) => col.name === "release_url")) {
    await db.exec(`ALTER TABLE versions ADD COLUMN release_url TEXT;`);
  }
  if (!versionColumns.some((col) => col.name === "release_channel")) {
    await db.exec(`ALTER TABLE versions ADD COLUMN release_channel TEXT NOT NULL DEFAULT 'release';`);
  }

  await db.exec(`UPDATE addons SET compatibility = 'UPSTREAM' WHERE compatibility = 'BLEEDING-EDGE';`);
  await db.exec(`UPDATE versions SET compatibility = 'UPSTREAM' WHERE compatibility = 'BLEEDING-EDGE';`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      asset_type TEXT CHECK(asset_type IN ('full_model', 'skin_only')) NOT NULL,
      associated_model TEXT,
      glb_path TEXT,
      texture_path TEXT,
      thumbnail_path TEXT,
      votes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS model_votes (
      model_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (model_id, user_id),
      FOREIGN KEY(model_id) REFERENCES models(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_models_user ON models(user_id);`);

  const modelColumns = await db.all(`PRAGMA table_info(models);`);
  if (!modelColumns.some((col) => col.name === "status")) {
    await db.exec(`ALTER TABLE models ADD COLUMN status TEXT NOT NULL DEFAULT 'published';`);
  }
  if (!modelColumns.some((col) => col.name === "parent_model_id")) {
    await db.exec(`ALTER TABLE models ADD COLUMN parent_model_id INTEGER REFERENCES models(id);`);
  }
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_models_parent ON models(parent_model_id);`);

  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_follower_username ON follows(follower_id, followed_username);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);`);
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      long_description TEXT,
      website_url TEXT,
      chat_url TEXT,
      icon_url TEXT,
      ip TEXT,
      version TEXT,
      gamemodes TEXT,
      languages TEXT,
      requires_mods INTEGER NOT NULL DEFAULT 0,
      connection_method TEXT,
      player_count INTEGER NOT NULL DEFAULT 0,
      online INTEGER NOT NULL DEFAULT 0,
      last_relay_update TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);`);

  const serversColumns = await db.all(`PRAGMA table_info(servers)`);
  if (!serversColumns.some((col) => col.name === "player_names")) {
    await db.exec(`ALTER TABLE servers ADD COLUMN player_names TEXT;`);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS server_api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      owner_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_used_at TEXT,
      FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_server_tokens_server ON server_api_tokens(server_id);`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS server_required_mods (
      server_id INTEGER NOT NULL,
      addon_id INTEGER NOT NULL,
      PRIMARY KEY (server_id, addon_id),
      FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY(addon_id) REFERENCES addons(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_server_required_mods_addon ON server_required_mods(addon_id);`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS server_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      server_id INTEGER
    );
  `);
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_server_likes_user_server ON server_likes(user_id, server_id);`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS creator_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      game_version TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_creator_projects_user ON creator_projects(user_id);`);

  await db.exec(`CREATE INDEX IF NOT EXISTS idx_addons_author ON addons(author);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_versions_addon ON versions(addon_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_addon ON comments(addon_id, parent_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_username);`);
  const tokenColumns = await db.all(`PRAGMA table_info(server_api_tokens);`);
  if (!tokenColumns.some((col) => col.name === "token_prefix")) {
    await db.exec(`ALTER TABLE server_api_tokens ADD COLUMN token_prefix TEXT;`);
  }
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_server_tokens_prefix ON server_api_tokens(token_prefix);`);
}

export async function withTransaction(fn) {
  await db.exec("BEGIN IMMEDIATE;");
  try {
    const result = await fn();
    await db.exec("COMMIT;");
    return result;
  } catch (err) {
    try {
      await db.exec("ROLLBACK;");
    } catch (rollbackErr) {
      console.error("Transaction rollback failed:", rollbackErr);
    }
    throw err;
  }
}
