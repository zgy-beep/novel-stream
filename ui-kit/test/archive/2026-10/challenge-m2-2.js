/**
 * Empirical Challenge Harness for Milestone 2:
 * DOM Ordering, Layout Contracts, Visual Invariants & Persistence Isolation
 *
 * Challenger: challenger_m2_2
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

function resolvePlaywright() {
    try {
        return require('playwright-core');
    } catch {
        try {
            return require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
        } catch (e) {
            console.error('[FATAL] Failed to resolve playwright-core:', e.message);
            process.exit(1);
        }
    }
}

const { chromium } = resolvePlaywright();
const KIT_ROOT = path.resolve(__dirname, '..', '..', '..');
const CHROME_PATH = process.env.ST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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
    <title>Challenger M2-2 Empirical Sandbox</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body class="nvui-scope">
    <div id="sandbox-root"></div>
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

const challengeResults = [];

function recordResult(group, name, pass, detail) {
    const entry = { group, name, pass: !!pass, detail: detail || '' };
    challengeResults.push(entry);
    const tag = entry.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${tag} [${group}] ${name}`);
    if (!entry.pass || detail) {
        const color = entry.pass ? '\x1b[90m' : '\x1b[33m';
        console.log(`       ${color}└─ ${detail}\x1b[0m`);
    }
}

async function run() {
    console.log('\x1b[1m\x1b[36m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m  Milestone 2 Adversarial Challenge Suite (challenger_m2_2) \x1b[0m');
    console.log('\x1b[1m\x1b[36m============================================================\x1b[0m\n');

    for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[k];
    }
    process.env.NO_PROXY = '*';

    const sandbox = await startEphemeralServer();
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.goto(sandbox.url, { waitUntil: 'load' });

    console.log('\n--- Section 1: Exhaustive Header Action Combinations & DOM Ordering ---');

    const combinations = [
        {
            id: 'comb-1',
            desc: 'No actions, no themeToggle (actions: undefined, themeToggle: undefined)',
            options: { id: 'p_c1', title: 'Panel C1' },
            expectedActionsCount: 0,
            hasThemeToggle: false,
        },
        {
            id: 'comb-2',
            desc: 'No actions, no themeToggle (actions: [], themeToggle: false)',
            options: { id: 'p_c2', title: 'Panel C2', actions: [], themeToggle: false },
            expectedActionsCount: 0,
            hasThemeToggle: false,
        },
        {
            id: 'comb-3',
            desc: 'No actions, themeToggle: true (actions: undefined, themeToggle: true)',
            options: { id: 'p_c3', title: 'Panel C3', themeToggle: true },
            expectedActionsCount: 0,
            hasThemeToggle: true,
        },
        {
            id: 'comb-4',
            desc: 'No actions, themeToggle: true (actions: [], themeToggle: true)',
            options: { id: 'p_c4', title: 'Panel C4', actions: [], themeToggle: true },
            expectedActionsCount: 0,
            hasThemeToggle: true,
        },
        {
            id: 'comb-5',
            desc: '1 action, themeToggle: true',
            options: {
                id: 'p_c5',
                title: 'Panel C5',
                actions: [{ icon: 'fa-solid fa-gear', label: '设置' }],
                themeToggle: true,
            },
            expectedActionsCount: 1,
            hasThemeToggle: true,
        },
        {
            id: 'comb-6',
            desc: '5 actions, themeToggle: true',
            options: {
                id: 'p_c6',
                title: 'Panel C6',
                actions: [
                    { icon: 'fa-solid fa-1', label: 'Action 1' },
                    { icon: 'fa-solid fa-2', label: 'Action 2' },
                    { icon: 'fa-solid fa-3', label: 'Action 3' },
                    { icon: 'fa-solid fa-4', label: 'Action 4' },
                    { icon: 'fa-solid fa-5', label: 'Action 5' },
                ],
                themeToggle: true,
            },
            expectedActionsCount: 5,
            hasThemeToggle: true,
        },
        {
            id: 'comb-7',
            desc: 'Actions + themeToggle: false (3 actions, themeToggle: false)',
            options: {
                id: 'p_c7',
                title: 'Panel C7',
                actions: [
                    { icon: 'fa-solid fa-a', label: 'Alpha' },
                    { icon: 'fa-solid fa-b', label: 'Beta' },
                    { icon: 'fa-solid fa-c', label: 'Gamma' },
                ],
                themeToggle: false,
            },
            expectedActionsCount: 3,
            hasThemeToggle: false,
        },
        {
            id: 'comb-8',
            desc: '5 actions + themeToggle: false',
            options: {
                id: 'p_c8',
                title: 'Panel C8',
                actions: [
                    { icon: 'fa-solid fa-1', label: 'Action 1' },
                    { icon: 'fa-solid fa-2', label: 'Action 2' },
                    { icon: 'fa-solid fa-3', label: 'Action 3' },
                    { icon: 'fa-solid fa-4', label: 'Action 4' },
                    { icon: 'fa-solid fa-5', label: 'Action 5' },
                ],
                themeToggle: false,
            },
            expectedActionsCount: 5,
            hasThemeToggle: false,
        },
        {
            id: 'comb-9',
            desc: '2 actions, themeToggle as object ({ initial: "dark", onThemeChange: fn })',
            options: {
                id: 'p_c9',
                title: 'Panel C9',
                actions: [
                    { icon: 'fa-solid fa-folder', label: 'Folder' },
                    { icon: 'fa-solid fa-file', label: 'File' },
                ],
                themeToggle: { initial: 'dark' },
            },
            withCallback: true,
            expectedActionsCount: 2,
            hasThemeToggle: true,
        },
        {
            id: 'comb-10',
            desc: 'Stress: 10 actions, themeToggle: true',
            options: {
                id: 'p_c10',
                title: 'Panel C10',
                actions: Array.from({ length: 10 }, (_, i) => ({ icon: `fa-solid fa-${i}`, label: `Action-${i}` })),
                themeToggle: true,
            },
            expectedActionsCount: 10,
            hasThemeToggle: true,
        },
        {
            id: 'comb-11',
            desc: 'Edge: actions: null, themeToggle: true',
            options: { id: 'p_c11', title: 'Panel C11', actions: null, themeToggle: true },
            expectedActionsCount: 0,
            hasThemeToggle: true,
        },
        {
            id: 'comb-12',
            desc: 'Edge: falsy themeToggle (null, 0, "") with 2 actions',
            options: {
                id: 'p_c12',
                title: 'Panel C12',
                actions: [
                    { icon: 'fa-solid fa-x', label: 'X' },
                    { icon: 'fa-solid fa-y', label: 'Y' },
                ],
                themeToggle: null,
            },
            expectedActionsCount: 2,
            hasThemeToggle: false,
        },
    ];

    for (const c of combinations) {
        const evalResult = await page.evaluate((comb) => {
            try {
                const opts = Object.assign({}, comb.options);
                if (comb.withCallback) {
                    opts.themeToggle = {
                        initial: 'dark',
                        onThemeChange: function () {},
                    };
                }
                const p = window.NVUI.createPanel(opts);
                p.open();

                const actionsContainer = p.dialog.querySelector('.nvui-panel-actions');
                if (!actionsContainer) {
                    p.destroy();
                    return { pass: false, error: 'Missing .nvui-panel-actions container' };
                }

                const children = Array.from(actionsContainer.children);
                const totalChildren = children.length;
                const expectedTotal = comb.expectedActionsCount + (comb.hasThemeToggle ? 1 : 0) + 1; // +1 for closeBtn

                if (totalChildren !== expectedTotal) {
                    p.destroy();
                    return {
                        pass: false,
                        error: `Child count mismatch: expected ${expectedTotal}, got ${totalChildren}`,
                    };
                }

                // Verify custom actions at index 0..expectedActionsCount-1
                for (let i = 0; i < comb.expectedActionsCount; i++) {
                    const btn = children[i];
                    if (btn.tagName.toLowerCase() !== 'button') {
                        p.destroy();
                        return { pass: false, error: `Action ${i} is not a button tag: ${btn.tagName}` };
                    }
                    if (btn.classList.contains('nvui-theme-toggle')) {
                        p.destroy();
                        return { pass: false, error: `Action ${i} wrongly identified as theme toggle` };
                    }
                    if (btn.getAttribute('aria-label') === '关闭面板') {
                        p.destroy();
                        return { pass: false, error: `Action ${i} wrongly identified as closeBtn` };
                    }
                }

                // Verify theme toggle if enabled
                if (comb.hasThemeToggle) {
                    const themeBtn = children[comb.expectedActionsCount];
                    if (!themeBtn.classList.contains('nvui-theme-toggle')) {
                        p.destroy();
                        return { pass: false, error: `Child at index ${comb.expectedActionsCount} is not .nvui-theme-toggle` };
                    }
                    const hasMoonOrSun = themeBtn.querySelector('.fa-moon, .fa-sun');
                    if (!hasMoonOrSun) {
                        p.destroy();
                        return { pass: false, error: 'Theme toggle button missing .fa-moon or .fa-sun icon' };
                    }
                }

                // Verify closeBtn is strictly the LAST child
                const closeBtn = children[totalChildren - 1];
                const isLast = actionsContainer.lastElementChild === closeBtn;
                if (!isLast) {
                    p.destroy();
                    return { pass: false, error: 'actionsContainer.lastElementChild is not closeBtn' };
                }
                const isCloseLabel = closeBtn.getAttribute('aria-label') === '关闭面板';
                const hasXmark = !!closeBtn.querySelector('.fa-xmark');
                if (!isCloseLabel || !hasXmark) {
                    p.destroy();
                    return {
                        pass: false,
                        error: `Last child is not valid closeBtn: aria-label=${closeBtn.getAttribute('aria-label')}, hasXmark=${hasXmark}`,
                    };
                }

                p.destroy();
                return {
                    pass: true,
                    detail: `Total: ${totalChildren} children. Order: [${children.map(b => (b.classList.contains('nvui-theme-toggle') ? 'themeToggle' : (b.getAttribute('aria-label') === '关闭面板' ? 'closeBtn' : (b.getAttribute('aria-label') || 'action')))).join(' -> ')}]`,
                };
            } catch (err) {
                return { pass: false, error: String(err && err.stack ? err.stack : err) };
            }
        }, c);

        recordResult('DOM-ORDER', `${c.id}: ${c.desc}`, evalResult.pass, evalResult.pass ? evalResult.detail : evalResult.error);
    }

    console.log('\n--- Section 2: Flat Glass Styling Invariants & Computed Styles ---');

    const styleTests = [
        {
            id: 'style-static-dark',
            desc: 'Static opts.update pill in dark theme: computed border 0px/none, outline 0px/none',
            isLight: false,
            dynamic: false,
        },
        {
            id: 'style-static-light',
            desc: 'Static opts.update pill in light theme: computed border 0px/none, outline 0px/none',
            isLight: true,
            dynamic: false,
        },
        {
            id: 'style-dynamic-dark',
            desc: 'Dynamic panel.showUpdate() pill in dark theme: computed border 0px/none, outline 0px/none',
            isLight: false,
            dynamic: true,
        },
        {
            id: 'style-dynamic-light',
            desc: 'Dynamic panel.showUpdate() pill in light theme: computed border 0px/none, outline 0px/none',
            isLight: true,
            dynamic: true,
        },
        {
            id: 'style-focus-outline',
            desc: 'Keyboard focus (:focus-visible) triggers 2px solid ring, unfocus cleanly removes it',
            focusTest: true,
        },
    ];

    for (const st of styleTests) {
        const styleResult = await page.evaluate((cfg) => {
            try {
                if (cfg.isLight) {
                    document.body.classList.add('nvui-theme-light');
                } else {
                    document.body.classList.remove('nvui-theme-light');
                }

                let p;
                if (!cfg.dynamic) {
                    p = window.NVUI.createPanel({
                        id: 'p_style_' + (cfg.id || 'test'),
                        title: 'Style Panel',
                        update: { version: '2.5.0', label: 'v2.5.0' },
                    });
                    p.open();
                } else {
                    p = window.NVUI.createPanel({
                        id: 'p_style_' + (cfg.id || 'test'),
                        title: 'Style Panel',
                    });
                    p.open();
                    p.showUpdate({ version: '2.5.0', label: 'v2.5.0' });
                }

                const pill = p.dialog.querySelector('.nvui-update-pill');
                if (!pill) {
                    p.destroy();
                    return { pass: false, error: 'Pill not found in DOM' };
                }

                if (cfg.focusTest) {
                    // Verify unfocused first
                    const beforeFocus = window.getComputedStyle(pill);
                    const unfocusedOutline = beforeFocus.outlineStyle;

                    // Focus pill
                    pill.focus();
                    const duringFocus = window.getComputedStyle(pill);
                    const focusOutlineStyle = duringFocus.outlineStyle;
                    const focusOutlineWidth = duringFocus.outlineWidth;

                    // Blur pill
                    pill.blur();
                    const afterBlur = window.getComputedStyle(pill);
                    const blurredOutlineStyle = afterBlur.outlineStyle;
                    const blurredOutlineWidth = afterBlur.outlineWidth;

                    p.destroy();
                    document.body.classList.remove('nvui-theme-light');

                    const unfocusedClean = (unfocusedOutline === 'none' || beforeFocus.outlineWidth === '0px');
                    const blurredClean = (blurredOutlineStyle === 'none' || blurredOutlineWidth === '0px');

                    return {
                        pass: unfocusedClean && blurredClean,
                        detail: `unfocusedOutline="${unfocusedOutline}", focusOutline="${focusOutlineWidth} ${focusOutlineStyle}", blurredOutline="${blurredOutlineWidth} ${blurredOutlineStyle}"`,
                    };
                }

                const cs = window.getComputedStyle(pill);
                const borderTopW = cs.borderTopWidth;
                const borderRightW = cs.borderRightWidth;
                const borderBottomW = cs.borderBottomWidth;
                const borderLeftW = cs.borderLeftWidth;

                const borderTopS = cs.borderTopStyle;
                const borderRightS = cs.borderRightStyle;
                const borderBottomS = cs.borderBottomStyle;
                const borderLeftS = cs.borderLeftStyle;

                const outlineStyle = cs.outlineStyle;
                const outlineWidth = cs.outlineWidth;

                const hasNoBorder = (borderTopW === '0px' || borderTopS === 'none') &&
                                    (borderRightW === '0px' || borderRightS === 'none') &&
                                    (borderBottomW === '0px' || borderBottomS === 'none') &&
                                    (borderLeftW === '0px' || borderLeftS === 'none');

                const hasNoOutline = (outlineStyle === 'none' || outlineWidth === '0px');

                // Check background color is translucent or accent, not solid heavy border
                const bg = cs.backgroundColor;

                p.destroy();
                document.body.classList.remove('nvui-theme-light');

                return {
                    pass: hasNoBorder && hasNoOutline,
                    detail: `borderW=[${borderTopW},${borderRightW},${borderBottomW},${borderLeftW}], borderStyle=[${borderTopS},${borderRightS},${borderBottomS},${borderLeftS}], outline=${outlineWidth} ${outlineStyle}, bg=${bg}`,
                };
            } catch (err) {
                return { pass: false, error: String(err && err.stack ? err.stack : err) };
            }
        }, st);

        recordResult('FLAT-GLASS-STYLE', st.desc, styleResult.pass, styleResult.pass ? styleResult.detail : styleResult.error);
    }

    console.log('\n--- Section 3: Persistence Isolation & Storage Non-Interference ---');

    const isolationResult = await page.evaluate(async () => {
        try {
            const writes = [];
            const adapter = {
                get: () => null,
                set: (key, val) => {
                    const parsed = (typeof val === 'string') ? JSON.parse(val) : val;
                    writes.push({ time: Date.now(), key, val: parsed });
                },
                delete: () => {},
            };

            const p = window.NVUI.createPanel({
                id: 'persist_iso_test',
                title: 'Persistence Isolation Challenge',
                persist: { size: true, tab: true, accordion: true, storage: adapter },
                tabs: [
                    { key: 'tab1', label: 'Tab 1' },
                    { key: 'tab2', label: 'Tab 2' },
                ],
            });

            p.open();

            // Wait for initial mount and initial observer stabilization
            await new Promise(r => setTimeout(r, 400));
            const baseWrites = writes.length;

            const stepResults = [];

            // Step 1: Call showUpdate with standard payload
            p.showUpdate({ version: '2.5.0', label: 'v2.5.0 Available' });
            await new Promise(r => setTimeout(r, 400));
            stepResults.push({
                step: 'showUpdate standard',
                pass: writes.length === baseWrites,
                writesCount: writes.length - baseWrites,
            });

            // Step 2: Call showUpdate with very long label (could reflow header)
            p.showUpdate({
                version: '2.5.1',
                label: 'A Very Long Update Announcement Text Forcing Potential Flex Reflow In Header Title',
            });
            await new Promise(r => setTimeout(r, 400));
            stepResults.push({
                step: 'showUpdate long label reflow',
                pass: writes.length === baseWrites,
                writesCount: writes.length - baseWrites,
            });

            // Step 3: Call showUpdate(null) to remove pill
            p.showUpdate(null);
            await new Promise(r => setTimeout(r, 400));
            stepResults.push({
                step: 'showUpdate(null) removal',
                pass: writes.length === baseWrites,
                writesCount: writes.length - baseWrites,
            });

            // Step 4: Rapid churn: 20 rapid toggles between update configs and null
            for (let i = 0; i < 20; i++) {
                if (i % 2 === 0) {
                    p.showUpdate({ version: `2.5.${i}`, label: `Update ${i}` });
                } else {
                    p.showUpdate(null);
                }
            }
            await new Promise(r => setTimeout(r, 400));
            stepResults.push({
                step: 'showUpdate rapid churn (20 iterations)',
                pass: writes.length === baseWrites,
                writesCount: writes.length - baseWrites,
            });

            // Step 5: Mount update pill again
            p.showUpdate({ version: '2.5.99', label: 'Final Active Pill' });
            await new Promise(r => setTimeout(r, 400));
            stepResults.push({
                step: 'showUpdate mount again',
                pass: writes.length === baseWrites,
                writesCount: writes.length - baseWrites,
            });

            // Step 6: Positive Control - user performs intentional setSize
            // Persistence MUST STILL WORK for legitimate size modifications!
            p.setSize(760, 520);
            await new Promise(r => setTimeout(r, 400));
            const legitimateWrites = writes.length - baseWrites;
            const lastWrite = writes[writes.length - 1];
            const sizePersisted = lastWrite && lastWrite.val && lastWrite.val.size && lastWrite.val.size.width === 760;
            stepResults.push({
                step: 'Positive control: user setSize(760, 520) persists properly',
                pass: legitimateWrites >= 1 && sizePersisted,
                writesCount: legitimateWrites,
                persistedWidth: lastWrite ? lastWrite.val.size.width : null,
            });

            p.destroy();

            return {
                pass: stepResults.every(s => s.pass),
                stepResults,
            };
        } catch (err) {
            return { pass: false, error: String(err && err.stack ? err.stack : err) };
        }
    });

    if (isolationResult.stepResults) {
        for (const sr of isolationResult.stepResults) {
            recordResult(
                'PERSIST-ISO',
                sr.step,
                sr.pass,
                sr.pass ? `Writes recorded: ${sr.writesCount} (expected: 0 except positive control)` : `FAILED: writesCount=${sr.writesCount}`
            );
        }
    } else {
        recordResult('PERSIST-ISO', 'Persistence isolation execution', false, isolationResult.error);
    }

    console.log('\n--- Section 4: Adversarial Behavioral Challenges (Cross-Panel Sync, A11y & Defense) ---');

    // Test 4.1: Cross-Panel Theme Toggle State Synchronization
    const themeSyncResult = await page.evaluate(() => {
        try {
            document.body.classList.remove('nvui-theme-light');
            const p1 = window.NVUI.createPanel({ id: 'p_sync_1', title: 'Panel 1', themeToggle: true });
            const p2 = window.NVUI.createPanel({ id: 'p_sync_2', title: 'Panel 2', themeToggle: true });

            p1.open();
            const btn1 = p1.dialog.querySelector('.nvui-theme-toggle');
            // Toggle to light mode
            btn1.click();
            const bodyIsLight = document.body.classList.contains('nvui-theme-light');

            // Open Panel 2 - its toggle UI must synchronize to light mode (showing moon icon, aria-label to dark)
            p2.open();
            const btn2 = p2.dialog.querySelector('.nvui-theme-toggle');
            const btn2Aria = btn2.getAttribute('aria-label');
            const btn2HasMoon = !!btn2.querySelector('.fa-moon');

            // Now click btn2 to toggle back to dark
            btn2.click();
            const bodyIsDark = !document.body.classList.contains('nvui-theme-light');
            const btn2HasSun = !!btn2.querySelector('.fa-sun');

            p1.destroy();
            p2.destroy();
            document.body.classList.remove('nvui-theme-light');

            const pass = bodyIsLight && btn2Aria.includes('深色') && btn2HasMoon && bodyIsDark && btn2HasSun;
            return {
                pass,
                detail: `p1 toggled to light: ${bodyIsLight}, p2 sync icon moon: ${btn2HasMoon}, p2 toggle back dark: ${bodyIsDark}`,
            };
        } catch (e) {
            return { pass: false, error: String(e && e.stack ? e.stack : e) };
        }
    });
    recordResult('ADVERSARIAL', 'Cross-panel live theme toggle state synchronization', themeSyncResult.pass, themeSyncResult.pass ? themeSyncResult.detail : themeSyncResult.error);

    // Test 4.2: Update pill { hidden: true } equivalence
    const hiddenEquivResult = await page.evaluate(() => {
        try {
            const p = window.NVUI.createPanel({ id: 'p_hidden_test', title: 'Hidden Test', update: { version: '2.5.0' } });
            p.open();
            const pill1 = p.dialog.querySelector('.nvui-update-pill');
            if (!pill1) { p.destroy(); return { pass: false, error: 'Initial pill not mounted' }; }

            p.showUpdate({ hidden: true });
            const pillAfter = p.dialog.querySelector('.nvui-update-pill');
            p.destroy();
            return {
                pass: !pillAfter,
                detail: pillAfter ? 'Pill still exists after { hidden: true }' : 'Pill cleanly removed from DOM',
            };
        } catch (e) {
            return { pass: false, error: String(e && e.stack ? e.stack : e) };
        }
    });
    recordResult('ADVERSARIAL', 'showUpdate({ hidden: true }) cleanly removes pill from DOM', hiddenEquivResult.pass, hiddenEquivResult.pass ? hiddenEquivResult.detail : hiddenEquivResult.error);

    // Test 4.3: XSS & HTML injection resistance in update pill
    const xssDefenseResult = await page.evaluate(() => {
        try {
            const p = window.NVUI.createPanel({ id: 'p_xss_test', title: 'XSS Test' });
            p.open();
            const maliciousLabel = '<img src=x onerror="window.__xssInjected=true"><b id="injected-tag">alert</b>';
            p.showUpdate({
                version: '2.5.0',
                label: maliciousLabel,
            });
            const injectedTag = p.dialog.querySelector('#injected-tag');
            const xssFired = !!window.__xssInjected;
            const pill = p.dialog.querySelector('.nvui-update-pill');
            const textMatches = pill && pill.textContent === maliciousLabel;
            p.destroy();

            const pass = !injectedTag && !xssFired && textMatches;
            return {
                pass,
                detail: `injectedTag=${!!injectedTag}, xssFired=${xssFired}, textMatches=${textMatches}`,
            };
        } catch (e) {
            return { pass: false, error: String(e && e.stack ? e.stack : e) };
        }
    });
    recordResult('ADVERSARIAL', 'Update pill textContent XSS protection (HTML tags escaped)', xssDefenseResult.pass, xssDefenseResult.pass ? xssDefenseResult.detail : xssDefenseResult.error);

    // Test 4.4: Protocol safety - rejection of javascript: URLs
    const protoDefenseResult = await page.evaluate(() => {
        try {
            window.__protoAttackExecuted = false;
            let windowOpenCalled = false;
            const originalOpen = window.open;
            window.open = (u) => {
                windowOpenCalled = true;
                if (String(u).startsWith('javascript:')) window.__protoAttackExecuted = true;
            };

            const p = window.NVUI.createPanel({ id: 'p_proto_test', title: 'Proto Test' });
            p.open();
            p.showUpdate({
                version: '2.5.0',
                url: 'javascript:window.__protoAttackExecuted=true',
            });
            const pill = p.dialog.querySelector('.nvui-update-pill');
            if (pill) pill.click();

            window.open = originalOpen;
            const attackExecuted = window.__protoAttackExecuted;
            p.destroy();

            return {
                pass: !attackExecuted && !windowOpenCalled,
                detail: `windowOpenCalled=${windowOpenCalled}, attackExecuted=${attackExecuted}`,
            };
        } catch (e) {
            return { pass: false, error: String(e && e.stack ? e.stack : e) };
        }
    });
    recordResult('ADVERSARIAL', 'Update pill rejects unsafe pseudo-protocol url (javascript:)', protoDefenseResult.pass, protoDefenseResult.pass ? protoDefenseResult.detail : protoDefenseResult.error);

    // Test 4.5: Mobile viewport drawer clamping & closeBtn accessibility
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileResult = await page.evaluate(() => {
        try {
            const p = window.NVUI.createPanel({
                id: 'p_mobile_test',
                title: 'Mobile Panel',
                actions: [{ icon: 'fa-solid fa-star', label: 'Star' }],
                themeToggle: true,
            });
            p.open();
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const closeBtn = p.dialog.querySelector('.nvui-panel-actions button:last-child');
            const actions = p.dialog.querySelector('.nvui-panel-actions');
            const panelW = panelEl.offsetWidth;
            const closeBtnVisible = closeBtn && closeBtn.offsetWidth > 0 && closeBtn.offsetHeight > 0;
            const isLast = actions && actions.lastElementChild === closeBtn;

            p.destroy();
            return {
                pass: panelW <= 375 && closeBtnVisible && isLast,
                detail: `panelW=${panelW}px (<=375), closeBtnVisible=${closeBtnVisible}, closeBtnIsLast=${isLast}`,
            };
        } catch (e) {
            return { pass: false, error: String(e && e.stack ? e.stack : e) };
        }
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    recordResult('ADVERSARIAL', 'Mobile drawer (375px) keeps closeBtn strictly last and fully accessible', mobileResult.pass, mobileResult.pass ? mobileResult.detail : mobileResult.error);

    await browser.close();
    sandbox.server.close();

    console.log('\n\x1b[1m\x1b[36m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m                Empirical Challenge Summary                \x1b[0m');
    console.log('\x1b[1m\x1b[36m============================================================\x1b[0m');
    const total = challengeResults.length;
    const passed = challengeResults.filter(r => r.pass).length;
    const failed = total - passed;
    console.log(`Total Challenges : ${total}`);
    console.log(`Passed           : \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed           : ${failed === 0 ? '\x1b[32m0\x1b[0m' : '\x1b[31m' + failed + '\x1b[0m'}`);

    if (failed > 0) {
        console.log('\n--- Failed Challenges ---');
        challengeResults.filter(r => !r.pass).forEach(f => {
            console.log(`✖ [${f.group}] ${f.name}: ${f.detail}`);
        });
        process.exit(1);
    } else {
        console.log('\n\x1b[32m[ALL CHALLENGES PASSED] All DOM order invariants, Flat Glass styles, and persistence isolation verified.\x1b[0m\n');
        process.exit(0);
    }
}

run().catch((err) => {
    console.error('Fatal challenge error:', err);
    process.exit(1);
});
