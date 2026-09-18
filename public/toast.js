(function () {
  "use strict";

  var AREA_ID = "cubyz-toast-area";
  var STYLE_ID = "cubyz-toast-style";
  var MAX_VISIBLE = 5;
  var DURATIONS = { error: 5200, success: 3200, info: 3400 };
  var ICONS = { success: "\u2713", error: "!", info: "i" };

  var CSS =
    "#" + AREA_ID + "{position:fixed;top:18px;right:18px;z-index:9999;display:flex;" +
    "flex-direction:column;gap:8px;max-width:min(340px,calc(100vw - 36px));pointer-events:none}" +
    "#" + AREA_ID + " .ct-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;" +
    "background:#101010;background:var(--bg-alt,#101010);color:#e8e8e8;color:var(--text,#e8e8e8);" +
    "border:1px solid #292929;border:1px solid var(--border,#292929);" +
    "border-radius:10px;padding:11px 12px 12px;font-size:.93rem;" +
    "font-weight:600;line-height:1.35;border-left:4px solid #e05d5d;border-left:4px solid var(--accent,#e05d5d);" +
    "box-shadow:0 10px 32px rgba(0,0,0,.55);" +
    "opacity:0;transform:translateY(-6px);transition:opacity .2s ease,transform .2s ease;" +
    "overflow:hidden;position:relative;max-height:160px}" +
    "#" + AREA_ID + " .ct-toast.ct-show{opacity:1;transform:none}" +
    "#" + AREA_ID + " .ct-toast.ct-success{border-left-color:#4caf7d}" +
    "#" + AREA_ID + " .ct-toast.ct-error{border-left-color:#e5534b}" +
    "#" + AREA_ID + " .ct-icon{flex:0 0 auto;width:22px;height:22px;border-radius:50%;display:flex;" +
    "align-items:center;justify-content:center;font-size:.8rem;font-weight:800;" +
    "background:#e05d5d;background:var(--accent,#e05d5d);color:#000}" +
    "#" + AREA_ID + " .ct-success .ct-icon{background:#2c6e4f;color:#fff}" +
    "#" + AREA_ID + " .ct-error .ct-icon{background:#8c2f2b;color:#fff}" +
    "#" + AREA_ID + " .ct-msg{flex:1 1 auto;overflow:hidden;display:-webkit-box;" +
    "-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow-wrap:anywhere}" +
    "#" + AREA_ID + " .ct-close{flex:0 0 auto;border:0;background:transparent;color:inherit;" +
    "opacity:.6;cursor:pointer;font-size:1rem;line-height:1;padding:0 0 0 2px}" +
    "#" + AREA_ID + " .ct-close:hover{opacity:1}" +
    "#" + AREA_ID + " .ct-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;" +
    "background:rgba(255,255,255,.25);transform-origin:left}" +
    "#" + AREA_ID + " .ct-toast.ct-timing .ct-bar{animation:ct-shrink linear forwards}" +
    "#" + AREA_ID + " .ct-toast.ct-paused .ct-bar{animation-play-state:paused}" +
    "@keyframes ct-shrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}" +
    "@media (max-width:640px){#" + AREA_ID + "{top:auto;bottom:14px;right:14px;left:14px;max-width:none}}";

  function ensureArea() {
    var area = document.getElementById(AREA_ID);
    if (area) return area;
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    area = document.createElement("div");
    area.id = AREA_ID;
    area.setAttribute("role", "status");
    area.setAttribute("aria-live", "polite");
    document.body.appendChild(area);
    return area;
  }

  function prune(area) {
    while (area.children.length >= MAX_VISIBLE) {
      area.removeChild(area.firstChild);
    }
  }

  function dockUnderHeader(area) {
    try {
      if (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) return;
      var header = document.querySelector(".site-header");
      if (!header) return;
      var bottom = header.getBoundingClientRect().bottom;
      area.style.top = (bottom > 0 ? Math.round(bottom + 12) : 12) + "px";
    } catch (e) {
    }
  }

  function toast(message, opts) {
    opts = opts || {};
    var type = opts.type || "info";
    if (type !== "success" && type !== "error") type = "info";
    var duration = typeof opts.duration === "number" ? opts.duration : DURATIONS[type];

    var area = ensureArea();
    prune(area);
    dockUnderHeader(area);

    var el = document.createElement("div");
    el.className = "ct-toast ct-" + type;
    if (type === "error") el.setAttribute("role", "alert");

    var icon = document.createElement("span");
    icon.className = "ct-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ICONS[type];

    var msg = document.createElement("span");
    msg.className = "ct-msg";
    msg.textContent = String(message == null ? "" : message);

    var close = document.createElement("button");
    close.className = "ct-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "\u00D7";

    var bar = document.createElement("span");
    bar.className = "ct-bar";
    bar.setAttribute("aria-hidden", "true");

    el.appendChild(icon);
    el.appendChild(msg);
    el.appendChild(close);
    el.appendChild(bar);
    area.appendChild(el);

    var remaining = duration;
    var startedAt = 0;
    var timer = null;

    function clear() {
      if (timer) clearTimeout(timer);
      timer = null;
    }
    function dismiss() {
      clear();
      el.classList.remove("ct-show");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }
    function arm(ms) {
      clear();
      remaining = ms;
      startedAt = Date.now();
      bar.style.animationDuration = ms + "ms";
      el.classList.remove("ct-timing");
      void el.offsetWidth;
      el.classList.add("ct-timing");
      timer = setTimeout(dismiss, ms);
    }

    close.addEventListener("click", dismiss);
    el.addEventListener("click", function (e) {
      if (e.target === close) return;
      dismiss();
    });
    el.addEventListener("mouseenter", function () {
      if (!timer) return;
      clear();
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      el.classList.add("ct-paused");
    });
    el.addEventListener("mouseleave", function () {
      if (el.classList.contains("ct-paused")) {
        el.classList.remove("ct-paused");
        arm(remaining);
      }
    });

    requestAnimationFrame(function () {
      el.classList.add("ct-show");
    });
    arm(duration);

    return el;
  }

  toast.success = function (message, opts) {
    return toast(message, Object.assign({}, opts, { type: "success" }));
  };
  toast.error = function (message, opts) {
    return toast(message, Object.assign({}, opts, { type: "error" }));
  };
  toast.info = function (message, opts) {
    return toast(message, Object.assign({}, opts, { type: "info" }));
  };

  function showToast(msg, opts) {
    opts = opts || {};
    return toast(msg, { type: opts.error ? "error" : "info", duration: opts.duration });
  }

  window.toast = toast;
  window.showToast = showToast;
})();
