/**
 * v2.9.0 / GH-#18 B3 回归：persist.size: 'width-only'
 * ---------------------------------------------------------------------------
 * 「定宽 + 高度自适应」是下游高频诉求（#16 正是它的误用形态）。新增第三态：
 *   true         → 宽高 + 最大化全量持久化（既有行为，不动）
 *   false        → 完全不参与尺寸持久化（#16 语义，不动）
 *   'width-only' → 只记宽；height 恒为 null，最大化不记（最大化本质是二维状态）
 *
 * 覆盖：
 *   W1  历史存档带 height：打开后只回写宽，不写内联 height（下游 94vh 生效）
 *   W2  落盘：size.height === null、isMaximized === false、width 是数字
 *   W3  往返：重新打开仍只回写宽（不会因为一次 flush 就把 height 补回来）
 *   W4  回归 true：persist.size:true 照常恢复宽高（未受 B3 影响）
 *   W5  回归 false：persist.size:false 仍写 size:null（#16 未被绕过）
 *   W6  内联 px 仍被钳制：setSize() 的显式高度不因 width-only 而被丢掉
 *   W7  非法值 'widthOnly' 按 true 处理（手滑不静默丢尺寸）
 *   W8  setLayoutState 在 width-only 下把导入的 height 强制 null
 *   W9  全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-width-only.spec.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const browserDeps = require('../scripts/resolve-browser');
const { chromium } = browserDeps.requirePlaywright();

const KIT_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = browserDeps.requireChrome();

const PATHS = {
    tokensCss: path.join(KIT_ROOT, 'tokens.css'),
    componentsCss: path.join(KIT_ROOT, 'components.css'),
    nvuiApi: path.join(KIT_ROOT, 'nvui-api.js'),
};

function startEphemeralServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = req.url.split('?')[0];
            if (url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
            if (url === '/' || url === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NVUI v2.9.0 B3 width-only</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body>
    <div id="host-fixture">宿主聊天区</div>
    <script src="/nvui-api.js"></script>
</body>
</html>`);
                return;
            }
            let filePath = null;
            let mimeType = 'text/plain';
            if (url === '/tokens.css') { filePath = PATHS.tokensCss; mimeType = 'text/css'; }
            else if (url === '/components.css') { filePath = PATHS.componentsCss; mimeType = 'text/css'; }
            else if (url === '/nvui-api.js') { filePath = PATHS.nvuiApi; mimeType = 'application/javascript'; }
            if (filePath && fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': mimeType + '; charset=utf-8' });
                res.end(fs.readFileSync(filePath));
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });
        server.listen(0, '127.0.0.1', () => {
            resolve({
                server,
                url: 'http://127.0.0.1:' + server.address().port + '/',
                close: () => new Promise((r) => server.close(r)),
            });
        });
    });
}

const results = [];
function record(id, name, pass, detail, ms) {
    results.push({ id, name, pass: !!pass, detail: detail || '' });
    const tag = pass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(tag + ' ' + id + ': ' + name + ' \x1b[90m(' + ms + 'ms)\x1b[0m');
    if (detail) console.log('       \x1b[90m└─ ' + detail + '\x1b[0m');
}

(async () => {
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  v2.9.0 B3 · persist.size: \'width-only\'                    \x1b[0m');
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
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/favicon/i.test(m.text())) return;
        consoleErrors.push(m.text());
    });

    await page.goto(sandbox.url, { waitUntil: 'domcontentloaded' });

    const ready = await page.evaluate(() => typeof window.NVUI === 'object'
        && window.NVUI !== null && typeof window.NVUI.createPanel === 'function');
    if (!ready) {
        console.error('[FATAL] NVUI 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__seed = (id, state) => localStorage.setItem('nvui_state_' + id, JSON.stringify(state));
        window.__saved = (id) => {
            try { return JSON.parse(localStorage.getItem('nvui_state_' + id) || 'null'); }
            catch (e) { return 'PARSE_ERROR'; }
        };
        window.__setToken = (name, value) => document.documentElement.style.setProperty(name, value);
        window.__open = (opts) => {
            const p = NVUI.createPanel(opts);
            p.open();
            return p;
        };
        /* 下游典型做法：高度交给自己的 CSS 变量（1440x900 下 94vh = 846px） */
        window.__setToken('--nvui-panel-max-h', '94vh');
        window.__stale = { width: 700, height: 500, isMaximized: false };
    });

    const run = async (id, name, fn) => {
        const t0 = Date.now();
        try {
            const res = await page.evaluate(fn);
            record(id, name, res && res.pass, res && res.detail, Date.now() - t0);
            return !!(res && res.pass);
        } catch (err) {
            record(id, name, false, '抛错: ' + (err && err.message), Date.now() - t0);
            return false;
        }
    };

    // ------------------------------------------------------------------ W1
    await run('W1', '历史存档带 height：只回写宽度，不写内联 height（下游 94vh 生效）', () => {
        localStorage.clear();
        window.__seed('w1', { version: 1, size: window.__stale, tab: null, accordion: null });
        const p = window.__open({ id: 'w1', title: 'W1', persist: { size: 'width-only' } });
        window.__p = p;
        return window.__wait(140).then(() => {
            const rect = p.panel.getBoundingClientRect();
            return {
                pass: p.panel.style.getPropertyValue('--nvui-panel-w') === '700px'
                    && p.panel.style.getPropertyValue('--nvui-panel-h') === ''
                    && Math.abs(Math.round(rect.height) - Math.round(window.innerHeight * 0.94)) <= 2,
                detail: JSON.stringify({
                    inlineWidth: p.panel.style.getPropertyValue('--nvui-panel-w'),
                    inlineHeight: p.panel.style.getPropertyValue('--nvui-panel-h'),
                    rectHeight: Math.round(rect.height),
                    expected: Math.round(window.innerHeight * 0.94),
                }),
            };
        });
    });

    // ------------------------------------------------------------------ W2
    await run('W2', '落盘：size.height === null、isMaximized === false、width 是数字', () => {
        const p = window.__p;
        p.flushPersistSave(true);
        return window.__wait(80).then(() => {
            const saved = window.__saved('w1');
            return {
                pass: !!saved && !!saved.size
                    && saved.size.h === null
                    && saved.size.mode === 'width-only'
                    && saved.size.w === 700,
                detail: JSON.stringify(saved),
            };
        });
    });

    // ------------------------------------------------------------------ W3
    await run('W3', '往返：重新打开仍只回写宽（一次 flush 不会把 height 补回来）', () => {
        const p = window.__p;
        p.destroy();
        return window.__wait(260).then(() => {
            const q = window.__open({ id: 'w1', title: 'W1 again', persist: { size: 'width-only' } });
            return window.__wait(140).then(() => {
                const out = {
                    pass: q.panel.style.getPropertyValue('--nvui-panel-h') === '' && q.panel.style.getPropertyValue('--nvui-panel-w') === '700px',
                    detail: JSON.stringify({
                        inlineWidth: q.panel.style.getPropertyValue('--nvui-panel-w'),
                        inlineHeight: q.panel.style.getPropertyValue('--nvui-panel-h'),
                        saved: window.__saved('w1'),
                    }),
                };
                q.destroy();
                return out;
            });
        });
    });

    // ------------------------------------------------------------------ W4
    await run('W4', '回归 true：persist.size:true 照常恢复宽高', () => {
        localStorage.clear();
        window.__seed('w4', { version: 1, size: window.__stale, tab: null, accordion: null });
        const p = window.__open({ id: 'w4', title: 'W4', persist: { size: true } });
        return window.__wait(140).then(() => {
            const out = {
                pass: p.panel.style.getPropertyValue('--nvui-panel-w') === '700px' && p.panel.style.getPropertyValue('--nvui-panel-h') === '500px',
                detail: JSON.stringify({
                    inlineWidth: p.panel.style.getPropertyValue('--nvui-panel-w'),
                    inlineHeight: p.panel.style.getPropertyValue('--nvui-panel-h'),
                }),
            };
            p.destroy();
            return out;
        });
    });

    // ------------------------------------------------------------------ W5
    await run('W5', '回归 false：persist.size:false 仍写 size:null（#16 未被绕过）', () => {
        localStorage.clear();
        window.__seed('w5', { version: 1, size: window.__stale, tab: null, accordion: null });
        const p = window.__open({ id: 'w5', title: 'W5', persist: { size: false, tab: true } });
        return window.__wait(140).then(() => {
            p.flushPersistSave(true);
            return window.__wait(80).then(() => {
                const saved = window.__saved('w5');
                const out = {
                    pass: p.panel.style.getPropertyValue('--nvui-panel-h') === '' && !!saved && saved.size === null,
                    detail: JSON.stringify({ inlineHeight: p.panel.style.getPropertyValue('--nvui-panel-h'), saved: saved }),
                };
                p.destroy();
                return out;
            });
        });
    });

    // ------------------------------------------------------------------ W6
    await run('W6', '内联 px 仍被钳制：setSize() 的显式高度不因 width-only 被丢掉', () => {
        localStorage.clear();
        const p = window.__open({ id: 'w6', title: 'W6', persist: { size: 'width-only' } });
        p.setSize(900, 700);
        return window.__wait(140).then(() => {
            const h = parseInt(p.panel.style.getPropertyValue('--nvui-panel-h'), 10);
            const out = {
                pass: p.panel.style.getPropertyValue('--nvui-panel-w') === '900px' && !isNaN(h) && h > 0 && h <= window.innerHeight - 32,
                detail: JSON.stringify({
                    inlineWidth: p.panel.style.getPropertyValue('--nvui-panel-w'),
                    inlineHeight: p.panel.style.getPropertyValue('--nvui-panel-h'),
                    viewportH: window.innerHeight,
                }),
            };
            p.destroy();
            return out;
        });
    });

    // ------------------------------------------------------------------ W7
    await run('W7', "非法值 'widthOnly' 按 true 处理（不静默丢尺寸）", () => {
        localStorage.clear();
        window.__seed('w7', { version: 1, size: window.__stale, tab: null, accordion: null });
        const p = window.__open({ id: 'w7', title: 'W7', persist: { size: 'widthOnly' } });
        return window.__wait(140).then(() => {
            const out = {
                pass: p.panel.style.getPropertyValue('--nvui-panel-h') === '500px',
                detail: JSON.stringify({
                    inlineHeight: p.panel.style.getPropertyValue('--nvui-panel-h'),
                    saved: window.__saved('w7'),
                }),
            };
            p.destroy();
            return out;
        });
    });

    // ------------------------------------------------------------------ W8
    await run('W8', 'setLayoutState 在 width-only 下把导入的 height 强制 null', () => {
        localStorage.clear();
        const p = window.__open({ id: 'w8', title: 'W8', persist: { size: 'width-only' } });
        const applied = p.setLayoutState({ size: { width: 640, height: 480, isMaximized: true } });
        return window.__wait(420).then(() => {
            const saved = window.__saved('w8');
            const out = {
                pass: !!applied && !!applied.size
                    && applied.size.w === 640
                    && applied.size.h === null
                    && applied.size.mode === 'width-only'
                    && !!saved && !!saved.size
                    && saved.size.h === null && saved.size.mode === 'width-only',
                detail: JSON.stringify({ applied: applied, saved: saved }),
            };
            p.destroy();
            return out;
        });
    });

    // ------------------------------------------------------------------ W9
    await new Promise((r) => setTimeout(r, 200));
    record('W9', '全程 0 pageerror / 0 console error',
        pageErrors.length === 0 && consoleErrors.length === 0,
        JSON.stringify({ pageErrors, consoleErrors }), 0);

    await browser.close();
    await sandbox.close();

    const failed = results.filter((r) => !r.pass);
    console.log('\n\x1b[1m------------------------------------------------------------\x1b[0m');
    if (failed.length) {
        console.log(`\x1b[31m  结果: ${results.length - failed.length}/${results.length} PASS\x1b[0m`);
        failed.forEach((f) => console.log('   \x1b[31mFAIL ' + f.id + ' ' + f.name + '  ' + f.detail + '\x1b[0m'));
        process.exit(1);
    }
    console.log(`\x1b[32m  结果: ${results.length}/${results.length} PASS\x1b[0m`);
    console.log('\x1b[1m------------------------------------------------------------\x1b[0m');
})().catch((err) => {
    console.error('[FATAL] ' + (err && err.stack || err));
    process.exit(1);
});
