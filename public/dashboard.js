function showToast(msg, { error = false, duration = 2000 } = {}) {
  const area = document.getElementById("toastArea");
  const t = document.createElement("div");
  t.className = "toast" + (error ? " error" : "");
  t.textContent = msg;
  area.appendChild(t);

  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, duration);
}



async function loadNavUser() {
  try {
    const res = await fetch("/api/auth/status", { credentials: "include" });
    const j = await res.json().catch(() => ({ ok: false }));
    const navs = document.querySelectorAll("#nav-user");
    if (!navs || navs.length === 0) return;

    navs.forEach((n, i) => {
      if (i > 0) n.remove();
    });

    const nav = navs[0];
    nav.innerHTML = "";

    if (j.ok && j.user) {
      const sp = document.createElement("button");
      sp.className = "auth-btn user-label";
      sp.title = "Dashboard";
      sp.onclick = () => (window.location.href = "/dashboard.html");

      const icon = document.createElement("img");
      icon.className = "user-icon";
      const DEFAULT_AVATAR = "/assets/Snale_Avatar.webp";
      const avatarUrl = j.user.avatarUrl || DEFAULT_AVATAR;
      icon.src = avatarUrl;
      icon.onerror = () => {
        icon.src = DEFAULT_AVATAR;
      };

      const name = document.createElement("span");
      name.className = "user-name";
      name.textContent = 'Account';

      sp.append(icon, name);

      const out = document.createElement("button");
      out.className = "auth-btn";
      out.textContent = "Logout";
      out.onclick = async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        window.location.reload();
      };

      nav.append(sp, out);
    } else {
      const login = document.createElement("button");
      login.className = "auth-btn";
      login.textContent = "Login / Register";
      login.onclick = () => (window.location.href = "/");
      nav.append(login);
    }
  } catch (err) {
    console.error("NAV ERROR:", err);
  }
}


let currentAddons = [];
let editingId = null;

const addonGrid = document.getElementById("addonGrid");
const emptyState = document.getElementById("emptyState");
const modal = document.getElementById("editModal");
const modalClose = document.getElementById("modalClose");
const cancelEdit = document.getElementById("cancelEdit");
const editForm = document.getElementById("editForm");
const modalAddonName = document.getElementById("modalAddonName");


