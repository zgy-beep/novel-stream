/**
 * v2.9.0 / GH-#18 B1 回归：布局状态读写出入口
 * ---------------------------------------------------------------------------
 * 新增 `panel.getLayoutState()` / `panel.setLayoutState(state, { silent })`。
 *
 * 设计契约（本 spec 逐条锁死）：
 *   L1  get 的返回结构：{ version, size, tab, accordion }，**不含 timestamp**
 *       （时间戳是存储记录元数据，带上就破坏往返深相等）
 *   L2  往返幂等：get → set → get 深相等
 *   L3  返回值是游离副本：外部改动不会污染内部 loadedState
 *   L4  set 是数据操作，不动当前视图：已打开的 tab 与内联尺寸都不变
 *   L5  set 会调度一次落盘，存储里拿到的就是导入值（tab / size）
 *   L6  silent:true 不写存储（存储调用计数不增长）
 *   L7  persist.size:false 的面板：导入的 size 被强制 null（#16 语义不被绕过）
 *   L8  未启用持久化：get 仍给只读快照，set 返回 null 并告警
 *   L9  连续多次 set 合并成一次落盘（去抖语义）
 *   L10 全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-layout-state.spec.js
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
    <title>NVUI v2.9.0 B1 Layout State</title>
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
    console.log('\x1b[1m\x1b[35m  v2.9.0 B1 · 布局状态读写出入口                          \x1b[0m');
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
        window.__stores = [];
        /* 内存 StorageAdapter：数组式的调用计数比劫持 localStorage 更直观 */
        window.__mkStore = () => {
            const data = {};
            const calls = { get: 0, set: 0, delete: 0 };
            const store = {
                data: data,
                calls: calls,
                get: function (k) {
                    calls.get++;
                    return data[k] === undefined ? null : JSON.parse(JSON.stringify(data[k]));
                },
                set: function (k, v) {
                    calls.set++;
                    data[k] = JSON.parse(JSON.stringify(v));
                },
                delete: function (k) {
                    calls.delete++;
                    delete data[k];
                },
            };
            window.__stores.push(store);
            return store;
        };
        window.__open = (opts) => {
            const p = NVUI.createPanel(opts);
            p.open();
            return p;
        };
        /* 深比较只看结构，不受对象原型影响（accordion 是无原型对象） */
        window.__eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
        window.__TABS = [{ key: 'one', label: '一' }, { key: 'two', label: '二' }];
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

    // ------------------------------------------------------------------ L1
    await run('L1', 'get 返回结构：version / size / tab / accordion，且不含 timestamp', () => {
        const store = window.__mkStore();
        const p = window.__open({ id: 'b1-l1', title: 'L1', tabs: window.__TABS, persist: { storage: store } });
        const st = p.getLayoutState();
        window.__p1 = p;
        window.__s1 = store;
        return window.__wait(60).then(() => ({
            pass: !!st
                && Object.keys(st).sort().join(',') === 'accordion,size,tab,version'
                && st.version === 2
                && !!st.size && typeof st.size.w === 'number'
                && Object.prototype.hasOwnProperty.call(st.size, 'h')
                && typeof st.size.mode === 'string' && st.size.mode.length > 0
                && typeof st.tab === 'string' && st.tab.length > 0
                && st.accordion !== null && typeof st.accordion === 'object',
            detail: JSON.stringify(st),
        }));
    });

    // ------------------------------------------------------------------ L2
    await run('L2', '往返幂等：get → set → get 深相等', () => {
        const p = window.__p1;
        const first = p.getLayoutState();
        p.setLayoutState(first);
        const second = p.getLayoutState();
        return window.__wait(20).then(() => ({
            pass: window.__eq(first, second),
            detail: JSON.stringify({ first: first, second: second }),
        }));
    });

    // ------------------------------------------------------------------ L3
    await run('L3', '返回值是游离副本：改返回值不污染内部状态', () => {
        const p = window.__p1;
        const a = p.getLayoutState();
        a.size.w = 12345;
        a.tab = '__hacked__';
        a.accordion.injected = true;
        const b = p.getLayoutState();
        return {
            pass: b.size.w !== 12345 && b.tab !== '__hacked__'
                && !Object.prototype.hasOwnProperty.call(b.accordion, 'injected'),
            detail: JSON.stringify(b),
        };
    });

    // ------------------------------------------------------------------ L4
    await run('L4', 'set 不动当前视图：已打开的 tab 与内联宽度都不变', () => {
        const p = window.__p1;
        p.setTab('two');
        const widthBefore = p.panel.style.getPropertyValue('--nvui-panel-w');
        p.setLayoutState({ tab: 'one', size: { width: 640, height: 420, isMaximized: false } });
        return window.__wait(60).then(() => ({
            pass: p.activeTab === 'two' && p.panel.style.getPropertyValue('--nvui-panel-w') === widthBefore,
            detail: JSON.stringify({
                activeTab: p.activeTab,
                widthBefore: widthBefore,
                widthAfter: p.panel.style.getPropertyValue('--nvui-panel-w'),
            }),
        }));
    });

    // ------------------------------------------------------------------ L5
    await run('L5', 'set 调度落盘：存储里拿到的是导入值（tab / size）', () => {
        const p = window.__p1;
        const store = window.__s1;
        const before = store.calls.set;
        p.setLayoutState({ tab: 'one', size: { width: 800, height: 520, isMaximized: false } });
        return window.__wait(420).then(() => {
            const saved = store.data['nvui_state_b1-l1'];
            return {
                pass: store.calls.set === before + 1
                    && !!saved && saved.tab === 'one'
                    && saved.size && saved.size.w === 800 && saved.size.h === 520
                    && typeof saved.timestamp === 'number',
                detail: JSON.stringify({ saved: saved, calls: store.calls }),
            };
        });
    });

    // ------------------------------------------------------------------ L6
    await run('L6', 'silent:true 不写存储：set 计数不增长', () => {
        const p = window.__p1;
        const store = window.__s1;
        const before = store.calls.set;
        const snapshot = store.data['nvui_state_b1-l1'];
        p.setLayoutState({ tab: 'two', size: { width: 700, height: 480, isMaximized: false } }, { silent: true });
        return window.__wait(420).then(() => ({
            pass: store.calls.set === before
                && window.__eq(store.data['nvui_state_b1-l1'], snapshot)
                /* 内存态确实换了 —— silent 只挡存储，不挡内存 */
                && p.getLayoutState().tab === 'two',
            detail: JSON.stringify({ calls: store.calls, memTab: p.getLayoutState().tab }),
        }));
    });

    // ------------------------------------------------------------------ L7
    await run('L7', 'persist.size:false：导入的 size 被强制 null（#16 不被绕过）', () => {
        const store = window.__mkStore();
        const p = window.__open({
            id: 'b1-l7', title: 'L7', tabs: window.__TABS,
            persist: { size: false, tab: true, storage: store },
        });
        const applied = p.setLayoutState({ size: { width: 900, height: 700, isMaximized: true }, tab: 'two' });
        return window.__wait(420).then(() => {
            const saved = store.data['nvui_state_b1-l7'];
            p.destroy();
            return {
                pass: !!applied && applied.size === null && applied.tab === 'two'
                    && !!saved && saved.size === null && saved.tab === 'two'
                    && p.panel.style.getPropertyValue('--nvui-panel-h') === '',
                detail: JSON.stringify({ applied: applied, saved: saved }),
            };
        });
    });

    // ------------------------------------------------------------------ L8
    await run('L8', '未启用持久化：get 仍给快照，set 返回 null（不抛错）', () => {
        const p = window.__open({ id: 'b1-l8', title: 'L8', tabs: window.__TABS, persist: false });
        const st = p.getLayoutState();
        const ret = p.setLayoutState({ tab: 'two' });
        return window.__wait(60).then(() => {
            const out = {
                pass: !!st && typeof st.size === 'object' && st.size !== null
                    && typeof st.tab === 'string'
                    && ret === null,
                detail: JSON.stringify({ st: st, ret: ret }),
            };
            p.destroy();
            return out;
        });
    });

    // ------------------------------------------------------------------ L9
    await run('L9', '连续多次 set 合并成一次落盘（去抖）', () => {
        const store = window.__mkStore();
        const p = window.__open({ id: 'b1-l9', title: 'L9', tabs: window.__TABS, persist: { storage: store } });
        const before = store.calls.set;
        p.setLayoutState({ tab: 'one' });
        p.setLayoutState({ tab: 'two' });
        p.setLayoutState({ tab: 'one', size: { width: 760, height: 500, isMaximized: false } });
        return window.__wait(460).then(() => {
            const saved = store.data['nvui_state_b1-l9'];
            p.destroy();
            return {
                pass: store.calls.set === before + 1
                    && !!saved && saved.tab === 'one'
                    && saved.size && saved.size.w === 760,
                detail: JSON.stringify({ calls: store.calls, before: before, saved: saved }),
            };
        });
    });

    // ----------------------------------------------------------------- L10
    await new Promise((r) => setTimeout(r, 200));
    record('L10', '全程 0 pageerror / 0 console error',
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
