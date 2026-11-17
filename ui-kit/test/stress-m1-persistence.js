/**
 * Adversarial Stress Harness for Milestone 1: Layout State Persistence Engine
 * ---------------------------------------------------------------------------
 * Stress-tests:
 *   1. High-frequency resize events (50 updates in 100ms) -> Exactly 1 debounced write ~250ms later.
 *   2. Premature close/destroy -> Immediate flush, zero timer leaks, no trailing writes.
 *   3. Storage failures -> Throwing get/set/delete, QuotaExceededError, rejecting async storage.
 *   4. Corrupted JSON & Malformed Schemas -> Syntax errors, primitives, arrays, NaN, negative/infinite bounds.
 *   5. Initialization race condition probe (<50ms initial window).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

/* 依赖解析统一到 scripts/resolve-browser.js（Roadmap A2） */
const browserDeps = require('../scripts/resolve-browser');

function resolvePlaywright() {
    return browserDeps.requirePlaywright();
}

const { chromium } = resolvePlaywright();

const KIT_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = browserDeps.resolveChrome()
    || process.env.ST_CHROME
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PATHS = {
    tokensCss: path.join(KIT_ROOT, 'tokens.css'),
    componentsCss: path.join(KIT_ROOT, 'components.css'),
    nvuiApi: path.join(KIT_ROOT, 'nvui-api.js'),
};

function startEphemeralServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = req.url.split('?')[0];
            if (url === '/' || url === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NVUI Kit Adversarial Stress Harness</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body class="nvui-scope">
    <div id="sandbox-root">
        <h1>NVUI M1 Adversarial Stress Test</h1>
    </div>
    <script src="/nvui-api.js"></script>
</body>
</html>`);
                return;
            }

            let filePath = null;
            let mimeType = 'text/plain';

            if (url === '/tokens.css') {
                filePath = PATHS.tokensCss;
                mimeType = 'text/css';
            } else if (url === '/components.css') {
                filePath = PATHS.componentsCss;
                mimeType = 'text/css';
            } else if (url === '/nvui-api.js') {
                filePath = PATHS.nvuiApi;
                mimeType = 'application/javascript';
            }

            if (filePath && fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': `${mimeType}; charset=utf-8` });
                res.end(fs.readFileSync(filePath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({
                server,
                port,
                url: `http://127.0.0.1:${port}/`,
                close: () => new Promise(r => server.close(r)),
            });
        });
    });
}

const testResults = [];

function recordStressTest(id, name, pass, detail, durationMs) {
    const entry = { id, name, pass: !!pass, detail: detail || '', durationMs: durationMs || 0 };
    testResults.push(entry);
    const tag = entry.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    const durTag = durationMs !== undefined ? `\x1b[90m(${durationMs}ms)\x1b[0m` : '';
    console.log(`${tag} ${id}: ${name} ${durTag}`);
    if (!entry.pass && entry.detail) {
        console.log(`       \x1b[33m└─ Diagnostic: ${entry.detail}\x1b[0m`);
    } else if (entry.detail) {
        console.log(`       \x1b[90m└─ Info: ${entry.detail}\x1b[0m`);
    }
    return entry.pass;
}

