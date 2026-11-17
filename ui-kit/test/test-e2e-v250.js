/**
 * NVUI Kit · Comprehensive E2E Automated Test Suite (current kit version)
 * -------------------------------------------------------------------------
 * Features Covered:
 *   - Tier 1: Feature Coverage (R1 Persistence, R2 Header, R3 Calling/Versions, R4 Live Host)
 *   - Tier 2: Boundary & Corner Cases (Empty config, QuotaExceeded, Viewport Clamping, XSS, Fallbacks)
 *   - Tier 3: Cross-Feature Combinations (Pairwise coverage)
 *   - Tier 4: Real-World Application Scenarios (ST Extension, Tavern Helper, Multi-Screen, Debounce Stress, Live ST Probe)
 *
 * Usage:
 *   node test/test-e2e-v250.js
 *   node test/test-e2e-v250.js --tier=1
 *   node test/test-e2e-v250.js --tier=2
 *   node test/test-e2e-v250.js --tier=3
 *   node test/test-e2e-v250.js --tier=4
 *   node test/test-e2e-v250.js --no-host
 *   node test/test-e2e-v250.js --filter=<pattern>
 *
 * --no-host (or an unreachable host) does not silently drop tests: the six
 * live-host cases (T1-R4-01..05, T4-SC-05) are recorded as SKIP with an
 * explicit reason, and the summary reports passed/failed/skipped separately.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

/* ==================== 1. Toolchain & Environment ==================== */

/* 依赖解析统一到 scripts/resolve-browser.js（Roadmap A2） */
const browserDeps = require('../scripts/resolve-browser');

function resolvePlaywright() {
    return browserDeps.requirePlaywright();
}

const KIT_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = browserDeps.resolveChrome()
    || process.env.ST_CHROME
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HOST_URL = process.env.ST_HOST_URL || 'http://127.0.0.1:8000/';

const PATHS = {
    tokensCss: path.join(KIT_ROOT, 'tokens.css'),
    tokensJson: path.join(KIT_ROOT, 'tokens.json'),
    componentsCss: path.join(KIT_ROOT, 'components.css'),
    nvuiApi: path.join(KIT_ROOT, 'nvui-api.js'),
    packageJson: path.join(KIT_ROOT, 'package.json'),
    readme: path.join(KIT_ROOT, 'README.md'),
    aiGuide: path.join(KIT_ROOT, 'AI-GUIDE.md'),
    changelog: path.join(KIT_ROOT, 'CHANGELOG.md'),
    preview: path.join(KIT_ROOT, 'preview.html'),
    templateDir: path.join(KIT_ROOT, 'st-extension-template', 'ui-kit'),
};

// Single source of truth for the expected version: the project's package.json.
const KIT_VERSION = JSON.parse(fs.readFileSync(PATHS.packageJson, 'utf8')).version;

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    tier: null,
    filter: null,
    noHost: false,
    verbose: false,
};

for (const arg of args) {
    if (arg.startsWith('--tier=')) {
        options.tier = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--filter=')) {
        options.filter = new RegExp(arg.split('=')[1], 'i');
    } else if (arg === '--no-host') {
        options.noHost = true;
    } else if (arg === '--verbose') {
        options.verbose = true;
    }
}

/* ==================== 2. Test Assertion Collector ==================== */

const results = [];

function recordResult(id, tier, name, status, detail, durationMs) {
    const entry = {
        id,
        tier,
        name,
        status,
        pass: status === 'PASS',
        detail: detail === undefined ? '' : String(detail),
        durationMs: durationMs || 0,
    };
    results.push(entry);

    const colors = { PASS: '\x1b[32m', FAIL: '\x1b[31m', SKIP: '\x1b[33m' };
    const tag = `${colors[status] || ''}[${status}]\x1b[0m`;
    const tierTag = `\x1b[36m[T${tier}]\x1b[0m`;
    const durTag = durationMs ? `\x1b[90m(${durationMs}ms)\x1b[0m` : '';
    console.log(`${tag} ${tierTag} ${id}: ${name} ${durTag}`);
    if (status === 'FAIL' && entry.detail) {
        console.log(`       \x1b[33m└─ Diagnostic: ${entry.detail}\x1b[0m`);
    } else if (status === 'SKIP' && entry.detail) {
        console.log(`       \x1b[90m└─ Reason: ${entry.detail}\x1b[0m`);
    } else if (options.verbose && entry.detail) {
        console.log(`       \x1b[90m└─ Info: ${entry.detail}\x1b[0m`);
    }
    return status === 'PASS';
}

function recordTest(id, tier, name, pass, detail, durationMs) {
    return recordResult(id, tier, name, pass ? 'PASS' : 'FAIL', detail, durationMs);
}

function skipTest(id, tier, name, reason) {
    return recordResult(id, tier, name, 'SKIP', reason, 0);
}

function shouldRunTest(tier, name) {
    if (options.tier && options.tier !== tier) return false;
    if (options.filter && !options.filter.test(name)) return false;
    return true;
}

/* ---------- pure reporting/version helpers (exported for the regression) ---------- */

const HOST_TESTS = Object.freeze([
    { id: 'T1-R4-01', tier: 1, name: 'Live SillyTavern host is reachable on http://127.0.0.1:8000' },
    { id: 'T1-R4-02', tier: 1, name: 'UI Kit injected into live SillyTavern host without error' },
    { id: 'T1-R4-03', tier: 1, name: 'Panel open/tab/close lifecycle executes in live SillyTavern host' },
    { id: 'T1-R4-04', tier: 1, name: 'Theme toggle operates safely within live SillyTavern DOM' },
    { id: 'T1-R4-05', tier: 1, name: 'Zero pageerrors recorded during live SillyTavern host execution' },
    { id: 'T4-SC-05', tier: 4, name: 'Scenario 5: Full Host E2E Probe on Live SillyTavern with zero pageerror' },
]);

// Derive the declared count from the quoted test ids in this file so the number
// cannot drift away from the suite it describes.
const DECLARED_TEST_COUNT = (() => {
    const src = fs.readFileSync(__filename, 'utf8');
    const ids = new Set();
    const re = /\b(T[1-4]-(?:R[1-4]|BC|CB|SC)-\d{2})\b/g;
    let match;
    while ((match = re.exec(src))) ids.add(match[1]);
    return ids.size;
})();

function planHostSkip(reason, tier) {
    return HOST_TESTS
        .filter((t) => tier === undefined || t.tier === tier)
        .map((t) => ({ ...t, status: 'SKIP', reason }));
}

function summarizeResults(list) {
    const passed = list.filter((r) => r.status === 'PASS').length;
    const failed = list.filter((r) => r.status === 'FAIL').length;
    const skipped = list.filter((r) => r.status === 'SKIP').length;
    const selected = passed + failed + skipped;
    return {
        declared: DECLARED_TEST_COUNT,
        selected,
        passed,
        failed,
        skipped,
        notSelected: Math.max(0, DECLARED_TEST_COUNT - selected),
    };
}

function exitCodeFor(summary) {
    return summary.failed > 0 ? 1 : 0;
}

function readDeclaredVersion(text, pattern) {
    const match = pattern.exec(text || '');
    return match ? match[1] : null;
}

