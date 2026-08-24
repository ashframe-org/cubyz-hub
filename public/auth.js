(function () {
  let authModal = document.getElementById('authModal');
  let authTitle = document.getElementById('authTitle');
  let authForm = document.getElementById('authForm');
  let toggleAuth = document.getElementById('toggleAuth');
  let authSubmit = document.getElementById('authSubmit');
  let mode = 'login';
  const DEFAULT_AVATAR = '/assets/Snale_Avatar.webp';

  const isIndexPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

  if (!authModal && isIndexPage) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div id="authModal" class="auth-modal">
        <div class="auth-box">
          <h2 id="authTitle">Login</h2>
          <form id="authForm">
            <input id="username" type="text" placeholder="Username" required />
            <input id="password" type="password" placeholder="Password" required />
            <button id="authSubmit" type="submit">Login</button>
          </form>
          <a href="#" id="toggleAuth">Create an account</a>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);

    authModal = document.getElementById('authModal');
    authTitle = document.getElementById('authTitle');
    authForm = document.getElementById('authForm');
    toggleAuth = document.getElementById('toggleAuth');
    authSubmit = document.getElementById('authSubmit');
  }

  if (toggleAuth) toggleAuth.addEventListener('click', e => {
    e.preventDefault();
    mode = mode === 'login' ? 'register' : 'login';
    authTitle.textContent = mode === 'login' ? 'Login' : 'Register';
    authSubmit.textContent = mode === 'login' ? 'Login' : 'Register';
    toggleAuth.textContent = mode === 'login' ? 'Create an account' : 'Already have an account? Login';
  });

  if (authModal) authModal.addEventListener('click', e => {
    if (e.target === authModal) authModal.classList.remove('active');
  });

  if (authForm) authForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (json.ok || json.success) {
        authModal.classList.remove('active');

        const redirect = localStorage.getItem('redirectAfterLogin');
        if (redirect) {
          localStorage.removeItem('redirectAfterLogin');
          window.location.href = redirect;
        } else {
          window.location.reload();
        }
      } else {
        alert('❌ ' + (json.error || json.message || 'Auth failed'));
      }
    } catch {
      alert('❌ Network error');
    }
  });

  document.addEventListener('click', e => {
    const loginBtn = e.target.closest('#authBtn,[data-open-auth]');
    if (loginBtn) {
      localStorage.setItem('redirectAfterLogin', window.location.href);
      if (authModal) {
        authModal.classList.add('active');
      } else {
        window.location.href = '/';
      }
      return;
    }

    const dropdownItem = e.target.closest('.user-dropdown-item');
    if (dropdownItem) {
      const action = dropdownItem.dataset.action;
      const href = dropdownItem.dataset.href;
      if (action === 'logout') {
        fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload());
      } else if (href) {
        window.location.href = href;
      }
      return;
    }

    const openMenu = document.querySelector('.user-dropdown-menu.visible');
    if (openMenu && !e.target.closest('.user-menu-wrapper')) {
      openMenu.classList.remove('visible');
      openMenu.setAttribute('aria-hidden', 'true');
      const toggle = openMenu.previousElementSibling;
      if (toggle && toggle.matches('.user-dropdown-toggle')) {
        toggle.setAttribute('aria-expanded', 'false');
      }
    }

    const openSearch = document.querySelector('.nav-search.open');
    if (openSearch && !e.target.closest('.nav-search')) {
      closeNavSearch(openSearch);
    }
  });

  function navigateToSearchResult(result) {
    if (!result) return;
    if (result.type === 'addon') {
      window.location.href = `/addon.html?id=${encodeURIComponent(result.id)}`;
    } else if (result.type === 'user') {
      window.location.href = `/profile/${encodeURIComponent(result.username)}`;
    }
  }

  function resultLabel(result) {
    if (result.type === 'addon') return result.name || 'Untitled addon';
    return `@${result.username}`;
  }

  function closeNavSearch(searchEl) {
    searchEl.classList.remove('open');
    const results = searchEl.querySelector('.nav-search-results');
    if (results) {
      results.innerHTML = '';
      results.setAttribute('aria-hidden', 'true');
    }
  }

  function renderSearchResults(searchEl, data) {
    const results = searchEl.querySelector('.nav-search-results');
    const input = searchEl.querySelector('.nav-search-input');
    const items = [
      ...(data.addons || []).map(addon => ({ type: 'addon', ...addon })),
      ...(data.users || []).map(user => ({ type: 'user', ...user }))
    ];

    searchEl._results = items;
    results.innerHTML = '';

    if (!input.value.trim()) {
      closeNavSearch(searchEl);
      return;
    }

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'nav-search-empty';
      empty.textContent = 'No matches found';
      results.appendChild(empty);
      searchEl.classList.add('open');
      results.setAttribute('aria-hidden', 'false');
      return;
    }

    items.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-search-result';

      const media = document.createElement('img');
      media.className = 'nav-search-result-media';
      media.src = item.type === 'addon'
        ? (item.iconUrl || '/assets/default_icon.png')
        : (item.avatarUrl || DEFAULT_AVATAR);
      media.alt = '';
      media.onerror = () => {
        media.src = item.type === 'addon' ? '/assets/default_icon.png' : DEFAULT_AVATAR;
      };

      const body = document.createElement('span');
      body.className = 'nav-search-result-body';

      const title = document.createElement('span');
      title.className = 'nav-search-result-title';
      title.textContent = resultLabel(item);

      const meta = document.createElement('span');
      meta.className = 'nav-search-result-meta';
      meta.textContent = item.type === 'addon'
        ? `Addon by ${item.author || 'Unknown'}`
        : 'User profile';

      body.append(title, meta);

      const badge = document.createElement('span');
      badge.className = 'nav-search-result-badge';
      badge.textContent = item.type === 'addon' ? 'Addon' : 'User';

      button.append(media, body, badge);
      button.addEventListener('click', () => navigateToSearchResult(item));
      results.appendChild(button);
    });

    searchEl.classList.add('open');
    results.setAttribute('aria-hidden', 'false');
  }

  function ensureNavSearch() {
    const header = document.querySelector('.site-header, .uh-header');
    const actions = document.querySelector('.header-actions');
    if (!header || !actions || header.querySelector('.nav-search')) return;

    const searchEl = document.createElement('form');
    searchEl.className = 'nav-search';
    searchEl.setAttribute('role', 'search');
    searchEl.innerHTML = `
      <select class="nav-search-type" aria-label="Search type">
        <option value="all">All</option>
        <option value="addons">Addons</option>
        <option value="users">Users</option>
      </select>
      <input class="nav-search-input" type="search" placeholder="Search addons or users" autocomplete="off" aria-label="Search addons or users">
      <div class="nav-search-results" aria-hidden="true"></div>
    `;

    header.insertBefore(searchEl, actions);

    const input = searchEl.querySelector('.nav-search-input');
    const type = searchEl.querySelector('.nav-search-type');
    let timer;
    let requestId = 0;

    async function search() {
      const q = input.value.trim();
      const currentRequest = ++requestId;
      if (!q) {
        closeNavSearch(searchEl);
        return;
      }

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type.value)}`);
        const data = await res.json().catch(() => ({ ok: false }));
        if (currentRequest !== requestId) return;
        renderSearchResults(searchEl, data.ok ? data : { addons: [], users: [] });
      } catch {
        if (currentRequest === requestId) renderSearchResults(searchEl, { addons: [], users: [] });
      }
    }

    function scheduleSearch() {
      clearTimeout(timer);
      timer = setTimeout(search, 180);
    }

    input.addEventListener('input', scheduleSearch);
    input.addEventListener('focus', () => {
      if (searchEl._results?.length) {
        searchEl.classList.add('open');
        searchEl.querySelector('.nav-search-results').setAttribute('aria-hidden', 'false');
      }
    });
    type.addEventListener('change', search);

    searchEl.addEventListener('submit', e => {
      e.preventDefault();
      const first = searchEl._results?.[0];
      if (first) navigateToSearchResult(first);
      else search();
    });

    searchEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.blur();
        closeNavSearch(searchEl);
      }
    });
  }

  function createUserDropdown(user) {
    const username = user.username;
    const wrapper = document.createElement('div');
    wrapper.className = 'user-menu-wrapper';

    const userLabel = document.createElement('button');
    userLabel.type = 'button';
    userLabel.className = 'auth-btn user-label user-dropdown-toggle';
    userLabel.title = 'Account';
    userLabel.setAttribute('aria-haspopup', 'menu');
    userLabel.setAttribute('aria-expanded', 'false');

    const userIcon = document.createElement('img');
    userIcon.className = 'user-icon';
    const avatarUrl = user.avatarUrl || DEFAULT_AVATAR;
    userIcon.src = avatarUrl;
    userIcon.onerror = () => {
      userIcon.src = DEFAULT_AVATAR;
    };
    userIcon.alt = 'User avatar';

    const userName = document.createElement('span');
    userName.className = 'user-name';
    userName.textContent = 'Account';

    const arrow = document.createElement('span');
    arrow.className = 'user-dropdown-arrow';
    arrow.textContent = '▾';

    userLabel.append(userIcon, userName, arrow);

    const menu = document.createElement('div');
    menu.className = 'user-dropdown-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-hidden', 'true');

    const items = [
      { action: 'profile', label: 'Profile', href: `/profile/${encodeURIComponent(username)}` },
      { action: 'dashboard', label: 'Dashboard', href: '/dashboard.html' },
      { action: 'logout', label: 'Logout' }
    ];

    items.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'user-dropdown-item';
      button.setAttribute('role', 'menuitem');
      button.dataset.action = item.action;
      if (item.href) button.dataset.href = item.href;
      button.textContent = item.label;
      menu.appendChild(button);
    });

    userLabel.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = userLabel.getAttribute('aria-expanded') === 'true';
      userLabel.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      menu.classList.toggle('visible', !isOpen);
      menu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    });

    wrapper.append(userLabel, menu);
    return wrapper;
  }

  async function checkAuthStatus() {
    ensureNavSearch();

    let json;
    try {
      const res = await fetch('/api/auth/status', {
        credentials: 'include'
      });
      json = await res.json();
    } catch {
      return;
    }

    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) return;
    headerActions.innerHTML = '';

    const user = json.user;
    const loggedIn = json.ok && user;

    if (loggedIn) {
      headerActions.append(createUserDropdown(user));
    } else {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'auth-btn';
      loginBtn.id = 'authBtn';
      loginBtn.textContent = 'Login / Register';
      loginBtn.setAttribute('data-open-auth', '1');
      headerActions.append(loginBtn);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', checkAuthStatus);
  } else {
    checkAuthStatus();
  }

  window.loadNavUser = checkAuthStatus;
})();
