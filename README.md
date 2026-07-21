# AI Token Tracker

Tampermonkey userscript for tracking AI credit/token spending from the Generate UI on supported platforms.

## Supported platforms

| Platform | URL | Tracking |
|----------|-----|----------|
| Kling | `https://kling.ai/app/*` | UI + network balance API |
| Higgsfield | `https://higgsfield.ai/*` | UI only (`Generate ✦ 16` on button) |
| SJinn Seedance | `https://sjinn.ai/tools/seedance20-video` | UI only, calculated from duration × credits/s |

## Build & test

```bash
npm install
npm test
npm run build
```

Output: [`dist/AI-Token-Tracker.user.js`](dist/AI-Token-Tracker.user.js)

Watch mode:

```bash
npm run watch
```

Install the built file in Tampermonkey (do not edit `dist/` by hand — change `src/` and rebuild).

## Project structure

```
src/
  index.js              Entry point
  userscript.header.js  Tampermonkey metadata
  core/
    app.js              Tracker bootstrap + ctx wiring
    tracker.js          Re-exports createTracker
    api.js              window.AITokenTracker API
    balance.js          UI/network balance observation
    network.js          fetch/XHR interception
    projects.js         Project CRUD + filters
    constants.js        Version, storage keys
  ui/
    panel.js            Shadow DOM panel + persistence
    render.js           Panel rendering
    icons.js            SVG icons
  adapters/
    kling.js            Kling adapter (network + UI)
    higgsfield.js       Higgsfield adapter (UI-only)
    shared.js           Shared UI parsing helpers
    metadata.js         Platform metadata parsers
    registry.js         Adapter registry
  lib/
    credits.js          Credit math
    balance-parse.js    Network balance JSON scoring
    utils.js            Text/JSON helpers
harness/
  index.html            Local test page (Kling + Higgsfield mocks)
```

## API

```javascript
window.AITokenTracker.getState()
window.AITokenTracker.listProjects()
window.AITokenTracker.syncProjectsFromSheets()
// Alias for backward compatibility:
window.KlingTokenTracker
```

## Adding a platform

1. Create a focused adapter in `src/adapters/`.
2. Export its factory from `src/adapters/index.js`.
3. Add Tampermonkey `@match` entries in `src/userscript.header.js`.
4. Add adapter unit tests.
5. Run `npm test` and `npm run build`.

## Storage

Uses `localStorage` prefix `klingTokenTracker.*` (unchanged for backward compatibility).

**Projects** and **spend history** are stored in Tampermonkey's `GM_getValue` / `GM_setValue`, so they sync automatically between supported platforms. On first run after update, data from each site's `localStorage` is merged into shared storage.

- **History** — combined across all services (History tab, project totals, «Only this project» filter).
- **Shared project catalog** — synchronized through the configured Google Sheet. New project forms suggest exact and fuzzy matches before creating a duplicate.
- **Project deletion** — archives the shared project without removing historical spend rows.
- **Undo project correction** — click the project name in the Undo banner to pause the countdown and reassign the spend before sync completes.
- **Create from Undo** — if the required project is missing, create it directly in the paused picker and immediately attach it to the spend.
- **Project search** — search active projects by name from the compact panel or the paused Undo picker; Undo lists newest-created projects first.
- **Balance / Session** — per current site only.
- **Today** — per current site only (from shared history, filtered by service).

## CI

GitHub Actions runs `npm test`, `npm run build`, and `node --check` on push and pull requests (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Version

0.9.6
