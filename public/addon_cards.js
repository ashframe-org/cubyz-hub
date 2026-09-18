function addonLink(addon) {
  const prefix = addon.type === "mod" ? "/mod" : "/addon";
  return `${prefix}/${addon.id}-${slugify(addon.name || "addon")}`;
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

function buildTagsRow(addon, limit) {
  const tagsRow = document.createElement("div");
  tagsRow.className = "addon-tags";
  parseTags(addon.tags)
  .slice(0, limit)
  .forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tagsRow.appendChild(chip);
  });
  return tagsRow;
}

function downloadIconHtml(count) {
  return `
  <span class="download-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v12"></path>
  <path d="M7 10l5 5 5-5"></path>
  <path d="M5 21h14a2 2 0 0 0 2-2v-3"></path>
  <path d="M3 16v3a2 2 0 0 0 2 2"></path>
  </svg>
  </span>
  ${count ?? 0}
  `;
}

function formatCompatibility(compatibility) {
  if (!compatibility) return null;
  return compatibility;
}

function compatIconHtml(compatibility) {
  const label = formatCompatibility(compatibility);
  if (!label) return "";
  return `
  <span class="compat-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 3 7v10l9 5 9-5V7z"></path>
  <path d="M3 7l9 5 9-5"></path>
  <path d="M12 12v10"></path>
  </svg>
  </span>
  <span class="compat-label">${label}</span>
  `;
}

function likeIconHtml(count) {
  return `
  <span class="like-icon" aria-hidden="true">
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
  <path d="M12 21s-6.7-4.35-9.3-8.1C1 10.1 1.8 6.6 4.9 5.2c2.2-1 4.4-.2 5.6 1.4a1 1 0 0 0 1.6 0c1.2-1.6 3.4-2.4 5.6-1.4 3.1 1.4 3.9 4.9 2.2 7.7C18.7 16.65 12 21 12 21Z"></path>
  </svg>
  </span>
  ${count ?? 0}
  `;
}

export function createAddonCard(addon, eager = false) {
  const link = document.createElement("a");
  link.className = "addon-card fade-in-card";
  link.href = addonLink(addon);
  link.setAttribute("aria-label", `Open ${addon.name || "Addon"}`);

  const banner = document.createElement("img");
  banner.className = "addon-banner";
  banner.src = safeUrl(addon.bannerThumbUrl || addon.bannerUrl, "/assets/default_banner.png");
  banner.alt = "banner";
  if (eager) {
    banner.fetchPriority = "high";
  } else {
    banner.loading = "lazy";
  }
  fadeInImage(banner);

  const iconWrap = document.createElement("div");
  iconWrap.className = "addon-icon";
  const iconImg = document.createElement("img");
  iconImg.src = safeUrl(addon.iconThumbUrl || addon.iconUrl, "/assets/default_icon.png");
  iconImg.alt = addon.name || "Addon";
  if (!eager) iconImg.loading = "lazy";
  fadeInImage(iconImg);
  iconWrap.appendChild(iconImg);

  const info = document.createElement("div");
  info.className = "addon-info";

  const headerRow = document.createElement("div");
  headerRow.className = "addon-header-row";

  const title = document.createElement("h2");
  title.className = "addon-title";
  title.textContent = addon.name || "Untitled";

  const author = document.createElement("p");
  author.className = "addon-author";
  author.textContent = `By ${addon.author || "Unknown"}`;

  const titleBlock = document.createElement("div");
  titleBlock.className = "addon-title-block";
  titleBlock.append(title, author);

  headerRow.append(iconWrap, titleBlock);

  const desc = document.createElement("p");
  desc.className = "addon-desc";
  desc.textContent = addon.description || "";

  const tagsRow = buildTagsRow(addon, 6);

  const meta = document.createElement("div");
  meta.className = "addon-meta";

  const likes = document.createElement("span");
  likes.className = "title-likes";
  likes.innerHTML = likeIconHtml(addon.likes ?? addon.stars ?? 0);
  meta.appendChild(likes);

  const downloads = document.createElement("span");
  downloads.className = "title-downloads";
  downloads.innerHTML = downloadIconHtml(addon.downloads);
  meta.appendChild(downloads);

  const compatLabel = formatCompatibility(addon.compatibility);
  if (compatLabel) {
    const compat = document.createElement("span");
    compat.className = "title-compat";
    compat.title = `Compatible with Cubyz ${compatLabel}`;
    compat.innerHTML = compatIconHtml(addon.compatibility);
    meta.appendChild(compat);
  }

  const typeBadge = document.createElement("span");
  typeBadge.className = "addon-type-badge" + (addon.type === "mod" ? " addon-type-badge-mod" : "");
  typeBadge.textContent = addon.type === "mod" ? "MOD" : "ADDON";
  meta.appendChild(typeBadge);

  info.append(headerRow, desc, tagsRow, meta);
  link.append(banner, info);

  return link;
}

