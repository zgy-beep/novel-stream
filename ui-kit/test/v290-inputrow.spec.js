/**
 * v2.9.0 / GH-#18 B5 回归：inputRow 的 textarea 与 hint / error
 * ---------------------------------------------------------------------------
 * 14 种原生 input 类型里没有多行文本；错误态此前只能下游自绘，且没法把说明
 * 关联给读屏。这里补：
 *   - `type: 'textarea'` 伪类型：DOM 是 <textarea>，意图走 data-nvui-type；
 *   - `hint` → aria-describedby；`error` → aria-invalid="true" + aria-describedby；
 *   - hint / error 各生成独立 id（不共用一个）。
 *
 * 覆盖：
 *   I1  textarea：标签名 / is-textarea 类 / data-nvui-type / rows / value 可写
 *   I2  textarea 的 onChange 回传字符串（多行不被折叠），number 仍回传数字
 *   I3  hint：aria-describedby 指向消息节点，文本一致，无 aria-invalid
 *   I4  error：aria-invalid="true"，aria-describedby 指向错误节点，行带 is-error
 *   I5  hint + error 同时给：两个 id 都在 aria-describedby 里且互不相同
 *   I6  多行并存：每条消息 id 唯一（不同输入行不会撞 id）
 *   I7  未知类型仍回退 text（既有契约不变），'textarea' 不再回退
 *   I8  全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-inputrow.spec.js
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
    <title>NVUI v2.9.0 B5 inputRow</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body>
    <div class="nvui-scope" id="probe" style="width:520px"></div>
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
    console.log('\x1b[1m\x1b[35m  v2.9.0 B5 · inputRow: textarea + hint/error                \x1b[0m');
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
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
        && window.NVUI !== null && typeof window.NVUI.inputRow === 'function');
    if (!ready) {
        console.error('[FATAL] NVUI.inputRow 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__host = () => document.getElementById('probe');
        window.__mount = (node) => {
            window.__host().appendChild(node);
            return node;
        };
        window.__clear = () => { window.__host().innerHTML = ''; };
        window.__seen = [];
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

    // ------------------------------------------------------------------ I1
    await run('I1', 'textarea：DOM 是 TEXTAREA + is-textarea + data-nvui-type + rows + value', () => {
        window.__clear();
        const row = window.__mount(NVUI.inputRow({
            label: '备注', type: 'textarea', rows: 4, value: '第一行\n第二行', placeholder: '写点什么',
        }));
        const el = row.input;
        window.__ta = row;
        return {
            pass: el.tagName === 'TEXTAREA'
                && el.classList.contains('is-textarea')
                && el.classList.contains('nvui-input')
                && el.getAttribute('data-nvui-type') === 'textarea'
                && el.rows === 4
                && el.value === '第一行\n第二行'
                && el.placeholder === '写点什么'
                && el.type === 'textarea',
            detail: JSON.stringify({
                tag: el.tagName, cls: el.className, data: el.getAttribute('data-nvui-type'),
                rows: el.rows, value: el.value, type: el.type,
            }),
        };
    });

    // ------------------------------------------------------------------ I2
    await run('I2', 'textarea 的 onChange 回传字符串；number 仍回传数字', () => {
        window.__clear();
        const got = [];
        const taRow = window.__mount(NVUI.inputRow({
            label: '多行', type: 'textarea', onChange: (v) => got.push(['ta', v, typeof v]),
        }));
        const numRow = window.__mount(NVUI.inputRow({
            label: '数量', type: 'number', onChange: (v) => got.push(['num', v, typeof v]),
        }));
        taRow.input.value = 'a\nb';
        taRow.input.dispatchEvent(new Event('change', { bubbles: true }));
        numRow.input.value = '42';
        numRow.input.dispatchEvent(new Event('change', { bubbles: true }));
        return {
            pass: got.length === 2
                && got[0][1] === 'a\nb' && got[0][2] === 'string'
                && got[1][1] === 42 && got[1][2] === 'number',
            detail: JSON.stringify(got),
        };
    });

    // ------------------------------------------------------------------ I3
    await run('I3', 'hint：aria-describedby 指向消息节点，且无 aria-invalid', () => {
        window.__clear();
        const row = window.__mount(NVUI.inputRow({ label: '路径', hint: '相对酒馆根目录' }));
        const id = row.input.getAttribute('aria-describedby');
        const msg = id ? document.getElementById(id) : null;
        window.__seen.push(id);
        return {
            pass: !!msg
                && msg.textContent === '相对酒馆根目录'
                && msg.classList.contains('nvui-input-msg')
                && msg.classList.contains('is-hint')
                && row.input.getAttribute('aria-invalid') === null
                && row.classList.contains('is-msg'),
            detail: JSON.stringify({
                id: id, text: msg && msg.textContent,
                invalid: row.input.getAttribute('aria-invalid'),
            }),
        };
    });

    // ------------------------------------------------------------------ I4
    await run('I4', 'error：aria-invalid="true" + 独立 id + 行带 is-error', () => {
        window.__clear();
        const row = window.__mount(NVUI.inputRow({ label: '地址', value: 'x', error: '必须是完整 URL' }));
        const id = row.input.getAttribute('aria-describedby');
        const msg = id ? document.getElementById(id) : null;
        window.__seen.push(id);
        return {
            pass: !!msg
                && msg.textContent === '必须是完整 URL'
                && msg.classList.contains('is-error')
                && row.input.getAttribute('aria-invalid') === 'true'
                && row.classList.contains('is-error'),
            detail: JSON.stringify({
                id: id, invalid: row.input.getAttribute('aria-invalid'),
                rowCls: row.className,
            }),
        };
    });

    // ------------------------------------------------------------------ I5
    await run('I5', 'hint + error 同时给：两个 id 都在 aria-describedby 且互不相同', () => {
        window.__clear();
        const row = window.__mount(NVUI.inputRow({
            label: 'Webhook', hint: '支持变量 {id}', error: '必须是 http(s) 地址',
        }));
        const ids = (row.input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
        const nodes = ids.map((i) => document.getElementById(i));
        return {
            pass: ids.length === 2
                && ids[0] !== ids[1]
                && nodes.every((n) => !!n)
                && nodes[0].textContent === '支持变量 {id}'
                && nodes[0].classList.contains('is-hint')
                && nodes[1].textContent === '必须是 http(s) 地址'
                && nodes[1].classList.contains('is-error')
                && row.input.getAttribute('aria-invalid') === 'true',
            detail: JSON.stringify({ ids: ids, texts: nodes.map((n) => n && n.textContent) }),
        };
    });

    // ------------------------------------------------------------------ I6
    await run('I6', '多行并存：消息 id 唯一（不同输入行不撞 id）', () => {
        window.__clear();
        const a = window.__mount(NVUI.inputRow({ label: 'A', hint: '提示 A' }));
        const b = window.__mount(NVUI.inputRow({ label: 'B', hint: '提示 B' }));
        const c = window.__mount(NVUI.inputRow({ label: 'C', error: '错误 C' }));
        const ids = [a, b, c].map((r) => r.input.getAttribute('aria-describedby'));
        return {
            pass: new Set(ids).size === 3 && ids.every((i) => !!document.getElementById(i)),
            detail: JSON.stringify(ids),
        };
    });

    // ------------------------------------------------------------------ I7
    await run('I7', '未知类型仍回退 text；textarea 不再被回退', () => {
        window.__clear();
        const bad = window.__mount(NVUI.inputRow({ label: '未知', type: 'quantum' }));
        const ta = window.__mount(NVUI.inputRow({ label: '多行', type: 'textarea' }));
        return {
            pass: bad.input.tagName === 'INPUT'
                && bad.input.type === 'text'
                && bad.input.getAttribute('data-nvui-type') === null
                && ta.input.tagName === 'TEXTAREA'
                && ta.input.getAttribute('data-nvui-type') === 'textarea',
            detail: JSON.stringify({
                badTag: bad.input.tagName, badType: bad.input.type,
                taTag: ta.input.tagName, taData: ta.input.getAttribute('data-nvui-type'),
            }),
        };
    });

    // ------------------------------------------------------------------ I8
    await new Promise((r) => setTimeout(r, 200));
    record('I8', '全程 0 pageerror / 0 console error',
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
