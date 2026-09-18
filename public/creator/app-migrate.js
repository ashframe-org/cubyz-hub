
window.CubyzMigrations = null;

async function loadMigrationRules() {
    if (window.CubyzMigrations) return window.CubyzMigrations;
    const res = await fetch("migrations/cubyz-addon-migrations.json");
    if (!res.ok) throw new Error("Failed to load migration rules.");
    window.CubyzMigrations = await res.json();
    return window.CubyzMigrations;
}

function versionIndex(rules, version) {
    return rules.versions.findIndex((v) => v.version === version);
}

function stepsBetween(rules, sourceVersion, targetVersion) {
    const fromIdx = versionIndex(rules, sourceVersion);
    const toIdx = versionIndex(rules, targetVersion);
    if (fromIdx === -1) throw new Error(`Unknown source version "${sourceVersion}".`);
    if (toIdx === -1) throw new Error(`Unknown target version "${targetVersion}".`);
    if (toIdx < fromIdx) throw new Error("Target version must be the same as or newer than the source version.");

    const versionsInRange = rules.versions.slice(fromIdx, toIdx + 1).map((v) => v.version);
    return rules.steps.filter((step) => versionsInRange.includes(step.from) && versionsInRange.includes(step.to));
}

function applyIdRenames(list, renames, assetType, conflicts, changes) {
    if (!list || !renames) return list;

    renames.forEach((rename) => {
        const oldIds = rename.old;
        const matches = oldIds
            .map((oldId) => ({ oldId, item: list.find((i) => i.id === oldId) }))
            .filter((m) => m.item);

        if (!matches.length) return;

        if (matches.length > 1) {
            conflicts.push({
                type: assetType,
                oldIds: matches.map((m) => m.oldId),
                newId: rename.new,
                reason: `${matches.length} old ids (${matches.map((m) => m.oldId).join(", ")}) merge into "${rename.new}" - kept "${matches[0].oldId}"'s data, review the others by hand.`,
            });
            changes.push({
                category: categoryLabel(assetType),
                itemId: rename.new,
                changeType: "id_merge",
                old: matches.map((m) => m.oldId).join(" + "),
                new: rename.new,
                note: "merged - review if both had distinct custom data",
            });
        } else {
            changes.push({
                category: categoryLabel(assetType),
                itemId: rename.new,
                changeType: "id_rename",
                old: matches[0].oldId,
                new: rename.new,
                note: "",
            });
        }

        const kept = matches[0].item;
        kept.id = rename.new;

        oldIds.forEach((oldId) => {
            if (oldId === matches[0].oldId) return;
            const idx = list.findIndex((i) => i.id === oldId);
            if (idx !== -1) list.splice(idx, 1);
        });
    });

    return list;
}

function categoryLabel(assetType) {
    const map = { block: "Blocks", item: "Items", biome: "Biomes", recipe: "Recipes", entity: "Entities", particle: "Particles" };
    return map[assetType] || (assetType ? assetType.charAt(0).toUpperCase() + assetType.slice(1) + "s" : "Other");
}

function applyFieldRenames(items, fieldRenames, scope, changes) {
    if (!items || !fieldRenames) return;
    fieldRenames
        .filter((fr) => fr.scope === scope)
        .forEach((fr) => {
            const oldKey = fr.old.replace(/^\./, "");
            const newKey = fr.new.replace(/^\./, "");
            const affected = [];
            items.forEach((item) => {
                if (Object.prototype.hasOwnProperty.call(item, oldKey)) {
                    item[newKey] = item[oldKey];
                    delete item[oldKey];
                    affected.push(item.id);
                }
            });
            if (affected.length) {
                changes.push({
                    category: categoryLabel(scope),
                    itemId: affected.join(", "),
                    changeType: "field_rename",
                    old: fr.old,
                    new: fr.new,
                    note: `${affected.length} ${affected.length === 1 ? categoryLabel(scope).slice(0, -1).toLowerCase() : categoryLabel(scope).toLowerCase()} affected: ${affected.join(", ")}`,
                });
            }
        });
}

function applyBlockEntityRenames(blocks, renames, changes) {
    if (!blocks || !renames) return;
    renames.forEach((rename) => {
        const oldBare = String(rename.old).split(":").pop();
        const affected = [];
        blocks.forEach((block) => {
            if (!block.blockEntity) return;
            const bare = String(block.blockEntity).split(":").pop().replace(/^\./, "");
            if (bare === oldBare && block.blockEntity !== rename.new) {
                block.blockEntity = rename.new;
                affected.push(block.id);
            }
        });
        if (affected.length) {
            changes.push({
                category: "Blocks",
                itemId: affected.join(", "),
                changeType: "block_entity_rename",
                old: rename.old,
                new: rename.new,
                note: `blockEntity ${rename.old} → ${rename.new} (${affected.length} block${affected.length === 1 ? "" : "s"}): ${affected.join(", ")}`,
            });
        }
    });
}