(async () => {
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  NVUI Kit M1 · Adversarial Persistence Stress Harness      \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

    for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[k];
    }
    process.env.NO_PROXY = '*';

    const sandbox = await startEphemeralServer();
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(sandbox.url, { waitUntil: 'domcontentloaded' });

    async function runTest(id, name, fn, ...args) {
        const t0 = Date.now();
        try {
            const res = await page.evaluate(fn, ...args);
            const dt = Date.now() - t0;
            recordStressTest(id, name, res.pass, res.detail, dt);
        } catch (err) {
            const dt = Date.now() - t0;
            recordStressTest(id, name, false, 'Thrown error: ' + err.message, dt);
        }
    }

    // =========================================================================
    // SECTION 1: High-Frequency Resize Events (50 updates in 100ms)
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 1: High-Frequency Debounce (50 updates / 100ms) ---\x1b[0m');

    await runTest('STR-1.1', '50 resize events over 100ms result in exactly 1 debounced write', async () => {
        window.localStorage.clear();
        const writeLog = [];
        const spyStorage = {
            get: () => null,
            set: (key, val) => {
                writeLog.push({ time: performance.now(), val: JSON.parse(JSON.stringify(val)) });
            },
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'str_hf_01',
            title: 'HF Resize Panel',
            persist: { storage: spyStorage },
        });
        p.open();

        const tStart = performance.now();
        // Fire 50 updates over 100ms (every 2ms)
        for (let i = 1; i <= 50; i++) {
            await new Promise(r => setTimeout(r, 2));
            p.setSize(600 + i * 2, 400 + i); // ends at 700 x 450
        }
        const tEndUpdates = performance.now();

        // Immediately after 50 updates, write count MUST still be 0
        const countAtEndUpdates = writeLog.length;

        // Debounce is 250ms. Let's wait 100ms: must still be 0
        await new Promise(r => setTimeout(r, 100));
        const countAt100After = writeLog.length;

        /* 最多等 1s 等那一次写入落地。写入时间戳记的是 adapter 完成时刻，
           不是防抖定时器触发时刻：机器负载高时 250ms 的定时器可能晚到 400ms+
           （2026-11-16 实测 431ms 假红一次，串行复跑 260ms）。因此用轮询代替
           固定 sleep，只锁「恰好一次」，不锁精确毫秒。 */
        const deadline = performance.now() + 1000;
        while (writeLog.length === 0 && performance.now() < deadline) {
            await new Promise(r => setTimeout(r, 20));
        }
        const countAtSettled = writeLog.length;

        // Wait another 200ms to verify no trailing duplicate writes
        await new Promise(r => setTimeout(r, 200));
        const countFinal = writeLog.length;

        p.destroy();

        const lastWrite = writeLog[0];
        const writeDelay = lastWrite ? Math.round(lastWrite.time - tEndUpdates) : -1;
        const correctFinalState = lastWrite && lastWrite.val && lastWrite.val.size &&
            lastWrite.val.size.w === 700 && lastWrite.val.size.h === 450;
        const exactOneWrite = countFinal === 1 && countAtSettled === 1;
        const timingValid = countAtEndUpdates === 0 && countAt100After === 0 && writeDelay >= 240 && writeDelay <= 1000;

        return {
            pass: exactOneWrite && timingValid && correctFinalState,
            detail: `writeCount=${countFinal}, writeDelay=${writeDelay}ms (expected ~250ms), finalW=${lastWrite?.val?.size?.w}`,
        };
    });

    // =========================================================================
    // SECTION 2: Premature Close & Destroy Lifecycle
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 2: Premature Close & Destroy Flush ---\x1b[0m');

    await runTest('STR-2.1', 'Premature close immediately flushes pending state and cancels timer', async () => {
        const writeLog = [];
        const spyStorage = {
            get: () => null,
            set: (key, val) => {
                writeLog.push({ time: performance.now(), val: JSON.parse(JSON.stringify(val)) });
            },
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'str_close_01',
            title: 'Premature Close Panel',
            persist: { storage: spyStorage },
        });
        p.open();

        // Trigger resize
        p.setSize(777, 555);

        // Immediately close within 1ms
        p.close();

        // At this instant, flush MUST have occurred synchronously in closePanel
        const countImmediatelyAfterClose = writeLog.length;
        const savedVal = writeLog[0]?.val;

        // Wait 350ms (well past the 250ms debounce) to ensure NO second write fires
        await new Promise(r => setTimeout(r, 350));
        const countAfterDebounceWindow = writeLog.length;

        p.destroy();

        const flushedImmediately = countImmediatelyAfterClose === 1;
        const noDuplicateTimer = countAfterDebounceWindow === 1;
        const correctSize = savedVal?.size?.w === 777 && savedVal?.size?.h === 555;

        return {
            pass: flushedImmediately && noDuplicateTimer && correctSize,
            detail: `flushedImmediate=${flushedImmediately}, countAfter350ms=${countAfterDebounceWindow}, width=${savedVal?.size?.w}`,
        };
    });

    await runTest('STR-2.2', 'Premature destroy flushes pending state and cleans up observers without leak', async () => {
        const writeLog = [];
        const spyStorage = {
            get: () => null,
            set: (key, val) => {
                writeLog.push({ time: performance.now(), val: JSON.parse(JSON.stringify(val)) });
            },
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'str_destroy_01',
            title: 'Premature Destroy Panel',
            persist: { storage: spyStorage },
        });
        p.open();
        p.setSize(820, 610);

        // Immediately destroy without closing first
        p.destroy();

        const countAfterDestroy = writeLog.length;
        // Wait 350ms to verify no post-destroy ghost write
        await new Promise(r => setTimeout(r, 350));
        const countAfterWait = writeLog.length;

        return {
            pass: countAfterDestroy === 1 && countAfterWait === 1 && writeLog[0]?.val?.size?.w === 820,
            detail: `countAfterDestroy=${countAfterDestroy}, countAfterWait=${countAfterWait}, width=${writeLog[0]?.val?.size?.w}`,
        };
    });

    await runTest('STR-2.3', 'Rapid flapping: 10 rapid open/close/resize cycles without state loss or timer leaks', async () => {
        const writeLog = [];
        const spyStorage = {
            get: () => null,
            set: (key, val) => {
                writeLog.push({ time: performance.now(), val: JSON.parse(JSON.stringify(val)) });
            },
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'str_flap_01',
            title: 'Flapping Panel',
            persist: { storage: spyStorage },
        });

        for (let i = 1; i <= 10; i++) {
            p.open();
            p.setSize(600 + i * 10, 400 + i * 10);
            p.close();
            await new Promise(r => setTimeout(r, 10));
        }

        const countAtEndCycles = writeLog.length;
        await new Promise(r => setTimeout(r, 350));
        const countAfterQuiet = writeLog.length;

        const lastState = writeLog[writeLog.length - 1]?.val;
        p.destroy();

        // 10 cycles of immediate close flush 10 times, settled cleanly with 700x500
        const correctEndWidth = lastState?.size?.w === 700;
        const noRunawayTimers = countAfterQuiet === countAtEndCycles;

        return {
            pass: correctEndWidth && noRunawayTimers,
            detail: `countAtEnd=${countAtEndCycles}, countAfterQuiet=${countAfterQuiet}, finalWidth=${lastState?.size?.w}`,
        };
    });

    // =========================================================================
    // SECTION 3: Storage Failures (Throwing and Rejecting Adapters)
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 3: Storage Failures & Exception Absorption ---\x1b[0m');

    await runTest('STR-3.1', 'Storage get throws synchronous SecurityError -> Panel opens safely with defaults', async () => {
        let getThrown = false;
        const faultyStorage = {
            get: () => {
                getThrown = true;
                throw new Error('SecurityError: The operation is insecure (storage disabled)');
            },
            set: () => {},
            delete: () => {},
        };

        let panelCreated = false;
        let opened = false;
        let p = null;
        try {
            p = NVUI.createPanel({
                id: 'str_throw_get',
                title: 'Throwing Get Panel',
                persist: { storage: faultyStorage },
            });
            panelCreated = !!p;
            p.open();
            opened = !p.dialog.querySelector('.nvui-overlay').hidden;
            p.close();
            p.destroy();
        } catch (e) {
            return { pass: false, detail: 'Crashed on throwing get: ' + e.message };
        }

        return {
            pass: getThrown && panelCreated && opened,
            detail: `getThrown=${getThrown}, panelCreated=${panelCreated}, opened=${opened}`,
        };
    });

    await runTest('STR-3.2', 'Storage set throws synchronous QuotaExceededError -> Panel functions without crash', async () => {
        let setThrown = false;
        const faultyStorage = {
            get: () => null,
            set: () => {
                setThrown = true;
                throw new Error('QuotaExceededError: DOMException quota exceeded');
            },
            delete: () => {},
        };

        let survived = false;
        try {
            const p = NVUI.createPanel({
                id: 'str_throw_set',
                title: 'Throwing Set Panel',
                persist: { storage: faultyStorage },
            });
            p.open();
            p.setSize(750, 520);
            p.close(); // Triggers immediate flush which calls faultyStorage.set()
            p.destroy();
            survived = true;
        } catch (e) {
            return { pass: false, detail: 'Crashed on throwing set: ' + e.message };
        }

        return {
            pass: setThrown && survived,
            detail: `setThrown=${setThrown}, survived=${survived}`,
        };
    });

    await runTest('STR-3.3', 'Storage delete throws error -> clearLayoutState does not crash', async () => {
        let deleteThrown = false;
        const faultyStorage = {
            get: () => null,
            set: () => {},
            delete: () => {
                deleteThrown = true;
                throw new Error('DiskError: unable to delete key');
            },
        };

        let survivedGlobal = false;
        let survivedMethod = false;
        try {
            NVUI.clearLayoutState('str_throw_del', faultyStorage);
            survivedGlobal = true;

            const p = NVUI.createPanel({
                id: 'str_throw_del',
                title: 'Throwing Del Panel',
                persist: { storage: faultyStorage },
            });
            p.clearLayoutState();
            survivedMethod = true;
            p.destroy();
        } catch (e) {
            return { pass: false, detail: 'Crashed on throwing delete: ' + e.message };
        }

        return {
            pass: deleteThrown && survivedGlobal && survivedMethod,
            detail: `deleteThrown=${deleteThrown}, survivedGlobal=${survivedGlobal}, survivedMethod=${survivedMethod}`,
        };
    });

    await runTest('STR-3.4', 'Async storage get rejects -> Panel degrades cleanly to defaults', async () => {
        const asyncRejectStorage = {
            get: () => Promise.reject(new Error('Async fetch network failure')),
            set: () => {},
            delete: () => {},
        };

        let p = null;
        try {
            p = NVUI.createPanel({
                id: 'str_async_reject_get',
                title: 'Async Reject Get Panel',
                persist: { storage: asyncRejectStorage },
            });
            p.open();
            // Wait 100ms for promise rejection to settle
            await new Promise(r => setTimeout(r, 100));
            const overlayVisible = !p.dialog.querySelector('.nvui-overlay').hidden;
            p.close();
            p.destroy();
            return {
                pass: overlayVisible,
                detail: `Panel remained functional: overlayVisible=${overlayVisible}`,
            };
        } catch (e) {
            if (p) p.destroy();
            return { pass: false, detail: 'Crashed on async reject get: ' + e.message };
        }
    });

    await runTest('STR-3.5', 'Async storage set rejects -> Absorption and unhandledrejection probe', async () => {
        let unhandledPromiseCount = 0;
        const unhandledListener = (evt) => {
            unhandledPromiseCount++;
        };
        window.addEventListener('unhandledrejection', unhandledListener);

        const asyncRejectSetStorage = {
            get: () => null,
            set: () => Promise.reject(new Error('Async save quota exceeded')),
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'str_async_reject_set',
            title: 'Async Reject Set Panel',
            persist: { storage: asyncRejectSetStorage },
        });
        p.open();
        p.setSize(700, 500);
        p.close();

        await new Promise(r => setTimeout(r, 300));
        p.destroy();
        window.removeEventListener('unhandledrejection', unhandledListener);

        return {
            pass: unhandledPromiseCount === 0,
            detail: `unhandledPromiseCount=${unhandledPromiseCount} (if > 0, storage.set returned rejected Promise without .catch)`,
        };
    });

    // =========================================================================
    // SECTION 4: Corrupted JSON in localStorage
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 4: Corrupted JSON & Malformed Storage Schemas ---\x1b[0m');

    await runTest('STR-4.1', 'Syntax error JSON in localStorage -> Recover with defaults, zero crash', async () => {
        const id = 'str_corrupt_syntax';
        window.localStorage.setItem('nvui_state_' + id, '{ syntax error !!! [bad json}');

        let p = null;
        try {
            p = NVUI.createPanel({
                id: id,
                title: 'Corrupt Syntax Panel',
                persist: true,
            });
            p.open();
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width);
            p.close();
            p.destroy();
            return {
                pass: true,
                detail: `Clean recovery with defaults. styleW=${styleW || 'default'}`,
            };
        } catch (e) {
            if (p) p.destroy();
            return { pass: false, detail: 'Crashed on invalid JSON: ' + e.message };
        }
    });

    await runTest('STR-4.2', 'Primitive JSON values in localStorage ("12345", "true", "\\"str\\"") -> Safe fallback', async () => {
        const corruptedPrimitives = ['12345', 'true', '"some-string"', 'null'];
        const results = [];

        for (let i = 0; i < corruptedPrimitives.length; i++) {
            const id = 'str_corrupt_prim_' + i;
            window.localStorage.setItem('nvui_state_' + id, corruptedPrimitives[i]);
            try {
                const p = NVUI.createPanel({
                    id: id,
                    title: 'Prim Panel ' + i,
                    persist: true,
                });
                p.open();
                p.close();
                p.destroy();
                results.push(true);
            } catch (e) {
                results.push(false);
            }
        }

        const allSafe = results.every(Boolean);
        return {
            pass: allSafe,
            detail: `Tested ${corruptedPrimitives.length} primitives. Results: ${JSON.stringify(results)}`,
        };
    });

    await runTest('STR-4.3', 'JSON Array in localStorage ("[1, 2, 3]") -> Handled safely', async () => {
        const id = 'str_corrupt_array';
        window.localStorage.setItem('nvui_state_' + id, '[1, 2, 3]');

        try {
            const p = NVUI.createPanel({
                id: id,
                title: 'Array Panel',
                persist: true,
            });
            p.open();
            p.close();
            p.destroy();
            return { pass: true, detail: 'Handled array state gracefully' };
        } catch (e) {
            return { pass: false, detail: 'Crashed on array state: ' + e.message };
        }
    });

    await runTest('STR-4.4', 'Schema type mismatch: string width, negative height, boolean tab -> Clamped safely without NaN', async () => {
        const id = 'str_corrupt_types';
        window.localStorage.setItem('nvui_state_' + id, JSON.stringify({
            version: 'not-a-number',
            size: { width: 'super-wide', height: -999, isMaximized: 'yes-str' },
            tab: 99999,
            accordion: 'not-an-object',
        }));

        try {
            const p = NVUI.createPanel({
                id: id,
                title: 'Bad Schema Panel',
                tabs: [{ key: 'tab1', label: 'Tab 1' }, { key: 'tab2', label: 'Tab 2' }],
                persist: true,
            });
            p.open();
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width);
            const styleH = (panelEl.style.getPropertyValue('--nvui-panel-h') || panelEl.style.height);

            const hasNaN = styleW.includes('NaN') || styleH.includes('NaN');
            p.close();
            p.destroy();

            return {
                pass: !hasNaN,
                detail: `styleWidth="${styleW}", styleHeight="${styleH}", hasNaN=${hasNaN}`,
            };
        } catch (e) {
            return { pass: false, detail: 'Crashed on malformed schema types: ' + e.message };
        }
    });

    await runTest('STR-4.5', 'Extreme out-of-bounds dimensions (width: 999999, height: 999999) clamped to viewport', async () => {
        const id = 'str_extreme_bounds';
        window.localStorage.setItem('nvui_state_' + id, JSON.stringify({
            version: 1,
            size: { width: 999999, height: 999999 },
        }));

        const p = NVUI.createPanel({
            id: id,
            title: 'Extreme Panel',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = parseInt((panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width), 10);
        const styleH = parseInt((panelEl.style.getPropertyValue('--nvui-panel-h') || panelEl.style.height), 10);
        const maxAllowedW = window.innerWidth - 32;
        const maxAllowedH = window.innerHeight - 32;

        p.close();
        p.destroy();

        const clamped = styleW <= maxAllowedW && styleH <= maxAllowedH;
        return {
            pass: clamped,
            detail: `actualW=${styleW} (max=${maxAllowedW}), actualH=${styleH} (max=${maxAllowedH})`,
        };
    });

    await runTest('STR-4.6', 'Negative & NaN dimensions clamped safely to min bounds', async () => {
        const id = 'str_neg_nan';
        window.localStorage.setItem('nvui_state_' + id, JSON.stringify({
            version: 1,
            size: { width: -500, height: -500 },
        }));

        const p = NVUI.createPanel({
            id: id,
            title: 'Negative Panel',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = parseInt((panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width), 10);
        const styleH = parseInt((panelEl.style.getPropertyValue('--nvui-panel-h') || panelEl.style.height), 10);

        p.close();
        p.destroy();

        const validMinW = styleW >= 320;
        const validMinH = styleH >= 240;
        return {
            pass: validMinW && validMinH,
            detail: `clampedWidth=${styleW} (>=320), clampedHeight=${styleH} (>=240)`,
        };
    });

    await runTest('STR-4.7', 'Non-existent tab key in stored state falls back to first valid tab', async () => {
        const id = 'str_corrupt_tab';
        window.localStorage.setItem('nvui_state_' + id, JSON.stringify({
            version: 1,
            tab: 'phantom_tab_never_existed',
        }));

        const p = NVUI.createPanel({
            id: id,
            title: 'Phantom Tab Panel',
            tabs: [{ key: 'main', label: 'Main' }, { key: 'extra', label: 'Extra' }],
            persist: true,
        });
        p.open();
        const activeTabEl = p.dialog.querySelector('.nvui-tab.is-active');
        const activeTabId = activeTabEl ? activeTabEl.id : '';
        p.close();
        p.destroy();

        const isMainActive = activeTabId.includes('main');
        return {
            pass: isMainActive,
            detail: `activeTabId=${activeTabId}, expected main fallback: ${isMainActive}`,
        };
    });

    // =========================================================================
    // SECTION 5: Timing Race Condition Probe (<50ms Initialization Window)
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 5: Initialization Race Condition Probe (<50ms) ---\x1b[0m');

    await runTest('STR-5.1', 'Immediate tab switch right after createPanel (<50ms) must NOT be silently dropped', async () => {
        const id = 'str_init_race_tab';
        window.localStorage.clear();

        const p = NVUI.createPanel({
            id: id,
            title: 'Init Race Panel',
            tabs: [{ key: 'tab1', label: 'Tab 1' }, { key: 'tab2', label: 'Tab 2' }],
            persist: true,
        });
        p.open();
        // Immediately switch tab synchronously (within 1ms of creation)
        p.setTab('tab2');
        p.close();

        // Wait 350ms to allow persistence debounce
        await new Promise(r => setTimeout(r, 350));
        p.destroy();

        const raw = window.localStorage.getItem('nvui_state_' + id);
        let savedTab = null;
        if (raw) {
            try { savedTab = JSON.parse(raw).tab; } catch (e) {}
        }

        return {
            pass: savedTab === 'tab2',
            detail: `savedTab="${savedTab}" (expected "tab2"). rawStorage=${raw}`,
        };
    });

    await runTest('STR-5.2', 'Immediate accordion toggle right after createPanel (<50ms) must NOT be silently dropped', async () => {
        const id = 'str_init_race_acc';
        window.localStorage.clear();

        const p = NVUI.createPanel({
            id: id,
            title: 'Init Race Acc Panel',
            tabs: [{ key: 'tab1', label: 'Tab 1' }],
            persist: true,
        });
        const acc = p.addAccordion('tab1', { id: 'acc_race_1', title: 'Acc 1', content: [] });
        p.open();
        // Immediately open accordion synchronously (<10ms)
        acc.setOpen(true);
        p.close();

        await new Promise(r => setTimeout(r, 350));
        p.destroy();

        const raw = window.localStorage.getItem('nvui_state_' + id);
        let accSaved = null;
        if (raw) {
            try { accSaved = JSON.parse(raw).accordion; } catch (e) {}
        }

        const passed = accSaved && accSaved['acc_race_1'] === true;
        return {
            pass: !!passed,
            detail: `accSaved=${JSON.stringify(accSaved)}, rawStorage=${raw}`,
        };
    });

    // =========================================================================
    // SECTION 6: Viewport Clamping & Mobile Edge Cases
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 6: Mobile Viewport Clamping Fallback ---\x1b[0m');

    await page.setViewportSize({ width: 375, height: 667 });

    await runTest('STR-6.1', 'Mobile viewport (<=600px): inline fixed pixel width/height cleared for CSS drawer takeover', async () => {
        const id = 'str_mobile_clamp';
        window.localStorage.setItem('nvui_state_' + id, JSON.stringify({
            version: 1,
            size: { width: 900, height: 700 },
        }));

        const p = NVUI.createPanel({
            id: id,
            title: 'Mobile Clamp Panel',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width);
        const styleH = (panelEl.style.getPropertyValue('--nvui-panel-h') || panelEl.style.height);
        p.close();
        p.destroy();

        const clampedMobile = NVUI.clampPanelLayout({ width: 900, height: 700 });
        const isMobile = clampedMobile.isMobile;
        const widthEmpty = styleW === '' && clampedMobile.styleWidth === '';
        const heightEmpty = styleH === '' && clampedMobile.styleHeight === '';

        return {
            pass: isMobile && widthEmpty && heightEmpty,
            detail: `isMobile=${isMobile}, panelStyleW="${styleW}", panelStyleH="${styleH}"`,
        };
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    // =========================================================================
    // SUMMARY REPORT
    // =========================================================================
    console.log('\n\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m         Adversarial Stress Test Execution Summary          \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');

    const total = testResults.length;
    const passed = testResults.filter(t => t.pass).length;
    const failed = total - passed;

    console.log(`Total Stress Tests: ${total}`);
    console.log(`Passed            : \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed            : ${failed > 0 ? '\x1b[31m' + failed + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);
    console.log(`Browser Pageerrors: ${pageErrors.length > 0 ? '\x1b[31m' + pageErrors.length + '\x1b[0m' : '\x1b[32m0\x1b[0m'}`);

    if (failed > 0) {
        console.log('\n\x1b[31m--- Failed Adversarial Challenges ---\x1b[0m');
        for (const t of testResults.filter(t => !t.pass)) {
            console.log(`✖ ${t.id}: ${t.name}`);
            console.log(`  └─ ${t.detail}`);
        }
    }

    await browser.close();
    await sandbox.close();

    process.exit(failed > 0 ? 1 : 0);
})();
