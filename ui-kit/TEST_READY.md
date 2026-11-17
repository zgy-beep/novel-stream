# TEST_READY: SillyTavern UI Kit E2E Test Suite

> **Current status (as of `package.json` v2.7.0):** the 58 cases below remain the declared suite. `T1-R3-04` now reads the expected version from `package.json` instead of the literal `2.5.0`. `--no-host` executes 52 cases and records the 6 live-host cases (`T1-R4-01..05`, `T4-SC-05`) as explicit `SKIP` with a reason. Static guard: `npm test`. Reporting/skip/version regression: `node test/test-e2e-reporting.js`.
>
> **Historical note:** the baseline/pending columns in §3 are the v2.4.0 -> v2.5.0 implementation record, not the current pass/fail state.

## 1. Readiness Declaration

The comprehensive End-to-End (E2E) automated test suite for **SillyTavern UI Kit v2.5.0** has been fully designed, implemented, and verified in `test/test-e2e-v250.js`.

The suite is **100% automated**, self-contained, adheres strictly to the opaque-box test philosophy, and executes directly via Node.js and Playwright-driven Google Chrome against both isolated ephemeral sandbox contexts and the live SillyTavern host on `http://127.0.0.1:8000`.

---

## 2. Test Execution Command

### Full Suite Run
```bash
node test/test-e2e-v250.js
```

### Granular Options & Filtering
```bash
# Run specific tier
node test/test-e2e-v250.js --tier=1
node test/test-e2e-v250.js --tier=2
node test/test-e2e-v250.js --tier=3
node test/test-e2e-v250.js --tier=4

# Run with regex filter on test description
node test/test-e2e-v250.js --filter=themeToggle
node test/test-e2e-v250.js --filter=clamping

# No-host mode: 52 cases execute; 6 live-host cases are recorded as explicit SKIP
node test/test-e2e-v250.js --no-host

# Verbose output with full payload logging
node test/test-e2e-v250.js --verbose

# Offline static guard (no browser, no host) and reporting regression (no browser)
npm test
node test/test-e2e-reporting.js
```

The summary reports `Declared / Selected / Passed / Failed / Skipped / Not selected` plus the reason for every skipped case. Skips do not fail the run; only `Failed > 0` exits with code 1. If the host is unreachable in a normal run, the same 6 host cases are recorded as `SKIP` after a 3s probe instead of being silently omitted.

---

## 3. Test Coverage Summary Across 4 Tiers (58 Tests Total)

| Tier | Category | Total Tests | Baseline PASS (v2.4.0) | Feature-Pending (M1/M2/M3) |
|---|---|---|---|---|
| **Tier 1** | R1 Layout State Persistence | 12 | 4 | 8 (Awaiting M1) |
| **Tier 1** | R2 Standardized Panel Header | 14 | 0 | 14 (Awaiting M2) |
| **Tier 1** | R3 Calling Paradigms & Versions | 5 | 3 | 2 (Awaiting M3) |
| **Tier 1** | R4 Live Host Integration & 0 Pageerrors | 5 | 5 | 0 |
| **Tier 2** | Boundary & Corner Cases (Clamping, Quota, XSS) | 11 | 6 | 5 (Awaiting M1/M2) |
| **Tier 3** | Cross-Feature Combinations (Pairwise) | 6 | 3 | 3 (Awaiting M1/M2) |
| **Tier 4** | Real-World Application Scenarios | 5 | 3 | 2 (Awaiting M1/M2) |
| **TOTAL** | **Full E2E Suite** | **58** | **24** | **34** |

With `--no-host`, 52 of the 58 cases execute and the 6 live-host cases (`T1-R4-01..05`, `T4-SC-05`) are reported as `SKIP`. The static `npm test` guard is a separate suite and does not run the browser tests.

---

## 4. Test Matrix by Requirement

### Tier 1: Feature Coverage (36 tests)
- **R1: Layout State Persistence (12 tests)**:
  - `T1-R1-01`: `createPanel` with `persist: true` initializes persistence lifecycle.
  - `T1-R1-02`: Panel size adjustments save into `localStorage` (`nvui_state_${id}`).
  - `T1-R1-03`: Re-opening panel restores saved width and height from `localStorage`.
  - `T1-R1-04`: Active tab switching persists and restores on re-open.
  - `T1-R1-05`: Accordion open/collapse state tracks and restores.
  - `T1-R1-06`: Granular persist config: `{ size: false, tab: true }`.
  - `T1-R1-07`: Custom `StorageAdapter` receives `get`/`set` calls.
  - `T1-R1-08`: 250ms debounced write consolidates rapid mutations.
  - `T1-R1-09`: `destroy()` or `close()` immediately flushes pending writes.
  - `T1-R1-10`: `NVUI.clearLayoutState(id)` clears default `localStorage` entry.
  - `T1-R1-11`: `NVUI.clearLayoutState(id, customStorage)` invokes custom adapter `delete`.
  - `T1-R1-12`: `panel.clearLayoutState()` clears storage and resets active panel DOM styles.