function applyTagRenames(items, tagRenames, changes) {
    if (!items || !tagRenames) return;
    tagRenames.forEach((tr) => {
        const oldTag = tr.old.replace(/^\./, "");
        const newTag = tr.new.replace(/^\./, "");
        items.forEach((item) => {
            if (Array.isArray(item.tags)) {
                const hadTag = item.tags.some((t) => t.replace(/^\./, "") === oldTag);
                item.tags = item.tags.map((t) => (t.replace(/^\./, "") === oldTag ? `.${newTag}` : t));
                if (hadTag) {
                    changes.push({
                        category: "Blocks",
                        itemId: item.id,
                        changeType: "tag_rename",
                        old: tr.old,
                        new: tr.new,
                        note: `tag ${tr.old} → ${tr.new}`,
                    });
                }
            }
        });
    });
}

function applyRemovedFields(items, removedFields, scope, changes) {
    if (!items || !removedFields) return;
    removedFields
        .filter((rf) => rf.scope === scope)
        .forEach((rf) => {
            if (rf.old_path === ".onUpdate.drops") {
                items.forEach((item) => {
                    const nested = item.onUpdate?.drops;
                    if (nested) {
                        item.drops = Array.isArray(item.drops) ? item.drops.concat(nested) : nested;
                        delete item.onUpdate.drops;
                        changes.push({
                            category: categoryLabel(scope),
                            itemId: item.id,
                            changeType: "removed_field",
                            old: rf.old_path,
                            new: ".drops",
                            note: "merged into top-level .drops",
                        });
                    }
                });
            }
        });
}

function applyRecipeStringRenames(recipes, blockRenames, itemRenames, changes) {
    if (!recipes) return;
    const allRenames = [...(blockRenames || []), ...(itemRenames || [])];
    if (!allRenames.length) return;

    const occurrenceCounts = new Map();

    const rewriteRef = (ref) => {
        const countMatch = ref.match(/^(\d+)\s+(.+)$/);
        const prefix = countMatch ? `${countMatch[1]} ` : "";
        const idPart = countMatch ? countMatch[2] : ref;
        const bareId = idPart.includes(':') ? idPart.split(':').slice(1).join(':') : idPart;

        for (const rename of allRenames) {
            if (rename.old.includes(bareId)) {
                const namespace = idPart.includes(':') ? idPart.split(':')[0] : null;
                const newRef = `${prefix}${namespace ? `${namespace}:` : ''}${rename.new}`;
                const key = JSON.stringify([ref, newRef]);
                occurrenceCounts.set(key, (occurrenceCounts.get(key) || 0) + 1);
                return newRef;
            }
        }
        return ref;
    };

    Object.keys(recipes).forEach((filename) => {
        recipes[filename] = recipes[filename].map((recipe) => ({
            inputs: (recipe.inputs || []).map(rewriteRef),
            output: recipe.output ? rewriteRef(recipe.output) : recipe.output,
        }));
    });

    occurrenceCounts.forEach((count, key) => {
        const [oldRef, newRef] = JSON.parse(key);
        changes.push({
            category: "Recipes",
            itemId: "",
            changeType: "recipe_string_rename",
            old: oldRef,
            new: newRef,
            note: `${count} occurrence${count === 1 ? "" : "s"}`,
        });
    });
}

window.migrateProject = async function (projectData, sourceVersion, targetVersion) {
    const rules = await loadMigrationRules();
    const steps = stepsBetween(rules, sourceVersion, targetVersion);

    const conflicts = [];
    const unresolved = [];
    const appliedSteps = [];
    const changes = [];

    steps.forEach((step) => {
        if (step.unresolved?.length) unresolved.push(...step.unresolved.map((u) => ({ ...u, step: `${step.from} -> ${step.to}` })));

        const beforeCount = changes.length;

        applyIdRenames(projectData.blocks, step.id_renames?.block, "block", conflicts, changes);
        applyIdRenames(projectData.items, step.id_renames?.item, "item", conflicts, changes);
        applyIdRenames(projectData.biomes, step.id_renames?.biome, "biome", conflicts, changes);

        applyFieldRenames(projectData.biomes, step.field_renames, "biome", changes);
        applyFieldRenames(projectData.blocks, step.field_renames, "block", changes);

        applyTagRenames(projectData.blocks, step.tag_renames, changes);

        applyBlockEntityRenames(projectData.blocks, step.block_entity_renames, changes);

        applyRemovedFields(projectData.blocks, step.removed_fields, "block", changes);

        applyRecipeStringRenames(projectData.recipes, step.id_renames?.block, step.id_renames?.item, changes);

        for (const fr of step.folder_renames || []) {
            if ((projectData.entities || []).length) {
                changes.push({
                    category: "General",
                    itemId: "",
                    changeType: "folder_rename",
                    old: fr.old,
                    new: fr.new,
                    note: "entity definition, texture and model folders move on export",
                });
            }
        }

        if (changes.length === beforeCount) {
            changes.push({
                category: "General",
                itemId: "",
                changeType: "no_change",
                old: "",
                new: "",
                note: `No changes needed for step ${step.from} -> ${step.to}.`,
            });
        }

        appliedSteps.push(`${step.from} -> ${step.to}`);
    });

    return { appliedSteps, conflicts, unresolved, changes };
};