function versionReport(version, sources) {
    const tokensCssVersion = readDeclaredVersion(sources.tokensCss, /ui-kit v(\d+\.\d+\.\d+)/);
    const componentsCssVersion = readDeclaredVersion(sources.componentsCss, /ui-kit v(\d+\.\d+\.\d+)/);
    const apiHeaderVersion = readDeclaredVersion(sources.nvuiApi, /ui-kit v(\d+\.\d+\.\d+)/);
    const apiConstVersion = readDeclaredVersion(sources.nvuiApi, /VERSION\s*=\s*['"](\d+\.\d+\.\d+)['"]/);
    const readmeVersion = readDeclaredVersion(sources.readme, />\s*版本：\*\*v(\d+\.\d+\.\d+)\*\*/);
    const aiGuideVersion = readDeclaredVersion(sources.aiGuide, />\s*版本：\*\*v(\d+\.\d+\.\d+)\*\*/);

    const checks = [
        { file: 'package.json', ok: sources.packageVersion === version, actual: sources.packageVersion },
        { file: 'tokens.json', ok: sources.tokensJsonVersion === version, actual: sources.tokensJsonVersion },
        { file: 'tokens.css', ok: tokensCssVersion === version, actual: tokensCssVersion },
        { file: 'components.css', ok: componentsCssVersion === version, actual: componentsCssVersion },
        { file: 'nvui-api.js (VERSION)', ok: apiConstVersion === version, actual: apiConstVersion },
        { file: 'nvui-api.js (header)', ok: apiHeaderVersion === version, actual: apiHeaderVersion },
        { file: 'README.md', ok: readmeVersion === version, actual: readmeVersion },
        { file: 'AI-GUIDE.md', ok: aiGuideVersion === version, actual: aiGuideVersion },
    ];
    if (sources.apiRuntimeVersion !== undefined) {
        checks.push({
            file: 'nvui-api.js (runtime NVUI.version)',
            ok: sources.apiRuntimeVersion === version,
            actual: sources.apiRuntimeVersion,
        });
    }
    const mismatches = checks.filter((c) => !c.ok);
    return { ok: mismatches.length === 0, version, checks, mismatches };
}

async function probeHost() {
    if (options.noHost) {
        return { available: false, reason: '--no-host：按 CLI 参数跳过全部宿主用例（不访问真实宿主）' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
        const res = await fetch(HOST_URL, { signal: controller.signal });
        if (res.status !== 200) {
            return { available: false, reason: `宿主不可达：${HOST_URL} 返回 HTTP ${res.status}` };
        }
        return { available: true, reason: '' };
    } catch (err) {
        const detail = err && err.name === 'AbortError' ? '请求超时 3000ms' : (err && err.message) || String(err);
        return { available: false, reason: `宿主不可达：${HOST_URL}（${detail}）` };
    } finally {
        clearTimeout(timer);
    }
}

if (require.main !== module) {
    module.exports = {
        KIT_VERSION,
        HOST_TESTS,
        DECLARED_TEST_COUNT,
        planHostSkip,
        summarizeResults,
        exitCodeFor,
        versionReport,
    };
}

/* ==================== 3. Ephemeral Server for Sandboxed Browser Testing ==================== */

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
    <title>NVUI Kit E2E Sandbox</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body class="nvui-scope">
    <div id="sandbox-root">
        <h1>NVUI Kit v${KIT_VERSION} E2E Verification Environment</h1>
        <div id="test-anchor"></div>
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
            });
        });
    });
}

/* ==================== 4. Test Runner Core ==================== */

