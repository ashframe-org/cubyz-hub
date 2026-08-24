import { createAddonCard } from './addon_cards.js';

const DEFAULT_AVATAR = "/assets/Snale_Avatar.webp";

function getUsernameFromUrl() {
  const pathMatch = window.location.pathname.match(/^\/profile\/([^\/]+)/);
  if (pathMatch && pathMatch[1]) {
    return decodeURIComponent(pathMatch[1]);
  }
  return new URLSearchParams(window.location.search).get("username");
}

function setText(selector, text) {
  const el = document.getElementById(selector);
  if (!el) return;
  el.textContent = text;
}

function formatNumber(value) {
  if (typeof value !== "number") return "0";
  return new Intl.NumberFormat().format(value);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function showEmptyState(message) {
  const noAddons = document.getElementById("no-addons");
  const addonContainer = document.getElementById("addon-container");
  if (addonContainer) addonContainer.classList.add("hidden");
  if (noAddons) {
    noAddons.classList.remove("hidden");
    noAddons.querySelector("p").textContent = message || "This user has not uploaded any addons yet.";
  }
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeUrl(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:") {
      return url.href;
    }
  } catch (_) {
    return fallback;
  }
  return fallback;
}

async function checkProfileOwner(username) {
  try {
    const res = await fetch("/api/auth/status", {
      credentials: "include",
    });
    const json = await res.json();
    return json.ok && json.user && json.user.username === username;
  } catch (err) {
    console.error("PROFILE OWNER CHECK ERROR:", err);
    return false;
  }
}

function createAboutParagraph(text) {
  const p = document.createElement("p");
  p.id = "profile-about";
  p.className = "profile-about editable";
  p.title = "Click to edit your about section";
  p.textContent = text;
  p.addEventListener("click", startAboutEdit);
  return p;
}

function restoreAboutParagraph(text) {
  const wrapper = document.querySelector(".profile-about-edit-wrapper");
  const paragraph = createAboutParagraph(text);
  if (wrapper && wrapper.parentNode) {
    wrapper.parentNode.replaceChild(paragraph, wrapper);
  }
}

function startAboutEdit() {
  const aboutEl = document.getElementById("profile-about");
  if (!aboutEl || aboutEl.classList.contains("editing")) return;

  aboutEl.classList.add("editing");
  const currentText = aboutEl.textContent.trim();

  const textarea = document.createElement("textarea");
  textarea.className = "profile-about-edit";
  textarea.value = currentText;
  textarea.rows = 4;

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "profile-about-action save";
  saveButton.textContent = "Save";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "profile-about-action cancel";
  cancelButton.textContent = "Cancel";

  const actionRow = document.createElement("div");
  actionRow.className = "profile-about-edit-actions";
  actionRow.append(saveButton, cancelButton);

  const wrapper = document.createElement("div");
  wrapper.className = "profile-about-edit-wrapper";
  wrapper.append(textarea, actionRow);

  aboutEl.replaceWith(wrapper);
  textarea.focus();

  saveButton.addEventListener("click", async () => {
    const updatedText = textarea.value.trim();
    try {
      const res = await fetch("/api/users/about", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about: updatedText }),
      });
      const json = await res.json();
      if (json.ok) {
        const paragraph = createAboutParagraph(json.about || updatedText);
        wrapper.parentNode.replaceChild(paragraph, wrapper);
      } else {
        alert("Unable to save about text: " + (json.error || "Unknown error"));
      }
    } catch (err) {
      console.error("SAVE ABOUT ERROR:", err);
      alert("Unable to save about text.");
    }
  });

  cancelButton.addEventListener("click", () => {
    restoreAboutParagraph(currentText);
  });
}

