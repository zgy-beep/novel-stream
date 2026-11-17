/**
 * Challenger M4-2: Real SillyTavern Live Host Empirical Verification Suite
 * --------------------------------------------------------------------------
 * Target Host: http://127.0.0.1:8000
 * Requirements verified:
 *   1. Panel opening (!dialog.hidden && dialog.open)
 *   2. Persistence (nvui_state_${id}, debounced write & re-open restoration, clearLayoutState)
 *   3. Theme toggle (.nvui-theme-light on body, sun/moon SVG transition, onThemeChange)
 *   4. Dynamic update pill (panel.showUpdate, WAI-ARIA role="button", tabindex="0", zero 1px solid border, XSS safe)
 *   5. Desktop golden width (computed width === 720px, opts.width, viewport clamping)
 *   6. STRICT 0 pageerrors throughout the entire test run
 */
'use strict';

const path = require('path');
const fs = require('fs');
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
const CHROME = process.env.ST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HOST_URL = process.env.ST_HOST_URL || 'http://127.0.0.1:8000/';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ASSETS = {
    tokensCss: path.join(ROOT_DIR, 'tokens.css'),
    componentsCss: path.join(ROOT_DIR, 'components.css'),
    nvuiApi: path.join(ROOT_DIR, 'nvui-api.js'),
};

