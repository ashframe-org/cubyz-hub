
window.validateProject = function () {
    const issues = [];
    const pd = window.projectData || {};

    (pd.blocks || []).forEach((block) => {
        const check = window.checkBlockRules({
            blockId: block.id,
            baseTexture: block.baseTexture,
            rotationMode: block.rotation,
            updateTypeVal: block.callbacks?.updateType,
            tickTypeVal: block.callbacks?.tickType,
            hasItemIconRef: !!block.itemIconSearch,
            tagCount: Array.isArray(block.tags) ? block.tags.length : 0,
        });

        if (check.missingTags) {
            issues.push({
                category: "Blocks",
                itemId: block.id || "(unnamed block)",
                issue: "No tags set.",
                suggestion: "Add at least one tag (e.g. mineable, diggable, choppable) - the game logs an error (and shows an error prompt in the client) for a block with no tags, and tags decide which tools can mine it.",
            });
        }
        if (check.oreNeedsIcon) {
            issues.push({
                category: "Blocks",
                itemId: block.id || "(unnamed block)",
                issue: "Ore rotation set with no inventory icon.",
                suggestion: "Procedural world ores require a 2D Inventory Icon Texture fallback sprite.",
            });
        }
        if (check.rotationCallbackConflict) {
            issues.push({
                category: "Blocks",
                itemId: block.id || "(unnamed block)",
                issue: "Incompatible rotation/callback combination.",
                suggestion: check.rotationMsg,
            });
        }
    });

    (pd.biomes || []).forEach((biome) => {
        const check = window.checkBiomeRules({
            biomeId: biome.id,
            isCave: biome.isCave,
            caveLayerTag: biome.caveLayerTag,
        });
        if (check.missingCaveLayer) {
            issues.push({
                category: "Biomes",
                itemId: biome.id || "(unnamed biome)",
                issue: "Cave biome has no cave layer tag set.",
                suggestion: "It will silently never spawn in-game until you set a cave layer in the Biomes panel.",
            });
        }
    });

    return issues;
};

window.showValidationReport = function (issues, headerText) {
    return new Promise((resolve) => {
        const modal = document.getElementById("validationReportModal");
        const body = document.getElementById("validationReportBody");
        if (!modal || !body) return resolve();

        let html = `<p style="margin-top:0;">${headerText || "Project check results:"}</p>`;

        if (!issues.length) {
            html += `<p style="margin:0; font-size:13px; color:#8f8;">No issues found!</p>`;
        } else {
            const grouped = {};
            issues.forEach((i) => {
                if (!grouped[i.category]) grouped[i.category] = [];
                grouped[i.category].push(i);
            });
            html += Object.keys(grouped).map((cat) => {
                const lines = grouped[cat].map((i) =>
                    `<li><strong>${i.itemId}</strong>: ${i.issue}${i.suggestion ? ` <span style="color:#c77;">${i.suggestion}</span>` : ""}</li>`
                ).join("");
                return `<div style="margin-bottom:10px;"><div style="font-weight:600; color:#ff9800; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">${cat} (${grouped[cat].length})</div><ul style="margin:0; padding-left:18px; font-size:13px; color:#ffcc80;">${lines}</ul></div>`;
            }).join("");
        }

        body.innerHTML = html;
        modal.style.display = "flex";

        const done = () => { modal.style.display = "none"; resolve(); };
        document.getElementById("validationReportOkBtn").onclick = done;
    });
};

window.checkProjectNow = async function () {
    const report = window.validateProject();
    await window.showValidationReport(report, "Project check results:");
};