export function createAddonRow(addon, eager = false) {
  const link = document.createElement("a");
  link.className = "addon-row fade-in-card";
  link.href = addonLink(addon);
  link.setAttribute("aria-label", `Open ${addon.name || "Addon"}`);

  const rowBanner = document.createElement("img");
  rowBanner.className = "addon-row-banner";
  rowBanner.src = safeUrl(addon.bannerThumbUrl || addon.bannerUrl, "/assets/default_banner.png");
  rowBanner.alt = "";
  if (eager) {
    rowBanner.fetchPriority = "high";
  } else {
    rowBanner.loading = "lazy";
  }
  rowBanner.setAttribute("aria-hidden", "true");
  fadeInImage(rowBanner);

  const iconImg = document.createElement("img");
  iconImg.className = "addon-row-icon";
  iconImg.src = safeUrl(addon.iconThumbUrl || addon.iconUrl, "/assets/default_icon.png");
  iconImg.alt = addon.name || "Addon";
  if (!eager) iconImg.loading = "lazy";
  fadeInImage(iconImg);

  const main = document.createElement("div");
  main.className = "addon-row-main";

  const titleLine = document.createElement("div");
  titleLine.className = "addon-row-title-line";

  const title = document.createElement("span");
  title.className = "addon-row-title";
  title.textContent = addon.name || "Untitled";
  titleLine.appendChild(title);

  const author = document.createElement("span");
  author.className = "addon-row-author";
  author.textContent = `By ${addon.author || "Unknown"}`;

  const desc = document.createElement("p");
  desc.className = "addon-row-desc";
  desc.textContent = addon.description || "";

  main.append(titleLine, author, desc, buildTagsRow(addon, 4));

  const stats = document.createElement("div");
  stats.className = "addon-row-stats";

  const typeBadge = document.createElement("span");
  typeBadge.className = "addon-type-badge" + (addon.type === "mod" ? " addon-type-badge-mod" : "");
  typeBadge.textContent = addon.type === "mod" ? "MOD" : "ADDON";

  const likes = document.createElement("span");
  likes.className = "title-likes";
  likes.innerHTML = likeIconHtml(addon.likes ?? addon.stars ?? 0);

  const rowCompatLabel = formatCompatibility(addon.compatibility);
  const compat = rowCompatLabel ? document.createElement("span") : null;
  if (compat) {
    compat.className = "title-compat";
    compat.title = `Compatible with Cubyz ${rowCompatLabel}`;
    compat.innerHTML = compatIconHtml(addon.compatibility);
  }

  const downloads = document.createElement("span");
  downloads.className = "title-downloads";
  downloads.innerHTML = downloadIconHtml(addon.downloads);

  stats.append(likes, downloads, ...(compat ? [compat] : []), typeBadge);

  link.append(rowBanner, iconImg, main, stats);

  return link;
}
