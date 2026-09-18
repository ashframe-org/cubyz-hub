import path from "node:path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";


export function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }
      req.session.user = { id: user.id, username: user.username };
      resolve();
    });
  });
}

let sessionsDb = null;
async function getSessionsDb() {
  if (!sessionsDb) {
    sessionsDb = await open({
      filename: path.join(process.cwd(), "data", "sessions.sqlite"),
      driver: sqlite3.Database,
    });
  }
  return sessionsDb;
}

export async function destroyUserSessions(userId) {
  const db = await getSessionsDb();
  const rows = await db.all("SELECT sid, sess FROM sessions");
  let removed = 0;
  for (const row of rows) {
    let payload = null;
    try {
      payload = JSON.parse(row.sess);
    } catch {
      continue;
    }
    if (payload && payload.user && payload.user.id === userId) {
      await db.run("DELETE FROM sessions WHERE sid = ?", [row.sid]);
      removed += 1;
    }
  }
  return removed;
}