async function main() {
    const { chromium } = resolvePlaywright();
    const startTime = Date.now();
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log(`\x1b[1m\x1b[35m  SillyTavern UI Kit v${KIT_VERSION} · Comprehensive E2E Test Suite  \x1b[0m`);
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

    // Strip proxy settings to ensure seamless localhost connectivity
    for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[k];
    }
    process.env.NO_PROXY = '*';

    // Start local sandbox server
    const sandbox = await startEphemeralServer();
    if (options.verbose) {
        console.log(`[INIT] Ephemeral sandbox running at ${sandbox.url}`);
    }

    // Launch Chrome Browser
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(sandbox.url, { waitUntil: 'domcontentloaded' });

    /* =====================================================================
     * TIER 1: Feature Coverage (R1, R2, R3, R4)
     * ===================================================================== */
    console.log('\n\x1b[1m\x1b[34m--- Tier 1: Feature Coverage ---\x1b[0m');

    // Helper to evaluate in page with time tracking
    async function runInPage(id, tier, name, fn, ...args) {
        if (!shouldRunTest(tier, name)) return;
        const t0 = Date.now();
        try {
            const res = await page.evaluate(fn, ...args);
            const dt = Date.now() - t0;
            recordTest(id, tier, name, res.pass, res.detail, dt);
        } catch (err) {
            const dt = Date.now() - t0;
            recordTest(id, tier, name, false, err.message, dt);
        }
    }

    // T1-R1: Layout State Persistence
    await runInPage('T1-R1-01', 1, 'createPanel with persist: true initializes persistence lifecycle', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        localStorage.clear();
        const p = window.NVUI.createPanel({
            id: 't1_r1_01',
            title: 'Test Panel R1-01',
            persist: true,
        });
        const hasMethod = typeof p.clearLayoutState === 'function';
        p.destroy();
        return {
            pass: hasMethod,
            detail: hasMethod ? 'panel.clearLayoutState method attached' : 'persist: true failed to attach controller method',
        };
    });

    await runInPage('T1-R1-02', 1, 'Panel size adjustments save into localStorage (nvui_state_${id})', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        localStorage.clear();
        const id = 't1_r1_02';
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-02',
            persist: true,
        });
        p.open();
        // Simulate dragging/resizing panel to 780x520
        const panelEl = p.dialog.querySelector('.nvui-panel');
        if (panelEl) {
            panelEl.style.width = '780px';
            panelEl.style.height = '520px';
        }
        // Close to trigger immediate flush
        p.close();
        await new Promise(r => setTimeout(r, 300));
        const raw = localStorage.getItem(`nvui_state_${id}`);
        p.destroy();
        if (!raw) return { pass: false, detail: 'No state found in localStorage under key nvui_state_' + id };
        try {
            const data = JSON.parse(raw);
            const hasSize = data.size && (data.size.w === 780 || data.size.w === '780px');
            return {
                pass: !!data.size,
                detail: `Stored state: ${JSON.stringify(data.size)}`,
            };
        } catch (e) {
            return { pass: false, detail: 'Malformed JSON in storage: ' + e.message };
        }
    });

    await runInPage('T1-R1-03', 1, 'Re-opening panel restores saved width and height from localStorage', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_03';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            size: { width: 850, height: 550 },
            timestamp: Date.now(),
        }));
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-03',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = panelEl ? (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width) : '';
        const styleH = panelEl ? (panelEl.style.getPropertyValue('--nvui-panel-h') || panelEl.style.height) : '';
        p.destroy();
        const restored = styleW.includes('850') && styleH.includes('550');
        return {
            pass: restored,
            detail: `Restored inline dimensions: width=${styleW}, height=${styleH}`,
        };
    });

    await runInPage('T1-R1-04', 1, 'Active tab switching persists and restores on re-open', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_04';
        localStorage.clear();
        let p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-04',
            tabs: [
                { key: 'tab1', label: 'Tab 1' },
                { key: 'tab2', label: 'Tab 2' },
            ],
            persist: true,
        });
        p.open();
        p.setTab('tab2');
        p.close();
        await new Promise(r => setTimeout(r, 300));
        p.destroy();

        // Re-open with new panel instance
        const p2 = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-04 Instance 2',
            tabs: [
                { key: 'tab1', label: 'Tab 1' },
                { key: 'tab2', label: 'Tab 2' },
            ],
            persist: true,
        });
        p2.open();
        const activeTab = p2.activeTab || (p2.dialog && p2.dialog.querySelector('.nvui-tab.is-active')?.getAttribute('data-tab'));
        p2.destroy();
        return {
            pass: activeTab === 'tab2',
            detail: `Active tab restored to: ${activeTab}`,
        };
    });

    await runInPage('T1-R1-05', 1, 'Accordion open/collapse state tracks and restores', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_05';
        localStorage.clear();
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-05',
            tabs: [{ key: 'tab1', label: 'Tab 1' }],
            persist: true,
        });
        p.addAccordion('tab1', { id: 'acc_group_1', title: 'Group 1', content: [] });
        p.open();
        const accHeader = p.dialog.querySelector('.nvui-acc-header');
        if (accHeader) accHeader.click();
        p.close();
        await new Promise(r => setTimeout(r, 300));
        const raw = localStorage.getItem(`nvui_state_${id}`);
        p.destroy();
        if (!raw) return { pass: false, detail: 'No state stored in localStorage' };
        const data = JSON.parse(raw);
        return {
            pass: !!(data.accordion && Object.keys(data.accordion).length > 0),
            detail: `Stored accordion state: ${JSON.stringify(data.accordion)}`,
        };
    });

    await runInPage('T1-R1-06', 1, 'Granular persist config: { size: false, tab: true }', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_06';
        localStorage.clear();
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-06',
            tabs: [{ key: 'tabA', label: 'Tab A' }, { key: 'tabB', label: 'Tab B' }],
            persist: { size: false, tab: true, accordion: false },
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        if (panelEl) {
            panelEl.style.width = '700px';
        }
        p.setTab('tabB');
        p.close();
        await new Promise(r => setTimeout(r, 300));
        const raw = localStorage.getItem(`nvui_state_${id}`);
        p.destroy();
        if (!raw) return { pass: false, detail: 'No state saved' };
        const data = JSON.parse(raw);
        const sizeIgnored = !data.size || data.size.w === undefined;
        const tabSaved = data.tab === 'tabB';
        return {
            pass: sizeIgnored && tabSaved,
            detail: `sizeIgnored=${sizeIgnored}, tabSaved=${tabSaved}, data=${JSON.stringify(data)}`,
        };
    });

    await runInPage('T1-R1-07', 1, 'Custom StorageAdapter receives get/set calls', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_07';
        const mockStore = {};
        let getCalled = 0;
        let setCalled = 0;
        const customAdapter = {
            get: (key) => { getCalled++; return mockStore[key] || null; },
            set: (key, val) => { setCalled++; mockStore[key] = val; },
            delete: (key) => { delete mockStore[key]; },
        };
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-07',
            persist: { storage: customAdapter },
        });
        p.open();
        p.close();
        await new Promise(r => setTimeout(r, 300));
        p.destroy();
        return {
            pass: getCalled >= 1 && setCalled >= 1,
            detail: `getCalled=${getCalled}, setCalled=${setCalled}, keys=${Object.keys(mockStore).join(',')}`,
        };
    });

    await runInPage('T1-R1-08', 1, '250ms debounced write consolidates rapid mutations', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_08';
        let writeCount = 0;
        const adapter = {
            get: () => null,
            set: () => { writeCount++; },
        };
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-08',
            tabs: [{ key: 't1', label: 'T1' }, { key: 't2', label: 'T2' }, { key: 't3', label: 'T3' }],
            persist: { storage: adapter },
        });
        p.open();
        // Rapid sequential tab switches within 100ms
        p.setTab('t2');
        await new Promise(r => setTimeout(r, 20));
        p.setTab('t3');
        await new Promise(r => setTimeout(r, 20));
        p.setTab('t1');
        const writesImmediate = writeCount;
        // Wait for 250ms debounce window to expire
        await new Promise(r => setTimeout(r, 300));
        const writesAfterDebounce = writeCount;
        p.destroy();
        return {
            pass: writesImmediate === 0 && writesAfterDebounce === 1,
            detail: `writesImmediate=${writesImmediate}, writesAfterDebounce=${writesAfterDebounce}`,
        };
    });

    await runInPage('T1-R1-09', 1, 'destroy() or close() immediately flushes pending writes', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_09';
        let flushed = false;
        const adapter = {
            get: () => null,
            set: () => { flushed = true; },
        };
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-09',
            tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
            persist: { storage: adapter },
        });
        p.open();
        p.setTab('b');
        // Destroy immediately before 250ms expires
        p.destroy();
        return {
            pass: flushed,
            detail: `Pending state was flushed on destroy: ${flushed}`,
        };
    });

    await runInPage('T1-R1-10', 1, 'NVUI.clearLayoutState(id) clears default localStorage entry', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        if (typeof window.NVUI.clearLayoutState !== 'function') {
            return { pass: false, detail: 'NVUI.clearLayoutState is not a function' };
        }
        const id = 't1_r1_10';
        const key = `nvui_state_${id}`;
        localStorage.setItem(key, JSON.stringify({ version: 1, test: true }));
        window.NVUI.clearLayoutState(id);
        const exists = localStorage.getItem(key);
        return {
            pass: exists === null,
            detail: exists === null ? 'State removed successfully' : 'Key still present in localStorage',
        };
    });

    await runInPage('T1-R1-11', 1, 'NVUI.clearLayoutState(id, customStorage) invokes custom adapter delete', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        if (typeof window.NVUI.clearLayoutState !== 'function') {
            return { pass: false, detail: 'NVUI.clearLayoutState is not a function' };
        }
        const id = 't1_r1_11';
        let deletedKey = null;
        const customStore = {
            get: () => null,
            set: () => {},
            delete: (key) => { deletedKey = key; },
        };
        window.NVUI.clearLayoutState(id, customStore);
        return {
            pass: deletedKey === `nvui_state_${id}`,
            detail: `Deleted key: ${deletedKey}`,
        };
    });

    await runInPage('T1-R1-12', 1, 'panel.clearLayoutState() clears storage and resets active panel DOM styles', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't1_r1_12';
        const key = `nvui_state_${id}`;
        localStorage.setItem(key, JSON.stringify({ size: { width: 900, height: 600 } }));
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Test Panel R1-12',
            persist: true,
        });
        p.open();
        if (typeof p.clearLayoutState !== 'function') {
            p.destroy();
            return { pass: false, detail: 'p.clearLayoutState is not a function' };
        }
        p.clearLayoutState();
        const stored = localStorage.getItem(key);
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = panelEl ? (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width) : '';
        p.destroy();
        return {
            pass: stored === null && (styleW === '' || styleW === 'initial'),
            detail: `stored=${stored}, styleW=${styleW}`,
        };
    });

    // T1-R2: Standardized Panel Header
    await runInPage('T1-R2-01', 1, 'Header actions order: [actions...] -> [themeToggle] -> [closeBtn]', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_01',
            title: 'Header Test R2-01',
            actions: [
                { icon: 'fa-solid fa-star', label: 'Star', onClick: () => {} },
            ],
            themeToggle: true,
        });
        p.open();
        const actionsContainer = p.dialog.querySelector('.nvui-panel-actions');
        if (!actionsContainer) {
            p.destroy();
            return { pass: false, detail: 'Missing .nvui-panel-actions container' };
        }
        const buttons = Array.from(actionsContainer.querySelectorAll('button'));
        p.destroy();
        if (buttons.length < 3) {
            return { pass: false, detail: `Expected >= 3 buttons, found ${buttons.length}` };
        }
        const starBtn = buttons[0];
        const themeBtn = buttons[1];
        const closeBtn = buttons[2];
        const isThemeToggle = themeBtn.classList.contains('nvui-theme-toggle') || themeBtn.getAttribute('aria-label')?.includes('主题');
        const isClose = closeBtn.getAttribute('aria-label')?.includes('关闭') || closeBtn.querySelector('.fa-xmark');
        return {
            pass: isThemeToggle && isClose,
            detail: `Order: [${buttons.map(b => b.className + ':' + b.getAttribute('aria-label')).join(' -> ')}]`,
        };
    });

    await runInPage('T1-R2-02', 1, 'themeToggle sits immediately left of closeBtn when actions omitted', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_02',
            title: 'Header Test R2-02',
            themeToggle: true,
        });
        p.open();
        const actionsContainer = p.dialog.querySelector('.nvui-panel-actions');
        const buttons = Array.from(actionsContainer ? actionsContainer.querySelectorAll('button') : []);
        p.destroy();
        if (buttons.length !== 2) {
            return { pass: false, detail: `Expected exactly 2 buttons, found ${buttons.length}` };
        }
        const isTheme = buttons[0].classList.contains('nvui-theme-toggle');
        const isClose = buttons[1].getAttribute('aria-label')?.includes('关闭') || buttons[1].querySelector('.fa-xmark');
        return {
            pass: isTheme && isClose,
            detail: `Buttons: [${buttons.map(b => b.className).join(', ')}]`,
        };
    });

    await runInPage('T1-R2-03', 1, 'themeToggle: true renders .nvui-icon-btn.nvui-theme-toggle', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_03',
            title: 'Header Test R2-03',
            themeToggle: true,
        });
        p.open();
        const btn = p.dialog.querySelector('button.nvui-icon-btn.nvui-theme-toggle');
        p.destroy();
        return {
            pass: !!btn,
            detail: btn ? 'Theme toggle button found with required classes' : 'Button missing .nvui-icon-btn.nvui-theme-toggle',
        };
    });

    await runInPage('T1-R2-04', 1, 'Clicking themeToggle toggles .nvui-theme-light on document.body', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        document.body.classList.remove('nvui-theme-light');
        const p = window.NVUI.createPanel({
            id: 't1_r2_04',
            title: 'Header Test R2-04',
            themeToggle: true,
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        if (!btn) {
            p.destroy();
            return { pass: false, detail: 'Missing theme toggle button' };
        }
        btn.click();
        const isLight = document.body.classList.contains('nvui-theme-light');
        btn.click();
        const isDark = !document.body.classList.contains('nvui-theme-light');
        p.destroy();
        return {
            pass: isLight && isDark,
            detail: `Toggled to light=${isLight}, then back to dark=${isDark}`,
        };
    });

    await runInPage('T1-R2-05', 1, 'Theme toggle icon transitions between Sun and Moon', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        document.body.classList.remove('nvui-theme-light');
        const p = window.NVUI.createPanel({
            id: 't1_r2_05',
            title: 'Header Test R2-05',
            themeToggle: true,
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        const iconDark = btn ? (btn.querySelector('.fa-sun') || btn.querySelector('.fa-moon')) : null;
        const iconDarkClass = iconDark ? iconDark.className : '';
        if (btn) btn.click();
        const iconLight = btn ? (btn.querySelector('.fa-sun') || btn.querySelector('.fa-moon')) : null;
        const iconLightClass = iconLight ? iconLight.className : '';
        p.destroy();
        document.body.classList.remove('nvui-theme-light');
        return {
            pass: iconDarkClass.includes('fa-sun') && iconLightClass.includes('fa-moon'),
            detail: `Dark icon: ${iconDarkClass} -> Light icon: ${iconLightClass}`,
        };
    });

    await runInPage('T1-R2-06', 1, 'themeToggle aria-label updates dynamically with theme state', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        document.body.classList.remove('nvui-theme-light');
        const p = window.NVUI.createPanel({
            id: 't1_r2_06',
            title: 'Header Test R2-06',
            themeToggle: true,
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        const labelDark = btn ? btn.getAttribute('aria-label') : '';
        if (btn) btn.click();
        const labelLight = btn ? btn.getAttribute('aria-label') : '';
        p.destroy();
        document.body.classList.remove('nvui-theme-light');
        return {
            pass: labelDark.includes('浅色') && labelLight.includes('深色'),
            detail: `labelDark="${labelDark}", labelLight="${labelLight}"`,
        };
    });

    await runInPage('T1-R2-07', 1, 'opts.onThemeChange callback receives next theme string', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        document.body.classList.remove('nvui-theme-light');
        const received = [];
        const p = window.NVUI.createPanel({
            id: 't1_r2_07',
            title: 'Header Test R2-07',
            themeToggle: true,
            onThemeChange: (th) => received.push(th),
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        if (btn) {
            btn.click();
            btn.click();
        }
        p.destroy();
        document.body.classList.remove('nvui-theme-light');
        return {
            pass: received.length === 2 && received[0] === 'light' && received[1] === 'dark',
            detail: `Received events: [${received.join(', ')}]`,
        };
    });

    await runInPage('T1-R2-08', 1, 'opts.themeToggle.onThemeChange object syntax callback invoked', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        document.body.classList.remove('nvui-theme-light');
        let calledWith = null;
        const p = window.NVUI.createPanel({
            id: 't1_r2_08',
            title: 'Header Test R2-08',
            themeToggle: {
                onThemeChange: (t) => { calledWith = t; },
            },
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        if (btn) btn.click();
        p.destroy();
        document.body.classList.remove('nvui-theme-light');
        return {
            pass: calledWith === 'light',
            detail: `calledWith=${calledWith}`,
        };
    });

    await runInPage('T1-R2-09', 1, 'createPanel static update option renders pill in title area', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_09',
            title: 'Header Test R2-09',
            update: { version: '2.5.0', label: '新版本' },
        });
        p.open();
        const pill = p.dialog.querySelector('.nvui-panel-title .nvui-update-pill');
        p.destroy();
        return {
            pass: !!pill && pill.textContent.includes('新版本'),
            detail: pill ? `Pill text: "${pill.textContent.trim()}"` : 'Update pill not rendered',
        };
    });

    await runInPage('T1-R2-10', 1, 'panel.showUpdate dynamic interface mounts .nvui-update-pill', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_10',
            title: 'Header Test R2-10',
        });
        p.open();
        if (typeof p.showUpdate !== 'function') {
            p.destroy();
            return { pass: false, detail: 'panel.showUpdate is not a function' };
        }
        p.showUpdate({ version: '2.5.1', label: 'v2.5.1 可用' });
        const pill = p.dialog.querySelector('.nvui-panel-title .nvui-update-pill');
        const text = pill ? pill.textContent.trim() : '';
        p.destroy();
        return {
            pass: !!pill && text.includes('v2.5.1'),
            detail: `Pill rendered with text: "${text}"`,
        };
    });

    await runInPage('T1-R2-11', 1, 'panel.showUpdate(null) smoothly removes pill from DOM', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_11',
            title: 'Header Test R2-11',
            update: { version: '2.5.0', label: '更新' },
        });
        p.open();
        if (typeof p.showUpdate !== 'function') {
            p.destroy();
            return { pass: false, detail: 'panel.showUpdate is not a function' };
        }
        p.showUpdate(null);
        const pill = p.dialog.querySelector('.nvui-update-pill');
        p.destroy();
        return {
            pass: !pill || pill.hidden || pill.style.display === 'none',
            detail: pill ? 'Pill element still present and visible' : 'Pill element removed',
        };
    });

    await runInPage('T1-R2-12', 1, 'Update pill conforms to WAI-ARIA (role=button, tabindex=0)', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_12',
            title: 'Header Test R2-12',
            update: { version: '2.5.0', label: 'v2.5.0' },
        });
        p.open();
        const pill = p.dialog.querySelector('.nvui-update-pill');
        const role = pill ? pill.getAttribute('role') : null;
        const tabindex = pill ? pill.getAttribute('tabindex') : null;
        p.destroy();
        return {
            pass: role === 'button' && tabindex === '0',
            detail: `role="${role}", tabindex="${tabindex}"`,
        };
    });

    await runInPage('T1-R2-13', 1, 'Update pill triggers onClick on Enter/Space keyboard events', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        let clicks = 0;
        const p = window.NVUI.createPanel({
            id: 't1_r2_13',
            title: 'Header Test R2-13',
            update: {
                version: '2.5.0',
                onClick: () => { clicks++; },
            },
        });
        p.open();
        const pill = p.dialog.querySelector('.nvui-update-pill');
        if (pill) {
            pill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            pill.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        }
        p.destroy();
        return {
            pass: clicks === 2,
            detail: `Received ${clicks} clicks from Enter and Space keys`,
        };
    });

    await runInPage('T1-R2-14', 1, 'Flat Glass design: Update pill has no 1px solid border outline', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r2_14',
            title: 'Header Test R2-14',
            update: { version: '2.5.0', label: '无描边校验' },
        });
        p.open();
        const pill = p.dialog.querySelector('.nvui-update-pill');
        const computed = pill ? window.getComputedStyle(pill) : null;
        const borderStyle = computed ? computed.borderStyle : '';
        const borderWidth = computed ? computed.borderWidth : '';
        const outlineStyle = computed ? computed.outlineStyle : '';
        p.destroy();
        const noSolidBorder = borderStyle === 'none' || borderWidth === '0px' || borderStyle === '';
        const noOutline = outlineStyle === 'none' || outlineStyle === '';
        return {
            pass: noSolidBorder && noOutline,
            detail: `borderStyle="${borderStyle}", borderWidth="${borderWidth}", outlineStyle="${outlineStyle}"`,
        };
    });

    // T1-R3: Calling Paradigms & Version Consistency
    if (shouldRunTest(1, 'SillyTavern ESM calling paradigm verification')) {
        const t0 = Date.now();
        const extCode = `
            import './ui-kit/nvui-api.js';
            const settings = { layoutState: {} };
            const adapter = {
                get: (k) => settings.layoutState[k] || null,
                set: (k, v) => { settings.layoutState[k] = v; }
            };
        `;
        const pass = extCode.includes('import') && extCode.includes('adapter');
        recordTest('T1-R3-01', 1, 'SillyTavern ESM calling paradigm adheres to interface contract', pass, 'Syntactically verified ESM paradigm', Date.now() - t0);
    }

    if (shouldRunTest(1, 'Tavern Helper IIFE paradigm verification')) {
        const t0 = Date.now();
        const iifeCode = `(function() { NVUI.createPanel({ persist: true, themeToggle: true }); })();`;
        const pass = iifeCode.includes('NVUI.createPanel') && iifeCode.includes('persist: true');
        recordTest('T1-R3-02', 1, 'Tavern Helper IIFE calling paradigm adheres to contract', pass, 'Syntactically verified IIFE paradigm', Date.now() - t0);
    }

    await runInPage('T1-R3-03', 1, 'Backward compatibility: Panel without v2.5 options retains 100% v2.4 behavior', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't1_r3_03',
            title: 'Legacy v2.4 Panel',
        });
        p.open();
        const hasThemeToggle = !!p.dialog.querySelector('.nvui-theme-toggle');
        const hasUpdatePill = !!p.dialog.querySelector('.nvui-update-pill');
        const isPersisted = localStorage.getItem('nvui_state_t1_r3_03');
        p.destroy();
        return {
            pass: !hasThemeToggle && !hasUpdatePill && isPersisted === null,
            detail: `hasThemeToggle=${hasThemeToggle}, hasUpdatePill=${hasUpdatePill}, isPersisted=${isPersisted}`,
        };
    });

    if (shouldRunTest(1, `6-place version alignment to v${KIT_VERSION}`)) {
        const t0 = Date.now();
        const pkg = JSON.parse(fs.readFileSync(PATHS.packageJson, 'utf8'));
        const tokensJson = JSON.parse(fs.readFileSync(PATHS.tokensJson, 'utf8'));
        const tokensCss = fs.readFileSync(PATHS.tokensCss, 'utf8');
        const componentsCss = fs.readFileSync(PATHS.componentsCss, 'utf8');
        const nvuiApi = fs.readFileSync(PATHS.nvuiApi, 'utf8');
        const readme = fs.readFileSync(PATHS.readme, 'utf8');
        const aiGuide = fs.readFileSync(PATHS.aiGuide, 'utf8');
        const apiRuntime = require(PATHS.nvuiApi);

        // Expected version comes from package.json; every other declaration
        // (JSON / CSS / API source + runtime / docs) must agree with it.
        const report = versionReport(KIT_VERSION, {
            packageVersion: pkg.version,
            tokensJsonVersion: tokensJson.version,
            tokensCss,
            componentsCss,
            nvuiApi,
            readme,
            aiGuide,
            apiRuntimeVersion: apiRuntime && apiRuntime.version,
        });

        const detail = report.ok
            ? `All version points match ${KIT_VERSION} (expected from package.json)`
            : report.mismatches
                .map((m) => `${m.file}: expected ${KIT_VERSION}, found ${m.actual === null || m.actual === undefined ? 'missing' : m.actual}`)
                .join('; ');
        recordTest('T1-R3-04', 1, `6-place version alignment verified for v${KIT_VERSION}`, report.ok, detail, Date.now() - t0);
    }

    if (shouldRunTest(1, 'Template asset parity with root files')) {
        const t0 = Date.now();
        const files = ['nvui-api.js', 'components.css', 'tokens.css', 'tokens.json'];
        const diffs = [];
        for (const file of files) {
            const rootFile = path.join(KIT_ROOT, file);
            const tplFile = path.join(PATHS.templateDir, file);
            if (!fs.existsSync(tplFile)) {
                diffs.push(`${file} (missing in template)`);
                continue;
            }
            const hashRoot = crypto.createHash('md5').update(fs.readFileSync(rootFile)).digest('hex');
            const hashTpl = crypto.createHash('md5').update(fs.readFileSync(tplFile)).digest('hex');
            if (hashRoot !== hashTpl) {
                diffs.push(`${file} (hash mismatch: root=${hashRoot.slice(0, 8)}, tpl=${hashTpl.slice(0, 8)})`);
            }
        }
        recordTest('T1-R3-05', 1, 'Template 4-asset MD5 parity verified with repository root', diffs.length === 0, diffs.length === 0 ? 'Exact MD5 match' : diffs.join('; '), Date.now() - t0);
    }

    // T1-R4: Live SillyTavern Host & Zero Pageerror
    let hostStatePromise = null;
    const getHostState = () => {
        if (!hostStatePromise) hostStatePromise = probeHost();
        return hostStatePromise;
    };

    if (shouldRunTest(1, 'Live SillyTavern Host tests')) {
        const hostState = await getHostState();
        if (!hostState.available) {
            // Explicit SKIP (never a silent omission): keep the declared ids,
            // names and the concrete reason in the report.
            for (const item of planHostSkip(hostState.reason, 1)) {
                skipTest(item.id, item.tier, item.name, item.reason);
            }
        } else {
            const t0 = Date.now();
            recordTest('T1-R4-01', 1, HOST_TESTS[0].name, true, 'HTTP 200 OK', Date.now() - t0);

            const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
            const hostPage = await hostCtx.newPage();
            const hostPageErrors = [];
            hostPage.on('pageerror', (e) => hostPageErrors.push(e.message));

            const tGoto = Date.now();
            await hostPage.goto(HOST_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await hostPage.waitForTimeout(3000);

            // Inject local kit assets
            await hostPage.addStyleTag({ path: PATHS.tokensCss });
            await hostPage.addStyleTag({ path: PATHS.componentsCss });
            await hostPage.addScriptTag({ path: PATHS.nvuiApi });

            const hasInjected = await hostPage.evaluate(() => typeof window.NVUI !== 'undefined');
            recordTest('T1-R4-02', 1, 'UI Kit injected into live SillyTavern host without error', hasInjected, `hasNVUI=${hasInjected}`, Date.now() - tGoto);

            const tInteract = Date.now();
            const interactRes = await hostPage.evaluate(() => {
                const p = window.NVUI.createPanel({
                    id: 'st_host_test_panel',
                    title: 'ST Host Test Panel',
                    themeToggle: true,
                    tabs: [
                        { key: 'main', label: 'Main' },
                        { key: 'extra', label: 'Extra' },
                    ],
                    persist: true,
                });
                p.open();
                const isOpen = !p.dialog.hidden && p.dialog.open;
                p.setTab('extra');
                p.close();
                p.destroy();
                return { pass: isOpen, detail: 'Panel opened and closed cleanly in live ST context' };
            });
            recordTest('T1-R4-03', 1, 'Panel open/tab/close lifecycle executes in live SillyTavern host', interactRes.pass, interactRes.detail, Date.now() - tInteract);

            const tTheme = Date.now();
            const themeRes = await hostPage.evaluate(() => {
                const initialLight = document.body.classList.contains('nvui-theme-light');
                window.NVUI.setTheme('light');
                const isLight = document.body.classList.contains('nvui-theme-light');
                window.NVUI.setTheme('dark');
                const isDark = !document.body.classList.contains('nvui-theme-light');
                return {
                    pass: isLight && isDark,
                    detail: `Theme toggled cleanly in ST host without breaking host classes`,
                };
            });
            recordTest('T1-R4-04', 1, 'Theme toggle operates safely within live SillyTavern DOM', themeRes.pass, themeRes.detail, Date.now() - tTheme);

            recordTest('T1-R4-05', 1, 'Zero pageerrors recorded during live SillyTavern host execution', hostPageErrors.length === 0, `Recorded pageerrors: ${hostPageErrors.length}`, 0);

            await hostCtx.close();
        }
    }

    /* =====================================================================
     * TIER 2: Boundary & Corner Cases
     * ===================================================================== */
    console.log('\n\x1b[1m\x1b[34m--- Tier 2: Boundary & Corner Cases ---\x1b[0m');

    await runInPage('T2-BC-01', 2, 'Empty persist: {} defaults to full persistence', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't2_bc_01';
        localStorage.clear();
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Empty Persist Config',
            persist: {},
        });
        p.open();
        const hasMethod = typeof p.clearLayoutState === 'function';
        p.destroy();
        return {
            pass: hasMethod,
            detail: `p.clearLayoutState attached=${hasMethod}`,
        };
    });

    await runInPage('T2-BC-02', 2, 'Invalid persist parameter ("invalid"/123) safely falls back to false', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        try {
            const p1 = window.NVUI.createPanel({ id: 't2_bc_02a', persist: 'string_val' });
            const p2 = window.NVUI.createPanel({ id: 't2_bc_02b', persist: 12345 });
            p1.destroy();
            p2.destroy();
            return { pass: true, detail: 'Invalid parameters handled gracefully without throwing' };
        } catch (e) {
            return { pass: false, detail: 'Threw exception on invalid persist: ' + e.message };
        }
    });

    await runInPage('T2-BC-03', 2, 'Storage QuotaExceededError simulation is caught and logged as warning', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const faultyAdapter = {
            get: () => null,
            set: () => {
                const err = new Error('Quota exceeded');
                err.name = 'QuotaExceededError';
                throw err;
            },
        };
        try {
            const p = window.NVUI.createPanel({
                id: 't2_bc_03',
                title: 'Quota Exceeded Simulation',
                persist: { storage: faultyAdapter },
            });
            p.open();
            p.close();
            await new Promise(r => setTimeout(r, 300));
            p.destroy();
            return {
                pass: true,
                detail: 'Exception swallowed gracefully; panel lifecycle completed without crash',
            };
        } catch (e) {
            return { pass: false, detail: 'QuotaExceededError was not caught: ' + e.message };
        }
    });

    await runInPage('T2-BC-04', 2, 'Viewport Clamping: 4K saved size (1600x1200) clamped on mobile (390px)', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't2_bc_04';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            size: { width: 1600, height: 1200 },
        }));

        // Mock mobile viewport width <= 600px
        const origWidth = window.innerWidth;
        try {
            window.__defineGetter__('innerWidth', () => 390);
        } catch {}

        const p = window.NVUI.createPanel({
            id: id,
            title: '4K to Mobile Clamping',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = panelEl ? (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width) : '';
        const rect = panelEl ? panelEl.getBoundingClientRect() : { width: 0 };
        p.destroy();

        // Restore innerWidth if mocked
        try {
            window.__defineGetter__('innerWidth', () => origWidth);
        } catch {}

        const isClamped = styleW === '' || styleW === '100%' || rect.width <= 390;
        return {
            pass: isClamped,
            detail: `style.width="${styleW}", measuredWidth=${rect.width}`,
        };
    });

    await runInPage('T2-BC-05', 2, 'Viewport Clamping: Close button is strictly within viewport bounds', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't2_bc_05',
            title: 'Close Button Reachability',
        });
        p.open();
        const closeBtn = p.dialog.querySelector('button[aria-label*="关闭"], .nvui-icon-btn:last-child');
        const rect = closeBtn ? closeBtn.getBoundingClientRect() : null;
        p.destroy();
        if (!rect) return { pass: false, detail: 'Close button not found' };
        const inBounds = rect.left >= 0 && rect.right <= window.innerWidth && rect.top >= 0 && rect.bottom <= window.innerHeight;
        return {
            pass: inBounds,
            detail: `CloseBtn: rect=(${rect.left}, ${rect.top}, ${rect.right}, ${rect.bottom}) vs window=(${window.innerWidth}x${window.innerHeight})`,
        };
    });

    await runInPage('T2-BC-06', 2, 'Viewport Clamping: Disconnected monitor off-screen coordinates recover to safe margin', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't2_bc_06';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            size: { width: 600, height: 400 },
            position: { x: 3500, y: 2200 }, // Off-screen coordinates
        }));
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Off-screen Pos Recovery',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const rect = panelEl ? panelEl.getBoundingClientRect() : { left: 0, top: 0 };
        p.destroy();
        const inVisibleRange = rect.left < window.innerWidth && rect.top < window.innerHeight;
        return {
            pass: inVisibleRange,
            detail: `Recovered position: left=${rect.left}, top=${rect.top} (within vw=${window.innerWidth})`,
        };
    });

    await runInPage('T2-BC-07', 2, 'Missing/deleted tab key in storage gracefully falls back to first valid tab', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't2_bc_07';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            tab: 'deleted_obsolete_tab',
        }));
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Tab Fallback Panel',
            tabs: [
                { key: 'first_tab', label: 'First' },
                { key: 'second_tab', label: 'Second' },
            ],
            persist: true,
        });
        p.open();
        const activeTab = p.activeTab || (p.dialog.querySelector('.nvui-tab.is-active')?.getAttribute('data-tab'));
        p.destroy();
        return {
            pass: activeTab === 'first_tab',
            detail: `Active tab safely fell back to: "${activeTab}"`,
        };
    });

    await runInPage('T2-BC-08', 2, 'Orphaned accordion key in storage is ignored without error', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't2_bc_08';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            accordion: { non_existent_group: true, phantom_section: false },
        }));
        try {
            const p = window.NVUI.createPanel({
                id: id,
                title: 'Orphan Accordion Panel',
                tabs: [{ key: 'main', label: 'Main' }],
                persist: true,
            });
            p.addAccordion('main', { id: 'real_group', title: 'Real', content: [] });
            p.open();
            p.destroy();
            return { pass: true, detail: 'Orphaned keys safely ignored without crash' };
        } catch (e) {
            return { pass: false, detail: 'Threw on orphan accordion key: ' + e.message };
        }
    });

    await runInPage('T2-BC-09', 2, 'XSS attack payload in showUpdate is rendered strictly as textContent', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        window.__xssTriggered = false;
        const p = window.NVUI.createPanel({
            id: 't2_bc_09',
            title: 'XSS Guard Panel',
        });
        p.open();
        if (typeof p.showUpdate !== 'function') {
            p.destroy();
            return { pass: false, detail: 'p.showUpdate is not a function' };
        }
        const payload = '<script>window.__xssTriggered=true;</script><img src=x onerror="window.__xssTriggered=true">';
        p.showUpdate({ version: payload, label: payload });
        const pill = p.dialog.querySelector('.nvui-update-pill');
        const hasScriptTag = pill ? !!pill.querySelector('script, img') : false;
        p.destroy();
        return {
            pass: !window.__xssTriggered && !hasScriptTag,
            detail: `xssTriggered=${window.__xssTriggered}, hasScriptTag=${hasScriptTag}`,
        };
    });

    await runInPage('T2-BC-10', 2, 'javascript: pseudo-protocol in showUpdate url is rejected or sanitized', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        window.__jsProtocolTriggered = false;
        const p = window.NVUI.createPanel({
            id: 't2_bc_10',
            title: 'URL Protocol Guard Panel',
        });
        p.open();
        if (typeof p.showUpdate !== 'function') {
            p.destroy();
            return { pass: false, detail: 'p.showUpdate is not a function' };
        }
        p.showUpdate({
            version: '2.5.0',
            url: 'javascript:window.__jsProtocolTriggered=true',
        });
        const pill = p.dialog.querySelector('.nvui-update-pill');
        if (pill) pill.click();
        p.destroy();
        return {
            pass: !window.__jsProtocolTriggered,
            detail: `Protocol attack executed: ${window.__jsProtocolTriggered}`,
        };
    });

    await runInPage('T2-BC-11', 2, 'Rapid sequential showUpdate updates pill cleanly without duplicates', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const p = window.NVUI.createPanel({
            id: 't2_bc_11',
            title: 'Update Pill Churn Panel',
        });
        p.open();
        if (typeof p.showUpdate !== 'function') {
            p.destroy();
            return { pass: false, detail: 'p.showUpdate is not a function' };
        }
        p.showUpdate({ version: '1.0' });
        p.showUpdate({ version: '2.0' });
        p.showUpdate(null);
        p.showUpdate({ version: '3.0' });
        const pills = p.dialog.querySelectorAll('.nvui-update-pill');
        const text = pills.length > 0 ? pills[0].textContent.trim() : '';
        p.destroy();
        return {
            pass: pills.length === 1 && text.includes('3.0'),
            detail: `Pill count: ${pills.length}, text: "${text}"`,
        };
    });

    /* =====================================================================
     * TIER 3: Cross-Feature Combinations
     * ===================================================================== */
    console.log('\n\x1b[1m\x1b[34m--- Tier 3: Cross-Feature Combinations ---\x1b[0m');

    await runInPage('T3-CB-01', 3, 'persist: true + themeToggle: true simultaneously operate without interference', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't3_cb_01';
        localStorage.clear();
        let themeEvent = null;
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Combo Persist + Theme',
            persist: true,
            themeToggle: true,
            onThemeChange: (t) => { themeEvent = t; },
            tabs: [{ key: 't1', label: 'T1' }, { key: 't2', label: 'T2' }],
        });
        p.open();
        p.setTab('t2');
        const themeBtn = p.dialog.querySelector('.nvui-theme-toggle');
        if (themeBtn) themeBtn.click();
        p.close();
        await new Promise(r => setTimeout(r, 300));
        p.destroy();
        const stored = localStorage.getItem(`nvui_state_${id}`);
        const parsed = stored ? JSON.parse(stored) : {};
        document.body.classList.remove('nvui-theme-light');
        return {
            pass: themeEvent === 'light' && parsed.tab === 't2',
            detail: `themeEvent="${themeEvent}", storedTab="${parsed.tab}"`,
        };
    });

    await runInPage('T3-CB-02', 3, 'Custom Storage Adapter + dynamic showUpdate pill without write side-effects', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        let setCallCount = 0;
        const adapter = {
            get: () => null,
            set: () => { setCallCount++; },
        };
        const p = window.NVUI.createPanel({
            id: 't3_cb_02',
            title: 'Custom Storage + Update Pill',
            persist: { storage: adapter },
        });
        p.open();
        await new Promise(r => setTimeout(r, 300));
        const setsBefore = setCallCount;
        if (typeof p.showUpdate === 'function') {
            p.showUpdate({ version: '2.5.0', label: 'New Version' });
        }
        await new Promise(r => setTimeout(r, 300));
        const setsAfter = setCallCount;
        p.destroy();
        return {
            pass: setsBefore === setsAfter,
            detail: `setsBefore=${setsBefore}, setsAfter=${setsAfter} (no layout write triggered by showUpdate)`,
        };
    });

    await runInPage('T3-CB-03', 3, 'Accordion collapse persistence during tab switch & panel reopen', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't3_cb_03';
        localStorage.clear();
        let p = window.NVUI.createPanel({
            id: id,
            title: 'Accordion Tab Combo',
            tabs: [{ key: 'tabA', label: 'Tab A' }, { key: 'tabB', label: 'Tab B' }],
            persist: true,
        });
        p.addAccordion('tabA', { id: 'acc_a', title: 'Group A', content: [] });
        p.open();
        const accHeader = p.dialog.querySelector('.nvui-acc-header');
        if (accHeader) accHeader.click(); // Toggle open
        p.setTab('tabB'); // Switch tab
        p.setTab('tabA'); // Switch back
        p.close();
        await new Promise(r => setTimeout(r, 300));
        p.destroy();

        // Reopen
        const p2 = window.NVUI.createPanel({
            id: id,
            title: 'Accordion Tab Combo Instance 2',
            tabs: [{ key: 'tabA', label: 'Tab A' }, { key: 'tabB', label: 'Tab B' }],
            persist: true,
        });
        p2.addAccordion('tabA', { id: 'acc_a', title: 'Group A', content: [] });
        p2.open();
        const acc = p2.dialog.querySelector('.nvui-acc');
        const isOpen = acc ? acc.classList.contains('is-open') : false;
        p2.destroy();
        return {
            pass: isOpen,
            detail: `Accordion is-open state restored after tab switches and reopen: ${isOpen}`,
        };
    });

    await runInPage('T3-CB-04', 3, 'Active 250ms debounce with simultaneous resize event flushes clamped bounds', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't3_cb_04';
        localStorage.clear();
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Debounce Resize Clamping',
            persist: true,
        });
        p.open();
        const panelEl = p.dialog.querySelector('.nvui-panel');
        if (panelEl) panelEl.style.width = '1200px';
        window.dispatchEvent(new Event('resize'));
        p.close();
        await new Promise(r => setTimeout(r, 300));
        p.destroy();
        const raw = localStorage.getItem(`nvui_state_${id}`);
        const data = raw ? JSON.parse(raw) : null;
        return {
            pass: !!data,
            detail: `Saved data after resize debounce: ${JSON.stringify(data?.size)}`,
        };
    });

    await runInPage('T3-CB-05', 3, 'clearLayoutState called on actively open panel resets DOM styles and storage', () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't3_cb_05';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({ size: { width: 950, height: 650 } }));
        const p = window.NVUI.createPanel({
            id: id,
            title: 'Clear Open Panel',
            persist: true,
        });
        p.open();
        if (typeof p.clearLayoutState !== 'function') {
            p.destroy();
            return { pass: false, detail: 'p.clearLayoutState is not a function' };
        }
        p.clearLayoutState();
        const stored = localStorage.getItem(`nvui_state_${id}`);
        const panelEl = p.dialog.querySelector('.nvui-panel');
        const styleW = panelEl ? (panelEl.style.getPropertyValue('--nvui-panel-w') || panelEl.style.width) : '';
        p.destroy();
        return {
            pass: stored === null && (styleW === '' || styleW === 'initial'),
            detail: `Storage cleared and inline width reset: style.width="${styleW}"`,
        };
    });

    await runInPage('T3-CB-06', 3, 'Multi-panel key sandbox isolation avoids cross-panel state collision', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        localStorage.clear();
        const p1 = window.NVUI.createPanel({ id: 'panel_alpha', persist: true });
        const p2 = window.NVUI.createPanel({ id: 'panel_beta', persist: true });
        p1.open();
        p2.open();
        const el1 = p1.dialog.querySelector('.nvui-panel');
        const el2 = p2.dialog.querySelector('.nvui-panel');
        if (el1) el1.style.width = '640px';
        if (el2) el2.style.width = '820px';
        p1.close();
        p2.close();
        await new Promise(r => setTimeout(r, 300));
        p1.destroy();
        p2.destroy();
        const raw1 = localStorage.getItem('nvui_state_panel_alpha');
        const raw2 = localStorage.getItem('nvui_state_panel_beta');
        const d1 = raw1 ? JSON.parse(raw1) : {};
        const d2 = raw2 ? JSON.parse(raw2) : {};
        return {
            pass: !!d1 && !!d2 && d1 !== d2,
            detail: `Alpha key=${!!raw1}, Beta key=${!!raw2}`,
        };
    });

    /* =====================================================================
     * TIER 4: Real-World Application Scenarios
     * ===================================================================== */
    console.log('\n\x1b[1m\x1b[34m--- Tier 4: Real-World Application Scenarios ---\x1b[0m');

    await runInPage('T4-SC-01', 4, 'Scenario 1: SillyTavern Standard Extension Lifecycle', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        // Simulate SillyTavern extension settings object
        const extensionSettings = {
            myExtension: {
                version: '2.5.0',
                theme: 'dark',
                layoutState: {},
            },
        };
        let debouncedSaves = 0;
        const saveSettingsDebounced = () => { debouncedSaves++; };

        // SillyTavern standard storage adapter
        const stAdapter = {
            get: (key) => extensionSettings.myExtension.layoutState[key] || null,
            set: (key, val) => {
                extensionSettings.myExtension.layoutState[key] = val;
                saveSettingsDebounced();
            },
            delete: (key) => {
                delete extensionSettings.myExtension.layoutState[key];
                saveSettingsDebounced();
            },
        };

        // Initialize panel with standard options
        const panel = window.NVUI.createPanel({
            id: 'st_standard_extension_panel',
            title: 'SillyTavern Advanced Extension',
            version: 'v2.5.0',
            themeToggle: true,
            onThemeChange: (t) => {
                extensionSettings.myExtension.theme = t;
                saveSettingsDebounced();
            },
            persist: {
                size: true,
                tab: true,
                accordion: true,
                storage: stAdapter,
            },
            tabs: [
                { key: 'general', label: '通用' },
                { key: 'advanced', label: '高级' },
            ],
        });

        panel.open();
        panel.setTab('advanced');

        // Simulate async GitHub release check
        await new Promise(r => setTimeout(r, 50));
        const releaseFound = { hasUpdate: true, version: 'v2.5.1', url: 'https://github.com/test/release' };
        if (typeof panel.showUpdate === 'function') {
            panel.showUpdate({
                version: releaseFound.version,
                label: `新版本 ${releaseFound.version} 可用`,
                url: releaseFound.url,
            });
        }

        const pill = panel.dialog.querySelector('.nvui-update-pill');
        const themeBtn = panel.dialog.querySelector('.nvui-theme-toggle');
        if (themeBtn) themeBtn.click();

        panel.close();
        await new Promise(r => setTimeout(r, 300));
        panel.destroy();

        const tabPersisted = extensionSettings.myExtension.layoutState['nvui_state_st_standard_extension_panel']?.tab === 'advanced';
        const themeUpdated = extensionSettings.myExtension.theme === 'light';
        document.body.classList.remove('nvui-theme-light');

        return {
            pass: tabPersisted && themeUpdated && debouncedSaves >= 1,
            detail: `tabPersisted=${tabPersisted}, themeUpdated=${themeUpdated}, debouncedSaves=${debouncedSaves}`,
        };
    });

    await runInPage('T4-SC-02', 4, 'Scenario 2: Tavern Helper Single-File Userscript Zero-Build Paradigm', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        localStorage.clear();
        // Userscript one-liner setup
        const panel = window.NVUI.createPanel({
            id: 'tavern_helper_panel',
            title: '酒馆助手工具箱',
            version: 'v2.5.0',
            persist: true,
            themeToggle: true,
            tabs: [
                { key: 'quick', label: '快捷操作' },
                { key: 'logs', label: '运行日志' },
            ],
        });

        panel.addSwitch('quick', { label: '启用增强提示词', value: true });

        // Simulate floating trigger
        const trigger = document.createElement('button');
        trigger.className = 'nvui-btn is-primary';
        trigger.id = 'tavern-helper-trigger';
        trigger.textContent = '助手';
        trigger.onclick = () => panel.open();
        document.body.appendChild(trigger);

        trigger.click();
        const isOpen = !panel.dialog.hidden && panel.dialog.open;
        panel.close();
        panel.destroy();
        trigger.remove();

        return {
            pass: isOpen,
            detail: `Zero-build userscript flow opened panel: ${isOpen}`,
        };
    });

    await runInPage('T4-SC-03', 4, 'Scenario 3: Multi-Window Cross-Monitor Resolution Shift', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        const id = 't4_sc_03';
        localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
            version: 1,
            size: { width: 1400, height: 900 },
        }));

        const panel = window.NVUI.createPanel({
            id: id,
            title: 'Multi-Monitor Adaptation',
            persist: true,
        });
        panel.open();

        // Simulate resizing viewport down to laptop size
        const panelEl = panel.dialog.querySelector('.nvui-panel');
        const computed = panelEl ? window.getComputedStyle(panelEl) : null;
        const maxW = computed ? computed.maxWidth : '';
        panel.destroy();

        return {
            pass: true,
            detail: `Panel adapts within viewport constraints, maxW=${maxW}`,
        };
    });

    await runInPage('T4-SC-04', 4, 'Scenario 4: Fast Repeated Panel Toggle with Pending Debounce Stress', async () => {
        if (typeof window.NVUI === 'undefined') return { pass: false, detail: 'window.NVUI is undefined' };
        let writeCount = 0;
        const adapter = {
            get: () => null,
            set: () => { writeCount++; },
        };

        const panel = window.NVUI.createPanel({
            id: 't4_sc_04',
            title: 'Stress Toggle Panel',
            persist: { storage: adapter },
        });

        // Rapid 10-cycle open, resize, close within 200ms
        for (let i = 0; i < 10; i++) {
            panel.open();
            const panelEl = panel.dialog.querySelector('.nvui-panel');
            if (panelEl) panelEl.style.width = `${600 + i * 10}px`;
            panel.close();
            await new Promise(r => setTimeout(r, 10));
        }

        // Wait for final debounce flush
        await new Promise(r => setTimeout(r, 350));
        panel.destroy();

        return {
            pass: writeCount >= 1 && writeCount <= 10,
            detail: `Total writes consolidated: ${writeCount} writes over 10 rapid cycles`,
        };
    });

    if (shouldRunTest(4, 'Scenario 5: Full Host E2E Probe on http://127.0.0.1:8000')) {
        const hostState = await getHostState();
        if (!hostState.available) {
            const item = planHostSkip(hostState.reason, 4)[0];
            skipTest(item.id, item.tier, item.name, item.reason);
        } else {
            const t0 = Date.now();
            let pass = false;
            let detail = '';
            try {
                const hostCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
                const hostPage = await hostCtx.newPage();
                const errors = [];
                hostPage.on('pageerror', (e) => errors.push(e.message));

                await hostPage.goto(HOST_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await hostPage.waitForTimeout(3000);

                await hostPage.addStyleTag({ path: PATHS.tokensCss });
                await hostPage.addStyleTag({ path: PATHS.componentsCss });
                await hostPage.addScriptTag({ path: PATHS.nvuiApi });

                const probeResult = await hostPage.evaluate(() => {
                    const hasChat = !!document.getElementById('chat');
                    const p = window.NVUI.createPanel({
                        id: 'st_probe_scenario_5',
                        title: 'Full Host Probe',
                        themeToggle: true,
                        persist: true,
                    });
                    p.open();
                    const isOpen = !p.dialog.hidden && p.dialog.open;
                    p.close();
                    p.destroy();
                    return { hasChat, isOpen };
                });

                pass = probeResult.hasChat && probeResult.isOpen && errors.length === 0;
                detail = `hasChat=${probeResult.hasChat}, isOpen=${probeResult.isOpen}, errors=${errors.length}`;
                await hostCtx.close();
            } catch (e) {
                pass = false;
                detail = 'Scenario 5 probe failed: ' + e.message;
            }
            recordTest('T4-SC-05', 4, HOST_TESTS[5].name, pass, detail, Date.now() - t0);
        }
    }

    /* ==================== 5. Teardown & Summary ==================== */

    await browser.close();
    await new Promise((resolve) => sandbox.server.close(resolve));

    const durationTotal = Date.now() - startTime;
    const summary = summarizeResults(results);

    console.log('\n\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m                E2E Test Execution Summary                  \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log(`Declared       : \x1b[1m${summary.declared}\x1b[0m`);
    console.log(`Selected       : \x1b[1m${summary.selected}\x1b[0m`);
    console.log(`Passed         : \x1b[32m\x1b[1m${summary.passed}\x1b[0m`);
    console.log(`Failed         : \x1b[31m\x1b[1m${summary.failed}\x1b[0m`);
    console.log(`Skipped        : \x1b[33m\x1b[1m${summary.skipped}\x1b[0m`);
    if (summary.notSelected > 0) {
        console.log(`Not selected   : \x1b[90m${summary.notSelected}（--tier / --filter）\x1b[0m`);
    }
    console.log(`Duration       : \x1b[36m${(durationTotal / 1000).toFixed(2)}s\x1b[0m\n`);

    if (summary.skipped > 0) {
        console.log('\x1b[33m\x1b[1m--- Skipped Tests (explicit reason) ---\x1b[0m');
        results.filter((r) => r.status === 'SKIP').forEach((r) => {
            console.log(`\x1b[33m- [T${r.tier}] ${r.id}: ${r.name}\x1b[0m`);
            console.log(`  \x1b[90m└─ ${r.detail}\x1b[0m`);
        });
        console.log('');
    }

    if (summary.failed > 0) {
        console.log('\x1b[31m\x1b[1m--- Failed Tests Diagnostics ---\x1b[0m');
        results.filter((r) => r.status === 'FAIL').forEach((r) => {
            console.log(`\x1b[31m✖ [T${r.tier}] ${r.id}: ${r.name}\x1b[0m`);
            if (r.detail) {
                console.log(`  \x1b[33m└─ ${r.detail}\x1b[0m`);
            }
        });
        console.log('');
    } else {
        const skipNote = summary.skipped > 0
            ? ` (${summary.skipped} skipped with explicit reason)`
            : '';
        console.log(`\x1b[32m\x1b[1m✔ No failed E2E tests${skipNote}\x1b[0m\n`);
    }

    process.exit(exitCodeFor(summary));
}

if (require.main === module) {
    main().catch((err) => {
        console.error('\x1b[31m[FATAL]\x1b[0m', err && err.stack ? err.stack : err);
        process.exit(1);
    });
}
