const CHANGELOG_LAST_SEEN_KEY = "cubyzhub-changelog-last-seen";
const CHANGELOG_DISMISSED_KEY = "cubyzhub-changelog-dismissed";

async function checkChangelogBanner() {
  if (window.location.pathname.endsWith("changelog.html")) return;

  try {
    const res = await fetch("/api/changelog");
    const json = await res.json();
    if (!json.ok || !json.entries || !json.entries[0]) return;

    const latest = json.entries[0];
    let lastSeen = 0;
    try {
      lastSeen = parseInt(localStorage.getItem(CHANGELOG_LAST_SEEN_KEY) || "0", 10) || 0;
    } catch (_) {}
    if (latest.id <= lastSeen) return;

    let dismissed = 0;
    try {
      dismissed = parseInt(localStorage.getItem(CHANGELOG_DISMISSED_KEY) || "0", 10) || 0;
    } catch (_) {}
    if (latest.id <= dismissed) return;

    try {
      const statusRes = await fetch("/api/auth/status", { credentials: "include" });
      const statusJson = await statusRes.json();
      if (statusJson.ok) {
        const prefsRes = await fetch("/api/users/notification-prefs", { credentials: "include" });
        const prefsJson = await prefsRes.json();
        if (prefsJson.ok && prefsJson.prefs.changelogUpdates === false) return;
      }
    } catch (_) {}

    showChangelogBanner(latest);
  } catch (err) {
    console.error("Failed to check for changelog updates:", err);
  }
}

function showChangelogBanner(entry) {
  const banner = document.createElement("div");
  banner.className = "changelog-banner";
  banner.innerHTML = `
    <a class="changelog-banner-text" href="/changelog.html"></a>
    <button type="button" class="changelog-banner-dismiss" aria-label="Dismiss">&times;</button>
  `;
  banner.querySelector(".changelog-banner-text").textContent = `New update: ${entry.title}`;
  document.body.appendChild(banner);

  banner.querySelector(".changelog-banner-dismiss").addEventListener("click", () => {
    try {
      localStorage.setItem(CHANGELOG_DISMISSED_KEY, String(entry.id));
    } catch (_) {}
    banner.remove();
  });
}

window.addEventListener("DOMContentLoaded", checkChangelogBanner);
