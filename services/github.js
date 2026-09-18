import { db } from "../db/index.js";
import { createNotification } from "./notifications.js";

const CUBYZ_RELEASES_URL = "https://api.github.com/repos/PixelGuys/Cubyz/releases";

const CUBYZ_VERSIONS_CACHE_MS = 60 * 60 * 1000;
let cubyzVersionsCache = { versions: [], latest: null, fetchedAt: 0 };

async function notifyNewCubyzVersion(newLatest) {
  if (!db) return;
  try {
    const authors = await db.all(
      `SELECT DISTINCT a.author, u.id AS user_id
       FROM addons a
       JOIN users u ON u.username = a.author`
    );

    for (const { user_id } of authors) {
      await createNotification({
        userId: user_id,
        type: "new_cubyz_version",
        message: `Cubyz ${newLatest} is out - check if your addons need a new version.`,
        link: `/dashboard.html`,
        dedupeKey: `new_cubyz_version:${newLatest}:${user_id}`
      });
    }
  } catch (err) {
    console.error("Failed to create new-Cubyz-version notifications:", err);
  }
}

export async function getCubyzVersions() {
  const now = Date.now();
  if (cubyzVersionsCache.versions.length && now - cubyzVersionsCache.fetchedAt < CUBYZ_VERSIONS_CACHE_MS) {
    return cubyzVersionsCache;
  }

  try {
    const res = await fetch(CUBYZ_RELEASES_URL, {
      headers: { "User-Agent": "cubyz-addon-marketplace", "Accept": "application/vnd.github+json" }
    });
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const releases = await res.json();

    const tags = releases
    .filter((r) => !r.draft && !r.prerelease && r.tag_name)
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at))
    .map((r) => r.tag_name);

    if (tags.length) {
      const previousLatest = cubyzVersionsCache.latest;
      const newLatest = tags[tags.length - 1];

      cubyzVersionsCache = {
        versions: [...tags, "UPSTREAM"],
        latest: newLatest,
        fetchedAt: now
      };

      if (previousLatest && previousLatest !== newLatest) {
        notifyNewCubyzVersion(newLatest).catch((err) => {
          console.error("notifyNewCubyzVersion failed:", err);
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch Cubyz releases from GitHub:", err.message);
  }

  return cubyzVersionsCache;
}

const GITHUB_RELEASE_CACHE_MS = 30 * 60 * 1000;

export function parseGithubRepoUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

const GITHUB_RELEASE_HISTORY_LIMIT = 10;

function mapGithubRelease(release, fallbackUrl) {
  return {
    tag: release.tag_name || null,
    name: release.name || release.tag_name || null,
    publishedAt: release.published_at || null,
    htmlUrl: release.html_url || fallbackUrl,
    assets: Array.isArray(release.assets)
      ? release.assets.map((a) => ({ name: a.name, downloadUrl: a.browser_download_url, size: a.size }))
      : []
  };
}

export async function getGithubReleases(addon) {
  const now = Date.now();
  const fetchedAt = addon.github_release_fetched_at ? new Date(addon.github_release_fetched_at).getTime() : 0;
  if (addon.github_release_cache && now - fetchedAt < GITHUB_RELEASE_CACHE_MS) {
    try {
      return JSON.parse(addon.github_release_cache);
    } catch {
    }
  }

  const repoInfo = parseGithubRepoUrl(addon.githubUrl || "");
  if (!repoInfo) return { latest: null, releases: [] };

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases?per_page=${GITHUB_RELEASE_HISTORY_LIMIT}`,
      { headers: { "User-Agent": "cubyz-addon-marketplace", "Accept": "application/vnd.github+json" } }
    );
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
    const rawReleases = await res.json();

    const releases = (Array.isArray(rawReleases) ? rawReleases : [])
      .filter((r) => !r.draft)
      .map((r) => mapGithubRelease(r, addon.githubUrl));

    const result = { latest: releases[0] || null, releases };

    await db.run(
      "UPDATE addons SET github_release_cache = ?, github_release_fetched_at = ? WHERE id = ?",
      [JSON.stringify(result), new Date().toISOString(), addon.id]
    );

    return result;
  } catch (err) {
    console.error(`Failed to fetch GitHub releases for addon ${addon.id}:`, err.message);
    if (addon.github_release_cache) {
      try {
        return JSON.parse(addon.github_release_cache);
      } catch {
        return { latest: null, releases: [] };
      }
    }
    return { latest: null, releases: [] };
  }
}