const checks = [];
function recordCheck(dimension, name, pass, detail) {
    const item = { dimension, name, pass: !!pass, detail: detail || '' };
    checks.push(item);
    const tag = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${tag} [${dimension}] ${name} ${detail ? '-> ' + detail : ''}`);
    return pass;
}

function probeHostHttp(url) {
    return new Promise((resolve) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port || 80,
            path: u.pathname || '/',
            method: 'GET',
            timeout: 5000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    ok: res.statusCode >= 200 && res.statusCode < 400,
                    bodyLength: data.length,
                });
            });
        });
        req.on('error', (err) => {
            resolve({ statusCode: 0, error: err.message, ok: false });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ statusCode: 0, error: 'Timeout', ok: false });
        });
        req.end();
    });
}

(async () => {
    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m  CHALLENGER M4-2: Real SillyTavern Host Empirical Verification Suite \x1b[0m');
    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');

    // 1. Host Availability & HTTP Probe
    console.log('\n--- 1. Live Host Availability & HTTP Probe ---');
    const httpProbe = await probeHostHttp(HOST_URL);
    recordCheck('PROBE', 'Host HTTP GET http://127.0.0.1:8000/ status 200',
        httpProbe.statusCode === 200,
        `Status: ${httpProbe.statusCode}, BodyLength: ${httpProbe.bodyLength} bytes`
    );

    if (!httpProbe.ok) {
        console.error('\x1b[31m[FATAL] Host is not reachable on http://127.0.0.1:8000/\x1b[0m');
        process.exit(1);
    }

    const browser = await chromium.launch({
        executablePath: CHROME,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
    });

    const pageErrors = [];
    const consoleLogs = [];

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
        pageErrors.push(err.message || String(err));
        console.error('\x1b[31m[BROWSER PAGEERROR]\x1b[0m', err.message);
    });

    page.on('console', (msg) => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') {
            console.warn('\x1b[33m[BROWSER CONSOLE ERROR]\x1b[0m', msg.text());
        }
    });

    console.log('\n--- 2. Loading Live SillyTavern Host & Injecting Kit v2.5.0 ---');
    await page.goto(HOST_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(4000);

    const stReady = await page.evaluate(() => {
        return {
            hasChat: !!document.getElementById('chat'),
            hasExtensionsMenu: !!document.getElementById('extensionsMenuButton'),
            title: document.title,
        };
    });
    recordCheck('HOST', 'SillyTavern DOM readiness',
        stReady.hasChat || stReady.hasExtensionsMenu,
        `title="${stReady.title}", chat=${stReady.hasChat}, extMenu=${stReady.hasExtensionsMenu}`
    );

    // Inject current v2.5.0 tokens, components and nvui-api
    await page.addStyleTag({ path: ASSETS.tokensCss });
    await page.addStyleTag({ path: ASSETS.componentsCss });
    await page.addScriptTag({ path: ASSETS.nvuiApi });

    const kitVersion = await page.evaluate(() => window.NVUI && window.NVUI.version);
    recordCheck('ENV', 'NVUI Kit v2.5.0 loaded in host window',
        kitVersion === '2.5.0',
        `window.NVUI.version === ${kitVersion}`
    );

    // =========================================================================
    // Dimension 1: Panel Opening (!dialog.hidden && dialog.open)
    // =========================================================================
    console.log('\n--- 3. Dimension 1: Panel Opening Verification ---');
    const d1Result = await page.evaluate(async () => {
        const id = 'challenger_d1_open';
        const panel = window.NVUI.createPanel({
            id,
            title: 'Challenger Open Test',
            themeToggle: true,
            actions: [
                { id: 'act1', label: 'Action 1', onClick: () => {} }
            ],
            body: '<p class="challenger-content">Live Host Panel Content</p>',
        });

        const preOpenHidden = panel.dialog.hidden;
        const preOpenOpen = panel.dialog.open;

        panel.open();

        const postOpenHidden = panel.dialog.hidden;
        const postOpenOpen = panel.dialog.open;
        const postOpenDom = !!document.getElementById(`${id}-layer`);
        const isDialogTag = panel.dialog.tagName.toLowerCase() === 'dialog';

        // Check header action ordering: actions -> themeToggle -> closeBtn
        const header = panel.dialog.querySelector('.nvui-panel-header');
        const headerChildren = Array.from(header.querySelectorAll('button, .nvui-theme-toggle, .nvui-panel-close'));
        const hasThemeToggle = !!header.querySelector('.nvui-theme-toggle');
        const hasCloseBtn = !!header.querySelector('.nvui-panel-close');

        // Close with animation wait
        panel.close();
        await new Promise(r => setTimeout(r, 350));
        const postCloseHidden = panel.dialog.hidden;
        const postCloseOpen = panel.dialog.open;

        panel.destroy();
        const postDestroyDom = !document.getElementById(`${id}-layer`);

        return {
            preOpenHidden,
            preOpenOpen,
            postOpenHidden,
            postOpenOpen,
            postOpenDom,
            isDialogTag,
            hasThemeToggle,
            hasCloseBtn,
            postCloseHidden,
            postCloseOpen,
            postDestroyDom,
        };
    });

    recordCheck('D1', 'Panel opens with !dialog.hidden && dialog.open',
        !d1Result.postOpenHidden && d1Result.postOpenOpen,
        `preHidden=${d1Result.preOpenHidden}, postHidden=${d1Result.postOpenHidden}, postOpen=${d1Result.postOpenOpen}`
    );
    recordCheck('D1', 'Panel DOM layer created & cleaned up on destroy',
        d1Result.postOpenDom && d1Result.postDestroyDom,
        `created=${d1Result.postOpenDom}, destroyed=${d1Result.postDestroyDom}`
    );
    recordCheck('D1', 'Panel close sets hidden or !open',
        d1Result.postCloseHidden || !d1Result.postCloseOpen,
        `postCloseHidden=${d1Result.postCloseHidden}, postCloseOpen=${d1Result.postCloseOpen}`
    );

    // =========================================================================
    // Dimension 2: Persistence (nvui_state_${id})
    // =========================================================================
    console.log('\n--- 4. Dimension 2: Persistence Verification ---');
    const d2Result = await page.evaluate(async () => {
        const id = 'challenger_d2_persist';
        const storageKey = `nvui_state_${id}`;

        // Ensure clean state
        window.localStorage.removeItem(storageKey);

        const panel1 = window.NVUI.createPanel({
            id,
            title: 'Persistence Test',
            persist: true,
            tabs: [
                { key: 'tab_a', label: 'Tab A', content: '<div id="content_a">A</div>' },
                { key: 'tab_b', label: 'Tab B', content: '<div id="content_b">B</div>' },
            ],
        });

        panel1.open();
        // Switch to tab_b
        const tabs = panel1.dialog.querySelectorAll('.nvui-tab');
        if (tabs[1]) tabs[1].click();

        // Change size
        panel1.setSize(750, 620);

        // Wait 300ms for 250ms debounced write
        await new Promise(r => setTimeout(r, 350));

        const storedRaw = window.localStorage.getItem(storageKey);
        let stored = null;
        try { stored = JSON.parse(storedRaw); } catch {}

        // Close and destroy first panel
        panel1.close();
        panel1.destroy();

        // Create panel 2 with same id
        const panel2 = window.NVUI.createPanel({
            id,
            title: 'Persistence Test Reopened',
            persist: true,
            tabs: [
                { key: 'tab_a', label: 'Tab A', content: '<div id="content_a">A</div>' },
                { key: 'tab_b', label: 'Tab B', content: '<div id="content_b">B</div>' },
            ],
        });

        panel2.open();

        // Check restored active tab
        const activeTab = panel2.dialog.querySelector('.nvui-tab.is-active');
        const activeTabId = activeTab?.getAttribute('data-tab');

        // Check restored size from panel (not dialog wrapper)
        const restoredWidth = panel2.panel.style.width;
        const restoredHeight = panel2.panel.style.height;

        // Test clearLayoutState
        panel2.clearLayoutState();
        const afterClearKey = window.localStorage.getItem(storageKey);

        panel2.close();
        panel2.destroy();

        return {
            storedRaw,
            storedWidth: stored?.size?.width,
            storedHeight: stored?.size?.height,
            storedTab: stored?.tab,
            activeTabId,
            restoredWidth,
            restoredHeight,
            afterClearKey,
        };
    });

    recordCheck('D2', 'State written to nvui_state_${id} with debouncing',
        !!d2Result.storedRaw && (d2Result.storedWidth === 750 || d2Result.storedWidth === '750px'),
        `stored=${d2Result.storedRaw}`
    );
    recordCheck('D2', 'Active tab state persisted (tab_b)',
        d2Result.storedTab === 'tab_b' && d2Result.activeTabId === 'tab_b',
        `storedTab=${d2Result.storedTab}, restoredActiveTabId=${d2Result.activeTabId}`
    );
    recordCheck('D2', 'Dimensions restored upon re-open (750px x 620px)',
        d2Result.restoredWidth === '750px' && d2Result.restoredHeight === '620px',
        `restoredW=${d2Result.restoredWidth}, restoredH=${d2Result.restoredHeight}`
    );
    recordCheck('D2', 'clearLayoutState removes sandboxed key from localStorage',
        d2Result.afterClearKey === null,
        `afterClearKey=${d2Result.afterClearKey}`
    );

    // =========================================================================
    // Dimension 3: Theme Toggle
    // =========================================================================
    console.log('\n--- 5. Dimension 3: Theme Toggle Verification ---');
    const d3Result = await page.evaluate(async () => {
        const id = 'challenger_d3_theme';
        let themeCallbackValue = null;

        // Reset theme to default dark first
        document.body.classList.remove('nvui-theme-light');

        const panel = window.NVUI.createPanel({
            id,
            title: 'Theme Toggle Test',
            themeToggle: true,
            onThemeChange: (theme) => {
                themeCallbackValue = theme;
            },
        });

        panel.open();

        const toggleBtn = panel.dialog.querySelector('.nvui-theme-toggle');
        const initialHasLightClass = document.body.classList.contains('nvui-theme-light');
        const initialSvgHtml = toggleBtn?.innerHTML || '';

        // Click toggle button -> should switch to light
        toggleBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const lightHasLightClass = document.body.classList.contains('nvui-theme-light');
        const lightCallbackVal = themeCallbackValue;
        const lightSvgHtml = toggleBtn?.innerHTML || '';

        // Click toggle button again -> should switch back to dark
        toggleBtn.click();
        await new Promise(r => setTimeout(r, 100));

        const darkHasLightClass = document.body.classList.contains('nvui-theme-light');
        const darkCallbackVal = themeCallbackValue;
        const darkSvgHtml = toggleBtn?.innerHTML || '';

        panel.close();
        panel.destroy();

        return {
            hasToggleBtn: !!toggleBtn,
            initialHasLightClass,
            lightHasLightClass,
            lightCallbackVal,
            darkHasLightClass,
            darkCallbackVal,
            svgChanged: initialSvgHtml !== lightSvgHtml && lightSvgHtml !== darkSvgHtml,
        };
    });

    recordCheck('D3', 'Theme toggle button exists in header',
        d3Result.hasToggleBtn,
        `hasToggleBtn=${d3Result.hasToggleBtn}`
    );
    recordCheck('D3', 'Clicking theme toggle toggles .nvui-theme-light on document.body',
        !d3Result.initialHasLightClass && d3Result.lightHasLightClass && !d3Result.darkHasLightClass,
        `init=${d3Result.initialHasLightClass}, after1st=${d3Result.lightHasLightClass}, after2nd=${d3Result.darkHasLightClass}`
    );
    recordCheck('D3', 'onThemeChange callback fires with correct theme names',
        d3Result.lightCallbackVal === 'light' && d3Result.darkCallbackVal === 'dark',
        `1st=${d3Result.lightCallbackVal}, 2nd=${d3Result.darkCallbackVal}`
    );
    recordCheck('D3', 'Sun/Moon SVG icon transitions between dark and light themes',
        d3Result.svgChanged,
        `svgChanged=${d3Result.svgChanged}`
    );

    // =========================================================================
    // Dimension 4: Dynamic Update Pill (panel.showUpdate)
    // =========================================================================
    console.log('\n--- 6. Dimension 4: Dynamic Update Pill Verification ---');
    const d4Result = await page.evaluate(async () => {
        const id = 'challenger_d4_update';
        let clickFired = false;

        const panel = window.NVUI.createPanel({
            id,
            title: 'Dynamic Update Pill Test',
        });

        panel.open();

        const prePill = panel.dialog.querySelector('.nvui-update-pill');

        // Dynamically show update
        panel.showUpdate({
            version: 'v2.5.1',
            label: '发现新版本 v2.5.1',
            onClick: () => {
                clickFired = true;
            },
            url: 'https://github.com/SillyTavern/SillyTavern/releases',
        });

        const pill = panel.dialog.querySelector('.nvui-update-pill');
        const titleContainer = panel.dialog.querySelector('.nvui-panel-title');
        const isInsideTitle = titleContainer && titleContainer.contains(pill);

        // A11y checks
        const role = pill?.getAttribute('role');
        const tabindex = pill?.getAttribute('tabindex');
        const ariaLabel = pill?.getAttribute('aria-label');
        const pillText = pill?.textContent?.trim();

        // Style checks: Flat Glass design red line - zero 1px solid border
        const computedStyle = window.getComputedStyle(pill);
        const borderStyle = computedStyle.borderStyle;
        const borderWidth = computedStyle.borderWidth;
        const borderTopWidth = computedStyle.borderTopWidth;
        const outlineStyle = computedStyle.outlineStyle;

        // Click interaction
        pill?.click();

        // Test XSS attempt via malicious label / version
        let xssAlertFired = false;
        const oldAlert = window.alert;
        window.alert = () => { xssAlertFired = true; };

        panel.showUpdate({
            version: '<script>alert(1)</script>',
            label: '<img src="x" onerror="alert(1)">',
        });

        const sanitizedPill = panel.dialog.querySelector('.nvui-update-pill');
        const rawHtmlInPill = sanitizedPill?.innerHTML;
        const hasImgTag = !!sanitizedPill?.querySelector('img');
        const hasScriptTag = !!sanitizedPill?.querySelector('script');

        window.alert = oldAlert;

        panel.close();
        panel.destroy();

        return {
            prePillExists: !!prePill,
            pillExists: !!pill,
            isInsideTitle,
            role,
            tabindex,
            ariaLabel,
            pillText,
            borderStyle,
            borderWidth,
            borderTopWidth,
            outlineStyle,
            clickFired,
            xssAlertFired,
            hasImgTag,
            hasScriptTag,
            rawHtmlInPill,
        };
    });

    recordCheck('D4', 'Pill rendered dynamically inside title area',
        !d4Result.prePillExists && d4Result.pillExists && d4Result.isInsideTitle,
        `pre=${d4Result.prePillExists}, post=${d4Result.pillExists}, insideTitle=${d4Result.isInsideTitle}`
    );
    recordCheck('D4', 'WAI-ARIA compliance: role="button", tabindex="0"',
        d4Result.role === 'button' && d4Result.tabindex === '0',
        `role=${d4Result.role}, tabindex=${d4Result.tabindex}`
    );
    recordCheck('D4', 'Zero 1px solid border (Flat Glass red line)',
        d4Result.borderStyle === 'none' || d4Result.borderWidth === '0px' || d4Result.borderTopWidth === '0px',
        `borderStyle=${d4Result.borderStyle}, borderWidth=${d4Result.borderWidth}`
    );
    recordCheck('D4', 'Click event fires callback on live host',
        d4Result.clickFired,
        `clickFired=${d4Result.clickFired}`
    );
    recordCheck('D4', 'XSS attack safely sanitized (no img/script tags inserted)',
        !d4Result.hasImgTag && !d4Result.hasScriptTag && !d4Result.xssAlertFired,
        `hasImg=${d4Result.hasImgTag}, hasScript=${d4Result.hasScriptTag}, alert=${d4Result.xssAlertFired}`
    );

    // =========================================================================
    // Dimension 5: Desktop Golden Width (720px) & Viewport Clamping
    // =========================================================================
    console.log('\n--- 7. Dimension 5: Desktop Golden Width Verification ---');
    // Ensure viewport is desktop (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });

    const d5Result = await page.evaluate(async () => {
        const idDefault = 'challenger_d5_default';
        const panelDefault = window.NVUI.createPanel({
            id: idDefault,
            title: 'Default 720px Golden Width Test',
        });
        panelDefault.open();

        const defaultRect = panelDefault.panel.getBoundingClientRect();
        const defaultComputed = window.getComputedStyle(panelDefault.panel);
        const defaultComputedW = Math.round(parseFloat(defaultComputed.width));
        const defaultRectW = Math.round(defaultRect.width);

        panelDefault.close();
        panelDefault.destroy();

        // Custom opts.width
        const idCustom = 'challenger_d5_custom';
        const panelCustom = window.NVUI.createPanel({
            id: idCustom,
            title: 'Custom Width 680px Test',
            width: 680,
        });
        panelCustom.open();

        const customRect = panelCustom.panel.getBoundingClientRect();
        const customComputed = window.getComputedStyle(panelCustom.panel);
        const customComputedW = Math.round(parseFloat(customComputed.width));
        const customRectW = Math.round(customRect.width);

        panelCustom.close();
        panelCustom.destroy();

        return {
            defaultComputedW,
            defaultRectW,
            customComputedW,
            customRectW,
        };
    });

    recordCheck('D5', 'Default desktop panel computed width is exactly 720px',
        d5Result.defaultComputedW === 720 || d5Result.defaultRectW === 720,
        `computedWidth=${d5Result.defaultComputedW}px, rectWidth=${d5Result.defaultRectW}px`
    );
    recordCheck('D5', 'Custom opts.width (680px) is respected',
        d5Result.customComputedW === 680 || d5Result.customRectW === 680,
        `computedWidth=${d5Result.customComputedW}px, rectWidth=${d5Result.customRectW}px`
    );

    // Test Viewport Clamping on Mobile screen (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileClampedResult = await page.evaluate(() => {
        const idMobile = 'challenger_d5_mobile';
        const panelMobile = window.NVUI.createPanel({
            id: idMobile,
            title: 'Mobile Clamped Test',
        });
        panelMobile.open();

        const rect = panelMobile.dialog.getBoundingClientRect();
        const fitsInViewport = rect.width <= 390 && rect.right <= 391;

        panelMobile.close();
        panelMobile.destroy();

        return {
            rectWidth: Math.round(rect.width),
            fitsInViewport,
        };
    });

    recordCheck('D5', 'Mobile viewport clamping ensures panel does not exceed viewport',
        mobileClampedResult.fitsInViewport,
        `mobileWidth=${mobileClampedResult.rectWidth}px, fits=${mobileClampedResult.fitsInViewport}`
    );

    // Restore viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // =========================================================================
    // Dimension 6: STRICT 0 Pageerrors
    // =========================================================================
    console.log('\n--- 8. Dimension 6: STRICT 0 Pageerrors Verification ---');
    const pageErrorsZero = pageErrors.length === 0;
    recordCheck('D6', 'STRICT 0 pageerrors during entire test run',
        pageErrorsZero,
        pageErrorsZero ? 'pageErrors.length === 0' : `Caught ${pageErrors.length} errors: ${pageErrors.join('; ')}`
    );

    await context.close();
    await browser.close();

    // =========================================================================
    // Summary & Verdict
    // =========================================================================
    console.log('\n======================================================================');
    console.log('                 CHALLENGER VERIFICATION SUMMARY                      ');
    console.log('======================================================================');

    const total = checks.length;
    const passed = checks.filter(c => c.pass).length;
    const failed = checks.filter(c => !c.pass).length;

    console.log(`Total Checks : ${total}`);
    console.log(`Passed       : ${passed}`);
    console.log(`Failed       : ${failed}`);
    console.log(`Page Errors  : ${pageErrors.length}`);

    if (failed === 0 && pageErrors.length === 0) {
        console.log('\n\x1b[32m\x1b[1mVERDICT: APPROVE\x1b[0m');
        process.exit(0);
    } else {
        console.log('\n\x1b[31m\x1b[1mVERDICT: REJECT\x1b[0m');
        process.exit(1);
    }
})();
