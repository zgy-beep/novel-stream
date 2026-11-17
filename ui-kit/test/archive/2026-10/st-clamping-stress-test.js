/**
 * Adversarial Stress Test Harness: Viewport Clamping & Cross-Screen Resilience
 * 
 * Verifies:
 * 1. 4K down to 390x844 mobile transition (fixed inline pixels reset, drawer applies)
 * 2. Coordinate boundary extremes ((x: -500, y: -500), (x: 5000, y: 5000), NaN, Infinity)
 * 3. Dynamic window resize while panel is open (shrinkage, expansion, fluttering)
 * 4. SillyTavern Live Host (127.0.0.1:8000) verification with 0 pageerrors
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
const CHROME_PATH = process.env.ST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HOST_URL = process.env.ST_HOST_URL || 'http://127.0.0.1:8000/';
const KIT_ROOT = path.resolve(__dirname, '..', '..', '..');

const results = [];

function record(name, pass, detail) {
    const entry = { name, pass: !!pass, detail: detail || '' };
    results.push(entry);
    const tag = entry.pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${tag} ${name}`);
    if (!entry.pass && entry.detail) {
        console.log(`       \x1b[33m└─ Diagnostic: ${entry.detail}\x1b[0m`);
    } else if (entry.detail) {
        console.log(`       \x1b[90m└─ Detail: ${entry.detail}\x1b[0m`);
    }
    return entry.pass;
}

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
    <title>NVUI Viewport Clamping Stress Test</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body class="nvui-scope">
    <div id="test-root"></div>
    <script src="/nvui-api.js"></script>
</body>
</html>`);
                return;
            }

            let filePath = null;
            let mimeType = 'text/plain';
            if (url === '/tokens.css') { filePath = path.join(KIT_ROOT, 'tokens.css'); mimeType = 'text/css'; }
            else if (url === '/components.css') { filePath = path.join(KIT_ROOT, 'components.css'); mimeType = 'text/css'; }
            else if (url === '/nvui-api.js') { filePath = path.join(KIT_ROOT, 'nvui-api.js'); mimeType = 'application/javascript'; }

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
            resolve({ server, port, url: `http://127.0.0.1:${port}/` });
        });
    });
}

function checkLiveHost(url) {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

(async () => {
    console.log('\x1b[1m\x1b[36m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m   NVUI Kit v2.5.0 Viewport Clamping Adversarial Stress Test\x1b[0m');
    console.log('\x1b[1m\x1b[36m============================================================\x1b[0m');

    const ephemeral = await startEphemeralServer();
    console.log(`[INIT] Ephemeral server listening on ${ephemeral.url}`);

    const browser = await chromium.launch({
        headless: true,
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const pageErrors = [];
    const consoleWarnErrors = [];

    const page = await browser.newPage();
    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
        console.error('\x1b[31m[PAGEERROR]\x1b[0m', err.message);
    });
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            consoleWarnErrors.push(`[error] ${msg.text()}`);
        }
    });

    try {
        await page.goto(ephemeral.url, { waitUntil: 'domcontentloaded' });

        /* -------------------------------------------------------------
         * TEST GROUP 1: Mathematical Model Unit Level (clampPanelLayout)
         * ------------------------------------------------------------- */
        console.log('\n--- GROUP 1: clampPanelLayout() Mathematical Model Stress ---');

        const mathResults = await page.evaluate(() => {
            const out = {};

            // 1. Desktop 1920x1080 default
            const d1 = window.NVUI.clampPanelLayout({ width: 880, height: 600 });
            out.d1 = { width: d1.width, height: d1.height, styleWidth: d1.styleWidth, styleHeight: d1.styleHeight };

            // 2. Negative coordinates (-500, -500)
            const neg = window.NVUI.clampPanelLayout({ width: 880, height: 600 }, { x: -500, y: -500 });
            out.neg = { x: neg.x, y: neg.y };

            // 3. Huge positive coordinates (5000, 5000) in 1920x1080
            const posHuge = window.NVUI.clampPanelLayout({ width: 880, height: 600 }, { x: 5000, y: 5000 });
            out.posHuge = { x: posHuge.x, y: posHuge.y, vw: window.innerWidth, vh: window.innerHeight };

            // 4. Boundary coordinates: (0, 0), (15, 15), (16, 16)
            const b0 = window.NVUI.clampPanelLayout({ width: 600, height: 400 }, { x: 0, y: 0 });
            const b15 = window.NVUI.clampPanelLayout({ width: 600, height: 400 }, { x: 15, y: 15 });
            const b16 = window.NVUI.clampPanelLayout({ width: 600, height: 400 }, { x: 16, y: 16 });
            out.b0 = { x: b0.x, y: b0.y };
            out.b15 = { x: b15.x, y: b15.y };
            out.b16 = { x: b16.x, y: b16.y };

            // 5. Extreme adversarial values: NaN, Infinity, -Infinity
            const nanPos = window.NVUI.clampPanelLayout({ width: 880, height: 600 }, { x: NaN, y: NaN });
            const infPos = window.NVUI.clampPanelLayout({ width: 880, height: 600 }, { x: Infinity, y: -Infinity });
            const nanSize = window.NVUI.clampPanelLayout({ width: NaN, height: NaN });
            const hugeSize = window.NVUI.clampPanelLayout({ width: 99999, height: 99999 });
            const negSize = window.NVUI.clampPanelLayout({ width: -500, height: -500 });

            out.nanPos = { hasX: 'x' in nanPos, hasY: 'y' in nanPos };
            out.infPos = { x: infPos.x, y: infPos.y };
            out.nanSize = { width: nanSize.width, height: nanSize.height };
            out.hugeSize = { width: hugeSize.width, height: hugeSize.height };
            out.negSize = { width: negSize.width, height: negSize.height };

            return out;
        });

        record(
            'Unit: Negative coordinates (-500, -500) clamped to safe margin (>=16px)',
            mathResults.neg.x >= 16 && mathResults.neg.y >= 16 && mathResults.neg.x === 16 && mathResults.neg.y === 16,
            `clamped (x: ${mathResults.neg.x}, y: ${mathResults.neg.y})`
        );

        record(
            'Unit: Huge positive coordinates (5000, 5000) clamped within viewport right/bottom safe margins',
            mathResults.posHuge.x <= (mathResults.posHuge.vw - 880 - 16) && mathResults.posHuge.x >= 16 &&
            mathResults.posHuge.y <= (mathResults.posHuge.vh - 600 - 16) && mathResults.posHuge.y >= 16,
            `clamped (x: ${mathResults.posHuge.x}, y: ${mathResults.posHuge.y}) in vw=${mathResults.posHuge.vw}, vh=${mathResults.posHuge.vh}`
        );

        record(
            'Unit: Boundary (0, 0) and (15, 15) clamped to minimum 16px safe margin',
            mathResults.b0.x === 16 && mathResults.b0.y === 16 &&
            mathResults.b15.x === 16 && mathResults.b15.y === 16 &&
            mathResults.b16.x === 16 && mathResults.b16.y === 16,
            `b0=(${mathResults.b0.x}, ${mathResults.b0.y}), b15=(${mathResults.b15.x}, ${mathResults.b15.y}), b16=(${mathResults.b16.x}, ${mathResults.b16.y})`
        );

        record(
            'Unit: Adversarial NaN coordinates safely omitted, Infinity clamped to safe margins',
            !mathResults.nanPos.hasX && !mathResults.nanPos.hasY &&
            mathResults.infPos.y === 16 && mathResults.infPos.x <= (mathResults.posHuge.vw - 880 - 16) &&
            typeof mathResults.nanSize.width === 'number' && !isNaN(mathResults.nanSize.width),
            `nanPos=${JSON.stringify(mathResults.nanPos)}, infPos=(${mathResults.infPos.x}, ${mathResults.infPos.y})`
        );

        record(
            'Unit: Oversized dimensions (99999x99999) clamped to viewport max bounds (vw - 32, vh - 32)',
            mathResults.hugeSize.width <= (mathResults.posHuge.vw - 32) &&
            mathResults.hugeSize.height <= (mathResults.posHuge.vh - 32),
            `hugeSize clamped to (${mathResults.hugeSize.width}px, ${mathResults.hugeSize.height}px)`
        );

        record(
            'Unit: Negative dimensions (-500x-500) clamped to min safe dimensions (>=320, >=240)',
            mathResults.negSize.width >= 320 && mathResults.negSize.height >= 240,
            `negSize clamped to (${mathResults.negSize.width}px, ${mathResults.negSize.height}px)`
        );

        /* -------------------------------------------------------------
         * TEST GROUP 2: 4K down to 390x844 Mobile Transition
         * ------------------------------------------------------------- */
        console.log('\n--- GROUP 2: 4K down to 390x844 Mobile Transition Stress ---');

        // Set to 4K resolution (3840 x 2160)
        await page.setViewportSize({ width: 3840, height: 2160 });
        await page.waitForTimeout(50);

        const res4kInit = await page.evaluate(async () => {
            window.localStorage.removeItem('nvui_state_stress_4k');
            const p = window.NVUI.createPanel({
                id: 'stress_4k',
                title: '4K Transition Panel',
                persist: true,
                tabs: [{ key: 'tab1', label: 'Tab 1' }],
            });
            p.open();
            // Set huge size in 4K
            p.setSize(1800, 1200);
            p.flushPersistSave();

            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = panelEl.style.width;
            const styleH = panelEl.style.height;
            const saved = JSON.parse(window.localStorage.getItem('nvui_state_stress_4k'));
            return {
                styleW,
                styleH,
                savedW: saved && saved.size ? saved.size.width : null,
                savedH: saved && saved.size ? saved.size.height : null,
            };
        });

        record(
            '4K Init: Panel sized to 1800x1200 in 4K resolution and saved to localStorage',
            res4kInit.styleW === '1800px' && res4kInit.styleH === '1200px' &&
            res4kInit.savedW === 1800 && res4kInit.savedH === 1200,
            `style=(${res4kInit.styleW}, ${res4kInit.styleH}), saved=(${res4kInit.savedW}, ${res4kInit.savedH})`
        );

        // Now dynamically resize window to 390x844 (iPhone 12/13/14 mobile viewport)
        await page.setViewportSize({ width: 390, height: 844 });
        // Allow requestAnimationFrame and resize handler to execute
        await page.waitForTimeout(100);

        const resMobileTransition = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_4k-layer .nvui-panel');
            if (!panelEl) return { error: 'Panel element not found' };
            const styleW = panelEl.style.width;
            const styleH = panelEl.style.height;
            const rect = panelEl.getBoundingClientRect();
            const cs = window.getComputedStyle(panelEl);

            const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

            return {
                styleW,
                styleH,
                rectW: rect.width,
                rectH: rect.height,
                rectLeft: rect.left,
                rectRight: rect.right,
                rectTop: rect.top,
                rectBottom: rect.bottom,
                csWidth: cs.width,
                csHeight: cs.height,
                closeInBounds: closeRect ? (
                    closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                    closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                ) : false,
                closeRect: closeRect ? { left: closeRect.left, right: closeRect.right, top: closeRect.top, bottom: closeRect.bottom } : null
            };
        });

        record(
            '4K -> Mobile (390x844): Panel resets fixed inline pixels (style.width == "", style.height == "")',
            resMobileTransition.styleW === '' && resMobileTransition.styleH === '',
            `style.width="${resMobileTransition.styleW}", style.height="${resMobileTransition.styleH}"`
        );

        record(
            '4K -> Mobile (390x844): Mobile CSS drawer (width: 100%) applies without horizontal overflow',
            resMobileTransition.rectW <= 390 && resMobileTransition.rectLeft >= 0 && resMobileTransition.rectRight <= 390,
            `measured rectW=${resMobileTransition.rectW}px, rect=(${resMobileTransition.rectLeft}, ${resMobileTransition.rectRight})`
        );

        record(
            '4K -> Mobile (390x844): Close button is strictly within mobile viewport and reachable',
            resMobileTransition.closeInBounds === true,
            `closeRect=${JSON.stringify(resMobileTransition.closeRect)}, viewport=(390x844)`
        );

        // Test closing via click on mobile
        const clickCloseResult = await page.evaluate(async () => {
            const closeBtn = document.querySelector('#stress_4k-layer .nvui-icon-btn:last-child');
            if (!closeBtn) return { error: 'Close button not found' };
            closeBtn.click();
            await new Promise(r => setTimeout(r, 200));
            const overlay = document.querySelector('#stress_4k-overlay');
            return {
                isClosed: overlay.hidden || overlay.classList.contains('is-closing')
            };
        });

        record(
            '4K -> Mobile (390x844): Close button click successfully dismisses panel',
            clickCloseResult.isClosed === true,
            `overlay hidden=${clickCloseResult.isClosed}`
        );

        // Test Re-opening while on 390x844 mobile
        const reopenOnMobile = await page.evaluate(async () => {
            // Clean DOM
            const old = document.querySelector('#stress_4k-layer');
            if (old) old.remove();

            // Recreate panel with existing saved 1800x1200 state in localStorage
            const p = window.NVUI.createPanel({
                id: 'stress_4k',
                title: '4K Transition Panel Reopened',
                persist: true,
                tabs: [{ key: 'tab1', label: 'Tab 1' }],
            });
            p.open();
            await new Promise(r => setTimeout(r, 80));

            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = panelEl.style.width;
            const styleH = panelEl.style.height;
            const rect = panelEl.getBoundingClientRect();
            p.destroy();

            return {
                styleW,
                styleH,
                rectW: rect.width,
            };
        });

        record(
            'Mobile Reopen: Saved 1800x1200 state safely resets inline pixels upon open in mobile (390x844)',
            reopenOnMobile.styleW === '' && reopenOnMobile.styleH === '' && reopenOnMobile.rectW <= 390,
            `styleW="${reopenOnMobile.styleW}", rectW=${reopenOnMobile.rectW}px`
        );

        // Test transition BACK from mobile (390x844) to desktop (1920x1080)
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(100);

        const restoreToDesktop = await page.evaluate(async () => {
            const p = window.NVUI.createPanel({
                id: 'stress_4k',
                title: 'Desktop Reopened',
                persist: true,
                tabs: [{ key: 'tab1', label: 'Tab 1' }],
            });
            p.open();
            await new Promise(r => setTimeout(r, 80));
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = panelEl.style.width;
            const styleH = panelEl.style.height;
            const rect = panelEl.getBoundingClientRect();
            p.destroy();

            return {
                styleW,
                styleH,
                rectW: rect.width,
                rectH: rect.height,
            };
        });

        record(
            'Mobile -> Desktop (1920x1080): Saved state restored and safely clamped to desktop max (1800px <= 1888px)',
            restoreToDesktop.styleW === '1800px' && restoreToDesktop.rectW <= (1920 - 32),
            `styleW="${restoreToDesktop.styleW}", rectW=${restoreToDesktop.rectW}px`
        );

        // Multiple ping-pong transitions (4K -> mobile -> 4K -> mobile)
        console.log('Testing multiple ping-pong 4K <-> mobile transitions...');
        let pingPongPassed = true;
        for (let iter = 0; iter < 3; iter++) {
            await page.setViewportSize({ width: 3840, height: 2160 });
            await page.waitForTimeout(60);
            await page.setViewportSize({ width: 390, height: 844 });
            await page.waitForTimeout(60);
            const check = await page.evaluate(() => {
                const p = window.NVUI.createPanel({ id: 'pingpong_panel', persist: true });
                p.open();
                const panelEl = p.dialog.querySelector('.nvui-panel');
                const ok = panelEl.style.width === '' && panelEl.style.height === '';
                p.destroy();
                return ok;
            });
            if (!check) pingPongPassed = false;
        }

        record(
            'Ping-Pong Stress: Repeated 4K <-> 390x844 transitions consistently reset inline pixels on mobile',
            pingPongPassed,
            `Completed 3 full 4K <-> mobile cycles`
        );

        // Simulated Mobile Mode in isolated page (mocking window.innerWidth = 390 as in test-e2e-v250.js T2-BC-04)
        const simPage = await browser.newPage();
        await simPage.goto(ephemeral.url, { waitUntil: 'domcontentloaded' });
        const simMobileRes = await simPage.evaluate(() => {
            try {
                window.__defineGetter__('innerWidth', () => 390);
            } catch {}

            const clamped = window.NVUI.clampPanelLayout({ width: 1600, height: 1200 });
            const p = window.NVUI.createPanel({
                id: 'sim_mobile_test',
                title: 'Simulated Mobile Panel',
                persist: true,
            });
            p.open();
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const styleW = panelEl ? panelEl.style.width : null;
            p.destroy();

            return {
                isMobile: clamped.isMobile,
                clampedStyleW: clamped.styleWidth,
                panelStyleW: styleW,
            };
        });
        await simPage.close();

        record(
            'Simulated Mobile Mode: window.innerWidth=390 triggers isMobile=true and style.width=""',
            simMobileRes.isMobile === true && simMobileRes.panelStyleW === '',
            `isMobile=${simMobileRes.isMobile}, clampedStyleW="${simMobileRes.clampedStyleW}", panelStyleW="${simMobileRes.panelStyleW}"`
        );

        /* -------------------------------------------------------------
         * TEST GROUP 3: Coordinate Boundary Extremes (In-DOM Stress)
         * ------------------------------------------------------------- */
        console.log('\n--- GROUP 3: Coordinate Boundary Extremes (In-DOM Stress) ---');

        await page.setViewportSize({ width: 1920, height: 1080 });

        // Boundary A: (-500, -500)
        const domNegPos = await page.evaluate(async () => {
            const id = 'stress_pos_neg';
            window.localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
                version: 1,
                size: { width: 880, height: 600 },
                position: { x: -500, y: -500 },
            }));

            const p = window.NVUI.createPanel({
                id: id,
                title: 'Negative Pos Clamping Panel',
                persist: true,
            });
            p.open();
            await new Promise(r => setTimeout(r, 60));

            const panelEl = p.dialog.querySelector('.nvui-panel');
            const rect = panelEl.getBoundingClientRect();
            const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

            p.destroy();

            return {
                rectLeft: rect.left,
                rectTop: rect.top,
                rectRight: rect.right,
                rectBottom: rect.bottom,
                closeInBounds: closeRect ? (
                    closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                    closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                ) : false,
            };
        });

        record(
            'In-DOM: Saved pos (x: -500, y: -500) renders panel inside viewport safe margins (>=16px)',
            domNegPos.rectLeft >= 16 && domNegPos.rectTop >= 16 && domNegPos.closeInBounds,
            `rectLeft=${domNegPos.rectLeft}, rectTop=${domNegPos.rectTop}, closeInBounds=${domNegPos.closeInBounds}`
        );

        // Boundary B: (5000, 5000)
        const domHugePos = await page.evaluate(async () => {
            const id = 'stress_pos_huge';
            window.localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
                version: 1,
                size: { width: 880, height: 600 },
                position: { x: 5000, y: 5000 },
            }));

            const p = window.NVUI.createPanel({
                id: id,
                title: 'Huge Pos Clamping Panel',
                persist: true,
            });
            p.open();
            await new Promise(r => setTimeout(r, 60));

            const panelEl = p.dialog.querySelector('.nvui-panel');
            const rect = panelEl.getBoundingClientRect();
            const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

            p.destroy();

            return {
                rectLeft: rect.left,
                rectTop: rect.top,
                rectRight: rect.right,
                rectBottom: rect.bottom,
                closeInBounds: closeRect ? (
                    closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                    closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                ) : false,
            };
        });

        record(
            'In-DOM: Saved pos (x: 5000, y: 5000) renders panel inside viewport right/bottom safe margins (<=1904px)',
            domHugePos.rectRight <= (1920 - 16) && domHugePos.rectBottom <= (1080 - 16) && domHugePos.closeInBounds,
            `rectRight=${domHugePos.rectRight}, rectBottom=${domHugePos.rectBottom}, closeInBounds=${domHugePos.closeInBounds}`
        );

        /* -------------------------------------------------------------
         * TEST GROUP 4: Dynamic Window Resize While Panel Is Open
         * ------------------------------------------------------------- */
        console.log('\n--- GROUP 4: Dynamic Window Resize While Open Stress ---');

        // Start at 1920x1080, open panel with 1600x900
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(50);

        const dynamicPanelSetup = await page.evaluate(() => {
            window.localStorage.removeItem('nvui_state_stress_dynamic');
            const p = window.NVUI.createPanel({
                id: 'stress_dynamic',
                title: 'Dynamic Resize Panel',
                persist: true,
                tabs: [{ key: 'tab1', label: 'Tab 1' }],
            });
            p.open();
            p.setSize(1600, 900);
            window.__dynamicPanel = p;
            const panelEl = p.dialog.querySelector('.nvui-panel');
            return {
                width: panelEl.style.width,
                height: panelEl.style.height,
            };
        });

        record(
            'Dynamic Resize: Initial 1600x900 panel opened at 1920x1080',
            dynamicPanelSetup.width === '1600px' && dynamicPanelSetup.height === '900px',
            `init width=${dynamicPanelSetup.width}, height=${dynamicPanelSetup.height}`
        );

        // Shrink Step 1: 1400 x 800
        await page.setViewportSize({ width: 1400, height: 800 });
        await page.waitForTimeout(80);
        const shrink1 = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            return { width: panelEl.style.width, height: panelEl.style.height };
        });
        // At 1400x800, maxW = 1400 - 32 = 1368px, maxH = 800 - 32 = 768px
        record(
            'Dynamic Resize: Shrink to 1400x800 dynamically clamps to 1368px x 768px',
            shrink1.width === '1368px' && shrink1.height === '768px',
            `clamped style=(${shrink1.width}, ${shrink1.height})`
        );

        // Shrink Step 2: 1024 x 768
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(80);
        const shrink2 = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            return { width: panelEl.style.width, height: panelEl.style.height };
        });
        // At 1024x768, maxW = 1024 - 32 = 992px, maxH = 768 - 32 = 736px
        record(
            'Dynamic Resize: Shrink to 1024x768 dynamically clamps to 992px x 736px',
            shrink2.width === '992px' && shrink2.height === '736px',
            `clamped style=(${shrink2.width}, ${shrink2.height})`
        );

        // Shrink Step 3: 800 x 600
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(80);
        const shrink3 = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            return { width: panelEl.style.width, height: panelEl.style.height };
        });
        // At 800x600, maxW = 800 - 32 = 768px, maxH = 600 - 32 = 568px
        record(
            'Dynamic Resize: Shrink to 800x600 dynamically clamps to 768px x 568px',
            shrink3.width === '768px' && shrink3.height === '568px',
            `clamped style=(${shrink3.width}, ${shrink3.height})`
        );

        // Shrink Step 4: 600 x 800 (Boundary breakpoint: vw <= 600)
        await page.setViewportSize({ width: 600, height: 800 });
        await page.waitForTimeout(80);
        const shrink4 = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            return { width: panelEl.style.width, height: panelEl.style.height, rectW: panelEl.getBoundingClientRect().width };
        });
        record(
            'Dynamic Resize: Shrink across 600px mobile boundary immediately clears inline styles',
            shrink4.width === '' && shrink4.height === '' && shrink4.rectW <= 600,
            `clamped style=(${shrink4.width}, ${shrink4.height}), measured rectW=${shrink4.rectW}px`
        );

        // Dynamic Resize Step 5: High-frequency fluttering resize
        console.log('Testing high-frequency fluttering resize (30 rapid resize cycles)...');
        const jitterSizes = [
            { width: 1920, height: 1080 },
            { width: 1280, height: 720 },
            { width: 750, height: 1334 },
            { width: 1440, height: 900 },
            { width: 414, height: 896 },
            { width: 1680, height: 1050 },
            { width: 500, height: 900 },
            { width: 1200, height: 800 },
        ];

        for (let i = 0; i < 30; i++) {
            const sz = jitterSizes[i % jitterSizes.length];
            await page.setViewportSize(sz);
            await new Promise(r => setTimeout(r, 10));
        }

        // Final settle size: 1280 x 800
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(150);

        const flutterResult = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            const rect = panelEl.getBoundingClientRect();
            const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

            return {
                styleW: panelEl.style.width,
                styleH: panelEl.style.height,
                rectW: rect.width,
                rectH: rect.height,
                rectRight: rect.right,
                rectBottom: rect.bottom,
                closeInBounds: closeRect ? (
                    closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                    closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                ) : false
            };
        });

        record(
            'Flutter Stress: 30 rapid viewport flips settle cleanly to clamped bounds (<=1248px x <=768px)',
            flutterResult.rectW <= (1280 - 32) && flutterResult.rectH <= (800 - 32) && flutterResult.closeInBounds,
            `settled: rect=(${flutterResult.rectW}px, ${flutterResult.rectH}px), right=${flutterResult.rectRight}, closeInBounds=${flutterResult.closeInBounds}`
        );

        // Maximized Panel Resize Test
        const maxResult = await page.evaluate(async () => {
            const p = window.__dynamicPanel;
            p.setMaximized(true);
            await new Promise(r => setTimeout(r, 60));
            const panelEl = p.dialog.querySelector('.nvui-panel');
            const rect = panelEl.getBoundingClientRect();
            return {
                isMax: panelEl.classList.contains('is-maximized'),
                styleW: panelEl.style.width,
                styleH: panelEl.style.height,
                rectW: rect.width,
                rectH: rect.height,
                expectedW: window.innerWidth - 32,
                expectedH: window.innerHeight - 32,
            };
        });

        const isMaxCalcW = maxResult.styleW.includes('100vw') && maxResult.styleW.includes('32px');
        const isMaxCalcH = maxResult.styleH.includes('100vh') && maxResult.styleH.includes('32px');
        record(
            'Maximized Panel: Dynamically expands to calc(100vw - 32px) and calc(100vh - 32px)',
            maxResult.isMax && isMaxCalcW && isMaxCalcH && Math.abs(maxResult.rectW - maxResult.expectedW) <= 2,
            `styleW="${maxResult.styleW}", rectW=${maxResult.rectW} vs expected=${maxResult.expectedW}`
        );

        // Resize maximized panel to mobile (390x844)
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(80);

        const maxMobileResult = await page.evaluate(() => {
            const panelEl = document.querySelector('#stress_dynamic-layer .nvui-panel');
            return {
                styleW: panelEl.style.width,
                styleH: panelEl.style.height,
                rectW: panelEl.getBoundingClientRect().width,
            };
        });

        record(
            'Maximized Panel on Mobile: Clears inline calc styles so 100% drawer rules govern',
            maxMobileResult.styleW === '' && maxMobileResult.styleH === '' && maxMobileResult.rectW <= 390,
            `mobile styleW="${maxMobileResult.styleW}", rectW=${maxMobileResult.rectW}px`
        );

        // Clean up dynamic panel
        await page.evaluate(() => {
            if (window.__dynamicPanel) window.__dynamicPanel.destroy();
        });

        /* -------------------------------------------------------------
         * TEST GROUP 5: Live SillyTavern Host (127.0.0.1:8000) Stress
         * ------------------------------------------------------------- */
        console.log('\n--- GROUP 5: Live SillyTavern Host (127.0.0.1:8000) Verification ---');

        const liveHostAvailable = await checkLiveHost(HOST_URL);
        if (!liveHostAvailable) {
            console.log('\x1b[33m[SKIP]\x1b[0m SillyTavern live host not reachable at ' + HOST_URL);
        } else {
            console.log(`[CONNECT] Connecting to live SillyTavern host: ${HOST_URL}`);
            const hostPageErrors = [];
            const hostPage = await browser.newPage();
            hostPage.on('pageerror', (err) => {
                hostPageErrors.push(err.message);
                console.error('\x1b[31m[HOST PAGEERROR]\x1b[0m', err.message);
            });

            await hostPage.goto(HOST_URL, { waitUntil: 'domcontentloaded' });

            // Inject latest nvui-api.js and components.css
            const apiCode = fs.readFileSync(path.join(KIT_ROOT, 'nvui-api.js'), 'utf8');
            const cssCode = fs.readFileSync(path.join(KIT_ROOT, 'components.css'), 'utf8');
            await hostPage.addStyleTag({ content: cssCode });
            await hostPage.addScriptTag({ content: apiCode });

            // 1. Live Host 4K to Mobile transition
            await hostPage.setViewportSize({ width: 3840, height: 2160 });
            await hostPage.waitForTimeout(50);

            const host4kRes = await hostPage.evaluate(async () => {
                window.localStorage.removeItem('nvui_state_host_stress');
                const p = window.NVUI.createPanel({
                    id: 'host_stress',
                    title: 'Live Host Stress Panel',
                    persist: true,
                    tabs: [{ key: 'h1', label: 'Host Tab' }],
                });
                p.open();
                p.setSize(1800, 1200);
                p.flushPersistSave();
                window.__hostPanel = p;
                const panelEl = p.dialog.querySelector('.nvui-panel');
                return {
                    width: panelEl.style.width,
                    height: panelEl.style.height,
                };
            });

            record(
                'Live Host: Panel sized to 1800x1200 on 4K SillyTavern workspace',
                host4kRes.width === '1800px' && host4kRes.height === '1200px',
                `style=(${host4kRes.width}, ${host4kRes.height})`
            );

            // Resize Live Host to mobile (390x844)
            await hostPage.setViewportSize({ width: 390, height: 844 });
            await hostPage.waitForTimeout(100);

            const hostMobileRes = await hostPage.evaluate(() => {
                const panelEl = document.querySelector('#host_stress-layer .nvui-panel');
                const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
                const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
                const rect = panelEl.getBoundingClientRect();
                return {
                    styleW: panelEl.style.width,
                    styleH: panelEl.style.height,
                    rectW: rect.width,
                    closeInBounds: closeRect ? (
                        closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                        closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                    ) : false,
                };
            });

            record(
                'Live Host: 4K -> 390x844 transition clears inline styles with 0 pageerrors',
                hostMobileRes.styleW === '' && hostMobileRes.styleH === '' && hostMobileRes.rectW <= 390 && hostMobileRes.closeInBounds,
                `styleW="${hostMobileRes.styleW}", rectW=${hostMobileRes.rectW}px, closeInBounds=${hostMobileRes.closeInBounds}`
            );

            // Test Extreme coordinates on live host
            const hostExtremeRes = await hostPage.evaluate(async () => {
                window.__hostPanel.destroy();

                const id = 'host_extreme_pos';
                window.localStorage.setItem(`nvui_state_${id}`, JSON.stringify({
                    version: 1,
                    size: { width: 900, height: 600 },
                    position: { x: 9999, y: 9999 },
                }));

                const p = window.NVUI.createPanel({
                    id: id,
                    title: 'Host Extreme Pos',
                    persist: true,
                });
                p.open();
                await new Promise(r => setTimeout(r, 60));
                const panelEl = p.dialog.querySelector('.nvui-panel');
                const closeBtn = panelEl.querySelector('.nvui-icon-btn:last-child');
                const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
                const rect = panelEl.getBoundingClientRect();
                p.destroy();

                return {
                    rectW: rect.width,
                    closeInBounds: closeRect ? (
                        closeRect.left >= 0 && closeRect.right <= window.innerWidth &&
                        closeRect.top >= 0 && closeRect.bottom <= window.innerHeight
                    ) : false,
                };
            });

            record(
                'Live Host: Off-screen coordinates (9999, 9999) safely clamped within mobile viewport with accessible close button',
                hostExtremeRes.closeInBounds === true,
                `closeInBounds=${hostExtremeRes.closeInBounds}`
            );

            record(
                'Live Host Stability: 0 pageerrors detected across all host stress tests',
                hostPageErrors.length === 0,
                hostPageErrors.length === 0 ? 'Strict 0 pageerror' : `Errors: ${hostPageErrors.join(', ')}`
            );

            await hostPage.close();
        }

        record(
            'Sandbox Stability: 0 uncaught pageerrors detected in sandbox test harness',
            pageErrors.length === 0,
            pageErrors.length === 0 ? 'Strict 0 pageerror' : `Errors: ${pageErrors.join(', ')}`
        );

    } finally {
        await browser.close();
        ephemeral.server.close();
    }

    /* -------------------------------------------------------------
     * Summary & Verdict
     * ------------------------------------------------------------- */
    console.log('\n\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m   STRESS TEST SUMMARY REPORT\x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');

    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;

    console.log(`Total Assertions: ${total}`);
    console.log(`Passed:           \x1b[32m${passed}\x1b[0m`);
    console.log(`Failed:           \x1b[31m${failed}\x1b[0m`);

    if (failed === 0) {
        console.log('\n\x1b[1m\x1b[32mVERDICT: ALL ADVERSARIAL STRESS TESTS PASSED (APPROVE)\x1b[0m\n');
        process.exit(0);
    } else {
        console.log('\n\x1b[1m\x1b[31mVERDICT: SOME STRESS TESTS FAILED (REJECT)\x1b[0m\n');
        process.exit(1);
    }
})();
