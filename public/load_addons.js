import { createAddonCard, createAddonRow } from './addon_cards.js?v=20260919-17';
import { enhanceSelect, openInstances, closeOthers } from './custom-select.js?v=20260919-17';

let activeTags = new Set();
let currentPage = 1;
let totalPages = 1;

const MOBILE_PAGE_SIZE = 12;

const VIEW_MODE_KEY = 'cubyzhub-addon-view';
const isNarrowViewport = window.matchMedia('(max-width: 640px)').matches;
let viewMode = 'grid';
if (!isNarrowViewport) {
    try {
        const saved = localStorage.getItem(VIEW_MODE_KEY);
        if (saved === 'grid' || saved === 'list') viewMode = saved;
    } catch (_) {}
}

const DOM = {
    container: document.getElementById('addon-container'),
    emptyState: document.getElementById('empty-state'),
    search: document.getElementById('searchBar'),
    sort: document.getElementById('sortSelect'),
    compat: document.getElementById('compatSelect'),
    type: document.getElementById('typeSelect'),
    aiUsage: document.getElementById('aiUsageToggle'),
    tagFiltersVisible: document.getElementById('tagFiltersVisible'),
    viewToggle: document.getElementById('viewToggle'),
    pagination: document.getElementById('addon-pagination')
};


const TAG_OPTIONS_BY_TYPE = {
    addon: ["Biomes", "Recipes", "Tools", "Items", "Textures", "QoL", "Structures"],
    mod: ["Visual", "Gameplay", "Sound", "Overhaul"]
};
let TAG_OPTIONS = TAG_OPTIONS_BY_TYPE.addon;

async function loadAddons() {
    try {
        const params = new URLSearchParams();
        params.set('page', String(currentPage));
        if (isNarrowViewport) params.set('pageSize', String(MOBILE_PAGE_SIZE));
        if (DOM.search.value.trim()) params.set('search', DOM.search.value.trim());
        if (DOM.sort.value) params.set('sort', DOM.sort.value);
        if (DOM.compat && DOM.compat.value) params.set('compatibility', DOM.compat.value);
        if (DOM.type && DOM.type.value) params.set('type', DOM.type.value);
        if (DOM.aiUsage && !DOM.aiUsage.checked) params.set('aiUsage', 'none');
        if (activeTags.size) params.set('tags', JSON.stringify([...activeTags]));

        const res = await fetch(`/api/addons?${params.toString()}`);
        const json = await res.json();

        if (!json.ok) {
            showAddonsError(json.error || 'Could not load addons.');
            return;
        }

        currentPage = json.page || 1;
        totalPages = json.totalPages || 1;

        DOM.emptyState.style.display = 'none';

        renderAddons(json.addons || []);
        renderPagination();

    } catch (err) {
        console.error('Failed to load addons', err);
        showAddonsError('Could not load addons. Check your connection and try again.');
    }
}

function showAddonsError(message) {
    const container = DOM.container;
    container.classList.remove('addon-container-loading');
    container.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'addons-load-error';
    const text = document.createElement('p');
    text.textContent = message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-primary btn-sm';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => {
        container.classList.add('addon-container-loading');
        loadAddons();
    });
    box.appendChild(text);
    box.appendChild(retry);
    container.appendChild(box);
    if (typeof window.toast === 'function') window.toast.error(message);
}


let hasRenderedOnce = false;

function renderAddons(list) {
    const container = DOM.container;

    container.classList.toggle('addon-container-list', viewMode === 'list');
    container.classList.remove('addon-container-loading');

    if (list.length === 0) {
        container.innerHTML = `<p class="no-results">No addons found.</p>`;
        return;
    }

    const createItem = viewMode === 'list' ? createAddonRow : createAddonCard;
    const eagerCount = (!hasRenderedOnce && currentPage === 1) ? 4 : 0;

    container.innerHTML = "";
    list.forEach((addon, i) => {
        container.appendChild(createItem(addon, i < eagerCount));
    });
    hasRenderedOnce = true;
}

function renderPagination() {
    const el = DOM.pagination;
    if (!el) return;

    if (totalPages <= 1) {
        el.innerHTML = '';
        el.hidden = true;
        return;
    }
    el.hidden = false;

    function pageBtn(page, label, opts = {}) {
        const disabled = opts.disabled ? 'disabled' : '';
        const active = page === currentPage ? ' active' : '';
        return `<button type="button" class="page-btn${active}" data-page="${page}" ${disabled}>${label}</button>`;
    }

    const parts = [];
    parts.push(pageBtn(currentPage - 1, '‹ Prev', { disabled: currentPage <= 1 }));

    const pageNumbers = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    let prev = null;
    for (let p = 1; p <= totalPages; p++) {
        if (!pageNumbers.has(p)) continue;
        if (prev !== null && p - prev > 1) parts.push('<span class="page-ellipsis">…</span>');
        parts.push(pageBtn(p, String(p)));
        prev = p;
    }

    parts.push(pageBtn(currentPage + 1, 'Next ›', { disabled: currentPage >= totalPages }));

    el.innerHTML = parts.join('');
}