- **R2: Standardized Panel Header (14 tests)**:
  - `T1-R2-01`: Header actions order: `[actions...] -> [themeToggle] -> [closeBtn]`.
  - `T1-R2-02`: `themeToggle` sits immediately left of `closeBtn` when actions omitted.
  - `T1-R2-03`: `themeToggle: true` renders `.nvui-icon-btn.nvui-theme-toggle`.
  - `T1-R2-04`: Clicking `themeToggle` toggles `.nvui-theme-light` on `document.body`.
  - `T1-R2-05`: Theme toggle icon transitions between Sun and Moon.
  - `T1-R2-06`: `themeToggle` `aria-label` updates dynamically with theme state.
  - `T1-R2-07`: `opts.onThemeChange` callback receives next theme string.
  - `T1-R2-08`: `opts.themeToggle.onThemeChange` object syntax callback invoked.
  - `T1-R2-09`: `createPanel` static `update` option renders pill in title area.
  - `T1-R2-10`: `panel.showUpdate` dynamic interface mounts `.nvui-update-pill`.
  - `T1-R2-11`: `panel.showUpdate(null)` smoothly removes pill from DOM.
  - `T1-R2-12`: Update pill conforms to WAI-ARIA (`role="button"`, `tabindex="0"`).
  - `T1-R2-13`: Update pill triggers `onClick` on Enter/Space keyboard events.
  - `T1-R2-14`: Flat Glass design: Update pill has no 1px solid border outline.

- **R3: Calling Paradigms & Version Integrity (5 tests)**:
  - `T1-R3-01`: SillyTavern ESM calling paradigm conforms to module contracts.
  - `T1-R3-02`: Tavern Helper IIFE calling paradigm operates zero-build.
  - `T1-R3-03`: Backward compatibility: panel without v2.5 options retains 100% v2.4 behavior.
  - `T1-R3-04`: 6-place version alignment verified against the current `package.json` version (tokens.json / tokens.css / components.css / nvui-api.js source + runtime / README / AI-GUIDE must agree).
  - `T1-R3-05`: Template 4-asset MD5 parity verified with repository root.

- **R4: Live SillyTavern Host & Zero Pageerrors (5 tests)**:
  - `T1-R4-01`: Live SillyTavern host is reachable on `http://127.0.0.1:8000`.
  - `T1-R4-02`: UI Kit injected into live SillyTavern host without error.
  - `T1-R4-03`: Panel open/tab/close lifecycle executes in live SillyTavern host.
  - `T1-R4-04`: Theme toggle operates safely within live SillyTavern DOM.
  - `T1-R4-05`: Zero pageerrors recorded during live SillyTavern host execution.

### Tier 2: Boundary & Corner Cases (11 tests)
- `T2-BC-01`: Empty `persist: {}` defaults to full persistence.
- `T2-BC-02`: Invalid persist parameter (`"invalid"` / `123`) safely falls back to false.
- `T2-BC-03`: Storage `QuotaExceededError` simulation is caught and logged as warning.
- `T2-BC-04`: Viewport Clamping: 4K saved size (1600x1200) clamped on mobile (390px).
- `T2-BC-05`: Viewport Clamping: Close button is strictly within viewport bounds.
- `T2-BC-06`: Viewport Clamping: Disconnected monitor off-screen coordinates recover to safe margin.
- `T2-BC-07`: Missing/deleted tab key in storage gracefully falls back to first valid tab.
- `T2-BC-08`: Orphaned accordion key in storage is ignored without error.
- `T2-BC-09`: XSS attack payload in `showUpdate` is rendered strictly as `textContent`.
- `T2-BC-10`: `javascript:` pseudo-protocol in `showUpdate` url is rejected or sanitized.
- `T2-BC-11`: Rapid sequential `showUpdate` updates pill cleanly without duplicates.

### Tier 3: Cross-Feature Combinations (6 tests)
- `T3-CB-01`: `persist: true` + `themeToggle: true` simultaneously operate without interference.
- `T3-CB-02`: Custom Storage Adapter + dynamic `showUpdate` pill without write side-effects.
- `T3-CB-03`: Accordion collapse persistence during tab switch & panel reopen.
- `T3-CB-04`: Active 250ms debounce with simultaneous resize event flushes clamped bounds.
- `T3-CB-05`: `clearLayoutState` called on actively open panel resets DOM styles and storage.
- `T3-CB-06`: Multi-panel key sandbox isolation avoids cross-panel state collision.

### Tier 4: Real-World Application Scenarios (5 tests)
- `T4-SC-01`: Scenario 1 — SillyTavern Standard Extension Lifecycle (`extension_settings` + GitHub check + header actions).
- `T4-SC-02`: Scenario 2 — Tavern Helper Single-File Userscript Zero-Build Paradigm.
- `T4-SC-03`: Scenario 3 — Multi-Window Cross-Monitor Resolution Shift.
- `T4-SC-04`: Scenario 4 — Fast Repeated Panel Toggle with Pending Debounce Stress.
- `T4-SC-05`: Scenario 5 — Full Host E2E Probe on Live SillyTavern (`http://127.0.0.1:8000`) with zero pageerrors.

---

## 5. Next Steps for Implementation & Verification Tracks (historical v2.5.0 record)

1. **Worker M1** (`worker_m1`): Implement R1 layout state persistence, StorageAdapter, 250ms debounce, and Viewport Clamping in `nvui-api.js` and `components.css`. Run `node test/test-e2e-v250.js --tier=1` to verify R1 tests turn green.
2. **Worker M2**: Implement R2 standardized header actions, `themeToggle` button & transitions, `onThemeChange`, update pill, and `panel.showUpdate`. Run `node test/test-e2e-v250.js --tier=1` to verify R2 tests turn green.
3. **Worker M3**: Align the version declarations (now resolved dynamically from `package.json`), sync template assets (MD5 parity), and write calling and migration guides. Verify R3 tests turn green.
4. **Worker M4**: Run full verification `node test/test-e2e-v250.js` to ensure 58/58 when the host is reachable, or 52/52 executed + 6 explicit SKIP under `--no-host`; also run `node test/test-ui-kit.js` for contract guards.
