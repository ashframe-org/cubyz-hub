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

function fadeInImage(img) {
  img.classList.add("img-fade");
  const reveal = () => img.classList.add("loaded");
  if (img.complete && img.naturalWidth > 0) {
    reveal();
  } else {
    img.addEventListener("load", reveal, { once: true });
    img.addEventListener("error", reveal, { once: true });
  }
}

function parseTags(tags) {
  try {
    if (Array.isArray(tags)) return tags;
    return JSON.parse(tags || "[]");
  } catch {
    return [];
  }
}

export function createAddonCard(addon) {
  const link = document.createElement("a");
  link.className = "addon-card fade-in-card";
  link.href = `/addon/${addon.id}-${slugify(addon.name || "addon")}`;
  link.setAttribute("aria-label", `Open ${addon.name || "Addon"}`);

  const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  let showRibbon = false;
  let ribbonText = "";
  let ribbonClass = "";

  if (addon.created_at) {
    const createdDate = new Date(addon.created_at).getTime();
    if (now - createdDate <= twentyFourHoursInMs) {
      showRibbon = true;
      ribbonText = "NEW";
      ribbonClass = "ribbon-new";
    }
  }

  if (!showRibbon && addon.updated_at) {
    const updatedDate = new Date(addon.updated_at).getTime();
    if (now - updatedDate <= twentyFourHoursInMs) {
      showRibbon = true;
      ribbonText = "UPDATED";
      ribbonClass = "ribbon-updated";
    }
  }

  if (showRibbon) {
    const ribbonWrapper = document.createElement("div");
    ribbonWrapper.className = "ribbon-wrapper";

    const ribbonElement = document.createElement("div");
    ribbonElement.className = ribbonClass;
    ribbonElement.textContent = ribbonText;

    ribbonWrapper.appendChild(ribbonElement);
    link.appendChild(ribbonWrapper);
  }

  const banner = document.createElement("img");
  banner.className = "addon-banner";
  banner.src = safeUrl(addon.bannerUrl, "/assets/default_banner.png");
  banner.alt = "banner";
  banner.loading = "lazy";
  fadeInImage(banner);

  const iconWrap = document.createElement("div");
  iconWrap.className = "addon-icon";
  const iconImg = document.createElement("img");
  iconImg.src = safeUrl(addon.iconUrl, "/assets/default_icon.png");
  iconImg.alt = addon.name || "Addon";
  iconImg.loading = "lazy";
  fadeInImage(iconImg);
  iconWrap.appendChild(iconImg);

  const info = document.createElement("div");
  info.className = "addon-info";

  const title = document.createElement("h3");
  title.className = "addon-title";
  title.textContent = addon.name || "Untitled";

  const likes = document.createElement("span");
  likes.className = "title-likes";
  likes.innerHTML = `<span class="like-icon">❤</span> ${addon.likes ?? addon.stars ?? 0}`;
  title.appendChild(likes);

  const author = document.createElement("p");
  author.className = "addon-author";
  author.textContent = `By ${addon.author || "Unknown"}`;

  const desc = document.createElement("p");
  desc.className = "addon-desc";
  desc.textContent = addon.description || "";

  const tagsRow = document.createElement("div");
  tagsRow.className = "addon-tags";
  parseTags(addon.tags)
  .slice(0, 6)
  .forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tagsRow.appendChild(chip);
  });

  const meta = document.createElement("div");
  meta.className = "addon-meta";

  const downloads = document.createElement("span");
  downloads.className = "title-downloads";
  downloads.innerHTML = `
  <span class="download-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v12"></path>
  <path d="M7 10l5 5 5-5"></path>
  <path d="M5 21h14a2 2 0 0 0 2-2v-3"></path>
  <path d="M3 16v3a2 2 0 0 0 2 2"></path>
  </svg>
  </span>
  ${addon.downloads ?? 0}
  `;
  meta.appendChild(downloads);

  info.append(title, author, desc, tagsRow, meta);
  link.append(banner, iconWrap, info);

  return link;
}