if (DOM.pagination) {
    DOM.pagination.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (!btn || btn.disabled) return;
        const page = parseInt(btn.dataset.page, 10);
        if (!page || page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadAddons();
        DOM.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function setViewMode(mode) {
    if (mode !== 'grid' && mode !== 'list') return;
    viewMode = mode;
    try {
        localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch (_) {}
    if (DOM.viewToggle) {
        DOM.viewToggle.querySelectorAll('[data-view]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
            btn.setAttribute('aria-pressed', String(btn.dataset.view === mode));
        });
    }
    loadAddons();
}

if (DOM.viewToggle) {
    DOM.viewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (!btn) return;
        setViewMode(btn.dataset.view);
    });
    DOM.viewToggle.querySelectorAll('[data-view]').forEach(btn => {
        const isActive = btn.dataset.view === viewMode;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function chipHtml(tag) {
    const active = activeTags.has(tag) ? ' active' : '';
    return `<button type="button" class="filter-chip${active}" data-tag="${tag}">${tag}</button>`;
}

function toggleTag(tag, btn) {
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
        btn.classList.remove('active');
    } else {
        activeTags.add(tag);
        btn.classList.add('active');
    }
    currentPage = 1;
    updateFiltersState();
    loadAddons();
}

function renderTagChips() {
    for (const t of [...activeTags]) {
        if (!TAG_OPTIONS.includes(t)) activeTags.delete(t);
    }

    DOM.tagFiltersVisible.innerHTML = TAG_OPTIONS.map(chipHtml).join('');
}

function attachTagChipListeners() {
    DOM.tagFiltersVisible.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-chip');
        if (!btn) return;
        toggleTag(btn.dataset.tag, btn);
    });
}

let debounceTimer;

DOM.search.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        currentPage = 1;
        loadAddons();
    }, 250);
});

DOM.sort.addEventListener('change', () => {
    currentPage = 1;
    loadAddons();
});
enhanceSelect(DOM.sort);

async function populateCompatFilter() {
    if (!DOM.compat) return;
    try {
        const res = await fetch('/api/game/versions');
        const json = await res.json();
        if (!json.ok) throw new Error('API returned not-ok');

        const options = ['<option value="">All versions</option>'];
        (json.versions || []).slice().reverse().forEach(v => {
            options.push(`<option value="${v}">${v}</option>`);
        });
        DOM.compat.innerHTML = options.join('');
        enhanceSelect(DOM.compat);
    } catch (err) {
        console.error('Failed to load compatibility versions', err);
        DOM.compat.hidden = false;
    }
}

if (DOM.type) enhanceSelect(DOM.type);
DOM.type?.addEventListener('change', () => {
    TAG_OPTIONS = TAG_OPTIONS_BY_TYPE[DOM.type.value] || TAG_OPTIONS_BY_TYPE.addon;
    renderTagChips();
    currentPage = 1;
    updateFiltersState();
    loadAddons();
});

DOM.aiUsage?.addEventListener('change', () => {
    currentPage = 1;
    updateFiltersState();
    loadAddons();
});

DOM.compat?.addEventListener('change', () => {
    currentPage = 1;
    updateFiltersState();
    loadAddons();
});

const filtersBtn = document.getElementById('filtersBtn');
const filtersPopover = document.getElementById('filtersPopover');
const filtersCount = document.getElementById('filtersCount');
const filtersClearBtn = document.getElementById('filtersClearBtn');

function countActiveFilters() {
    let count = 0;
    if (DOM.type && DOM.type.value) count++;
    if (DOM.compat && DOM.compat.value) count++;
    if (DOM.aiUsage && !DOM.aiUsage.checked) count++;
    count += activeTags.size;
    return count;
}

function updateFiltersState() {
    const count = countActiveFilters();
    filtersBtn.classList.toggle('active', count > 0);
    filtersCount.classList.toggle('hidden', count === 0);
    filtersCount.textContent = String(count);
    filtersClearBtn.classList.toggle('hidden', count === 0);
}

if (filtersBtn && filtersPopover) {
    function closeFiltersPopover() {
        filtersPopover.hidden = true;
        filtersBtn.setAttribute('aria-expanded', 'false');
        openInstances.delete(filtersEntry);
    }

    const filtersEntry = { close: closeFiltersPopover, el: filtersBtn.closest('.filters-wrapper') };

    filtersBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !filtersPopover.hidden;
        if (isOpen) {
            closeFiltersPopover();
            return;
        }
        closeOthers(filtersEntry.el, closeFiltersPopover);
        filtersPopover.hidden = false;
        filtersBtn.setAttribute('aria-expanded', 'true');
        openInstances.add(filtersEntry);
    });

    document.addEventListener('click', (e) => {
        if (filtersPopover.hidden) return;
        if (e.target.closest('.filters-wrapper')) return;
        closeFiltersPopover();
    });

    filtersClearBtn?.addEventListener('click', () => {
        if (DOM.type) DOM.type.value = '';
        if (DOM.compat) DOM.compat.value = '';
        if (DOM.aiUsage) DOM.aiUsage.checked = true;
        activeTags.clear();
        renderTagChips();
        [DOM.type, DOM.compat, DOM.aiUsage].forEach((el) => el?.dispatchEvent(new Event('change')));
    });
}

attachTagChipListeners();
renderTagChips();
populateCompatFilter();
updateFiltersState();
loadAddons();
