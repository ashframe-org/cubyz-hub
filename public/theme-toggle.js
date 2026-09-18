const THEME_KEY = "cubyzhub-theme";

function applyTheme(theme) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", "ashframe");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "ashframe" ? "ashframe" : "default";
  const next = current === "ashframe" ? "default" : "ashframe";
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (_) {}

  fetch("/api/users/theme-preference", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme: next })
  }).catch(() => {});
}

function initThemeToggleTrigger() {
  const triggers = document.querySelectorAll("[data-theme-trigger]");
  triggers.forEach((trigger) => {
    trigger.style.cursor = "pointer";
    trigger.addEventListener("click", toggleTheme);
  });
}

async function syncThemeFromAccount() {
  try {
    const res = await fetch("/api/auth/status", { credentials: "include" });
    const json = await res.json();
    if (!json.ok || !json.themePreference) return;

    const current = document.documentElement.getAttribute("data-theme") === "ashframe" ? "ashframe" : "default";
    if (json.themePreference !== current) {
      applyTheme(json.themePreference);
    }
    try {
      localStorage.setItem(THEME_KEY, json.themePreference);
    } catch (_) {}
  } catch (_) {}
}

const ACTIVITY_HEARTBEAT_INTERVAL_MS = 15 * 1000;
function startActivityHeartbeat() {
  setInterval(() => {
    if (document.visibilityState === "visible") {
      fetch("/api/auth/status", { credentials: "include" }).catch(() => {});
    }
  }, ACTIVITY_HEARTBEAT_INTERVAL_MS);
}

window.addEventListener("DOMContentLoaded", () => {
  initThemeToggleTrigger();
  syncThemeFromAccount();
  startActivityHeartbeat();
});
