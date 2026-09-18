import fs from "fs";
import { db, withTransaction } from "../db/index.js";
import { resolveLocalFile } from "./uploads.js";

export async function deleteAddonCascade(addon) {
  const addonId = addon.id;
  const versions = await db.all("SELECT fileUrl FROM versions WHERE addon_id = ?", addonId);
  const filesToDelete = versions.map(v => v.fileUrl).concat([addon.fileUrl, addon.iconUrl, addon.bannerUrl, addon.iconThumbUrl, addon.bannerThumbUrl]);

  await withTransaction(async () => {
    await db.run("DELETE FROM versions WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM comments WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM likes WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM server_required_mods WHERE addon_id = ?", addonId);
    await db.run("DELETE FROM addons WHERE id = ?", addonId);
  });

  filesToDelete.forEach(fileUrl => {
    if (!fileUrl) return;
    const filePath = resolveLocalFile(fileUrl);
    if (!filePath) {
      console.warn("Refusing to delete out-of-root file URL:", fileUrl);
      return;
    }
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn("Failed to delete file:", filePath, e);
    }
  });
}
