/**
 * Adversarial Stress Test Suite for Milestone 2: Standardized Panel Header (Issue #6)
 * ----------------------------------------------------------------------------------
 * Targets:
 *   1. High-frequency theme toggling:
 *      - 50 rapid synchronous clicks on .nvui-theme-toggle.
 *      - Body class (.nvui-theme-light), icon state (fa-sun vs fa-moon), and aria-label consistency.
 *      - Callback verification: opts.onThemeChange and opts.themeToggle.onThemeChange receiving 50 events.
 *      - External theme sync when opening panel.
 *      - Error resilience when callbacks throw.
 *      - 200-cycle high-throughput benchmark.
 *   2. Dynamic update pill churn & DOM cleanliness:
 *      - 100 rapid sequential panel.showUpdate(...) calls with versions, null, { hidden: true }.
 *      - Strict DOM cleanliness: exactly 0 or 1 pill at every state, no duplicates.
 *      - Singleton element identity reuse across updates.
 *      - Adversarial XSS strings (<script>, <img onerror>, <svg onload>, escaped properly as textContent).
 *      - Malicious URL protocol rejection (javascript:, data:, vbscript:, uppercase/whitespace variants).
 *      - Safe URL handling with window.open.
 *   3. Keyboard interaction & WAI-ARIA APG compliance:
 *      - Enter, Space (' '), Spacebar keydown dispatch triggering onClick and e.preventDefault().
 *      - Non-triggering keys (Tab, Escape, Arrows, letters) do not invoke onClick.
 *      - APG semantics: role="button", tabindex="0", dynamic aria-label.
 *      - Fault tolerance when onClick throws.
 *   4. Cross-feature isolation & stability:
 *      - showUpdate churn during persist: true causes zero spurious layout writes.
 *      - Theme toggle does not interfere with panel layout persistence.
 *      - panel.destroy() cleanly unmounts pill and isolates memory.
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
    <title>NVUI Kit M2 Adversarial Stress Harness</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body class="nvui-scope">
    <div id="sandbox-root">
        <h1>NVUI M2 Adversarial Stress Test</h1>
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
    console.log('\x1b[1m\x1b[35m  NVUI Kit M2 · Adversarial Header & Stress Test Harness     \x1b[0m');
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
    // SECTION 1: High-Frequency Theme Toggling (50+ Rapid Clicks)
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 1: High-Frequency Theme Toggling ---\x1b[0m');

    await runTest('STR-M2-1.1', '50 rapid synchronous clicks maintain 100% body class, icon, and aria-label consistency', async () => {
        document.body.classList.remove('nvui-theme-light');
        const themeLog = [];
        const themeToggleObjLog = [];

        const p = NVUI.createPanel({
            id: 'm2_theme_stress_01',
            title: 'Theme Stress Panel 1',
            themeToggle: {
                onThemeChange: (th) => themeToggleObjLog.push(th),
            },
            onThemeChange: (th) => themeLog.push(th),
        });
        p.open();

        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        if (!btn) {
            p.destroy();
            return { pass: false, detail: 'Theme toggle button missing' };
        }

        let anomaly = null;
        for (let i = 1; i <= 50; i++) {
            btn.click();

            const isLightExpected = (i % 2 === 1);
            const bodyHasLight = document.body.classList.contains('nvui-theme-light');
            const icon = btn.querySelector('i');
            const iconClass = icon ? icon.className : '';
            const ariaLabel = btn.getAttribute('aria-label') || '';

            const expectedIconClass = isLightExpected ? 'fa-moon' : 'fa-sun';
            const expectedAriaLabel = isLightExpected ? '切换为深色主题' : '切换为浅色主题';

            if (bodyHasLight !== isLightExpected) {
                anomaly = `Cycle ${i}: Body class mismatch. Expected light=${isLightExpected}, got ${bodyHasLight}`;
                break;
            }
            if (!iconClass.includes(expectedIconClass)) {
                anomaly = `Cycle ${i}: Icon mismatch. Expected ${expectedIconClass}, got ${iconClass}`;
                break;
            }
            if (ariaLabel !== expectedAriaLabel) {
                anomaly = `Cycle ${i}: Aria-label mismatch. Expected "${expectedAriaLabel}", got "${ariaLabel}"`;
                break;
            }
        }

        p.destroy();
        document.body.classList.remove('nvui-theme-light');

        if (anomaly) return { pass: false, detail: anomaly };
        if (themeLog.length !== 50 || themeToggleObjLog.length !== 50) {
            return { pass: false, detail: `Callback counts: opts.onThemeChange=${themeLog.length}, themeToggle.onThemeChange=${themeToggleObjLog.length}` };
        }

        return {
            pass: true,
            detail: `50 toggles completed cleanly. Callbacks fired: ${themeLog.length}, Final theme: ${themeLog[49]}`,
        };
    });

    await runTest('STR-M2-1.2', 'External theme changes while panel closed resynchronize upon reopen', async () => {
        document.body.classList.remove('nvui-theme-light');

        const p = NVUI.createPanel({
            id: 'm2_theme_sync_02',
            title: 'Theme Sync Panel 2',
            themeToggle: true,
        });

        // 1. Open panel in dark mode
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        const initialLabel = btn.getAttribute('aria-label');
        const initialIcon = btn.querySelector('i').className;
        p.close();

        // 2. Externally mutate theme to light while panel is closed
        NVUI.setTheme('light');
        const isBodyLight = document.body.classList.contains('nvui-theme-light');

        // 3. Reopen panel and verify immediate UI resynchronization
        p.open();
        const reopenedBtn = p.dialog.querySelector('.nvui-theme-toggle');
        const reopenedLabel = reopenedBtn.getAttribute('aria-label');
        const reopenedIcon = reopenedBtn.querySelector('i').className;

        p.destroy();
        document.body.classList.remove('nvui-theme-light');

        const pass = isBodyLight &&
            initialLabel === '切换为浅色主题' &&
            initialIcon.includes('fa-sun') &&
            reopenedLabel === '切换为深色主题' &&
            reopenedIcon.includes('fa-moon');

        return {
            pass,
            detail: `Initial: [${initialIcon}, "${initialLabel}"] -> Reopened: [${reopenedIcon}, "${reopenedLabel}"]`,
        };
    });

    await runTest('STR-M2-1.3', 'Fault tolerance: Throwing onThemeChange callback does not break theme toggle UI', async () => {
        document.body.classList.remove('nvui-theme-light');
        let errorLogged = false;

        const p = NVUI.createPanel({
            id: 'm2_theme_err_03',
            title: 'Theme Error Panel 3',
            themeToggle: {
                onThemeChange: () => {
                    throw new Error('Simulated rogue onThemeChange exception');
                },
            },
            onThemeChange: () => {
                throw new Error('Simulated second rogue exception');
            },
        });
        p.open();

        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        let toggledCleanly = false;
        try {
            btn.click();
            toggledCleanly = document.body.classList.contains('nvui-theme-light');
            btn.click();
            toggledCleanly = toggledCleanly && !document.body.classList.contains('nvui-theme-light');
        } catch (e) {
            toggledCleanly = false;
        }

        p.destroy();
        document.body.classList.remove('nvui-theme-light');

        return {
            pass: toggledCleanly,
            detail: toggledCleanly ? 'Exceptions safely trapped without aborting UI state toggle' : 'Theme toggle threw unhandled exception',
        };
    });

    await runTest('STR-M2-1.4', 'High-throughput theme benchmark: 200 consecutive toggles complete in < 250ms', async () => {
        document.body.classList.remove('nvui-theme-light');

        const p = NVUI.createPanel({
            id: 'm2_theme_bench_04',
            title: 'Theme Bench Panel 4',
            themeToggle: true,
        });
        p.open();
        const btn = p.dialog.querySelector('.nvui-theme-toggle');

        const t0 = performance.now();
        for (let i = 0; i < 200; i++) {
            btn.click();
        }
        const duration = performance.now() - t0;

        p.destroy();
        document.body.classList.remove('nvui-theme-light');

        return {
            pass: duration < 250,
            detail: `200 theme toggles completed in ${duration.toFixed(2)}ms (average ${(duration / 200).toFixed(3)}ms/toggle)`,
        };
    });

    // =========================================================================
    // SECTION 2: Dynamic Update Pill Churn & DOM Cleanliness
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 2: Update Pill Churn, DOM Cleanliness & Security ---\x1b[0m');

    await runTest('STR-M2-2.1', '100 rapid sequential showUpdate calls maintain strictly 0 or 1 pill at every state', async () => {
        const p = NVUI.createPanel({
            id: 'm2_update_churn_01',
            title: 'Update Churn Panel 1',
        });
        p.open();

        const configs = [
            { version: '1.0.0' },
            null,
            { version: '2.0.0', label: '版本 2.0' },
            { hidden: true },
            { version: '3.0.0-rc.1', ariaLabel: '测试候选 3.0' },
            undefined,
            { hidden: false, version: '4.0.0' },
            null,
            { version: '5.0.0' },
        ];

        let anomaly = null;
        let count = 0;

        for (let cycle = 0; cycle < 100; cycle++) {
            const cfg = configs[cycle % configs.length];
            p.showUpdate(cfg);

            const pills = p.dialog.querySelectorAll('.nvui-update-pill');
            const isNullOrHidden = !cfg || cfg.hidden === true;

            if (isNullOrHidden && pills.length !== 0) {
                anomaly = `Cycle ${cycle}: Expected 0 pills when config=${JSON.stringify(cfg)}, but found ${pills.length}`;
                break;
            }
            if (!isNullOrHidden && pills.length !== 1) {
                anomaly = `Cycle ${cycle}: Expected exactly 1 pill when config=${JSON.stringify(cfg)}, but found ${pills.length}`;
                break;
            }
            count++;
        }

        // Final verification: showUpdate with concrete version
        p.showUpdate({ version: '9.9.9', label: '最终发布 9.9.9' });
        const finalPills = p.dialog.querySelectorAll('.nvui-update-pill');
        const finalText = finalPills.length === 1 ? finalPills[0].textContent : '';

        p.destroy();

        if (anomaly) return { pass: false, detail: anomaly };
        return {
            pass: finalPills.length === 1 && finalText === '最终发布 9.9.9',
            detail: `100 churn cycles verified with 0 duplicate DOM nodes. Final pill: "${finalText}"`,
        };
    });

    await runTest('STR-M2-2.2', 'Singleton identity reuse: Consecutive showUpdate calls mutate same DOM node', async () => {
        const p = NVUI.createPanel({
            id: 'm2_update_singleton_02',
            title: 'Update Singleton Panel 2',
        });
        p.open();

        const node1 = p.showUpdate({ version: '1.0.0' });
        const node2 = p.showUpdate({ version: '2.0.0' });
        const node3 = p.showUpdate({ version: '3.0.0', label: 'New 3.0' });

        const pass = (node1 === node2) && (node2 === node3) && (node3.textContent === 'New 3.0');
        p.destroy();

        return {
            pass,
            detail: pass ? 'Same DOM element reference preserved across mutations' : 'showUpdate created redundant DOM elements',
        };
    });

    await runTest('STR-M2-2.3', 'Robust handling of edge case & invalid parameter inputs', async () => {
        const p = NVUI.createPanel({
            id: 'm2_update_edge_03',
            title: 'Update Edge Cases Panel 3',
        });
        p.open();

        // 1. Empty object
        const n1 = p.showUpdate({});
        const t1 = n1 ? n1.textContent : '';

        // 2. Numeric 0 version
        const n2 = p.showUpdate({ version: 0 });
        const t2 = n2 ? n2.textContent : '';

        // 3. Empty string label
        const n3 = p.showUpdate({ label: '' });
        const t3 = n3 ? n3.textContent : '';

        // 4. Invalid primitives (numbers, strings, booleans, functions)
        const n4 = p.showUpdate(12345);
        const n5 = p.showUpdate('invalid-string');
        const n6 = p.showUpdate(true);

        p.destroy();

        const pass = (t1 === '新版本可用') &&
                     (t2 === 'v0 可用') &&
                     (t3 === '') &&
                     (n4 === null) &&
                     (n5 === null) &&
                     (n6 === null);

        return {
            pass,
            detail: `t1="${t1}", t2="${t2}", t3="${t3}", invalid primitives safely returned null`,
        };
    });

    await runTest('STR-M2-2.4', 'Adversarial XSS attacks are strictly escaped into textContent without code execution', async () => {
        window.__XSS_TRIGGER_1 = undefined;
        window.__XSS_TRIGGER_2 = undefined;
        window.__XSS_TRIGGER_3 = undefined;

        const p = NVUI.createPanel({
            id: 'm2_update_xss_04',
            title: 'XSS Attack Panel 4',
        });
        p.open();

        const payloads = [
            '<script>window.__XSS_TRIGGER_1 = true;</script>',
            '<img src="missing.png" onerror="window.__XSS_TRIGGER_2 = true;">',
            '<svg/onload="window.__XSS_TRIGGER_3 = true">',
            '"><script>window.__XSS_TRIGGER_1 = true;</script>',
        ];

        let injectionObserved = false;
        for (const attack of payloads) {
            p.showUpdate({ version: attack, label: attack, ariaLabel: attack });
            const titleEl = p.dialog.querySelector('.nvui-panel-title');
            const pillEl = titleEl ? titleEl.querySelector('.nvui-update-pill') : null;

            if (!pillEl) {
                injectionObserved = true;
                break;
            }

            // Verify HTML representation is escaped
            if (pillEl.innerHTML.includes('<script>') || pillEl.innerHTML.includes('<img ') || pillEl.innerHTML.includes('<svg')) {
                injectionObserved = true;
                break;
            }
        }

        // Wait a frame for any asynchronous onerror triggers
        await new Promise(r => setTimeout(r, 50));

        const xssExecuted = !!window.__XSS_TRIGGER_1 || !!window.__XSS_TRIGGER_2 || !!window.__XSS_TRIGGER_3;

        p.destroy();

        return {
            pass: !injectionObserved && !xssExecuted,
            detail: !xssExecuted ? '0 XSS payloads executed. HTML entities strictly sanitized.' : 'CRITICAL: XSS execution detected!',
        };
    });

    await runTest('STR-M2-2.5', 'Malicious URL pseudo-protocols are strictly blocked from window.open', async () => {
        const p = NVUI.createPanel({
            id: 'm2_update_url_05',
            title: 'URL Protocol Attack Panel 5',
        });
        p.open();

        let openedUrl = null;
        const originalOpen = window.open;
        window.open = (url) => { openedUrl = url; };

        const maliciousUrls = [
            'javascript:window.__XSS_PROTO=true',
            'JAVASCRIPT:alert(1)',
            '  javascript:alert(2)',
            'data:text/html,<script>window.__XSS_PROTO=true</script>',
            'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
            'vbscript:msgbox(1)',
            'VBSCRIPT:alert(1)',
        ];

        let blockedAll = true;
        for (const malUrl of maliciousUrls) {
            openedUrl = null;
            p.showUpdate({ version: '1.0', url: malUrl });
            const pill = p.dialog.querySelector('.nvui-update-pill');
            if (pill) pill.click();

            if (openedUrl !== null) {
                blockedAll = false;
                break;
            }
        }

        // Test safe URL
        openedUrl = null;
        p.showUpdate({ version: '1.0', url: 'https://github.com/SillyTavern/SillyTavern/releases' });
        const pillSafe = p.dialog.querySelector('.nvui-update-pill');
        if (pillSafe) pillSafe.click();
        const safePassed = openedUrl === 'https://github.com/SillyTavern/SillyTavern/releases';

        window.open = originalOpen;
        p.destroy();

        return {
            pass: blockedAll && safePassed,
            detail: `Malicious protocols rejected: ${blockedAll}, Safe URL opened: ${safePassed} ("${openedUrl}")`,
        };
    });

    // =========================================================================
    // SECTION 3: Keyboard Interaction & WAI-ARIA APG Compliance
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 3: Keyboard Interaction & WAI-ARIA APG Compliance ---\x1b[0m');

    await runTest('STR-M2-3.1', 'Update pill handles Enter, Space, and Spacebar keydown with e.preventDefault()', async () => {
        let triggerCount = 0;
        let lastEvent = null;

        const p = NVUI.createPanel({
            id: 'm2_kbd_01',
            title: 'Keyboard Panel 1',
            update: {
                version: '2.5.0',
                onClick: (e) => {
                    triggerCount++;
                    lastEvent = e;
                },
            },
        });
        p.open();

        const pill = p.dialog.querySelector('.nvui-update-pill');
        if (!pill) {
            p.destroy();
            return { pass: false, detail: 'Pill not found' };
        }

        function dispatchKey(keyName) {
            const ev = new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true });
            pill.dispatchEvent(ev);
            return ev.defaultPrevented;
        }

        // 1. Activation keys: Enter, Space, Spacebar
        const enterPrevented = dispatchKey('Enter');
        const spacePrevented = dispatchKey(' ');
        const spacebarPrevented = dispatchKey('Spacebar');

        const activationPass = (triggerCount === 3) && enterPrevented && spacePrevented && spacebarPrevented;

        // 2. Non-activation keys should NOT trigger onClick
        const nonTriggerKeys = ['Tab', 'Escape', 'ArrowRight', 'ArrowDown', 'Shift', 'KeyA'];
        let nonTriggerPassed = true;
        let failedKeyInfo = null;
        for (const k of nonTriggerKeys) {
            const prev = triggerCount;
            // Dispatch with bubbles: false to isolate updatePill's own listener behavior
            const ev = new KeyboardEvent('keydown', { key: k, bubbles: false, cancelable: true });
            pill.dispatchEvent(ev);
            if (triggerCount !== prev || ev.defaultPrevented) {
                failedKeyInfo = `${k} (prevClicks=${prev}, newClicks=${triggerCount}, prevented=${ev.defaultPrevented})`;
                nonTriggerPassed = false;
                break;
            }
        }

        p.destroy();

        return {
            pass: activationPass && nonTriggerPassed,
            detail: `Enter/Space/Spacebar triggers: ${triggerCount}/3 (all defaultPrevented=true), Non-activation keys ignored: ${nonTriggerPassed} (failed on: ${failedKeyInfo || 'none'})`,
        };
    });

    await runTest('STR-M2-3.2', 'WAI-ARIA compliance: role="button", tabindex="0", aria-label semantic accuracy', async () => {
        const p = NVUI.createPanel({
            id: 'm2_kbd_aria_02',
            title: 'ARIA APG Panel 2',
            update: {
                version: '2.5.0',
                ariaLabel: '自定义升级提示标签',
            },
        });
        p.open();

        const pill = p.dialog.querySelector('.nvui-update-pill');
        const role = pill.getAttribute('role');
        const tabindex = pill.getAttribute('tabindex');
        const ariaLabel = pill.getAttribute('aria-label');

        // Dynamically update aria-label via showUpdate
        p.showUpdate({ version: '2.6.0' });
        const updatedAriaLabel = pill.getAttribute('aria-label');

        p.destroy();

        const pass = (role === 'button') &&
                     (tabindex === '0') &&
                     (ariaLabel === '自定义升级提示标签') &&
                     (updatedAriaLabel === '发现新版本: 2.6.0');

        return {
            pass,
            detail: `role="${role}", tabindex="${tabindex}", customLabel="${ariaLabel}", autoLabel="${updatedAriaLabel}"`,
        };
    });

    await runTest('STR-M2-3.3', 'Fault tolerance: Throwing in update onClick handler does not break keyboard navigation', async () => {
        let invocations = 0;

        const p = NVUI.createPanel({
            id: 'm2_kbd_err_03',
            title: 'Keyboard Error Panel 3',
            update: {
                version: '2.5.0',
                onClick: () => {
                    invocations++;
                    throw new Error('Rogue update onClick handler error');
                },
            },
        });
        p.open();

        const pill = p.dialog.querySelector('.nvui-update-pill');

        let handledGracefully = true;
        try {
            pill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            pill.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        } catch (e) {
            handledGracefully = false;
        }

        p.destroy();

        return {
            pass: handledGracefully && invocations === 2,
            detail: handledGracefully ? 'Exceptions trapped cleanly in handleUpdateTrigger' : 'Keyboard handler uncaught exception',
        };
    });

    // =========================================================================
    // SECTION 4: Cross-Feature Zero Side-Effects (Persist & Clamping & Destroy)
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m--- Stress Area 4: Cross-Feature Zero Side-Effects & Cleanup ---\x1b[0m');

    await runTest('STR-M2-4.1', 'showUpdate churn during persist: true causes zero spurious layout writes', async () => {
        const writeLog = [];
        const spyStorage = {
            get: () => null,
            set: (k, v) => writeLog.push({ k, v, t: performance.now() }),
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'm2_persist_sideeffect_01',
            title: 'Persist Side-effect Panel 1',
            persist: { size: true, storage: spyStorage },
        });
        p.open();

        // Initial render stabilization
        await new Promise(r => setTimeout(r, 60));
        const initialWrites = writeLog.length;

        // Rapidly call showUpdate 30 times
        for (let i = 1; i <= 30; i++) {
            p.showUpdate({ version: `2.${i}.0`, label: `版本 2.${i}.0` });
        }

        // Wait longer than the 250ms debounce window
        await new Promise(r => setTimeout(r, 350));

        const spuriousWrites = writeLog.length - initialWrites;
        p.destroy();

        return {
            pass: spuriousWrites === 0,
            detail: `Spurious layout persistence writes triggered: ${spuriousWrites} (expected 0)`,
        };
    });

    await runTest('STR-M2-4.2', 'Rapid theme toggle during active persistence maintains untouched layout state', async () => {
        document.body.classList.remove('nvui-theme-light');
        let savedState = null;
        const spyStorage = {
            get: () => ({ size: { width: 750, height: 500, isMaximized: false } }),
            set: (k, v) => { savedState = v; },
            delete: () => {},
        };

        const p = NVUI.createPanel({
            id: 'm2_theme_persist_02',
            title: 'Theme Persist Panel 2',
            persist: { size: true, storage: spyStorage },
            themeToggle: true,
        });
        p.open();

        const btn = p.dialog.querySelector('.nvui-theme-toggle');
        for (let i = 0; i < 20; i++) {
            btn.click();
        }

        p.flushPersistSave();
        p.destroy();
        document.body.classList.remove('nvui-theme-light');

        const pass = savedState && savedState.size && savedState.size.w === 750 && savedState.size.h === 500;

        return {
            pass,
            detail: pass ? `Layout state maintained accurately: ${JSON.stringify(savedState.size)}` : 'State corrupted by theme toggle',
        };
    });

    await runTest('STR-M2-4.3', 'panel.destroy() cleanly tears down pill, listeners, and references', async () => {
        const p = NVUI.createPanel({
            id: 'm2_destroy_cleanup_03',
            title: 'Destroy Cleanup Panel 3',
            themeToggle: true,
            update: { version: '2.5.0' },
        });
        p.open();

        const dialog = p.dialog;
        const pill = dialog.querySelector('.nvui-update-pill');

        p.destroy();
        // Wait 60ms for deferred dialog.close() and setTimeout(remove, 0) in destroy()
        await new Promise(r => setTimeout(r, 60));

        const dialogInDom = document.contains(dialog);
        const pillInDom = document.contains(pill);

        // Calling showUpdate after destroy should safely return without throwing
        let postDestroySafe = false;
        try {
            const res = p.showUpdate({ version: '3.0.0' });
            postDestroySafe = true;
        } catch (e) {
            postDestroySafe = false;
        }

        return {
            pass: !dialogInDom && !pillInDom && postDestroySafe,
            detail: `dialogInDom=${dialogInDom}, pillInDom=${pillInDom}, postDestroySafe=${postDestroySafe}`,
        };
    });

    // =========================================================================
    // Summary
    // =========================================================================
    await browser.close();
    await sandbox.close();

    console.log('\n\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m       NVUI M2 Adversarial Stress Test Summary              \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');

    const total = testResults.length;
    const passed = testResults.filter(t => t.pass).length;
    const failed = total - passed;

    console.log(`Total Stress Tests : ${total}`);
    console.log(`Passed             : \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed             : ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : '0'}`);

    if (pageErrors.length > 0) {
        console.log(`\n\x1b[31mUncaught Page Errors (${pageErrors.length}):\x1b[0m`);
        pageErrors.forEach(e => console.log(` - ${e}`));
    } else {
        console.log(`Page Errors        : \x1b[32m0 pageerror\x1b[0m`);
    }

    if (failed > 0 || pageErrors.length > 0) {
        console.log('\n\x1b[31m✘ Adversarial stress testing failed.\x1b[0m\n');
        process.exit(1);
    } else {
        console.log('\n\x1b[32m✔ All adversarial stress tests passed cleanly!\x1b[0m\n');
        process.exit(0);
    }
})();
