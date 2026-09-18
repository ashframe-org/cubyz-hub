
(function () {
    const STRESSTEST_ADMIN_USERNAME = "iNiKKo";

    function setVal(id, value) {
        const el = document.getElementById(id);
        if (!el) return false;
        el.value = value;
        return true;
    }

    function setChecked(id, checked) {
        const el = document.getElementById(id);
        if (!el) return false;
        el.checked = checked;
        return true;
    }

    function pick(arr, i) {
        return arr[i % arr.length];
    }

    function randPick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function randRange(min, max, decimals = 1) {
        const v = min + Math.random() * (max - min);
        return Number(v.toFixed(decimals));
    }


    const ROTATION_MODES = ["cubyz:stairs", "cubyz:ore", "cubyz:decayable", "cubyz:carpet", "cubyz:direction", "cubyz:hanging", "cubyz:no_rotation", "cubyz:planar", "cubyz:torch", "cubyz:texture_pile", "cubyz:branch", "cubyz:log", "cubyz:fence", "cubyz:sign"];
    const SUPPORT_CHECK_ROTATIONS = ["cubyz:carpet", "cubyz:planar", "cubyz:no_rotation", "cubyz:torch", "cubyz:texture_pile", "cubyz:direction"];
    const TOUCH_VARIANTS = ["heat", "heal", "void"];
    const UPDATE_TYPES = ["none", "check_support_blocks", "decay", "vine_decay", "replace_block"];
    const TICK_TYPES = ["none", "check_support_blocks", "decay", "vine_decay", "replace_block"];
    const BREAK_TYPES = ["none", "replace_block"];
    const INTERACT_TYPES = ["none", "open_chest", "edit_sign", "open_window"];
    const BLOCK_TAG_CHOICES = ["mineable", "choppable", "diggable", "cuttable", "leaf", "fluid"];

    const MATERIAL_MODIFIERS = ["none", "durable", "fragile", "heavy", "light", "powerful", "weak"];
    const ITEM_TAG_CHOICES = ["material", "metal", "precious", "ore", "food", "fluidPlaceable"];

    const CLIMATE = ["hot", "temperate", "cold"];
    const HUMIDITY = ["wet", "neitherWetNorDry", "dry"];
    const ZONE = ["inland", "land", "ocean"];
    const GROWTH = ["barren", "balanced", "overgrown"];
    const ELEVATION = ["lowTerrain", "balanced", "mountain", "antiMountain"];
    const INTERPOLATION = [".square", ".linear", ".none"];
    const CAVE_LAYERS = ["cave_layer", "shallow_cave_layer", "surface_caves_layer", "sky_layer", "sky_island_layer", "dropoff_layer", "mantle_layer", "root_layer", "void_layer"];
    const STRUCTURE_TYPES = ["cubyz:simple_tree", "cubyz:simple_vegetation", "cubyz:flower_patch", "cubyz:boulder", "cubyz:ground_patch", "cubyz:fallen_tree", "cubyz:sbb"];

    const COORD_SYSTEMS = [".right_handed_z_up", ".left_handed_y_up"];

    const PARTICLE_SHAPES = ["point", "sphere", "cube"];
    const PARTICLE_MODES = ["spread", "scatter", "direction"];

    async function stressTestIsAdmin() {
        try {
            const res = await fetch("/api/auth/status", { credentials: "include" });
            const data = await res.json();
            return !!(data.ok && data.user && data.user.username === STRESSTEST_ADMIN_USERNAME);
        } catch (_) {
            return false;
        }
    }

    async function stressTestGenerateBlocks(n, blockTextures, itemTextures) {
        const ids = [];
        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("blocks", null);

            const id = `stress_block_${i}`;
            let updateTypePreview = pick(UPDATE_TYPES, i);
            let tickTypePreview = pick(TICK_TYPES, i + 1);
            if (["decay", "vine_decay"].includes(updateTypePreview) && ["decay", "vine_decay"].includes(tickTypePreview)) {
                tickTypePreview = "none";
            }
            let rotation = pick(ROTATION_MODES, i);
            if (updateTypePreview === "decay" || tickTypePreview === "decay") rotation = "cubyz:decayable";
            else if (updateTypePreview === "vine_decay" || tickTypePreview === "vine_decay") rotation = "cubyz:hanging";
            else if (updateTypePreview === "check_support_blocks" || tickTypePreview === "check_support_blocks") {
                rotation = pick(SUPPORT_CHECK_ROTATIONS, i);
            }
            const needsIcon = rotation === "cubyz:ore";

            setVal("blockId", id);
            setVal("blockHealth", randRange(0.5, 20, 1));
            setVal("blockResistance", randRange(0, 20, 1));

            setVal("blockRotation", rotation);
            window.handleRotationChange(rotation);

            const variantIdx = i % 6;
            let collide, transparent, replaceable, degradable, viewThrough, alwaysViewThrough, hasBackFace, allowOres;
            if (variantIdx === 0) {
                collide = true; transparent = false; replaceable = false; degradable = false;
                viewThrough = false; alwaysViewThrough = false; hasBackFace = false; allowOres = false;
            } else if (variantIdx === 1) {
                collide = true; transparent = true; replaceable = true; degradable = true;
                viewThrough = true; alwaysViewThrough = true; hasBackFace = true; allowOres = true;
            } else if (variantIdx === 2) {
                collide = false; transparent = false; replaceable = false; degradable = false;
                viewThrough = true; alwaysViewThrough = false; hasBackFace = false; allowOres = false;
            } else if (variantIdx === 3) {
                collide = false; transparent = true; replaceable = true; degradable = false;
                viewThrough = true; alwaysViewThrough = true; hasBackFace = false; allowOres = false;
            } else if (variantIdx === 4) {
                collide = true; transparent = false; replaceable = false; degradable = false;
                viewThrough = false; alwaysViewThrough = false; hasBackFace = true; allowOres = true;
            } else {
                collide = true; transparent = true; replaceable = false; degradable = true;
                viewThrough = true; alwaysViewThrough = false; hasBackFace = true; allowOres = false;
            }
            setChecked("blockCollide", collide);
            setChecked("blockTransparent", transparent);
            setChecked("blockReplaceable", replaceable);
            setChecked("blockDegradable", degradable);
            setChecked("blockViewThrough", viewThrough);
            setChecked("blockAlwaysViewThrough", alwaysViewThrough);
            setChecked("blockHasBackFace", hasBackFace);
            setChecked("blockAllowOres", allowOres);

            setVal("blockFriction", randRange(1, 40, 1));
            setVal("blockBounciness", randRange(0, 1, 2));
            setVal("blockDensity", randRange(0.2, 5, 2));
            setVal("blockTerminalVelocity", randRange(10, 150, 0));
            setVal("blockMobility", randRange(0, 3, 2));

            setVal("emittedLightColor", (i % 3 === 0) ? "#ff8800" : "#000000");
            setVal("absorbedLightColor", (i % 4 === 0) ? "#4444ff" : "#ffffff");

            window.addDynamicTagPill("blockTagsContainer", "tagTextInput", pick(BLOCK_TAG_CHOICES, i));
            if (i % 2 === 0) {
                window.addDynamicTagPill("blockTagsContainer", "tagTextInput", pick(BLOCK_TAG_CHOICES, i + 2));
            }

            const baseTex = randPick(blockTextures);
            setVal("topSearch", baseTex.name);
            if (i % 3 === 0) setVal("frontSearch", randPick(blockTextures).name);
            if (i % 4 === 0) setVal("leftSearch", randPick(blockTextures).name);
            if (i % 4 === 1) setVal("rightSearch", randPick(blockTextures).name);
            if (i % 3 === 1) setVal("upSearch", randPick(blockTextures).name);
            if (i % 3 === 2) setVal("bottomSearch", randPick(blockTextures).name);

            setChecked("hasItemIcon", needsIcon || i % 6 === 0);
            window.toggleItemIconInput(document.getElementById("hasItemIcon"));
            if (needsIcon || i % 6 === 0) {
                setVal("itemIconSearch", randPick(itemTextures).name);
            }

            const dropAuto = i % 2 === 0;
            setChecked("dropAuto", dropAuto);
            window.toggleDropInput(document.getElementById("dropAuto"));
            if (!dropAuto) setVal("dropSearch", "cubyz:stone");

            document.getElementById("toggleAdvancedLogic").checked = true;
            document.getElementById("advancedLogicGrid").style.display = "grid";

            setVal("logicTouchType", (i % 3 === 0) ? "hurt" : "none");
            if (i % 3 === 0) {
                setVal("logicTouchDps", randRange(0.1, 5, 1));
                setVal("logicTouchTypeVariant", pick(TOUCH_VARIANTS, i));
                setVal("logicTouchMode", (i % 6 === 0) ? "heal" : "damage");
            }

            const updateType = updateTypePreview;
            setVal("logicUpdateType", updateType);
            if (updateType === "replace_block") setVal("updateReplaceBlockSearch", "cubyz:air");
            if (updateType === "decay") {
                setVal("decayReplacement", "cubyz:air");
                setVal("decayPrevention", ".log, .branch");
            }

            const tickType = tickTypePreview;
            setVal("logicTickType", tickType);
            document.getElementById("advTickReplaceWrapper").style.display = (tickType === "replace_block") ? "block" : "none";
            if (tickType === "replace_block") setVal("tickReplaceBlockSearch", "cubyz:air");
            if (tickType === "decay") {
                setVal("decayTickReplacement", "cubyz:air");
                setVal("decayTickPrevention", ".log");
            }

            const breakType = pick(BREAK_TYPES, i);
            setVal("logicBreakType", breakType);
            document.getElementById("advBreakReplaceWrapper").style.display = (breakType === "replace_block") ? "block" : "none";
            if (breakType === "replace_block") setVal("breakReplaceBlockSearch", "cubyz:air");

            const interactType = pick(INTERACT_TYPES, i + 2);
            setVal("logicInteractType", interactType);
            document.getElementById("advInteractWindowWrapper").style.display = (interactType === "open_window") ? "block" : "none";
            if (interactType === "open_window") setVal("interactWindowName", "crafting_table");

            const ok = window.saveBlockToProject(true);
            if (ok) ids.push(id);
            else console.error(`[stress-test] block ${id} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function stressTestGenerateItems(n, itemTextures) {
        const ids = [];
        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("items", null);

            const id = `stress_item_${i}`;
            setVal("itemId", id);
            setVal("itemStackSize", pick([1, 16, 64, 120, 999], i));
            setVal("itemFoodValue", (i % 3 === 0) ? randRange(0.5, 10, 1) : 0);

            if (i % 4 === 0) setVal("itemBlockPlacementSearch", "cubyz:torch");

            const isMaterial = i % 2 === 0;
            if (isMaterial) window.addDynamicTagPill("itemTagsContainer", "itemTagTextInput", "material");
            window.addDynamicTagPill("itemTagsContainer", "itemTagTextInput", pick(ITEM_TAG_CHOICES, i + 1));

            setVal("matDurability", randRange(10, 2000, 0));
            setVal("matSwingSpeed", randRange(0.1, 10, 1));
            setVal("matTexRoughness", randRange(0, 1, 2));
            setVal("matMassDamage", randRange(0, 10, 1));
            setVal("matHardnessDamage", randRange(0, 10, 1));
            setVal("matColorBase", pick(["#9c9c9c", "#e6194b", "#ffaa00", "#33cc66", "#3388ff", "#aa22ff"], i));

            const modifier = pick(MATERIAL_MODIFIERS, i);
            setVal("matModifierType", modifier);
            setVal("matModifierStrength", randRange(0.1, 3, 1));

            setVal("itemTextureSearch", randPick(itemTextures).name);

            const ok = window.saveItemToProject(true);
            if (ok) ids.push(id);
            else console.error(`[stress-test] item ${id} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function stressTestGenerateBiomes(n, blockIds) {
        const ids = [];
        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("biomes", null);

            const id = `stress_biome_${i}`;
            setVal("biomeId", id);
            setVal("biomeChance", randRange(0.05, 2, 2));
            setVal("bioInterpolation", pick(INTERPOLATION, i));

            document.querySelector(`input[name="bioTemp"][value="${pick(CLIMATE, i)}"]`).checked = true;
            document.querySelector(`input[name="bioWet"][value="${pick(HUMIDITY, i + 1)}"]`).checked = true;
            document.querySelector(`input[name="bioZone"][value="${pick(ZONE, i + 2)}"]`).checked = true;
            document.querySelector(`input[name="bioGrowth"][value="${pick(GROWTH, i)}"]`).checked = true;
            document.querySelector(`input[name="bioHeightProp"][value="${pick(ELEVATION, i + 1)}"]`).checked = true;

            setVal("bioSurfaceBlock", i % 5 === 0 ? randPick(blockIds) : "cubyz:grass");
            setVal("bioSubBlock", "cubyz:soil");
            setVal("bioStoneBlock", "cubyz:slate/smooth");

            setVal("bioMinRadius", randRange(64, 300, 0));
            setVal("bioMaxRadius", randRange(300, 600, 0));
            setVal("bioMinHeight", randRange(-200, 50, 0));
            setVal("bioMaxHeight", randRange(51, 400, 0));
            setChecked("bioSmoothBeaches", i % 2 === 0);
            setVal("bioMinHeightLimit", randRange(1, 20, 0));
            setVal("bioMaxHeightLimit", randRange(21, 120, 0));
            setVal("bioRoughness", randRange(0.1, 3, 1));
            setVal("bioHills", randRange(0, 15, 1));
            setVal("bioMountains", randRange(0, 10, 1));
            setVal("bioSoilCreep", randRange(0, 3, 1));
            setVal("bioKeepOriginalTerrain", randRange(0, 1, 2));

            setVal("bioMusic", "cubyz:sunrise");
            setVal("bioFogDensity", randRange(0.1, 4, 1));
            setVal("bioSkyColor", pick(["#75b2ff", "#ffcc88", "#331144", "#88ffee"], i));
            setVal("bioFogColor", pick(["#e2f2ff", "#ffddaa", "#220033", "#ccffee"], i));
            setChecked("bioSpawn", i % 3 !== 0);

            const isCave = i % 3 === 0;
            setChecked("bioIsCave", isCave);
            document.getElementById("caveSettings").style.display = isCave ? "grid" : "none";
            if (isCave) {
                setVal("bioCaves", randRange(0.2, 3, 1));
                setVal("bioCaveRadiusFactor", randRange(0.2, 3, 1));
                setVal("bioCrystals", pick([0, 1, 5, 20], i));
                if (i % 7 === 0) {
                    setVal("bioCaveLayer", "__custom__");
                    document.getElementById("bioCaveLayerCustom").style.display = "block";
                    setVal("bioCaveLayerCustom", "stress_addon:custom_layer");
                } else {
                    setVal("bioCaveLayer", pick(CAVE_LAYERS, i));
                    document.getElementById("bioCaveLayerCustom").style.display = "none";
                }
            }

            const structCount = i % 4;
            for (let s = 0; s < structCount; s++) {
                const type = pick(STRUCTURE_TYPES, i + s);
                const data = { id: type, chance: randRange(0.005, 0.3, 3) };
                if (type === "cubyz:simple_tree") {
                    Object.assign(data, { log: "cubyz:oak_log", leaves: "cubyz:leaves/oak", height: 6, height_variation: 3, leafRadius: 2 });
                } else if (type === "cubyz:simple_vegetation") {
                    Object.assign(data, { block: "cubyz:fern", height: 1 });
                } else if (type === "cubyz:flower_patch") {
                    Object.assign(data, { block: "cubyz:daffodil", width: 10, variation: 6, density: 0.3 });
                } else if (type === "cubyz:boulder") {
                    Object.assign(data, { block: "cubyz:slate/rough", size: 5, size_variance: 4 });
                } else if (type === "cubyz:ground_patch") {
                    Object.assign(data, { block: "cubyz:gravel", width: 5, depth: 2, smoothness: 0.2 });
                } else if (type === "cubyz:fallen_tree") {
                    Object.assign(data, { log: "cubyz:oak_log", height: 6, height_variation: 3 });
                } else if (type === "cubyz:sbb") {
                    Object.assign(data, { structure: "cubyz:tree/coniferous/pine/loblolly", placeMode: ".degradable" });
                }
                window.addStructureRow(data);
            }

            const ok = window.saveBiomeToProject(true);
            if (ok) ids.push(id);
            else console.error(`[stress-test] biome ${id} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function stressTestGenerateEntities(n, entityModels, entityTextures) {
        const ids = [];
        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("entities", null);

            const id = `stress_entity_${i}`;
            setVal("entityId", id);
            setVal("entityHeight", randRange(0.2, 4, 1));
            const coordSys = pick(COORD_SYSTEMS, i);
            setVal("entityCoordSystem", coordSys);

            const modelName = randPick(entityModels);
            setVal("entityModelSearch", `cubyz:${modelName}`);

            if (entityTextures.length) {
                const tex = randPick(entityTextures);
                let name = tex.name.replace("entityModels/textures/", "").replace("entity_models/textures/", "");
                setVal("entityTextureSearch", name);
            }

            if (i % 2 === 0) window.addDynamicTagPill("entityTagsContainer", "entityTagTextInput", "living");
            if (i % 3 === 0) window.addDynamicTagPill("entityTagsContainer", "entityTagTextInput", "ambient");
            if (i % 5 === 0) window.addDynamicTagPill("entityTagsContainer", "entityTagTextInput", "playerModel");

            const ok = window.saveEntityToProject(true);
            if (ok) ids.push(id);
            else console.error(`[stress-test] entity ${id} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function stressTestGenerateParticles(n, particleTextures) {
        const ids = [];
        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("particles", null);

            const id = `stress_particle_${i}`;
            setVal("particleId", id);

            const tex = randPick(particleTextures);
            let name = tex.name.startsWith("particles/textures/") ? tex.name.replace("particles/textures/", "") : tex.name;
            setVal("particleTextureSearch", name);

            setChecked("particleHasEmission", i % 4 === 0);

            setVal("particleSpeedMin", randRange(0.1, 2, 1));
            setVal("particleSpeedMax", randRange(2, 6, 1));
            setVal("particleLifeMin", randRange(0.1, 1, 2));
            setVal("particleLifeMax", randRange(1, 4, 2));
            setVal("particleDensityMin", randRange(0.5, 3, 1));
            setVal("particleDensityMax", randRange(3, 8, 1));
            setVal("particleRotVelMin", randRange(0, 40, 0));
            setVal("particleRotVelMax", randRange(40, 200, 0));
            setVal("particleDragMin", randRange(0.05, 0.5, 2));
            setVal("particleDragMax", randRange(0.5, 1, 2));
            setChecked("particleRandomRotate", i % 2 === 0);
            setChecked("particleCollides", i % 3 !== 0);

            const shape = pick(PARTICLE_SHAPES, i);
            setVal("particleSpawnShape", shape);
            window.toggleParticleShapeFields(shape);
            if (shape === "sphere") setVal("particleShapeRadius", randRange(0.2, 3, 1));
            else if (shape === "cube") setVal("particleShapeSize", String(randRange(0.2, 3, 1)));

            const mode = pick(PARTICLE_MODES, i + 1);
            setVal("particleDirectionMode", mode);
            window.toggleParticleDirectionFields(mode);
            if (mode === "direction") {
                setVal("particleDirX", randRange(-1, 1, 1));
                setVal("particleDirY", randRange(-1, 1, 1));
                setVal("particleDirZ", randRange(-1, 1, 1));
            }

            const ok = window.saveParticleToProject(true);
            if (ok) ids.push(id);
            else console.error(`[stress-test] particle ${id} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function stressTestGenerateRecipes(n, blockIds, itemIds) {
        const ids = [];
        const pool = [...blockIds, ...itemIds];
        if (!pool.length) return ids;

        for (let i = 0; i < n; i++) {
            await window.loadStudioPanel("recipes", null);

            const filename = `stress_recipe_${i}`;
            setVal("recipeFilename", filename);

            const inputCount = (i % 4) + 1;
            for (let s = 1; s <= 4; s++) {
                if (s <= inputCount) {
                    setVal(`recipeInputSearch${s}`, pick(pool, i + s));
                    setVal(`recipeInputCount${s}`, pick([1, 1, 2, 4, 9], i + s));
                } else {
                    setVal(`recipeInputSearch${s}`, "");
                    setVal(`recipeInputCount${s}`, 1);
                }
            }

            setVal("recipeOutputSearch", pick(pool, i + 7));
            setVal("recipeOutputCount", pick([1, 1, 2, 4, 9], i));

            const ok = window.saveRecipeToProject(true);
            if (ok) ids.push(filename);
            else console.error(`[stress-test] recipe ${filename} failed validation`, window.projectData);
            window.hasUnsavedChanges = false;
        }
        return ids;
    }

    async function generateStressTestPack() {
        const btn = document.getElementById("stressTestBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Generating..."; }

        try {
            if (!window.blockTexturesOnly?.length || !window.itemTexturesOnly?.length) {
                await window.loadServerAssets();
            }

            const blockTextures = window.blockTexturesOnly || [];
            const itemTextures = window.itemTexturesOnly || [];
            const particleTextures = window.particleTexturesOnly || [];
            const entityModels = (window.serverEntityModels || []).length ? window.serverEntityModels : ["cubert"];
            const entityTextures = (window.serverTextures || []).filter(t => t.isEntityType);

            if (!blockTextures.length || !itemTextures.length) {
                alert("Stress-test generator: server texture manifests aren't loaded yet, try again in a moment.");
                return;
            }

            if (!document.getElementById("addonName").value.trim()) {
                setVal("addonName", "stress_test_addon");
            }

            const blockIds = await stressTestGenerateBlocks(20, blockTextures, itemTextures);
            const itemIds = await stressTestGenerateItems(20, itemTextures);
            const biomeIds = await stressTestGenerateBiomes(20, blockIds.length ? blockIds : ["cubyz:grass"]);
            const entityIds = await stressTestGenerateEntities(20, entityModels, entityTextures);
            const particleIds = particleTextures.length ? await stressTestGenerateParticles(20, particleTextures) : [];
            const recipeIds = await stressTestGenerateRecipes(20, blockIds, itemIds);

            window.updateSidebarProjectTree();

            console.log("[stress-test] generated:", {
                blocks: blockIds.length,
                items: itemIds.length,
                biomes: biomeIds.length,
                entities: entityIds.length,
                particles: particleIds.length,
                recipes: recipeIds.length
            });

            await window.loadStudioPanel("blocks", null);

            alert(`Stress-test pack generated: ${blockIds.length} blocks, ${itemIds.length} items, ${biomeIds.length} biomes, ${entityIds.length} entities, ${particleIds.length} particles, ${recipeIds.length} recipes. Use "Export Addon (.ZIP)" to download it.`);
        } catch (err) {
            console.error("[stress-test] generation failed:", err);
            alert(`Stress-test generation failed: ${err.message}`);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Generate Stress-Test Pack"; }
        }
    }
    window.generateStressTestPack = generateStressTestPack;

    async function stressTestInitUI() {
        const isAdmin = await stressTestIsAdmin();
        if (!isAdmin) return;

        const container = document.querySelector(".toolbar-buttons-side");
        if (!container || document.getElementById("stressTestBtn")) return;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "stressTestBtn";
        btn.className = "import-label-btn";
        btn.title = "Generates ~20 varied blocks/items/biomes/entities/particles/recipes into the current project for manual in-game testing. Only visible to you.";
        btn.textContent = "Generate Stress-Test Pack";
        btn.onclick = () => window.generateStressTestPack();

        const exportBtn = container.querySelector('button.btn-primary.toolbar-btn');
        if (exportBtn) container.insertBefore(btn, exportBtn);
        else container.appendChild(btn);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", stressTestInitUI);
    } else {
        stressTestInitUI();
    }
})();
