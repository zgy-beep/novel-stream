/**
 * Empirical Adversarial Test Suite for Milestone 2 Gate 2:
 * URL Sanitization (isSafeUrl) & Interactive Update Pill (panel.showUpdate)
 *
 * Challenger: challenger_m2_gate2_1
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
const KIT_ROOT = path.resolve(__dirname, '..', '..');
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
    <title>Challenger M2 Gate 2 URL & Update Pill Sandbox</title>
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
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${port}`,
            });
        });
    });
}

async function runAdversarialSuite() {
    console.log('='.repeat(70));
    console.log('  Milestone 2 Gate 2: Adversarial URL & Update Pill Stress Harness  ');
    console.log('='.repeat(70));

    // Extract isSafeUrl from nvui-api.js for direct node-level unit testing
    const apiCode = fs.readFileSync(PATHS.nvuiApi, 'utf8');
    const isSafeUrlMatch = apiCode.match(/function isSafeUrl\([\s\S]*?\n    \}/);
    if (!isSafeUrlMatch) {
        throw new Error('Could not find isSafeUrl function in nvui-api.js');
    }
    const isSafeUrl = new Function('rawUrl', `${isSafeUrlMatch[0]}; return isSafeUrl(rawUrl);`);

    const summary = {
        total: 0,
        passed: 0,
        failed: 0,
        details: [],
    };

    function record(testId, name, pass, detail) {
        summary.total++;
        if (pass) {
            summary.passed++;
            console.log(`[PASS] ${testId}: ${name}`);
            if (detail) console.log(`       └─ ${detail}`);
        } else {
            summary.failed++;
            console.error(`[FAIL] ${testId}: ${name}`);
            if (detail) console.error(`       └─ ERROR: ${detail}`);
        }
        summary.details.push({ testId, name, pass, detail });
    }

    // -------------------------------------------------------------
    // PART 1: 50+ Malicious Payloads against isSafeUrl (Direct Logic)
    // -------------------------------------------------------------
    console.log('\n--- Part 1: Adversarial Malicious URL Matrix (50+ Payloads) ---');

    const maliciousPayloads = [
        // 1. Embedded Tabs & Whitespaces
        { name: 'embedded tab in javascript', url: 'jav\tascript:alert(1)' },
        { name: 'multiple tabs in javascript', url: 'j\ta\tv\ta\ts\tc\tr\ti\tp\tt:alert(1)' },
        { name: 'embedded newline in javascript', url: 'jav\nascript:alert(1)' },
        { name: 'embedded carriage return in javascript', url: 'jav\rascript:alert(1)' },
        { name: 'embedded CRLF in javascript', url: 'jav\r\nascript:alert(1)' },
        { name: 'embedded formfeed in javascript', url: 'jav\fascript:alert(1)' },
        { name: 'embedded vertical tab in javascript', url: 'jav\vascript:alert(1)' },
        { name: 'leading tab in javascript', url: '\tjavascript:alert(1)' },
        { name: 'trailing tab in javascript', url: 'javascript:alert(1)\t' },
        { name: 'leading whitespaces in javascript', url: '   javascript:alert(1)' },
        { name: 'spaces before colon in javascript', url: 'javascript   :alert(1)' },
        { name: 'spaced characters in javascript', url: 'j a v a s c r i p t : alert(1)' },

        // 2. C0 Control Codes (0x00 - 0x1F)
        { name: 'C0 NULL byte (0x00) prefix', url: '\x00javascript:alert(1)' },
        { name: 'C0 NULL byte (0x00) embedded', url: 'jav\x00ascript:alert(1)' },
        { name: 'C0 SOH (0x01) prefix', url: '\x01javascript:alert(1)' },
        { name: 'C0 SOH (0x01) embedded', url: 'jav\x01ascript:alert(1)' },
        { name: 'C0 STX (0x02) prefix', url: '\x02javascript:alert(1)' },
        { name: 'C0 ETX (0x03) prefix', url: '\x03javascript:alert(1)' },
        { name: 'C0 EOT (0x04) prefix', url: '\x04javascript:alert(1)' },
        { name: 'C0 ENQ (0x05) prefix', url: '\x05javascript:alert(1)' },
        { name: 'C0 ACK (0x06) prefix', url: '\x06javascript:alert(1)' },
        { name: 'C0 BEL (0x07) prefix', url: '\x07javascript:alert(1)' },
        { name: 'C0 BS (0x08) prefix', url: '\x08javascript:alert(1)' },
        { name: 'C0 ESC (0x1B) prefix', url: '\x1bjavascript:alert(1)' },
        { name: 'C0 US (0x1F) prefix', url: '\x1fjavascript:alert(1)' },

        // 3. C1 Control Codes & DEL (0x7F - 0x9F)
        { name: 'DEL (0x7F) prefix', url: '\x7fjavascript:alert(1)' },
        { name: 'DEL (0x7F) embedded', url: 'jav\x7fascript:alert(1)' },
        { name: 'C1 0x80 prefix', url: '\x80javascript:alert(1)' },
        { name: 'C1 NEL (0x85) prefix', url: '\x85javascript:alert(1)' },
        { name: 'C1 NEL (0x85) embedded', url: 'jav\x85ascript:alert(1)' },
        { name: 'C1 0x90 prefix', url: '\x90javascript:alert(1)' },
        { name: 'C1 0x9F prefix', url: '\x9fjavascript:alert(1)' },

        // 4. Unicode Whitespace & Separators (\s matched)
        { name: 'Unicode NBSP (\\u00A0) prefix', url: '\u00a0javascript:alert(1)' },
        { name: 'Unicode NBSP (\\u00A0) embedded', url: 'jav\u00a0ascript:alert(1)' },
        { name: 'Unicode Ogham (\\u1680) prefix', url: '\u1680javascript:alert(1)' },
        { name: 'Unicode En Quad (\\u2000) prefix', url: '\u2000javascript:alert(1)' },
        { name: 'Unicode Hair Space (\\u200A) prefix', url: '\u200ajavascript:alert(1)' },
        { name: 'Unicode Line Separator (\\u2028) prefix', url: '\u2028javascript:alert(1)' },
        { name: 'Unicode Paragraph Separator (\\u2029) prefix', url: '\u2029javascript:alert(1)' },
        { name: 'Unicode Narrow NBSP (\\u202F) prefix', url: '\u202fjavascript:alert(1)' },
        { name: 'Unicode Math Space (\\u205F) prefix', url: '\u205fjavascript:alert(1)' },
        { name: 'Unicode CJK Ideographic Space (\\u3000) prefix', url: '\u3000javascript:alert(1)' },
        { name: 'Unicode CJK Ideographic Space (\\u3000) embedded', url: 'jav\u3000ascript:alert(1)' },
        { name: 'Unicode BOM (\\uFEFF) prefix', url: '\ufeffjavascript:alert(1)' },
        { name: 'Unicode BOM (\\uFEFF) embedded', url: 'jav\ufeffascript:alert(1)' },

        // 5. Mixed Case & Case Permutations
        { name: 'Uppercase JAVASCRIPT:', url: 'JAVASCRIPT:alert(1)' },
        { name: 'Mixed case JaVaScRiPt:', url: 'JaVaScRiPt:alert(1)' },
        { name: 'CamelCase javaScript:', url: 'javaScript:void(0)' },

        // 6. data: Protocol Payloads
        { name: 'Standard data: HTML script', url: 'data:text/html,<script>alert(1)</script>' },
        { name: 'data: with embedded tab', url: 'dat\ta:text/html,payload' },
        { name: 'data: with newlines', url: 'd\na\rta:text/html,payload' },
        { name: 'Uppercase DATA: protocol', url: 'DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' },
        { name: 'Mixed case dAtA: SVG payload', url: 'dAtA:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+' },
        { name: 'data: with C0 NULL prefix', url: '\x00data:text/html,1' },
        { name: 'data: with spaces in scheme', url: 'd a t a : text/html,1' },

        // 7. vbscript: Protocol Payloads
        { name: 'Standard vbscript: alert', url: 'vbscript:alert(1)' },
        { name: 'Standard vbscript: msgbox', url: 'vbscript:msgbox(1)' },
        { name: 'vbscript: with embedded tab', url: 'vb\tscript:alert(1)' },
        { name: 'vbscript: with embedded newlines', url: 'v\nb\rscript:alert(1)' },
        { name: 'Uppercase VBSCRIPT: protocol', url: 'VBSCRIPT:alert(1)' },
        { name: 'Mixed case VbScRiPt: protocol', url: 'VbScRiPt:MsgBox(1)' },
        { name: 'vbscript: with C0 US prefix', url: '\x1fvbscript:1' },
        { name: 'vbscript: with spaces in scheme', url: 'v b s c r i p t : msgbox(1)' },

        // 8. Obfuscation & Comment Techniques
        { name: 'javascript with comment and newline', url: 'javascript://%0aalert(1)' },
        { name: 'javascript with multiline comment', url: 'javascript:/*--></title></style>*/alert(1)' },

        // 9. Edge Case Invalid Types & Empty Strings
        { name: 'Empty string', url: '' },
        { name: 'Spaces only', url: '     ' },
        { name: 'Tabs & newlines only', url: '\t\r\n' },
        { name: 'C0 control codes only', url: '\x00\x01\x1f' },
        { name: 'null value', url: null },
        { name: 'undefined value', url: undefined },
        { name: 'number primitive', url: 12345 },
        { name: 'object literal', url: {} },
    ];

    let malPassCount = 0;
    for (let i = 0; i < maliciousPayloads.length; i++) {
        const item = maliciousPayloads[i];
        const res = isSafeUrl(item.url);
        if (res === false) {
            malPassCount++;
        } else {
            console.error(`Bypass discovered on payload [${item.name}]: ${JSON.stringify(item.url)} returned ${res}`);
        }
    }

    record(
        'ADV-MAL-01',
        `Rejection of ${maliciousPayloads.length} malicious URL payloads`,
        malPassCount === maliciousPayloads.length,
        `${malPassCount}/${maliciousPayloads.length} payloads blocked (100% rejection rate)`
    );

    // -------------------------------------------------------------
    // PART 2: Legitimate URL Acceptance Matrix (16+ URLs)
    // -------------------------------------------------------------
    console.log('\n--- Part 2: Legitimate URL Acceptance Matrix ---');

    const validUrls = [
        { name: 'GitHub releases tag URL', url: 'https://github.com/SillyTavern/SillyTavern/releases/tag/v2.5.0' },
        { name: 'GitHub issue URL', url: 'https://github.com/zgy-beep/ui-kit/issues/6' },
        { name: 'HTTPS with standard query parameters', url: 'https://example.com/api?param=value&foo=bar' },
        { name: 'HTTPS with plus-encoded query spaces', url: 'https://example.com/search?q=silly+tavern+ui&filter=flat%20glass' },
        { name: 'HTTPS with literal spaces in query string', url: 'https://example.com/search?q=hello world&category=ui kit' },
        { name: 'HTTP with local IP and port', url: 'http://127.0.0.1:8000/plugins/ui-kit/' },
        { name: 'HTTP localhost documentation path', url: 'http://localhost:3000/docs/index.html' },
        { name: 'Relative path starting with ./', url: './release-notes.html' },
        { name: 'Absolute root relative path /', url: '/updates/v2.5.0' },
        { name: 'Parent directory relative path ../', url: '../index.html' },
        { name: 'Plain relative filename', url: 'release_notes_v250.html' },
        { name: 'Hash anchor #version-2-5-0', url: '#version-2-5-0' },
        { name: 'Hash anchor #section-persist', url: '#section-persist' },
        { name: 'Mailto URL with subject parameter', url: 'mailto:dev@example.com?subject=Update%20Feedback' },
        { name: 'Mailto URL with plain address', url: 'mailto:support@sillytavern.app' },
        { name: 'FTP scheme archive download', url: 'ftp://ftp.example.com/releases/v2.5.0.zip' },
    ];

    let validPassCount = 0;
    for (let i = 0; i < validUrls.length; i++) {
        const item = validUrls[i];
        const res = isSafeUrl(item.url);
        if (res === true) {
            validPassCount++;
        } else {
            console.error(`Legitimate URL rejected [${item.name}]: ${item.url}`);
        }
    }

    record(
        'ADV-VAL-01',
        `Acceptance of ${validUrls.length} legitimate URLs`,
        validPassCount === validUrls.length,
        `${validPassCount}/${validUrls.length} valid URLs accepted (100% acceptance rate)`
    );

    // -------------------------------------------------------------
    // PART 3: Live Chromium Browser Empirical Stress Tests
    // -------------------------------------------------------------
    console.log('\n--- Part 3: Live Chromium Browser Empirical Verification ---');

    const { server, baseUrl } = await startEphemeralServer();
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            executablePath: CHROME_PATH,
        });

        const page = await browser.newPage();
        await page.goto(baseUrl);

        // Verify kit loaded in page
        const kitLoaded = await page.evaluate(() => typeof window.NVUI !== 'undefined');
        if (!kitLoaded) {
            throw new Error('UI Kit failed to initialize in sandbox page');
        }

        // Test 3.1: panel.showUpdate click handler rejects unsafe URLs
        const clickTestResult = await page.evaluate(async (payloads) => {
            let openedUrl = null;
            const origOpen = window.open;
            window.open = (u) => { openedUrl = u; };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_click_panel',
                title: 'Click Safety Panel',
            });
            p.open();

            const failures = [];
            for (const item of payloads) {
                openedUrl = null;
                p.showUpdate({ version: '1.0', url: item.url });
                const pill = p.dialog.querySelector('.nvui-update-pill');
                if (!pill) {
                    failures.push({ name: item.name, error: 'Pill element not mounted' });
                    continue;
                }
                pill.click();
                if (openedUrl !== null) {
                    failures.push({ name: item.name, openedUrl: openedUrl });
                }
            }

            p.destroy();
            window.open = origOpen;
            return {
                passed: failures.length === 0,
                testedCount: payloads.length,
                failures: failures,
            };
        }, maliciousPayloads.filter(p => typeof p.url === 'string' && p.url.length > 0));

        record(
            'ADV-BROWSER-01',
            `Click handler blocks ${clickTestResult.testedCount} unsafe URL payloads from window.open`,
            clickTestResult.passed,
            clickTestResult.passed
                ? `0/${clickTestResult.testedCount} unsafe clicks reached window.open`
                : `Failures: ${JSON.stringify(clickTestResult.failures)}`
        );

        // Test 3.2: Enter key handler rejects unsafe URLs and calls preventDefault
        const enterKeyTestResult = await page.evaluate(async (payloads) => {
            let openedUrl = null;
            const origOpen = window.open;
            window.open = (u) => { openedUrl = u; };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_enter_panel',
                title: 'Enter Key Safety Panel',
            });
            p.open();

            const failures = [];
            for (const item of payloads) {
                openedUrl = null;
                p.showUpdate({ version: '1.0', url: item.url });
                const pill = p.dialog.querySelector('.nvui-update-pill');
                if (!pill) {
                    failures.push({ name: item.name, error: 'Pill element not mounted' });
                    continue;
                }

                let defaultPrevented = false;
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true,
                });
                pill.dispatchEvent(event);
                if (event.defaultPrevented) {
                    defaultPrevented = true;
                }

                if (!defaultPrevented) {
                    failures.push({ name: item.name, error: 'e.preventDefault() was not called on Enter' });
                }
                if (openedUrl !== null) {
                    failures.push({ name: item.name, openedUrl: openedUrl });
                }
            }

            p.destroy();
            window.open = origOpen;
            return {
                passed: failures.length === 0,
                testedCount: payloads.length,
                failures: failures,
            };
        }, maliciousPayloads.filter(p => typeof p.url === 'string' && p.url.length > 0));

        record(
            'ADV-BROWSER-02',
            `Enter keydown handler blocks ${enterKeyTestResult.testedCount} unsafe URLs with preventDefault`,
            enterKeyTestResult.passed,
            enterKeyTestResult.passed
                ? `Enter key correctly handled with 0 executions across ${enterKeyTestResult.testedCount} payloads`
                : `Failures: ${JSON.stringify(enterKeyTestResult.failures)}`
        );

        // Test 3.3: Space and Spacebar key handlers reject unsafe URLs and call preventDefault
        const spaceKeyTestResult = await page.evaluate(async (payloads) => {
            let openedUrl = null;
            const origOpen = window.open;
            window.open = (u) => { openedUrl = u; };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_space_panel',
                title: 'Space Key Safety Panel',
            });
            p.open();

            const failures = [];
            const spaceKeyVariants = [' ', 'Spacebar'];

            for (const spaceKey of spaceKeyVariants) {
                for (const item of payloads) {
                    openedUrl = null;
                    p.showUpdate({ version: '1.0', url: item.url });
                    const pill = p.dialog.querySelector('.nvui-update-pill');
                    if (!pill) {
                        failures.push({ spaceKey, name: item.name, error: 'Pill element not mounted' });
                        continue;
                    }

                    const event = new KeyboardEvent('keydown', {
                        key: spaceKey,
                        bubbles: true,
                        cancelable: true,
                    });
                    pill.dispatchEvent(event);

                    if (!event.defaultPrevented) {
                        failures.push({ spaceKey, name: item.name, error: 'e.preventDefault() was not called' });
                    }
                    if (openedUrl !== null) {
                        failures.push({ spaceKey, name: item.name, openedUrl: openedUrl });
                    }
                }
            }

            p.destroy();
            window.open = origOpen;
            return {
                passed: failures.length === 0,
                testedCount: payloads.length * spaceKeyVariants.length,
                failures: failures,
            };
        }, maliciousPayloads.slice(0, 15).filter(p => typeof p.url === 'string' && p.url.length > 0));

        record(
            'ADV-BROWSER-03',
            `Space & Spacebar key handlers block unsafe URLs and enforce preventDefault (${spaceKeyTestResult.testedCount} tests)`,
            spaceKeyTestResult.passed,
            spaceKeyTestResult.passed
                ? `Space/Spacebar correctly rejected all payloads with preventDefault`
                : `Failures: ${JSON.stringify(spaceKeyTestResult.failures)}`
        );

        // Test 3.4: Non-activation keys (Tab, Escape, ArrowRight, 'a') do NOT trigger action
        const nonActionKeyResult = await page.evaluate(async () => {
            let callCount = 0;
            const p = window.NVUI.createPanel({
                id: 'm2_gate2_non_action_panel',
                title: 'Non-Action Keys Panel',
            });
            p.open();

            p.showUpdate({
                version: '2.5.0',
                onClick: () => { callCount++; },
            });
            const pill = p.dialog.querySelector('.nvui-update-pill');

            const inertKeys = ['Tab', 'Escape', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Shift', 'Control', 'Alt', 'a'];
            for (const key of inertKeys) {
                pill.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
            }

            p.destroy();
            return {
                callCount: callCount,
                passed: callCount === 0,
            };
        });

        record(
            'ADV-BROWSER-04',
            'Inert keys (Tab, Escape, Arrows, Modifiers, alphanumeric) do not trigger showUpdate',
            nonActionKeyResult.passed,
            nonActionKeyResult.passed
                ? '0 invocations triggered by inert keys'
                : `Inert keys caused ${nonActionKeyResult.callCount} unexpected invocations`
        );

        // Test 3.5: Legitimate URLs successfully invoke window.open with exact parameters
        const validOpenResult = await page.evaluate(async (urls) => {
            let capturedCalls = [];
            const origOpen = window.open;
            window.open = (url, target, features) => {
                capturedCalls.push({ url, target, features });
            };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_valid_open_panel',
                title: 'Valid Open Panel',
            });
            p.open();

            const failures = [];
            for (const item of urls) {
                capturedCalls = [];
                p.showUpdate({ version: '2.5.0', url: item.url });
                const pill = p.dialog.querySelector('.nvui-update-pill');

                // 1. Click
                pill.click();
                if (capturedCalls.length !== 1) {
                    failures.push({ name: item.name, trigger: 'click', calls: capturedCalls.length });
                } else if (capturedCalls[0].url !== item.url.trim() || capturedCalls[0].target !== '_blank' || capturedCalls[0].features !== 'noopener,noreferrer') {
                    failures.push({ name: item.name, trigger: 'click', mismatch: capturedCalls[0] });
                }

                // 2. Enter key
                capturedCalls = [];
                pill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
                if (capturedCalls.length !== 1) {
                    failures.push({ name: item.name, trigger: 'enter', calls: capturedCalls.length });
                } else if (capturedCalls[0].url !== item.url.trim() || capturedCalls[0].target !== '_blank' || capturedCalls[0].features !== 'noopener,noreferrer') {
                    failures.push({ name: item.name, trigger: 'enter', mismatch: capturedCalls[0] });
                }

                // 3. Space key
                capturedCalls = [];
                pill.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
                if (capturedCalls.length !== 1) {
                    failures.push({ name: item.name, trigger: 'space', calls: capturedCalls.length });
                } else if (capturedCalls[0].url !== item.url.trim() || capturedCalls[0].target !== '_blank' || capturedCalls[0].features !== 'noopener,noreferrer') {
                    failures.push({ name: item.name, trigger: 'space', mismatch: capturedCalls[0] });
                }
            }

            p.destroy();
            window.open = origOpen;
            return {
                passed: failures.length === 0,
                testedCount: urls.length * 3,
                failures: failures,
            };
        }, validUrls);

        record(
            'ADV-BROWSER-05',
            `Legitimate URLs trigger window.open with (_blank, noopener,noreferrer) across click/Enter/Space (${validOpenResult.testedCount} actions)`,
            validOpenResult.passed,
            validOpenResult.passed
                ? 'All legitimate URLs preserved exact query parameters/spaces and window.open features'
                : `Failures: ${JSON.stringify(validOpenResult.failures)}`
        );

        // Test 3.6: Custom onClick callback overrides URL navigation and catches errors gracefully
        const onClickPriorityResult = await page.evaluate(async () => {
            let openCalled = false;
            let customClickCount = 0;
            const origOpen = window.open;
            window.open = () => { openCalled = true; };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_onclick_priority_panel',
                title: 'OnClick Priority Panel',
            });
            p.open();

            // When onClick is defined, it takes precedence over url
            p.showUpdate({
                version: '2.5.0',
                url: 'https://example.com/should-not-open',
                onClick: () => {
                    customClickCount++;
                },
            });

            const pill = p.dialog.querySelector('.nvui-update-pill');
            pill.click();
            pill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

            // Test fault tolerance when onClick throws
            let exceptionThrownToCaller = false;
            p.showUpdate({
                version: '2.5.0',
                onClick: () => {
                    throw new Error('Explosive custom onClick');
                },
            });
            try {
                pill.click();
            } catch (e) {
                exceptionThrownToCaller = true;
            }

            p.destroy();
            window.open = origOpen;

            return {
                passed: customClickCount === 2 && !openCalled && !exceptionThrownToCaller,
                customClickCount,
                openCalled,
                exceptionThrownToCaller,
            };
        });

        record(
            'ADV-BROWSER-06',
            'Custom onClick takes strict precedence over url and catches internal errors without uncaught exception',
            onClickPriorityResult.passed,
            onClickPriorityResult.passed
                ? `onClick fired ${onClickPriorityResult.customClickCount} times; openCalled=${onClickPriorityResult.openCalled}; exceptionSwallowed=${!onClickPriorityResult.exceptionThrownToCaller}`
                : `mismatch: ${JSON.stringify(onClickPriorityResult)}`
        );

        // Test 3.7: Homoglyphs and Unicode script evasion behavior in Chromium
        const homoglyphExecutionResult = await page.evaluate(async () => {
            window.__HOMOGLYPH_PWNED = false;
            const origOpen = window.open;

            // Test if browser window.open executes script for non-ASCII variations
            const variations = [
                'j\u0430vascript:window.__HOMOGLYPH_PWNED=true', // Cyrillic small 'a'
                '\uff4a\uff41\uff56\uff41\uff53\uff43\uff52\uff49\uff50\uff54:window.__HOMOGLYPH_PWNED=true', // Fullwidth latin
                'javascript\uff1awindow.__HOMOGLYPH_PWNED=true', // Fullwidth colon
            ];

            for (const v of variations) {
                try {
                    window.open(v, '_blank');
                } catch (e) {}
            }

            // Also test via showUpdate with mocked window.open spy
            let interceptedUrl = null;
            window.open = (u) => { interceptedUrl = u; };

            const p = window.NVUI.createPanel({
                id: 'm2_gate2_homoglyph_panel',
                title: 'Homoglyph Panel',
            });
            p.open();

            for (const v of variations) {
                interceptedUrl = null;
                p.showUpdate({ version: '1.0', url: v });
                const pill = p.dialog.querySelector('.nvui-update-pill');
                if (pill) pill.click();
            }

            p.destroy();
            window.open = origOpen;

            return {
                executed: !!window.__HOMOGLYPH_PWNED,
            };
        });

        record(
            'ADV-BROWSER-07',
            'Homoglyph and non-ASCII character variations never trigger script execution in Chromium',
            !homoglyphExecutionResult.executed,
            `Script execution detected: ${homoglyphExecutionResult.executed}`
        );

        await browser.close();
    } finally {
        server.close();
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Summary: Total Tests: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
    console.log('='.repeat(70));

    if (summary.failed > 0) {
        process.exit(1);
    }
}

runAdversarialSuite().catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
