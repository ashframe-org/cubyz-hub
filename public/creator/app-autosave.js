const AUTOSAVE_DELAY_MS = 600;

const PANEL_SAVE_FN = {
    blocks: "saveBlockToProject",
    items: "saveItemToProject",
    recipes: "saveRecipeToProject",
    biomes: "saveBiomeToProject",
    entities: "saveEntityToProject",
    particles: "saveParticleToProject",
};

let autosaveTimer = null;

function setSaveStatus(text, color) {
    const el = document.getElementById("panelSaveStatus");
    if (el) {
        el.textContent = text;
        el.style.color = color;
    }
}

function scheduleAutosave() {
    setSaveStatus("Saving", "#e0a030");
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
        const fnName = PANEL_SAVE_FN[window.currentPanelName];
        const fn = fnName && window[fnName];
        if (typeof fn !== "function") return;

        const ok = fn(true);
        setSaveStatus(ok ? "Saved" : "Warning", ok ? "#5BA65B" : "#dc3545");
    }, AUTOSAVE_DELAY_MS);
}

function initAutosave() {
    const workspace = document.getElementById("dynamicWorkspace");
    if (!workspace) return;

    workspace.addEventListener("input", () => {
        if (window.isInitializingPanel) return;
        scheduleAutosave();
    });
    workspace.addEventListener("change", () => {
        if (window.isInitializingPanel) return;
        scheduleAutosave();
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => setSaveStatus("", ""));
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAutosave);
} else {
    initAutosave();
}
