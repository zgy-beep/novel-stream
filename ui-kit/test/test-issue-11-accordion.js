/**
 * Issue #11 回归：innerHTML 注入的 .nvui-acc 也能接管持久化
 * ---------------------------------------------------------------------------
 * 覆盖公开入口 panel.trackAccordion(node, id?, options?) 与
 * panel.adoptAccordions(root, options?)：
 *   T1  注入的折叠条注册 / 点击（bind:true）/ 落盘
 *   T2  destroy 后重建同名面板：状态恢复
 *   T3  重复 adopt / track 幂等，单击只翻一次（不产生双重 toggle）
 *   T4  键优先级（显式 id > DOM id > data-nvui-acc-key > 自动键）与自动键稳定性
 *   T5  工厂 addAccordion 行为回归（不双重 toggle）
 *   T6  persist.accordion=false：不登记、不写存储，但仍可开合
 *   T7  clearLayoutState 后全部收起且不残留 true
 *   T8  destroy 后解绑：点击不再改变状态、不再落盘
 *   T9  拒绝 document / body 全量扫描
 *   T10 调用方自带 setOpen / 点击监听真实开合，kit 不重复 toggle
 *   T11 adopt 的 root 自身就是折叠条
 *   T12 同 id 冲突时拒绝注册，不覆盖已注册节点
 *   T13 默认不绑定点击：调用方切换 class 不双重 toggle，状态仍落盘
 *   T15 同面板多次重渲染：同 key 新节点替换旧条目，立即 close/destroy 后恢复
 *   T16 persist.accordion:false 不恢复/不登记；size/tab 仍保存；全 false 不写空状态
 *   T17 中文/非 ASCII 键与工厂/注入混合登记相互独立（含 __proto__）
 *   T18 外部容器拒绝、detached 预注册允许、destroy 后各注册链不再挂监听
 *   T14 全程 0 pageerror / 0 console error
 *
 * 运行（本仓库既有实机脚本同一套依赖解析顺序）：
 *   node test/test-issue-11-accordion.js
 * 可选环境变量：
 *   ST_CHROME  Chrome 可执行文件路径（默认 C:/Program Files/Google/Chrome/Application/chrome.exe）
 * 依赖：playwright-core（NODE_PATH 或下面 resolvePlaywright 的兜底路径）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

/* 依赖解析统一到 scripts/resolve-browser.js（Roadmap A2） */
const browserDeps = require('../scripts/resolve-browser');

function resolvePlaywright() {
    return browserDeps.requirePlaywright();
}

const { chromium } = resolvePlaywright();

const KIT_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = browserDeps.resolveChrome()
    || process.env.ST_CHROME
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PATHS = {
    tokensCss: path.join(KIT_ROOT, 'tokens.css'),
    componentsCss: path.join(KIT_ROOT, 'components.css'),
    nvuiApi: path.join(KIT_ROOT, 'nvui-api.js'),
};

function startEphemeralServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = req.url.split('?')[0];
            if (url === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }
            if (url === '/' || url === '/index.html') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NVUI Issue #11 Regression</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body>
    <div id="sandbox-root"></div>
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
    console.log('\x1b[1m\x1b[35m  Issue #11 · innerHTML 折叠条接管回归                      \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

    for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[k];
    }
    process.env.NO_PROXY = '*';

    if (!fs.existsSync(CHROME_PATH)) {
        console.error('[FATAL] 找不到 Chrome: ' + CHROME_PATH + '（可用 ST_CHROME 指定）');
        process.exit(1);
    }

    const sandbox = await startEphemeralServer();
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        /* Chrome 会把 404 资源（如 favicon）记成 console error，与本次回归无关 */
        if (/favicon/i.test(text)) return;
        consoleErrors.push(text);
    });

    await page.goto(sandbox.url, { waitUntil: 'domcontentloaded' });

    const ok = await page.evaluate(() => typeof window.NVUI === 'object'
        && window.NVUI !== null && typeof window.NVUI.createPanel === 'function');
    if (!ok) {
        console.error('[FATAL] NVUI 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    /* 页面内共用工具：面板工厂 / HTML 注入 / 存储读取 */
    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__state = (id) => {
            try { return JSON.parse(localStorage.getItem('nvui_state_' + id) || 'null'); }
            catch (e) { return 'PARSE_ERROR'; }
        };
        window.__panel = (id, persist) => {
            const p = NVUI.createPanel({ id: id, title: 'T', persist: persist });
            p.open();
            return p;
        };
        window.__inject = (p, html) => {
            p.body.innerHTML = html;
            return Array.prototype.slice.call(p.body.querySelectorAll('.nvui-acc'));
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

    // ------------------------------------------------------------------ T1
    await run('T1', 'innerHTML 注入的 .nvui-acc 可注册、可点击、可落盘', () => {
        localStorage.clear();
        const p = window.__panel('acc-t1', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="t1-a">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">A</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">A</div></div></div>');
        const n = nodes[0];
        const head = n.querySelector('.nvui-acc-head');
        const id = p.trackAccordion(n, { bind: true });
        head.click();
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t1');
            const acc = st && st.accordion;
            const opened = n.classList.contains('is-open');
            const aria = head.getAttribute('aria-expanded');
            p.destroy();
            return {
                pass: id === 't1-a' && opened === true && aria === 'true' && !!acc && acc['t1-a'] === true,
                detail: JSON.stringify({ id, opened, aria, acc }),
            };
        });
    });

    // ------------------------------------------------------------------ T2
    await run('T2', 'destroy 后重建同名面板：折叠状态恢复', () => {
        localStorage.clear();
        const html = '<div class="nvui-acc" id="r1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">R</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">R</div></div></div>';
        let p = window.__panel('acc-t2', { size: false, tab: false, accordion: true });
        let nodes = window.__inject(p, html);
        const firstId = p.trackAccordion(nodes[0], 'persist-key', { bind: true });
        nodes[0].querySelector('.nvui-acc-head').click();
        return window.__wait(420).then(() => {
            const savedBefore = window.__state('acc-t2');
            p.destroy();
            return window.__wait(160).then(() => {
                p = window.__panel('acc-t2', { size: false, tab: false, accordion: true });
                nodes = window.__inject(p, html);
                const secondId = p.trackAccordion(nodes[0], 'persist-key', { bind: true });
                const restoredOpen = nodes[0].classList.contains('is-open');
                const aria = nodes[0].querySelector('.nvui-acc-head').getAttribute('aria-expanded');
                p.destroy();
                return {
                    pass: firstId === 'persist-key' && secondId === 'persist-key'
                        && !!(savedBefore && savedBefore.accordion && savedBefore.accordion['persist-key'] === true)
                        && restoredOpen === true && aria === 'true',
                    detail: JSON.stringify({ firstId, secondId, savedBefore: savedBefore && savedBefore.accordion, restoredOpen, aria }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T3
    await run('T3', '重复 adopt / track 幂等，单击只翻一次（无双重 toggle）', () => {
        localStorage.clear();
        const p = window.__panel('acc-t3', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="i1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">I</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">I</div></div></div>');
        const n = nodes[0];
        const c1 = p.adoptAccordions(p.body, { bind: true });
        const c2 = p.adoptAccordions(p.body, { bind: true });
        const id3 = p.trackAccordion(n);
        n.querySelector('.nvui-acc-head').click();
        const openedOnce = n.classList.contains('is-open');
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t3');
            p.destroy();
            return {
                pass: c1 === 1 && c2 === 0 && id3 === 'i1' && openedOnce === true
                    && !!(st && st.accordion && st.accordion.i1 === true),
                detail: JSON.stringify({ c1, c2, id3, openedOnce, acc: st && st.accordion }),
            };
        });
    });

    // ------------------------------------------------------------------ T4
    await run('T4', '键优先级：显式 id > DOM id > data 键 > 自动键，且自动键跨重建稳定', () => {
        localStorage.clear();
        const html = '<div class="nvui-acc" id="k-a"><button type="button" class="nvui-acc-head">A</button></div>'
            + '<div class="nvui-acc" data-nvui-acc-key="kb"><button type="button" class="nvui-acc-head">B</button></div>'
            + '<div class="nvui-acc"><button type="button" class="nvui-acc-head">C</button></div>'
            + '<div class="nvui-acc" id="k-d"><button type="button" class="nvui-acc-head">D</button></div>';
        let p = window.__panel('acc-t4', { size: false, tab: false, accordion: true });
        let nodes = window.__inject(p, html);
        const a = p.trackAccordion(nodes[0], { bind: true });
        const b = p.trackAccordion(nodes[1], { bind: true });
        const c = p.trackAccordion(nodes[2], { bind: true });
        const d = p.trackAccordion(nodes[3], 'forced-d', { bind: true });
        nodes[2].querySelector('.nvui-acc-head').click(); // 打开自动键那一条
        return window.__wait(420).then(() => {
            const saved = window.__state('acc-t4');
            p.destroy();
            return window.__wait(160).then(() => {
                p = window.__panel('acc-t4', { size: false, tab: false, accordion: true });
                nodes = window.__inject(p, html);
                p.adoptAccordions(p.body);
                const restoredOpen = nodes[2].classList.contains('is-open');
                const autoSaved = !!(saved && saved.accordion && saved.accordion['acc_auto_3'] === true);
                p.destroy();
                return {
                    pass: a === 'k-a' && b === 'kb' && c === 'acc_auto_3' && d === 'forced-d'
                        && autoSaved && restoredOpen === true,
                    detail: JSON.stringify({ a, b, c, d, autoSaved, restoredOpen }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T5
    await run('T5', '工厂 addAccordion 回归：单击只 toggle 一次并正确落盘', () => {
        localStorage.clear();
        const p = window.__panel('acc-t5', { size: false, tab: false, accordion: true });
        const acc = p.addAccordion('fa', { id: 'f1', title: 'F', content: [] });
        const head = acc.querySelector('.nvui-acc-head');
        head.click();
        const openedOnce = acc.classList.contains('is-open');
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t5');
            p.destroy();
            return {
                pass: openedOnce === true && !!(st && st.accordion && st.accordion.f1 === true),
                detail: JSON.stringify({ openedOnce, acc: st && st.accordion }),
            };
        });
    });

    // ------------------------------------------------------------------ T6
    await run('T6', 'persist.accordion=false：不登记、不写存储，但仍可开合', () => {
        localStorage.clear();
        const p = window.__panel('acc-t6', { size: false, tab: false, accordion: false });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="t6-a">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">X</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">X</div></div></div>');
        const n = nodes[0];
        const count = p.adoptAccordions(p.body, { bind: true });
        n.querySelector('.nvui-acc-head').click();
        const opened = n.classList.contains('is-open');
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t6');
            p.destroy();
            return {
                pass: count === 0 && opened === true && st === null,
                detail: JSON.stringify({ count, opened, st }),
            };
        });
    });

    // ------------------------------------------------------------------ T7
    await run('T7', 'clearLayoutState 后全部收起，不残留 true', () => {
        localStorage.clear();
        const p = window.__panel('acc-t7', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="c1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">C</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">C</div></div></div>');
        const n = nodes[0];
        p.trackAccordion(n);
        n.setOpen(true); // 走补齐的 setOpen（恢复 / 清除同一路径）
        return window.__wait(420).then(() => {
            p.clearLayoutState();
            const closed = !n.classList.contains('is-open');
            return window.__wait(420).then(() => {
                const st = window.__state('acc-t7');
                p.destroy();
                const noTrue = !st || !st.accordion || st.accordion.c1 !== true;
                return {
                    pass: closed === true && noTrue,
                    detail: JSON.stringify({ closed, acc: st && st.accordion }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T8
    await run('T8', 'destroy 后解绑：点击不再改变状态、不再落盘', () => {
        localStorage.clear();
        const p = window.__panel('acc-t8', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="d1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">D</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">D</div></div></div>');
        const n = nodes[0];
        p.trackAccordion(n, { bind: true });
        const head = n.querySelector('.nvui-acc-head');
        head.click(); // 打开
        return window.__wait(420).then(() => {
            const before = localStorage.getItem('nvui_state_acc-t8');
            p.destroy();
            return window.__wait(160).then(() => {
                head.click(); // 已销毁：应完全无反应
                const stillOpen = n.classList.contains('is-open');
                return window.__wait(420).then(() => ({
                    pass: stillOpen === true && localStorage.getItem('nvui_state_acc-t8') === before,
                    detail: JSON.stringify({ stillOpen, unchanged: localStorage.getItem('nvui_state_acc-t8') === before }),
                }));
            });
        });
    });

    // ------------------------------------------------------------------ T9
    await run('T9', '拒绝 document / body 与其它面板的全量接管', () => {
        localStorage.clear();
        const p = window.__panel('acc-t9', { size: false, tab: false, accordion: true });
        window.__inject(p, '<div class="nvui-acc" id="g1">'
            + '<button type="button" class="nvui-acc-head">G</button></div>');
        const p2 = window.__panel('acc-t9b', { size: false, tab: false, accordion: true });
        window.__inject(p2, '<div class="nvui-acc" id="g2">'
            + '<button type="button" class="nvui-acc-head">G2</button></div>');
        const onDocument = p.adoptAccordions(document);
        const onBody = p.adoptAccordions(document.body);
        const onOtherPanel = p.adoptAccordions(p2.body);
        const onPanel = p.adoptAccordions(p.body);
        p2.destroy();
        p.destroy();
        return {
            pass: onDocument === 0 && onBody === 0 && onOtherPanel === 0 && onPanel === 1,
            detail: JSON.stringify({ onDocument, onBody, onOtherPanel, onPanel }),
        };
    });

    // ------------------------------------------------------------------ T10
    await run('T10', '调用方自带 setOpen / 点击监听真实开合，kit 不重复 toggle（bind:false）', () => {
        localStorage.clear();
        const p = window.__panel('acc-t10', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="u1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">U</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">U</div></div></div>');
        const n = nodes[0];
        const head = n.querySelector('.nvui-acc-head');
        let calls = 0;
        let clicks = 0;
        n.setOpen = function (v) { calls++; this.classList.toggle('is-open', !!v); };
        head.addEventListener('click', function () {
            clicks++;
            n.classList.toggle('is-open'); // 真实应用方开合，不是空计数
        });
        const id = p.trackAccordion(n, 'custom', { bind: false });
        head.click();
        const afterClickOpen = n.classList.contains('is-open');
        n.setOpen(true); // 只经调用方 setOpen 改动，验证保存钩子
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t10');
            p.destroy();
            return {
                pass: id === 'custom' && calls === 1 && clicks === 1 && afterClickOpen === true
                    && !!(st && st.accordion && st.accordion.custom === true),
                detail: JSON.stringify({ id, calls, clicks, afterClickOpen, acc: st && st.accordion }),
            };
        });
    });

    // ------------------------------------------------------------------ T11
    await run('T11', 'adopt 的 root 自身就是折叠条时也要接管', () => {
        localStorage.clear();
        const p = window.__panel('acc-t11', { size: false, tab: false, accordion: true });
        const holder = document.createElement('div');
        holder.innerHTML = '<div class="nvui-acc" id="root-acc">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">R</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">R</div></div></div>';
        const node = holder.firstElementChild;
        p.body.appendChild(node);
        const count = p.adoptAccordions(node);
        const id = p.trackAccordion(node);
        p.destroy();
        return {
            pass: count === 1 && id === 'root-acc',
            detail: JSON.stringify({ count, id }),
        };
    });

    // ------------------------------------------------------------------ T12
    await run('T12', '同 id 冲突时拒绝注册，不覆盖已注册节点', () => {
        localStorage.clear();
        const p = window.__panel('acc-t12', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="dup1"><button type="button" class="nvui-acc-head">1</button></div>'
            + '<div class="nvui-acc" id="dup2"><button type="button" class="nvui-acc-head">2</button></div>');
        const a = p.trackAccordion(nodes[0]);
        const b = p.trackAccordion(nodes[1], 'dup1');
        const c = p.trackAccordion(nodes[1]);
        p.destroy();
        return {
            pass: a === 'dup1' && b === null && c === 'dup2',
            detail: JSON.stringify({ a, b, c }),
        };
    });

    // ------------------------------------------------------------------ T13
    await run('T13', '默认不绑定点击：调用方切换 class 不双重 toggle，状态仍落盘', () => {
        localStorage.clear();
        const p = window.__panel('acc-t13', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="nb1">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">N</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">N</div></div></div>');
        const n = nodes[0];
        const head = n.querySelector('.nvui-acc-head');
        let ownClicks = 0;
        /* 模拟调用方自己的（或事件委托的）点击处理：kit 不应再插一手 */
        head.addEventListener('click', function () {
            ownClicks++;
            n.classList.toggle('is-open');
        });
        const id = p.trackAccordion(n); // 未传 bind
        head.click();
        const openedByCaller = n.classList.contains('is-open');
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t13');
            p.destroy();
            return {
                pass: id === 'nb1' && ownClicks === 1 && openedByCaller === true
                    && !!(st && st.accordion && st.accordion.nb1 === true),
                detail: JSON.stringify({ id, ownClicks, openedByCaller, acc: st && st.accordion }),
            };
        });
    });

    // ------------------------------------------------------------------ T15
    await run('T15', '同面板多次重渲染：同 key 新节点替换旧条目，立即 close/destroy 后真实恢复', () => {
        localStorage.clear();
        const html = '<div class="nvui-acc" id="rr-a">'
            + '<button type="button" class="nvui-acc-head" aria-expanded="false">R</button>'
            + '<div class="nvui-acc-body"><div class="nvui-acc-inner">R</div></div></div>';
        const p = window.__panel('acc-t15', { size: false, tab: false, accordion: true });
        window.__inject(p, html);
        const first = p.adoptAccordions(p.body, { bind: true });
        p.body.querySelector('.nvui-acc-head').click(); // 打开并等待落盘
        return window.__wait(420).then(() => {
            const savedOpen = window.__state('acc-t15');
            let renderCount = 0;
            for (let i = 0; i < 3; i++) {
                window.__inject(p, html); // 旧节点脱离本面板，但仍有 accList 条目
                const c = p.adoptAccordions(p.body, { bind: true });
                const n = p.body.querySelector('.nvui-acc');
                if (c === 1 && n.classList.contains('is-open')) renderCount += 1;
            }
            p.clearLayoutState(); // 只应作用于当前有效的新节点
            const clearedNew = !p.body.querySelector('.nvui-acc').classList.contains('is-open');
            const last = p.body.querySelector('.nvui-acc');
            const lastHead = last.querySelector('.nvui-acc-head');
            lastHead.click(); // 打开
            lastHead.click(); // 关闭，立即 close
            p.close();
            const afterClose = window.__state('acc-t15');
            p.destroy();
            return window.__wait(160).then(() => {
                const p2 = window.__panel('acc-t15', { size: false, tab: false, accordion: true });
                window.__inject(p2, html);
                const c2 = p2.adoptAccordions(p2.body, { bind: true });
                const n2 = p2.body.querySelector('.nvui-acc');
                const restoredClosed = !n2.classList.contains('is-open');
                const aria = n2.querySelector('.nvui-acc-head').getAttribute('aria-expanded');
                n2.querySelector('.nvui-acc-head').click(); // 重开后打开，立即 destroy
                p2.destroy();
                return window.__wait(160).then(() => {
                    const p3 = window.__panel('acc-t15', { size: false, tab: false, accordion: true });
                    window.__inject(p3, html);
                    const c3 = p3.adoptAccordions(p3.body, { bind: true });
                    const restoredOpen = p3.body.querySelector('.nvui-acc').classList.contains('is-open');
                    p3.destroy();
                    return {
                        pass: first === 1 && renderCount === 3 && clearedNew
                            && c2 === 1 && restoredClosed && aria === 'false'
                            && c3 === 1 && restoredOpen
                            && !!(savedOpen && savedOpen.accordion && savedOpen.accordion['rr-a'] === true)
                            && !!(afterClose && afterClose.accordion && afterClose.accordion['rr-a'] === false),
                        detail: JSON.stringify({
                            first,
                            saved: savedOpen && savedOpen.accordion,
                            renderCount,
                            clearedNew,
                            afterClose: afterClose && afterClose.accordion,
                            c2,
                            restoredClosed,
                            aria,
                            c3,
                            restoredOpen,
                        }),
                    };
                });
            });
        });
    });

    // ------------------------------------------------------------------ T16
    await run('T16', 'persist.accordion:false 不恢复/不登记；size/tab 仍保存；全 false 不写空状态', () => {
        localStorage.clear();
        localStorage.setItem('nvui_state_acc-t16', JSON.stringify({
            version: 1,
            size: { width: 700, height: 600, isMaximized: false },
            tab: 'a',
            accordion: { oldA: true, oldB: true },
        }));
        const p = NVUI.createPanel({
            id: 'acc-t16',
            title: 'T',
            tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
            persist: { size: true, tab: true, accordion: false },
        });
        p.open();
        const a = p.addAccordion('a', { id: 'oldA', title: 'A', content: [] });
        const b = NVUI.accordion({ title: 'B' });
        b.id = 'oldB';
        p.addNode('a', b);
        const closedBoth = !a.classList.contains('is-open') && !b.classList.contains('is-open');
        p.setTab('b');
        p.setSize(640, 500);
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t16');
            p.destroy();
            const p2 = NVUI.createPanel({
                id: 'acc-t16b',
                title: 'T2',
                persist: { size: false, tab: false, accordion: false },
            });
            p2.open();
            p2.addAccordion(null, { id: 'x', title: 'X', content: [] });
            p2.close();
            p2.destroy();
            return window.__wait(80).then(() => {
                const st2 = window.__state('acc-t16b');
                return {
                    pass: closedBoth && !!st && st.tab === 'b' && st.size && st.size.w === 640
                        && st2 === null,
                    detail: JSON.stringify({
                        closedBoth,
                        tab: st && st.tab,
                        size: st && st.size,
                        accordion: st && st.accordion,
                        allFalseState: st2,
                    }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T17
    await run('T17', '中文/非 ASCII 键与工厂/注入混合登记相互独立（含 __proto__）', () => {
        localStorage.clear();
        const p = window.__panel('acc-t17', { size: false, tab: false, accordion: true });
        const nodes = window.__inject(p, '<div class="nvui-acc" id="中文一">'
            + '<button type="button" class="nvui-acc-head">一</button></div>'
            + '<div class="nvui-acc" data-nvui-acc-key="中文二">'
            + '<button type="button" class="nvui-acc-head">二</button></div>');
        const id1 = p.trackAccordion(nodes[0]);
        const id2 = p.trackAccordion(nodes[1]);
        const a = p.addAccordion('x', { title: '高级', content: [] });
        const b = p.addAccordion('x', { title: '基本', content: [] });
        const c = NVUI.accordion({ title: '混合' });
        c.id = '混合-id';
        p.addNode('x', c);
        const proto = document.createElement('div');
        proto.className = 'nvui-acc';
        proto.id = '__proto__';
        proto.innerHTML = '<button type="button" class="nvui-acc-head">P</button>';
        p.body.appendChild(proto);
        const idProto = p.trackAccordion(proto);

        nodes[0].setOpen(true);
        nodes[1].setOpen(true);
        a.setOpen(true);
        b.setOpen(true);
        c.setOpen(true);
        proto.setOpen(true);
        return window.__wait(420).then(() => {
            const st = window.__state('acc-t17');
            const acc = st && st.accordion;
            const protoOwn = !!acc && Object.prototype.hasOwnProperty.call(acc, '__proto__');
            const protoVal = protoOwn ? acc['__proto__'] : undefined;
            p.destroy();
            return {
                pass: id1 === '中文一' && id2 === '中文二' && idProto === '__proto__'
                    && !!acc
                    && acc['中文一'] === true && acc['中文二'] === true
                    && acc['高级'] === true && acc['基本'] === true
                    && acc['混合-id'] === true
                    && protoOwn && protoVal === true,
                detail: JSON.stringify({
                    id1,
                    id2,
                    idProto,
                    keys: acc ? Object.keys(acc) : null,
                    protoOwn,
                    protoVal,
                    acc,
                }),
            };
        });
    });

    // ------------------------------------------------------------------ T18
    await run('T18', '外部容器拒绝、detached 预注册允许、destroy 后各注册链不再挂监听', () => {
        localStorage.clear();
        const p = window.__panel('acc-t18', { size: false, tab: false, accordion: true });
        const ext = document.createElement('div');
        ext.innerHTML = '<div class="nvui-acc" id="ext">'
            + '<button type="button" class="nvui-acc-head">E</button></div>';
        document.body.appendChild(ext);
        const rejected = p.adoptAccordions(ext);

        const det = document.createElement('div');
        det.className = 'nvui-acc';
        det.id = 'det';
        det.innerHTML = '<button type="button" class="nvui-acc-head">D</button>';
        const pre = p.trackAccordion(det); // 插入前预注册
        p.body.appendChild(det);
        det.setOpen(true);
        return window.__wait(420).then(() => {
            p.destroy();
            const afterDestroy = localStorage.getItem('nvui_state_acc-t18');
            const late = NVUI.accordion({ id: 'late' });
            p.addNode('t', late);
            const late2 = p.addAccordion('t', { id: 'late2', title: 'L2', content: [] });
            const afterTrack = p.trackAccordion(late2); // destroy 后各链都不应再登记
            const afterAdopt = p.adoptAccordions(p.body);
            late.setOpen(true);
            late2.setOpen(true);
            return window.__wait(80).then(() => {
                const after = localStorage.getItem('nvui_state_acc-t18');
                ext.remove();
                const stateText = after || '';
                return {
                    pass: rejected === 0 && pre === 'det' && after === afterDestroy
                        && afterTrack === null && afterAdopt === 0
                        && stateText.indexOf('"det":true') !== -1
                        && stateText.indexOf('"ext"') === -1
                        && stateText.indexOf('"late"') === -1
                        && stateText.indexOf('"late2"') === -1,
                    detail: JSON.stringify({
                        rejected,
                        pre,
                        afterTrack,
                        afterAdopt,
                        unchanged: after === afterDestroy,
                        state: afterDestroy,
                    }),
                };
            });
        });
    });

    // ------------------------------------------------------- 页面错误汇总
    const t0 = Date.now();
    record('T14', '全程 0 pageerror / 0 console error',
        pageErrors.length === 0 && consoleErrors.length === 0,
        JSON.stringify({ pageErrors, consoleErrors }), Date.now() - t0);

    await browser.close();
    await sandbox.close();

    const failed = results.filter((r) => !r.pass);
    console.log('\n\x1b[1m------------------------------------------------------------\x1b[0m');
    console.log((failed.length ? '\x1b[31m' : '\x1b[32m')
        + '  结果: ' + (results.length - failed.length) + '/' + results.length + ' PASS'
        + '\x1b[0m');
    if (failed.length) {
        console.log('\x1b[31m  失败项: ' + failed.map((r) => r.id).join(', ') + '\x1b[0m');
    }
    console.log('\x1b[1m------------------------------------------------------------\x1b[0m');
    process.exit(failed.length ? 1 : 0);
})().catch((err) => {
    console.error('[FATAL] 测试脚本异常: ' + (err && err.stack ? err.stack : err));
    process.exit(1);
});
