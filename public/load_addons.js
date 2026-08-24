import { createAddonCard } from './addon_cards.js';

let allAddons = [];
let activeTags = new Set();


const DOM = {
    container: document.getElementById('addon-container'),
    emptyState: document.getElementById('empty-state'),
    search: document.getElementById('searchBar'),
    sort: document.getElementById('sortSelect'),
    tagFilters: document.getElementById('tagFilters')
};


const TAG_OPTIONS = [
    "Biomes", "Recipes", "Tools", "Items", "Textures",
    "QoL", "Structures", "Mod"
];

async function loadAddons() {
    try {
        const res = await fetch('/api/addons');
        const json = await res.json();

        if (!json.ok || !json.addons) return;

        allAddons = json.addons.map(a => ({
            ...a,
            _tags: safeParseTags(a.tags),
            _name: (a.name || "").toLowerCase(),
            _desc: (a.description || "").toLowerCase(),
            _date: new Date(a.created_at).getTime(),
            _updated: new Date(a.created_at)
        }));

        DOM.emptyState.style.display = 'none';

        renderTagChips();
        applyFilters();

    } catch (err) {
        console.error('Failed to load addons', err);
    }
}


function safeParseTags(tags) {
    try {
        return Array.isArray(tags) ? tags : JSON.parse(tags || "[]");
    } catch {
        return [];
    }
}


function renderAddons(list) {
    const container = DOM.container;

    if (list.length === 0) {
        container.innerHTML = `<p class="no-results">No addons found.</p>`;
        return;
    }

    container.innerHTML = "";
    list.forEach(addon => {
        container.appendChild(createAddonCard(addon));
    });
}

function renderTagChips() {
    const row = DOM.tagFilters;

    row.innerHTML = TAG_OPTIONS.map(tag => `
        <button type="button" class="filter-chip" data-tag="${tag}">
            ${tag}
        </button>
    `).join('');

    row.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;

        const tag = btn.dataset.tag;

        if (activeTags.has(tag)) {
            activeTags.delete(tag);
            btn.classList.remove('active');
        } else {
            activeTags.add(tag);
            btn.classList.add('active');
        }

        applyFilters();
    });
}

function applyFilters() {
    const searchVal = DOM.search.value.toLowerCase();
    const sortMode = DOM.sort.value;

    const hasTags = activeTags.size > 0;

    let filtered = allAddons.filter(a => {
        const matchesSearch =
            a._name.includes(searchVal) ||
            a._desc.includes(searchVal) ||
            a._tags.some(t => t.toLowerCase().includes(searchVal));

        if (!matchesSearch) return false;

        if (hasTags) {
            return a._tags.some(t => activeTags.has(t));
        }

        return true;
    });

    switch (sortMode) {
        case "liked":
            filtered.sort((a, b) => (b.stars || 0) - (a.stars || 0));
            break;
        case "downloads":
            filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
            break;
        case "newest":
            filtered.sort((a, b) => b._date - a._date);
            break;
        case "name":
            filtered.sort((a, b) => a._name.localeCompare(b._name));
            break;
    }

    renderAddons(filtered);
}

let debounceTimer;

DOM.search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 250);
});

DOM.sort.addEventListener('change', applyFilters);

window.addEventListener('DOMContentLoaded', loadAddons);
