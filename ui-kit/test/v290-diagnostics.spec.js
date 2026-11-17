/**
 * v2.9.0 / GH-#18 B2 回归：NVUI.diagnostics()
 * ---------------------------------------------------------------------------
 * #16 报告里最贵的一步是「确认下游装的哪版、状态里到底有什么」。
 * 新增一次性快照：version / assets / glass / hostModals / escapeStackDepth /
 * persistKeys / listenerCounts（外加 status）。
 *
 * 覆盖：
 *   D1  Node 无 DOM：返回 status:'no-dom'，不抛错（本文件进程内直接断言）
 *   D2  浏览器：恰好 8 个字段，status === 'ok'
 *   D3  assets：tokensCss 版本与 NVUI.VERSION 一致；componentsCss 检测到规则
 *   D4  persistKeys：只收 nvui_state_* 且按字典序
 *   D5  escapeStackDepth：随 createPanel / destroy 增减（不是常驻值）
 *   D6  listenerCounts：开面板挂监听、销毁后回落到基线（不留残）
 *   D7  无副作用：连续两次调用不改 root class / localStorage / body 子节点
 *   D8  全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-diagnostics.spec.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const browserDeps = require('../scripts/resolve-browser');
const { chromium } = browserDeps.requirePlaywright();
const apiInNode = require('../nvui-api.js');

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
    <title>NVUI v2.9.0 B2 diagnostics</title>
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
    console.log('\x1b[1m\x1b[35m  v2.9.0 B2 · NVUI.diagnostics()                           \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

    // ------------------------------------------------------------------ D1
    // Node 里 require 得到的实例没有 DOM：诊断必须自己降级，而不是抛错。
    try {
        const nodeDiag = apiInNode.diagnostics();
        record('D1', 'Node 无 DOM：返回 status:no-dom 且不抛错',
            nodeDiag && nodeDiag.status === 'no-dom'
            && nodeDiag.version === apiInNode.VERSION
            && nodeDiag.assets === null,
            JSON.stringify(nodeDiag), 0);
    } catch (err) {
        record('D1', 'Node 无 DOM：返回 status:no-dom 且不抛错', false, '抛错: ' + err.message, 0);
    }

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
        && window.NVUI !== null && typeof window.NVUI.diagnostics === 'function');
    if (!ready) {
        console.error('[FATAL] NVUI.diagnostics 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__mkStore = () => {
            const data = {};
            return {
                get: (k) => (data[k] === undefined ? null : JSON.parse(JSON.stringify(data[k]))),
                set: (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); },
                delete: (k) => { delete data[k]; },
                data: data,
            };
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

    // ------------------------------------------------------------------ D2
    await run('D2', '浏览器：恰好 8 个字段，status === ok', () => {
        const d = NVUI.diagnostics();
        const keys = Object.keys(d).sort();
        window.__base = d;
        return {
            pass: keys.length === 8
                && keys.join(',') === 'assets,escapeStackDepth,glass,hostModals,listenerCounts,persistKeys,status,version'
                && d.status === 'ok'
                && d.version === NVUI.VERSION,
            detail: JSON.stringify({ keys: keys, status: d.status, version: d.version }),
        };
    });

    // ------------------------------------------------------------------ D3
    await run('D3', 'assets：tokensCss 版本与 VERSION 一致，componentsCss 检测到规则', () => {
        const d = NVUI.diagnostics();
        return {
            pass: d.assets.tokensCss.loaded === true
                && d.assets.tokensCss.kitVersion === NVUI.VERSION
                && d.assets.componentsCss.loaded === true
                && d.assets.nvuiApi.loaded === true
                && d.assets.nvuiApi.kitVersion === NVUI.VERSION
                && d.assets.tokensCss.md5 === null,
            detail: JSON.stringify(d.assets),
        };
    });

    // ------------------------------------------------------------------ D4
    await run('D4', 'persistKeys：只收 nvui_state_* 且按字典序', () => {
        localStorage.clear();
        localStorage.setItem('nvui_state_zeta', '{}');
        localStorage.setItem('nvui_state_alpha', '{}');
        localStorage.setItem('unrelated_key', '{}');
        const d = NVUI.diagnostics();
        return {
            pass: d.persistKeys.join(',') === 'nvui_state_alpha,nvui_state_zeta',
            detail: JSON.stringify(d.persistKeys),
        };
    });

    // ------------------------------------------------------------------ D5
    await run('D5', 'escapeStackDepth：随 createPanel / destroy 增减', () => {
        const before = NVUI.diagnostics().escapeStackDepth;
        const a = NVUI.createPanel({ id: 'd5-a', title: 'D5-A', persist: false });
        const b = NVUI.createPanel({ id: 'd5-b', title: 'D5-B', persist: false });
        const during = NVUI.diagnostics().escapeStackDepth;
        a.destroy();
        b.destroy();
        return window.__wait(220).then(() => ({
            pass: before === 0 && during === 2 && NVUI.diagnostics().escapeStackDepth === 0,
            detail: JSON.stringify({ before: before, during: during, after: NVUI.diagnostics().escapeStackDepth }),
        }));
    });

    // ------------------------------------------------------------------ D6
    await run('D6', 'listenerCounts：开面板挂监听，销毁后回落到基线', () => {
        const before = JSON.parse(JSON.stringify(NVUI.diagnostics().listenerCounts));
        const p = NVUI.createPanel({
            id: 'd6', title: 'D6', persist: { storage: window.__mkStore() },
        });
        p.open();
        return window.__wait(200).then(() => {
            const during = NVUI.diagnostics().listenerCounts;
            p.destroy();
            return window.__wait(260).then(() => {
                const after = NVUI.diagnostics().listenerCounts;
                const key = (o, k) => (o[k] || 0);
                /* 只统计长寿命目标：面板开着时 window.resize / document.keydown /
                   MediaQueryList.change 都应有活体监听，销毁后必须全部回落到基线 */
                const types = ['keydown', 'resize', 'change', 'animationend', 'close', 'load'];
                const back = types.every((t) => key(after, t) === key(before, t));
                return {
                    pass: key(during, 'keydown') >= 1
                        && key(during, 'resize') >= 1
                        && key(during, 'change') >= 2
                        && back,
                    detail: JSON.stringify({ before: before, during: during, after: after, back: back }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ D7
    await run('D7', '无副作用：连续两次调用不改 root class / localStorage / body 结构', () => {
        const rootBefore = document.documentElement.className;
        const lsBefore = localStorage.length;
        const bodyBefore = document.body.childNodes.length;
        const first = NVUI.diagnostics();
        const second = NVUI.diagnostics();
        return {
            pass: document.documentElement.className === rootBefore
                && localStorage.length === lsBefore
                && document.body.childNodes.length === bodyBefore
                && JSON.stringify(first) === JSON.stringify(second),
            detail: JSON.stringify({
                root: rootBefore === document.documentElement.className,
                ls: lsBefore + '->' + localStorage.length,
                body: bodyBefore + '->' + document.body.childNodes.length,
                stable: JSON.stringify(first) === JSON.stringify(second),
            }),
        };
    });

    // ------------------------------------------------------------------ D8
    await new Promise((r) => setTimeout(r, 200));
    record('D8', '全程 0 pageerror / 0 console error',
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
