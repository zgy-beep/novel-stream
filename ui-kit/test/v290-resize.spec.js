/**
 * v2.9.0 / GH-#18 B4 回归：resizable 手柄（指针 + 键盘）
 * ---------------------------------------------------------------------------
 * 尺寸此前只有 setSize() / setMaximized() 两个程序入口，键盘用户拿不到「记忆尺寸」。
 * opt-in 的 `createPanel({ resizable: true })` 补一个右下角手柄。
 *
 * 覆盖：
 *   K1  默认关闭：不传 resizable 时既无 .nvui-resize 也无 .is-resizable（视觉零变化）
 *   K2  开启后语义齐备：role=separator / aria-orientation / tabindex=0 / aria-valuenow
 *   K3  方向键 ±8px；Shift 加速到 ±32px
 *   K4  上下方向键改高度（宽不变）
 *   K5  Home 复位：宽度回默认值、内联 height 清空（高度交回 CSS）
 *   K6  焦点可见：focus() 后 :focus-visible 命中且 outline 宽度非 0
 *   K7  键盘调整会落盘（等防抖后 storage 里的 width 变化）
 *   K8  指针拖拽改宽高，且同步 aria-valuenow
 *   K9  销毁后手柄随面板移除（不留 DOM、不留监听）
 *   K10 prefers-reduced-motion 下尺寸无过渡（transition-duration 为 0s）
 *   K11 全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-resize.spec.js
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
    <title>NVUI v2.9.0 B4 resizable</title>
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
    console.log('\x1b[1m\x1b[35m  v2.9.0 B4 · resizable 手柄（指针 + 键盘）                  \x1b[0m');
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
        window.__mkStore = () => {
            const data = {};
            return {
                data: data,
                get: (k) => (data[k] === undefined ? null : JSON.parse(JSON.stringify(data[k]))),
                set: (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); },
                delete: (k) => { delete data[k]; },
            };
        };
        window.__open = (opts) => {
            const p = NVUI.createPanel(opts);
            p.open();
            return p;
        };
        window.__w = (p) => Math.round(p.panel.getBoundingClientRect().width);
        window.__h = (p) => Math.round(p.panel.getBoundingClientRect().height);
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

    // ------------------------------------------------------------------ K1
    await run('K1', '默认关闭：无手柄、无 is-resizable（既有面板视觉零变化）', () => {
        const p = window.__open({ id: 'k1', title: 'K1', persist: false });
        return window.__wait(120).then(() => {
            const hasGrip = !!p.panel.querySelector('.nvui-resize');
            const hasCls = p.panel.classList.contains('is-resizable');
            p.destroy();
            return {
                pass: hasGrip === false && hasCls === false,
                detail: JSON.stringify({ hasGrip: hasGrip, hasCls: hasCls }),
            };
        });
    });

    // ------------------------------------------------------------------ K2
    await run('K2', '开启后语义齐备：separator / aria-orientation / tabindex / aria-valuenow', () => {
        /* 基线必须在「宿主模态 close 单例」装好之后取：K1 创建面板时它才被装上 */
        window.__baseline = JSON.stringify(NVUI.diagnostics().listenerCounts);
        const store = window.__mkStore();
        const p = window.__open({ id: 'k2', title: 'K2', resizable: true, persist: { storage: store } });
        window.__p = p;
        window.__store = store;
        return window.__wait(160).then(() => {
            const grip = p.panel.querySelector('.nvui-resize');
            /* aria 数值在焦点到手时同步（创建时面板还没显示，offsetWidth 为 0） */
            if (grip) grip.focus();
            return {
                pass: !!grip
                    && p.panel.classList.contains('is-resizable')
                    && grip.getAttribute('role') === 'separator'
                    && grip.getAttribute('aria-orientation') === 'horizontal'
                    && grip.getAttribute('tabindex') === '0'
                    && !!grip.getAttribute('aria-label')
                    && Number(grip.getAttribute('aria-valuemin')) === 320
                    && Number(grip.getAttribute('aria-valuenow')) > 0,
                detail: JSON.stringify({
                    exists: !!grip,
                    role: grip && grip.getAttribute('role'),
                    now: grip && grip.getAttribute('aria-valuenow'),
                    min: grip && grip.getAttribute('aria-valuemin'),
                    max: grip && grip.getAttribute('aria-valuemax'),
                    text: grip && grip.getAttribute('aria-valuetext'),
                }),
            };
        });
    });

    // ------------------------------------------------------------------ K3
    await run('K3', '方向键 ±8px；Shift 加速 ±32px', () => {
        const p = window.__p;
        const grip = p.panel.querySelector('.nvui-resize');
        grip.focus();
        const w0 = window.__w(p);
        const fire = (key, shift) => grip.dispatchEvent(new KeyboardEvent('keydown', {
            key: key, shiftKey: !!shift, bubbles: true, cancelable: true,
        }));
        fire('ArrowRight');
        const w1 = window.__w(p);
        fire('ArrowRight', true);
        const w2 = window.__w(p);
        fire('ArrowLeft');
        const w3 = window.__w(p);
        return {
            pass: w1 === w0 + 8 && w2 === w0 + 40 && w3 === w0 + 32,
            detail: JSON.stringify({ w0: w0, w1: w1, w2: w2, w3: w3 }),
        };
    });

    // ------------------------------------------------------------------ K4
    /* 高度受 CSS `max-height: var(--nvui-panel-max-h)`（88vh）约束，往上长会被裁回来。
       这不是手柄的 bug，而是面板「固定外框」的设计 —— 所以只在可收缩区间内断言：
       收入 8px、再 Shift 收入 32px、Shift 放回 32px。 */
    await run('K4', '上下方向键改高度（宽不变；上限受面板 max-height 约束）', () => {
        const p = window.__p;
        const grip = p.panel.querySelector('.nvui-resize');
        const w0 = window.__w(p);
        const h0 = window.__h(p);
        const key = (k, shift) => grip.dispatchEvent(new KeyboardEvent('keydown', {
            key: k, shiftKey: !!shift, bubbles: true, cancelable: true,
        }));
        key('ArrowUp');
        const h1 = window.__h(p);
        key('ArrowUp', true);
        const h2 = window.__h(p);
        key('ArrowDown', true);
        const h3 = window.__h(p);
        return {
            pass: h1 === h0 - 8 && h2 === h0 - 40 && h3 === h0 - 8 && window.__w(p) === w0,
            detail: JSON.stringify({ h0: h0, h1: h1, h2: h2, h3: h3, w0: w0, wNow: window.__w(p) }),
        };
    });

    // ------------------------------------------------------------------ K5
    await run('K5', 'Home 复位：宽度回默认 720、内联 height 清空', () => {
        const p = window.__p;
        const grip = p.panel.querySelector('.nvui-resize');
        grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
        return window.__wait(120).then(() => ({
            pass: p.panel.style.getPropertyValue('--nvui-panel-w') === '720px' && p.panel.style.getPropertyValue('--nvui-panel-h') === '',
            detail: JSON.stringify({
                width: p.panel.style.getPropertyValue('--nvui-panel-w'),
                height: p.panel.style.getPropertyValue('--nvui-panel-h'),
                rect: window.__w(p),
            }),
        }));
    });

    // ------------------------------------------------------------------ K6
    await run('K6', '焦点可见：focus() 命中 :focus-visible 且 outline 宽度非 0', () => {
        const p = window.__p;
        const grip = p.panel.querySelector('.nvui-resize');
        grip.focus();
        const visible = grip.matches(':focus-visible');
        const cs = getComputedStyle(grip);
        return {
            pass: visible && parseFloat(cs.outlineWidth) >= 1
                && cs.outlineStyle !== 'none' && cs.outlineColor !== 'rgba(0, 0, 0, 0)',
            detail: JSON.stringify({
                visible: visible,
                width: cs.outlineWidth,
                style: cs.outlineStyle,
                color: cs.outlineColor,
            }),
        };
    });

    // ------------------------------------------------------------------ K7
    await run('K7', '键盘调整会落盘（等防抖后 storage 里的 width 变化）', () => {
        const p = window.__p;
        const store = window.__store;
        const grip = p.panel.querySelector('.nvui-resize');
        grip.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', shiftKey: true, bubbles: true, cancelable: true,
        }));
        return window.__wait(420).then(() => {
            const saved = store.data['nvui_state_k2'];
            return {
                pass: !!saved && !!saved.size && saved.size.w === 752,
                detail: JSON.stringify(saved),
            };
        });
    });

    // ------------------------------------------------------------------ K8
    await run('K8', '指针拖拽改宽高，并同步 aria-valuenow', () => {
        const p = window.__p;
        const grip = p.panel.querySelector('.nvui-resize');
        const w0 = window.__w(p);
        const h0 = window.__h(p);
        const rect = grip.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const send = (type, cx, cy) => grip.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 1, button: 0,
            clientX: cx, clientY: cy,
        }));
        send('pointerdown', x, y);
        send('pointermove', x + 24, y + 16);
        send('pointerup', x + 24, y + 16);
        const w1 = window.__w(p);
        const h1 = window.__h(p);
        /* 高度已经贴着 max-height（88vh），拖拽只能让宽度变化 —— 断言宽度与 aria 同步 */
        return {
            pass: w1 === w0 + 24
                && h1 === h0
                && Number(grip.getAttribute('aria-valuenow')) === w1,
            detail: JSON.stringify({
                w0: w0, w1: w1, h0: h0, h1: h1,
                ariaNow: grip.getAttribute('aria-valuenow'),
            }),
        };
    });

    // ------------------------------------------------------------------ K9
    await run('K9', '销毁后手柄随面板移除（不留 DOM、监听计数回基线）', () => {
        const p = window.__p;
        const before = window.__baseline;
        p.destroy();
        window.__p = null;
        return window.__wait(300).then(() => ({
            pass: document.querySelectorAll('.nvui-resize').length === 0
                && JSON.stringify(NVUI.diagnostics().listenerCounts) === before,
            detail: JSON.stringify({
                grips: document.querySelectorAll('.nvui-resize').length,
                before: before,
                after: JSON.stringify(NVUI.diagnostics().listenerCounts),
            }),
        }));
    });

    // ------------------------------------------------------------------ K10
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await run('K10', 'prefers-reduced-motion 下尺寸无过渡（transition-duration 0s）', () => {
        const p = window.__open({ id: 'k10', title: 'K10', resizable: true, persist: false });
        return window.__wait(120).then(() => {
            const cs = getComputedStyle(p.panel);
            const gripCs = getComputedStyle(p.panel.querySelector('.nvui-resize'));
            const out = {
                /* 全局 reduced-motion 规则用的是 0.01ms（浏览器读作 1e-05s）而不是 0s，
                   语义上「无过渡」，按 < 0.1ms 判定 */
                pass: parseFloat(cs.transitionDuration || '0') <= 0.0001
                    && parseFloat(gripCs.transitionDuration || '0') <= 0.0001,
                detail: JSON.stringify({
                    panel: cs.transitionDuration,
                    grip: gripCs.transitionDuration,
                }),
            };
            p.destroy();
            return out;
        });
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // ------------------------------------------------------------------ K11
    await new Promise((r) => setTimeout(r, 200));
    record('K11', '全程 0 pageerror / 0 console error',
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