async function loadUserAddons() {
  try {
    const res = await fetch("/api/user/addons", { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/";
      return;
    }

    const json = await res.json();

    addonGrid.innerHTML = "";
    if (!json.ok || !Array.isArray(json.addons) || json.addons.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    currentAddons = json.addons;

    currentAddons.forEach((a) => {
      const card = document.createElement("article");
      card.className = "user-addon-card fade-in-card";
      card.innerHTML = `
      <div style="background:${a.bannerUrl ? `url(${a.bannerUrl}) center/cover` : "#171717"}; height:120px; border-radius:8px 8px 0 0;"></div>

      <div style="padding:12px;">
      <div style="display:flex; gap:10px; align-items:center;">
      <div style="width:56px;height:56px;border-radius:8px;overflow:hidden;background:#111;">
      <img class="img-fade" src="${a.iconUrl || "assets/default_icon.png"}"
      alt="icon"
      style="width:100%;height:100%;object-fit:cover;color:transparent;">
      </div>

      <div style="flex:1;">
      <h4 style="margin:0 0 6px 0;">${escapeHtml(a.name)}</h4>
      <div style="color:#aaa;font-size:0.9rem;">
      v${escapeHtml(a.version || "—")} • ${new Date(a.created_at).toLocaleDateString()}
      </div>
      </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:10px; justify-content:space-between;">
      <div style="display:flex; gap:8px;">
      <button class="edit-btn" data-id="${a.id}">Edit</button>
      <button class="view-btn" data-id="${a.id}">View</button>
      </div>
      <button class="delete-btn" data-id="${a.id}">Delete</button>
      </div>
      </div>
      `;

      const cardIcon = card.querySelector("img.img-fade");
      if (cardIcon) {
        const reveal = () => cardIcon.classList.add("loaded");
        if (cardIcon.complete && cardIcon.naturalWidth > 0) reveal();
        else {
          cardIcon.addEventListener("load", reveal, { once: true });
          cardIcon.addEventListener("error", reveal, { once: true });
        }
      }

      addonGrid.appendChild(card);
    });

    document.querySelectorAll(".edit-btn").forEach((b) =>
      b.addEventListener("click", () => openEditModal(b.dataset.id))
    );

    document.querySelectorAll(".view-btn").forEach((b) =>
      b.addEventListener("click", () => {
        window.location.href = `/addon.html?id=${b.dataset.id}`;
      })
    );

    document.querySelectorAll(".delete-btn").forEach((b) =>
      b.addEventListener("click", () => openConfirmDelete(b.dataset.id))
    );
  } catch (err) {
    console.error("LOAD ADDONS FAIL:", err);
    emptyState.classList.remove("hidden");
  }
}


async function openEditModal(id) {
  const addon = currentAddons.find(a => String(a.id) === String(id));
  if (!addon) return showToast("Addon not found", { error: true });

  editingId = id;

  modalAddonName.textContent = addon.name;

  document.getElementById("editId").value = id;
  document.getElementById("e_name").value = addon.name || "";
  document.getElementById("e_short").value = addon.description || "";

  let localLong =
    addon.longDescription ||
    addon.long_description ||
    addon.long_desc ||
    "";

  document.getElementById("e_long").value = localLong;

  fetch(`/api/addons/${id}`)
    .then(res => res.ok ? res.json() : null)
    .then(j => {
      if (!j || !j.addon) return;

      const full = j.addon.longDescription ||
        j.addon.long_description ||
        j.addon.long_desc ||
        "";

      document.getElementById("e_long").value = full;
    })
    .catch(() => {
      console.warn("Could not fetch full longDescription");
    });


  applyTagsFromAddon(addon);
  await loadCompatibilityOptions();
  applyCompatibilityFromAddon(addon);


  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}


const confirmModal = document.getElementById("confirmModal");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
let deleteTarget = null;

function openConfirmDelete(id) {
  deleteTarget = id;
  confirmModal.classList.add("open");
  confirmModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

confirmCancel.addEventListener("click", () => {
  confirmModal.classList.remove("open");
  confirmModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
});

confirmOk.addEventListener("click", async () => {
  if (!deleteTarget) return;

  try {
    const r = await fetch(`/api/addons/${deleteTarget}`, { method: "DELETE", credentials: "include" });
    const j = await r.json().catch(() => ({ ok: false }));

    if (j.ok) {
      showToast("Deleted", { duration: 900 });
      setTimeout(() => loadUserAddons(), 400);
    } else {
      showToast("Delete failed", { error: true });
    }
  } catch (e) {
    showToast("Delete failed", { error: true });
  }

  confirmModal.classList.remove("open");
  confirmModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
});


const tagOptions = [
  "Biomes",
  "Recipes",
  "Tools",
  "Items",
  "Currency",
  "QoL",
  "Structures",
  "Mod",
];

let selectedTags = [];

function renderTagChips() {
  const wrap = document.getElementById("edit-tag-chips");
  wrap.innerHTML = "";

  tagOptions.forEach((tag) => {
    const div = document.createElement("div");
    div.className = "chip" + (selectedTags.includes(tag) ? " active" : "");
    div.textContent = tag;

    div.addEventListener("click", () => {
      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter((t) => t !== tag);
      } else if (selectedTags.length < 6) {
        selectedTags.push(tag);
      }
      updateTagField();
      renderTagChips();
    });

    wrap.appendChild(div);
  });
}

function updateTagField() {
  document.getElementById("e_tags").value = JSON.stringify(selectedTags);
}

function applyTagsFromAddon(addon) {
  try {
    selectedTags = Array.isArray(addon.tags)
      ? addon.tags
      : JSON.parse(addon.tags || "[]");
  } catch {
    selectedTags = [];
  }

  updateTagField();
  renderTagChips();
}


let compatOptions = [];

async function loadCompatibilityOptions() {
  const select = document.getElementById("e_compat");
  if (!select) return;

  select.innerHTML = "";

  try {
    const res = await fetch("/api/game/versions");
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.versions)) return;

    compatOptions = data.versions;

    compatOptions.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error("Failed to load compatibility versions:", err);
  }
}

