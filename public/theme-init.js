(function () {
  try {
    const saved = localStorage.getItem("cubyzhub-theme");
    if (saved !== "default") {
      document.documentElement.setAttribute("data-theme", "ashframe");
    }
  } catch (_) {
    document.documentElement.setAttribute("data-theme", "ashframe");
  }
})();