function openAvatarUpload() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      fileInput.remove();
      return;
    }

    const compressedAvatar = await compressImage(file, 512, 512, 0.90);
    const formData = new FormData();
    formData.append("avatar", compressedAvatar);

    try {
      const res = await fetch("/api/auth/upload-avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      console.log("Avatar upload response:", json);
      if (json.ok && json.avatarUrl) {
        const avatarEl = document.getElementById("profile-avatar");
        if (avatarEl) {
          avatarEl.src = `${json.avatarUrl}?t=${Date.now()}`;
        }

        await loadNavUser();
      } else if (json.ok) {
        window.location.reload();
      } else {
        alert("Unable to upload avatar: " + (json.error || "Unknown error"));
      }
    } catch (err) {
      console.error("UPLOAD AVATAR ERROR:", err);
      alert("Unable to upload avatar.");
    } finally {
      fileInput.remove();
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
}

function openBannerUpload() {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      fileInput.remove();
      return;
    }

    const compressedBanner = await compressImage(file, 1280, 720, 0.85);
    const formData = new FormData();
    formData.append("banner", compressedBanner);

    try {
      const res = await fetch("/api/auth/upload-banner", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (json.ok && json.bannerUrl) {
        const bannerEl = document.getElementById("profile-banner");
        if (bannerEl) {
          bannerEl.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.78)), url('${safeUrl(json.bannerUrl, "/assets/default_banner.png")}')`;
        }
      } else {
        alert("Unable to upload banner: " + (json.error || "Unknown error"));
      }
    } catch (err) {
      console.error("UPLOAD BANNER ERROR:", err);
      alert("Unable to upload banner.");
    } finally {
      fileInput.remove();
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
}

function enableProfileEditing() {
  const avatarShell = document.querySelector(".profile-avatar-shell");
  const bannerEl = document.getElementById("profile-banner");
  const aboutEl = document.getElementById("profile-about");
  if (avatarShell) {
    avatarShell.classList.add("editable");
    avatarShell.title = "Click to upload a new avatar";
    avatarShell.addEventListener("click", openAvatarUpload);
  }
  if (bannerEl) {
    bannerEl.classList.add("editable");
    bannerEl.title = "Click to upload a new banner";
    bannerEl.addEventListener("click", openBannerUpload);
  }
  if (aboutEl) {
    aboutEl.classList.add("profile-about", "editable");
    aboutEl.title = "Click to edit your about section";
    aboutEl.addEventListener("click", startAboutEdit);
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadProfile() {
  const username = getUsernameFromUrl();
  if (!username) {
    setText("profile-name", "Profile not found");
    setText("profile-bio", "No user was specified.");
    return;
  }

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}`);
    const data = await response.json();

    if (!data.ok) {
      setText("profile-name", "Profile not found");
      setText("profile-bio", data.error || "This profile does not exist.");
      return;
    }

    const user = data.user;
    const stats = data.stats || {};
    const aboutText = data.about || "No profile details have been added yet.";

    document.title = `${user.username} • Cubyz Hub`;
    setText("profile-name", user.username);
    setText("profile-handle", `@${user.username}`);
    setText("profile-addons-count", formatNumber(stats.totalAddons || 0));
    setText("profile-downloads-count", formatNumber(stats.totalDownloads || 0));
    setText("profile-joined-date", `Joined ${formatDate(user.created_at)}`);
    setText("stat-addons", formatNumber(stats.totalAddons || 0));
    setText("stat-downloads", formatNumber(stats.totalDownloads || 0));
    setText("stat-joined", formatDate(user.created_at));
    setText("stat-location", stats.location || "Earth");
    setText("profile-about", aboutText);

    if (await checkProfileOwner(user.username)) {
      enableProfileEditing();
    }

    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl) {
      const avatarUrl = data.avatarUrl || DEFAULT_AVATAR;
      avatarEl.classList.add("img-fade");
      const revealAvatar = () => avatarEl.classList.add("loaded");
      avatarEl.addEventListener("load", revealAvatar, { once: true });
      avatarEl.src = safeUrl(avatarUrl, DEFAULT_AVATAR);
      avatarEl.onerror = () => {
        avatarEl.src = DEFAULT_AVATAR;
        revealAvatar();
      };
    }

    const bannerEl = document.getElementById("profile-banner");
    if (bannerEl) {
      const bannerUrl = data.bannerUrl || "/assets/default_banner.png";
      bannerEl.classList.add("fade-in");
      bannerEl.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.78)), url('${safeUrl(bannerUrl, "/assets/default_banner.png")}')`;
    }

    const addonContainer = document.getElementById("addon-container");
    const noAddons = document.getElementById("no-addons");
    if (!addonContainer) return;

    if (!Array.isArray(data.addons) || data.addons.length === 0) {
      showEmptyState();
      return;
    }

    if (noAddons) noAddons.classList.add("hidden");
    addonContainer.classList.remove("hidden");
    addonContainer.innerHTML = "";
    const addons = data.addons || [];

    const cards = addons.map(addon => {
      const card = createAddonCard(addon);
      addonContainer.appendChild(card);
      return { card, addon };
    });

    (async () => {
      let user = null;

      try {
        const auth = await fetch("/api/auth/status", {
          credentials: "include"
        }).then(r => r.json());

        if (auth.ok) user = auth.user;
      } catch {
        return;
      }

      if (!user) return;

      for (const { card, addon } of cards) {
        try {
          const res = await fetch(`/api/addons/${addon.id}/liked`, {
            credentials: "include"
          }).then(r => r.json());

          if (res.ok && res.liked) {
            card.classList.add("liked");
          }
        } catch {

        }
      }
    })();
  } catch (err) {
    console.error("PROFILE LOAD ERROR:", err);
    setText("profile-name", "Profile not found");
    setText("profile-bio", "Unable to load profile details.");
  }
}

loadProfile();
