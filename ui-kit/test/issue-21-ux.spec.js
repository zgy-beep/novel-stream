/**
 * GH-#21 第 2 / 3 条回归：进度条可视标签 + 面板 body 溢出边缘渐隐
 * ---------------------------------------------------------------------------
 * 第 2 条：progress({ showLabel, showValue }) 渲染可视标题 / 数值（默认关闭）。
 *   验收：可选开启、默认零变化、可视文本 aria-hidden（不重复播报）、
 *         setValue() 同步 aria-valuenow 与可视数值、不确定进度不编数值。
 * 第 3 条：面板 body 内容溢出时按滚动位置打 data-nvui-fade（top / bottom / both）。
 *   验收：顶部→bottom、滚到底→top、不溢出→无属性、销毁后不留监听。
 *
 * 运行：node test/issue-21-ux.spec.js
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
    <title>NVUI GH-21 Regression</title>
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
    console.log('\x1b[1m\x1b[35m  GH-#21 · 进度条可视标签 + 滚动边缘渐隐                    \x1b[0m');
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
        && window.NVUI !== null && typeof window.NVUI.progress === 'function'
        && typeof window.NVUI.createPanel === 'function');
    if (!ready) {
        console.error('[FATAL] NVUI 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        /* 把节点挂到可见容器里再量样式：单独一个游离节点读不到布局 */
        window.__mount = (node) => {
            var host = document.createElement('div');
            host.id = 'probe-host';
            host.style.cssText = 'position:fixed;left:0;top:0;width:480px;z-index:1;';
            host.appendChild(node);
            document.body.appendChild(host);
            return node;
        };
        window.__cleanup = () => {
            var host = document.getElementById('probe-host');
            if (host && host.parentNode) host.parentNode.removeChild(host);
        };
        window.__fill = (node, n) => {
            for (var i = 0; i < n; i++) {
                var p = document.createElement('div');
                p.textContent = '段落 ' + (i + 1) + ' · 用于制造纵向溢出';
                node.appendChild(p);
            }
        };
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

    // ---------------------------------------------------------------- P1
    await run('P1', 'showLabel + showValue：外层 .nvui-progress-field，标题/数值可见', () => {
        window.__cleanup();
        const field = window.__mount(NVUI.progress({
            value: 42, label: '导出进度', showLabel: true, showValue: true,
        }));
        const label = field.querySelector('[data-nvui-part="label"]');
        const value = field.querySelector('[data-nvui-part="value"]');
        const track = field.querySelector('.nvui-progress');
        return {
            pass: field.className === 'nvui-progress-field'
                && !!label && label.textContent === '导出进度'
                && !!value && value.textContent === '42%'
                && !!track && track.getAttribute('role') === 'progressbar'
                && track.getAttribute('aria-valuenow') === '42'
                && track.getAttribute('aria-label') === '导出进度',
            detail: JSON.stringify({
                cls: field.className,
                label: label && label.textContent,
                value: value && value.textContent,
                trackAria: track && track.getAttribute('aria-valuenow'),
            }),
        };
    });

    // ---------------------------------------------------------------- P2
    await run('P2', '可视文本 aria-hidden：进度不被读屏重复播报', () => {
        const field = document.querySelector('#probe-host .nvui-progress-field');
        const label = field && field.querySelector('[data-nvui-part="label"]');
        const value = field && field.querySelector('[data-nvui-part="value"]');
        return {
            pass: !!label && label.getAttribute('aria-hidden') === 'true'
                && !!value && value.getAttribute('aria-hidden') === 'true',
            detail: JSON.stringify({
                label: label && label.getAttribute('aria-hidden'),
                value: value && value.getAttribute('aria-hidden'),
            }),
        };
    });

    // ---------------------------------------------------------------- P3
    await run('P3', 'setValue 同时更新 aria-valuenow 与可视数值', () => {
        const field = document.querySelector('#probe-host .nvui-progress-field');
        field.setValue(66);
        const value = field.querySelector('[data-nvui-part="value"]');
        const track = field.querySelector('.nvui-progress');
        const bar = field.querySelector('.nvui-progress-bar');
        return {
            pass: track.getAttribute('aria-valuenow') === '66'
                && value.textContent === '66%'
                && bar.style.width === '66%',
            detail: JSON.stringify({
                aria: track.getAttribute('aria-valuenow'),
                text: value.textContent,
                width: bar.style.width,
            }),
        };
    });

    // ---------------------------------------------------------------- P4
    await run('P4', '默认关闭：不传 showLabel/showValue 时返回值仍是 .nvui-progress', () => {
        window.__cleanup();
        const track = window.__mount(NVUI.progress({ value: 30, label: '静默进度' }));
        return {
            pass: track.className === 'nvui-progress' && !track.querySelector('[data-nvui-part]')
                && typeof track.setValue === 'function'
                && track.getAttribute('aria-valuenow') === '30',
            detail: JSON.stringify({ cls: track.className, html: track.outerHTML.slice(0, 120) }),
        };
    });

    // ---------------------------------------------------------------- P5
    await run('P5', '不确定进度 + showValue：不编造数值（aria-valuenow 仍为 null）', () => {
        window.__cleanup();
        const field = window.__mount(NVUI.progress({
            label: '正在准备', indeterminate: true, showLabel: true, showValue: true,
        }));
        const value = field.querySelector('[data-nvui-part="value"]');
        const track = field.querySelector('.nvui-progress');
        return {
            pass: !!field.querySelector('[data-nvui-part="label"]')
                && value === null
                && track.getAttribute('aria-valuenow') === null
                && track.classList.contains('is-indeterminate'),
            detail: JSON.stringify({ hasValue: !!value, aria: track.getAttribute('aria-valuenow') }),
        };
    });

    // ---------------------------------------------------------------- F1
    await run('F1', '长内容面板：初始在顶部 → data-nvui-fade="bottom"', () => {
        window.__cleanup();
        const p = NVUI.createPanel({ id: 'p21-f1', title: 'F1', persist: false });
        window.__fill(p.body, 80);
        p.open();
        window.__p1 = p;
        return window.__wait(260).then(() => {
            return {
                pass: p.body.getAttribute('data-nvui-fade') === 'bottom'
                    && p.body.scrollHeight > p.body.clientHeight + 20,
                detail: JSON.stringify({
                    fade: p.body.getAttribute('data-nvui-fade'),
                    scrollHeight: p.body.scrollHeight,
                    clientHeight: p.body.clientHeight,
                }),
            };
        });
    });

    // ---------------------------------------------------------------- F2
    await run('F2', '滚到底 → data-nvui-fade="top"', () => {
        const p = window.__p1;
        p.body.scrollTop = p.body.scrollHeight;
        return window.__wait(200).then(() => ({
            pass: p.body.getAttribute('data-nvui-fade') === 'top',
            detail: JSON.stringify({
                fade: p.body.getAttribute('data-nvui-fade'),
                scrollTop: Math.round(p.body.scrollTop),
            }),
        }));
    });

    // ---------------------------------------------------------------- F3
    await run('F3', '滚到中间 → data-nvui-fade="both"', () => {
        const p = window.__p1;
        p.body.scrollTop = Math.round((p.body.scrollHeight - p.body.clientHeight) / 2);
        return window.__wait(200).then(() => ({
            pass: p.body.getAttribute('data-nvui-fade') === 'both',
            detail: JSON.stringify({
                fade: p.body.getAttribute('data-nvui-fade'),
                scrollTop: Math.round(p.body.scrollTop),
            }),
        }));
    });

    // ---------------------------------------------------------------- F4
    await run('F4', '内容不溢出：不加 data-nvui-fade（不误伤短面板）', () => {
        window.__cleanup();
        const p = NVUI.createPanel({ id: 'p21-f4', title: 'F4', persist: false });
        p.body.appendChild(document.createTextNode('一行内容'));
        p.open();
        return window.__wait(220).then(() => {
            const fade = p.body.getAttribute('data-nvui-fade');
            p.destroy();
            return {
                pass: fade === null,
                detail: JSON.stringify({ fade: fade, scrollHeight: p.body.scrollHeight }),
            };
        });
    });

    // ---------------------------------------------------------------- F5
    await run('F5', '销毁后不留残留状态（重复开合 5 次，data-nvui-fade 归零）', () => {
        if (window.__p1) { window.__p1.destroy(); window.__p1 = null; }
        /* destroy() 的 DOM 摘除走 dialog close 的异步 task，先等它落地再取基线 */
        return window.__wait(220).then(() => {
            const before = document.querySelectorAll('[data-nvui-fade]').length;
            for (var i = 0; i < 5; i++) {
                var p = NVUI.createPanel({ id: 'p21-f5-' + i, title: 'F5-' + i, persist: false });
                window.__fill(p.body, 60);
                p.open();
                p.destroy();
            }
            return window.__wait(300).then(() => {
                const after = document.querySelectorAll('[data-nvui-fade]').length;
                return {
                    pass: after === 0 && before === 0,
                    detail: JSON.stringify({ before: before, after: after }),
                };
            });
        });
    });

    // ---------------------------------------------------------------- F6
    await new Promise((r) => setTimeout(r, 150));
    record('F6', '全程 0 pageerror / 0 console error',
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
