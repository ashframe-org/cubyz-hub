# Cubyz Addon Migration Guide

Compiled from PixelGuys/Cubyz's official releases, GitHub's file-rename
detection, and the game's own authoritative `_migrations.zig.zon` id-remap
manifests (`assets/cubyz/{blocks,items,biomes}/_migrations.zig.zon`).
Version scheme is `0.MAJOR.MINOR`, not patch-only increments.

## Release timeline

| Version | Released (UTC) | Addon-format breaking? |
|---|---|---|
| 0.0.0 | 2025-10-05 | — (baseline) |
| 0.0.1 | 2025-11-08 | No |
| 0.1.0 | 2025-12-31 | No |
| 0.1.1 | 2026-01-01 | No |
| 0.2.0 | 2026-04-03 | **Yes** |
| 0.3.0 | 2026-07-04 | **Yes** |
| *(unreleased, master)* | — | **Yes** — 5 changes merged post-0.3.0, not yet in a tagged release |

---

## 0.1.1 → 0.2.0

**Entity asset folder restructure** (folder-level, not manifest-backed —
confirmed via GitHub rename detection):
- `assets/cubyz/entity/` → `assets/cubyz/entities/` (singular → plural)
- Subpaths preserved: `entity/models/*` → `entities/models/*`,
  `entity/textures/*` → `entities/textures/*`

**Block/item id renames** (from `_migrations.zig.zon`) — wood set
reorganized into subfolders by material:

| Old ID | New ID |
|---|---|
| baobab_planks | planks/baobab |
| birch_planks | planks/birch |
| mahogany_planks | planks/mahogany |
| oak_planks | planks/oak |
| palm_planks | planks/palm |
| pine_planks | planks/pine |
| willow_planks | planks/willow |
| baobab_fence | fence/baobab |
| birch_fence | fence/birch |
| mahogany_fence | fence/mahogany |
| oak_fence | fence/oak |
| palm_fence | fence/palm |
| pine_fence | fence/pine |
| willow_fence | fence/willow |
| baobab_branch | branch/baobab |
| birch_branch | branch/birch |
| mahogany_branch | branch/mahogany |
| oak_branch | branch/oak |
| pine_branch | branch/pine |
| willow_branch | branch/willow |
| cactus_arm | branch/cactus |
| glimmergill_branch | branch/glimmergill |
| toadstool_branch | branch/toadstool |
| bolete_branch | branch/bolete |
| candy_cane/block | candy_cane_block |
| candy_cane/branch | branch/candy_cane |

**Biome id renames:**

| Old ID | New ID |
|---|---|
| flatland | development/flat |

---

## 0.2.0 → 0.3.0

**Block/item id renames** (from `_migrations.zig.zon`) — stone materials
split their old `base` variant into `rough` or `smooth` depending on
material, and log/top pairs merged into one `log/<material>` id:

| Old ID | New ID |
|---|---|
| baobab_log, baobab_top | log/baobab |
| birch_log, birch_top | log/birch |
| mahogany_log, mahogany_top | log/mahogany |
| oak_log, oak_top | log/oak |
| pine_log, pine_top | log/pine |
| willow_log, willow_top | log/willow |
| slate/base | slate/smooth |
| slate/cobble | slate/rough |
| marble/base | marble/smooth |
| glacite/base | glacite/smooth |
| basalt/base | basalt/smooth |
| voidstone/base | voidstone/smooth |
| pyrolite/base | pyrolite/rough |
| terracotta/base | terracotta/smooth |
| sandstone/base | sandstone/rough |
| ferrock/base | ferrock/smooth |
| limestone/base | limestone/smooth |
| nimbusite/base | nimbusite/smooth |

**Biome id renames:**

| Old ID | New ID |
|---|---|
| jungle | jungle/base |
| island | ocean/temperate/island/base |
| island_shelf | ocean/temperate/island/shelf |
| cave/cave | cave/slate/base |
| tall_mountain/peak | tall_mountain/summit1 |

**Other confirmed (not itemized as id renames):**
- Block entities now use `mod:name`-style namespaced ids (exact PR/commit
  not identified — flagged as a gap, see below).
- Cave layers introduced (new addon capability, not a breaking rename).
- **New requirement, not a rename — validation, not migratable:** any
  biome with `.isCave = true` needs at least one tag ending in `_layer`
  (e.g. `.sky_layer`) or it's silently excluded from cave generation
  entirely (registered but never spawns — only a server-side log warning,
  no crash, no in-game error visible to a player). Confirmed via Cubyz's
  own source (`src/server/terrain/biomes.zig`'s `Biome.init`,
  `src/server/terrain/cave_layers.zig`'s `CaveLayer.init`), introduced by
  the same cave-layers feature (PR #2826). Vanilla's own layer tags:
  `cave_layer`, `shallow_cave_layer`, `surface_caves_layer`, `sky_layer`,
  `sky_island_layer`, `sky_island_fog_layer`, `dropoff_layer`,
  `mantle_layer`, `lower_mantle_layer`, `root_layer`,
  `root_transition_layer`, `void_layer` — an addon can also define its own
  custom layer instead of using one of these. There's no old value to
  migrate from (a pre-0.3.0 cave biome simply didn't need this field at
  all), so this can't be an automatic migration rule — the Addon Creator
  instead validates for it directly (Biomes panel form + import results).

---

## 0.3.0 → unreleased (master, pending next version)

Everything below is **merged to master but not yet in a tagged release**.
Treat as provisional — re-verify once the next version actually ships,
since PR content can still change before release.

| PR | Change | Migration rule |
|---|---|---|
| #3338 | Asset folder `entityModels` → `entity_models` | Rename any addon's `entityModels/` directory to `entity_models/` |
| #3353 | Block tag `.voidStone` → `.voidstone` | Rename tag `.voidStone` to `.voidstone` in any block `.zig.zon` |
| #3403 | New optional `.colorTexture` field on items/materials | Non-breaking — old `.colors`/`.outlineColorLight`/`.outlineColorShadow` fields still work. No migration required, but note as available. |
| #3532 | `.onUpdate.drops` sub-field removed from block defs | Merge any block's nested `.onUpdate.drops` list into its top-level `.drops` field, then delete the nested one |
| #3599 | Biome field `.properties` → `.climate` | Rename `.properties` to `.climate` in any biome `.zig.zon` |

---

## Known gaps (do not guess past these)

- **Entity id/`mod:name` namespacing change (0.3.0)**: mentioned in the
  0.3.0 changelog ("block entities now use `mod:name` ids") but no
  specific PR or manifest entry was found. Needs a targeted search of
  `blockEntity`-related commits around the 0.3.0 window before a migration
  rule can be written for it.
- **GitHub's compare API truncates at 300 files per pair**, so the
  0.1.1→0.2.0 and 0.2.0→0.3.0 diffs above are backed by the authoritative
  `_migrations.zig.zon` manifests (which matched 100% of what the
  truncated compare diff did show), not a fully exhaustive file-level
  diff. Texture-only renames with no id change wouldn't affect addon
  compatibility anyway, so this gap is low-risk.
- **Whether `_migrations.zig.zon` itself is complete** for every rename
  the changelogs vaguely reference was not exhaustively proven — high
  confidence based on 100% agreement with independently-detected renames,
  but not a formal guarantee.