function applyCompatibilityFromAddon(addon) {
  const select = document.getElementById("e_compat");
  if (!select) return;

  const saved = (
    addon.compatibility ||
    addon.compat ||
    addon.compatibilityVersion ||
    addon.version_compatibility ||
    ""
  ).toString().trim();

  const apply = () => {
    const exists = [...select.options].some(o => o.value === saved);

    if (exists) {
      select.value = saved;
    } else if (saved) {
      const opt = document.createElement("option");
      opt.value = saved;
      opt.textContent = saved + " (legacy)";
      select.appendChild(opt);
      select.value = saved;
    }
  };

  if (select.options.length === 0) {
    setTimeout(apply, 50);
  } else {
    apply();
  }
}


editForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = editingId;
  const fd = new FormData(editForm);

  try {
    const res = await fetch(`/api/addons/${id}/update`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    const txt = await res.text();
    let json;

    try {
      json = txt ? JSON.parse(txt) : {};
    } catch {
      alert("Update failed: server returned invalid data");
      return;
    }

    if (json.ok) {
      showToast("Updated!");
      closeModal();
      loadUserAddons();
    } else {
      alert("" + (json.error || "Update failed"));
    }
  } catch (err) {
    alert("Network error");
  }
});


function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m];
  });
}


window.addEventListener("DOMContentLoaded", () => {
  // loadNavUser();
  loadUserAddons();

  const goUpload = document.getElementById("goUpload");
  if (goUpload) {
    goUpload.addEventListener("click", () => {
      window.location.href = "/upload.html"; 
    });
  }

  const uploadNew = document.getElementById("uploadNew");
  if (uploadNew) {
    uploadNew.addEventListener("click", () => {
      window.location.href = "/upload.html"; 
    });
  }
});


async function changeUsername() {
  const newUsernameEl = document.getElementById("newUsername");
  if (!newUsernameEl) return;

  const newUsername = newUsernameEl.value.trim();
  if (!newUsername) {
    return showToast("Enter a username", { error: true });
  }

  try {
    const res = await fetch("/api/auth/change-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ newUsername })
    });

    const data = await res.json();

    if (data.ok) {
      showToast("Username updated");
      // update nav display immediately
      const name = document.querySelector(".user-name");
      if (name && data.username) name.textContent = data.username;
      // optionally reload to refresh all data
      setTimeout(() => location.reload(), 500);
    } else {
      showToast(data.error || "Failed to update username", { error: true });
    }
  } catch (err) {
    console.error("CHANGE USERNAME ERROR:", err);
    showToast("Network error", { error: true });
  }
}


async function changePassword() {
  const oldEl = document.getElementById("oldPassword");
  const newEl = document.getElementById("newPassword");
  if (!oldEl || !newEl) return;

  const oldPassword = oldEl.value;
  const newPassword = newEl.value;

  if (!oldPassword || !newPassword) {
    return showToast("Fill both fields", { error: true });
  }

  try {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await res.json();

    if (data.ok) {
      showToast("Password updated");
      // clear inputs
      oldEl.value = "";
      newEl.value = "";
    } else {
      showToast(data.error || "Failed to update password", { error: true });
    }
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    showToast("Network error", { error: true });
  }
}



modalClose.addEventListener("click", closeModal);
cancelEdit.addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
