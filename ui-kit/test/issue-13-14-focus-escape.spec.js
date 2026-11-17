/**
 * NVUI Kit · Issues #13 / #14 浏览器回归（真实 Chrome + 真实键盘事件）
 * ---------------------------------------------------------------------------
 * 覆盖：
 *   #13 焦点管理
 *     T1  收起 accordion 的正文控件（visibility:hidden、offsetWidth > 0）
 *         不再污染焦点陷阱首尾；真实 Tab / Shift+Tab 只在可见控件间循环；
 *     T2  收起折叠体时，正文里的焦点被交还给折叠触发器；
 *     T3  持久化恢复到非首 tab 后，初始焦点进入当前激活 pane，而不是隐藏的
 *         首个 pane 里的 primary 按钮，也不停留在 Kit 载体上。
 *   #14 宿主模态
 *     T4  dialog.showModal() 期间按真实 Esc：宿主 cancel（fixture 里
 *         preventDefault 保持打开）优先，Kit 面板保持打开且 onClose 不触发；
 *         宿主关闭后 Esc 正常关闭 Kit 一次，再按 Esc 不重复关闭。
 *
 * 每个场景分别在两套资产上执行：
 *   root      = <repo>/nvui-api.js + tokens.css + components.css
 *   template  = <repo>/st-extension-template/ui-kit/ 下同名资产
 * 以证明两份 nvui-api.js 的修复行为等价。
 *
 * 运行（仓库既有实机脚本同一套依赖解析顺序）：
 *   node test/issue-13-14-focus-escape.spec.js
 *
 * 可选环境变量：
 *   ST_CHROME               Chrome 可执行文件（默认 Program Files 下的 Chrome）
 *   PLAYWRIGHT_MODULE_PATH  playwright-core 模块目录
 *
 * 不依赖 SillyTavern 服务、不访问网络、不修改 package.json。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

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

const ASSETS = [
    {
        label: 'root',
        api: path.join(KIT_ROOT, 'nvui-api.js'),
        tokens: path.join(KIT_ROOT, 'tokens.css'),
        css: path.join(KIT_ROOT, 'components.css'),
    },
    {
        label: 'template',
        api: path.join(KIT_ROOT, 'st-extension-template', 'ui-kit', 'nvui-api.js'),
        tokens: path.join(KIT_ROOT, 'st-extension-template', 'ui-kit', 'tokens.css'),
        css: path.join(KIT_ROOT, 'st-extension-template', 'ui-kit', 'components.css'),
    },
];

function pageHtml(label) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NVUI Issue #13/#14 Regression · ${label}</title>
    <link rel="stylesheet" href="/assets/${label}/tokens.css">
    <link rel="stylesheet" href="/assets/${label}/components.css">
</head>
<body>
    <div id="fixture-root"></div>
    <script src="/assets/${label}/nvui-api.js"></script>
</body>
</html>`;
}

function startEphemeralServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const pathname = url.pathname;
            if (pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }
            const pageMatch = /^\/(root|template)\.html$/.exec(pathname);
            if (pageMatch) {
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Cache-Control': 'no-store',
                });
                res.end(pageHtml(pageMatch[1]));
                return;
            }
            const assetMatch = /^\/assets\/(root|template)\/(tokens\.css|components\.css|nvui-api\.js)$/.exec(pathname);
            if (assetMatch) {
                const asset = ASSETS.find((item) => item.label === assetMatch[1]);
                const fileName = assetMatch[2];
                const filePath = fileName === 'tokens.css' ? asset.tokens
                    : (fileName === 'components.css' ? asset.css : asset.api);
                const mime = fileName === 'nvui-api.js' ? 'application/javascript' : 'text/css';
                if (asset && fs.existsSync(filePath)) {
                    res.writeHead(200, {
                        'Content-Type': mime + '; charset=utf-8',
                        'Cache-Control': 'no-store',
                    });
                    res.end(fs.readFileSync(filePath));
                    return;
                }
            }
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
        });
        server.listen(0, '127.0.0.1', () => {
            resolve({
                server,
                url: 'http://127.0.0.1:' + server.address().port,
                close: () => new Promise((done) => server.close(done)),
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

async function installPageHelpers(page) {
    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        window.__cleanup = () => {
            /* 连同宿主 fixture dialog 一起清掉，保证 T4/T5 之间不残留模态 */
            Array.prototype.forEach.call(document.querySelectorAll('dialog'), function (d) {
                try { if (d.open) d.close(); } catch (err) { /* ignore */ }
                try { d.remove(); } catch (err) { /* ignore */ }
            });
            Array.prototype.forEach.call(document.querySelectorAll('.nvui-overlay'), function (o) {
                try { o.remove(); } catch (err) { /* ignore */ }
            });
            window.__kitPanel = null;
            window.__kitClosed = 0;
        };
        window.__active = () => {
            const a = document.activeElement;
            const panel = document.querySelector('.nvui-panel');
            const firstPane = document.querySelector('.nvui-tabpane');
            return {
                id: (a && a.id) || '',
                tag: (a && a.tagName) || '',
                className: (a && typeof a.className === 'string') ? a.className : '',
                isBody: a === document.body,
                inPanel: !!(a && a.closest && a.closest('.nvui-panel') && panel),
                inFirstPane: !!(a && a.closest && a.closest('.nvui-tabpane') && a.closest('.nvui-tabpane') === firstPane),
                visible: !!(a && a.checkVisibility && a.checkVisibility({ checkVisibilityCSS: true })),
            };
        };
        window.__hiddenProbe = (id) => {
            const node = document.getElementById(id);
            return node ? {
                exists: true,
                offsetWidth: node.offsetWidth,
                checkVisibility: !!(node.checkVisibility && node.checkVisibility({ checkVisibilityCSS: true })),
            } : { exists: false };
        };
    });
}

(async () => {
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m');
    console.log('\x1b[1m\x1b[35m  Issues #13/#14 · 焦点陷阱 / 非首 tab / 宿主模态 Esc      \x1b[0m');
    console.log('\x1b[1m\x1b[35m============================================================\x1b[0m\n');

    for (const key of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[key];
    }
    process.env.NO_PROXY = '*';

    if (!fs.existsSync(CHROME_PATH)) {
        console.error('[FATAL] 找不到 Chrome: ' + CHROME_PATH + '（可用 ST_CHROME 指定）');
        process.exit(1);
    }

    /* 静态等价性：两份 nvui-api.js 必须逐字节一致（本次修复先同步再验证行为） */
    try {
        const rootBuf = fs.readFileSync(ASSETS[0].api);
        const templateBuf = fs.readFileSync(ASSETS[1].api);
        const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex');
        const templateHash = crypto.createHash('sha256').update(templateBuf).digest('hex');
        record('S0', 'root 与 template nvui-api.js 逐字节一致',
            rootBuf.equals(templateBuf), 'sha256=' + rootHash + ' / ' + templateHash, 0);
    } catch (err) {
        record('S0', 'root 与 template nvui-api.js 逐字节一致', false, '读取失败: ' + err.message, 0);
    }

    const sandbox = await startEphemeralServer();
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();

    let pageErrors = [];
    let consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/favicon/i.test(text)) return;
        consoleErrors.push(text);
    });

    async function runCase(id, name, fn) {
        const t0 = Date.now();
        try {
            const res = await fn();
            record(id, name, res && res.pass, res && res.detail, Date.now() - t0);
            return !!(res && res.pass);
        } catch (err) {
            record(id, name, false, '抛错: ' + (err && err.message), Date.now() - t0);
            return false;
        }
    }

    for (const asset of ASSETS) {
        pageErrors = [];
        consoleErrors = [];
        await page.goto(sandbox.url + '/' + asset.label + '.html', { waitUntil: 'domcontentloaded' });
        const loaded = await page.evaluate(() => typeof window.NVUI === 'object'
            && window.NVUI !== null && typeof window.NVUI.createPanel === 'function');
        if (!loaded) {
            record(asset.label + '-LOAD', 'NVUI 运行时加载', false, asset.api, 0);
            continue;
        }
        await installPageHelpers(page);
        console.log('\x1b[1m\x1b[36m--- 资产: ' + asset.label + ' (' + asset.api + ') ---\x1b[0m');

        /* ------------------------------------------------------------------
         * T1: 收起折叠体的隐藏按钮既不能进入 trap 边界，也不能被 Tab 到
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T1', '收起 accordion 的隐藏控件不进入 Tab 循环', async () => {
            const setup = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const p = NVUI.createPanel({ id: 't13-trap', mount: document.body, tabs: [{ key: 'a', label: 'A' }] });
                window.__kitPanel = p;
                const acc = document.createElement('div');
                acc.id = 't13-trap-acc';
                acc.className = 'nvui-acc is-open';
                acc.innerHTML = '<button type="button" id="trap-head" class="nvui-acc-head">Head</button>'
                    + '<div class="nvui-acc-body"><div class="nvui-acc-inner">'
                    + '<button type="button" id="inside">Hidden</button></div></div>';
                p.addNode('a', acc);
                const tracked = p.trackAccordion(acc);
                acc.setOpen(false);
                p.open();
                /* visibility 过渡 320ms：等它结束后再断言“隐藏控件不可见” */
                await window.__wait(500);
                const head = acc.querySelector('.nvui-acc-head');
                head.focus();
                return {
                    tracked,
                    headFocused: document.activeElement === head,
                    hidden: window.__hiddenProbe('inside'),
                };
            });
            await page.keyboard.press('Tab');
            const afterTab = await page.evaluate(() => window.__active());
            await page.evaluate(() => {
                const close = document.querySelector('.nvui-panel .nvui-icon-btn[aria-label="关闭面板"]')
                    || document.querySelector('.nvui-panel .nvui-icon-btn');
                if (close) close.focus();
            });
            await page.keyboard.press('Shift+Tab');
            const afterShiftTab = await page.evaluate(() => window.__active());

            const pass = setup.headFocused === true
                && setup.hidden.exists === true
                && setup.hidden.offsetWidth > 0        /* 复现前提：隐藏按钮仍有布局宽度 */
                && setup.hidden.checkVisibility === false
                && afterTab.inPanel === true
                && afterTab.isBody === false
                && afterTab.id !== 'inside'
                && afterTab.visible === true
                && afterShiftTab.id === 'trap-head'
                && afterShiftTab.isBody === false
                && afterShiftTab.visible === true;
            return {
                pass,
                detail: JSON.stringify({ setup, afterTab, afterShiftTab }),
            };
        });

        /* ------------------------------------------------------------------
         * T1b: 纯文本面板（内容区没有表单控件）—— 从激活 tab 按一次 Tab 不得逃出
         *      回归：未激活 tab 是 tabindex="-1"，若被当成 trap 尾项，激活 tab
         *      会被误判为「不是最后一站」而放行默认 Tab；原生序列已走完，
         *      焦点直接落到宿主页面（2026-11-16 实机冒烟发现）。
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T1b', '纯文本面板：激活 tab 按 Tab 仍留在面板内', async () => {
            const setup = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const p = NVUI.createPanel({
                    id: 't13-plain', mount: document.body,
                    tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
                });
                window.__kitPanel = p;
                p.addSectionTitle('a', '只有文字');
                p.open();
                await window.__wait(400);
                const tabA = document.getElementById('t13-plain-tab-a');
                tabA.focus();
                return {
                    focused: document.activeElement === tabA,
                    tabindexA: tabA.getAttribute('tabindex'),
                    tabindexB: document.getElementById('t13-plain-tab-b').getAttribute('tabindex'),
                };
            });
            await page.keyboard.press('Tab');
            const afterTab = await page.evaluate(() => window.__active());
            /* 再点非激活 tab（会激活并聚焦），确认随后 Tab 同样不逃出 */
            await page.evaluate(() => document.getElementById('t13-plain-tab-b').click());
            await page.waitForTimeout(250);
            await page.keyboard.press('Tab');
            const afterClickTab = await page.evaluate(() => window.__active());

            const pass = setup.focused === true
                && setup.tabindexA === '0'
                && setup.tabindexB === '-1'
                && afterTab.inPanel === true
                && afterTab.isBody === false
                && afterClickTab.inPanel === true
                && afterClickTab.isBody === false;
            return { pass, detail: JSON.stringify({ setup, afterTab, afterClickTab }) };
        });

        /* ------------------------------------------------------------------
         * T2: 收起时焦点从正文回收到折叠触发器
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T2', '收起折叠体时焦点回收到触发器', async () => {
            const res = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const p = NVUI.createPanel({ id: 't13-recover', mount: document.body, tabs: [{ key: 'a', label: 'A' }] });
                window.__kitPanel = p;
                const acc = document.createElement('div');
                acc.className = 'nvui-acc is-open';
                acc.innerHTML = '<button type="button" id="recover-head" class="nvui-acc-head">Head</button>'
                    + '<div class="nvui-acc-body"><div class="nvui-acc-inner">'
                    + '<button type="button" id="recover-inside">Inside</button></div></div>';
                p.addNode('a', acc);
                p.trackAccordion(acc);
                p.open();
                await window.__wait(160);
                const inside = acc.querySelector('#recover-inside');
                inside.focus();
                const before = window.__active();
                acc.setOpen(false);
                const after = window.__active();
                /* visibility 过渡 320ms 结束后再探测隐藏态 */
                await window.__wait(450);
                const hidden = window.__hiddenProbe('recover-inside');
                return { before, after, hidden };
            });
            return {
                pass: res.before.id === 'recover-inside'
                    && res.after.id === 'recover-head'
                    && res.after.inPanel === true
                    && res.after.visible === true
                    && res.hidden.checkVisibility === false,
                detail: JSON.stringify(res),
            };
        });

        /* ------------------------------------------------------------------
         * T3: 非首 tab 初始焦点进入当前激活 pane
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T3', '非首 tab 初始焦点不落在隐藏首 pane', async () => {
            const res = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const store = { version: 1, tab: 'b' };
                const p = NVUI.createPanel({
                    id: 't13-tabfocus',
                    mount: document.body,
                    tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
                    persist: {
                        size: false,
                        tab: true,
                        accordion: false,
                        storage: {
                            get: () => store,
                            set: (key, value) => { Object.keys(value || {}).forEach((k) => { store[k] = value[k]; }); },
                        },
                    },
                });
                window.__kitPanel = p;
                const input = document.createElement('input');
                input.id = 'b-input';
                input.className = 'nvui-input';
                p.addNode('b', input);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = 'a-primary';
                btn.className = 'nvui-btn is-primary';
                btn.textContent = 'A only';
                p.addNode('a', btn);
                p.open();
                await window.__wait(180);
                const info = window.__active();
                const paneB = document.getElementById('t13-tabfocus-pane-b');
                const paneA = document.getElementById('t13-tabfocus-pane-a');
                return {
                    activeId: info.id,
                    inPanel: info.inPanel,
                    inFirstPane: info.inFirstPane,
                    activeVisible: info.visible,
                    activeTabKey: p.activeTab,
                    paneBDisplay: paneB ? getComputedStyle(paneB).display : null,
                    paneADisplay: paneA ? getComputedStyle(paneA).display : null,
                    inPaneB: !!(document.activeElement && document.activeElement.closest
                        && document.activeElement.closest('.nvui-tabpane') === paneB),
                };
            });
            const pass = res.activeId === 'b-input'
                && res.inPanel === true
                && res.inPaneB === true
                && res.inFirstPane === false
                && res.activeVisible === true
                && res.activeTabKey === 'b'
                && res.paneBDisplay !== 'none'
                && res.paneADisplay === 'none';
            return { pass, detail: JSON.stringify(res) };
        });

        /* ------------------------------------------------------------------
         * T4: 宿主 showModal() 期间 Esc 只归宿主；关闭宿主后 Kit 恢复
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T4', '宿主 showModal 时 Esc 不关闭 Kit，关闭宿主后恢复', async () => {
            const setup = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const p = NVUI.createPanel({
                    id: 't14-host',
                    mount: document.body,
                    onClose: () => { window.__kitClosed += 1; },
                });
                window.__kitPanel = p;
                window.__kitClosed = 0;
                p.open();
                await window.__wait(180);
                const host = document.createElement('dialog');
                host.id = 'host-modal';
                host.innerHTML = '<button type="button" id="host-btn">host</button>';
                document.body.appendChild(host);
                host.addEventListener('cancel', (event) => event.preventDefault());
                host.showModal();
                host.querySelector('#host-btn').focus();
                return {
                    hostOpen: host.open,
                    kitHidden: p.overlay.hidden,
                    kitClosed: window.__kitClosed,
                    activeId: document.activeElement && document.activeElement.id,
                };
            });
            await page.waitForFunction(() => {
                const layer = document.querySelector('dialog.nvui-tl');
                return !!(layer && layer.classList.contains('is-host-modal'));
            }, null, { timeout: 3000 });

            await page.keyboard.press('Escape');
            await page.waitForTimeout(450);
            const during = await page.evaluate(() => {
                const host = document.getElementById('host-modal');
                return {
                    hostOpen: !!(host && host.open),
                    kitHidden: window.__kitPanel.overlay.hidden,
                    kitClosed: window.__kitClosed,
                    degraded: !!document.querySelector('dialog.nvui-tl.is-host-modal'),
                };
            });

            await page.evaluate(() => {
                const host = document.getElementById('host-modal');
                if (host && host.open) host.close();
            });
            await page.waitForFunction(() => {
                const layer = document.querySelector('dialog.nvui-tl');
                return !!(layer && !layer.classList.contains('is-host-modal'));
            }, null, { timeout: 3000 });

            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            const afterHostClose = await page.evaluate(() => ({
                kitHidden: window.__kitPanel.overlay.hidden,
                kitClosed: window.__kitClosed,
            }));

            await page.keyboard.press('Escape');
            await page.waitForTimeout(350);
            const afterExtraEscape = await page.evaluate(() => ({
                kitClosed: window.__kitClosed,
                kitHidden: window.__kitPanel.overlay.hidden,
            }));

            const pass = setup.hostOpen === true
                && setup.kitHidden === false
                && setup.activeId === 'host-btn'
                && during.hostOpen === true
                && during.kitHidden === false
                && during.kitClosed === 0
                && during.degraded === true
                && afterHostClose.kitHidden === true
                && afterHostClose.kitClosed === 1
                && afterExtraEscape.kitClosed === 1
                && afterExtraEscape.kitHidden === true;
            return {
                pass,
                detail: JSON.stringify({ setup, during, afterHostClose, afterExtraEscape }),
            };
        });

        /* ------------------------------------------------------------------
         * T5: 宿主 dialog 正常按 Esc 关闭自身时，Kit 仍保持打开
         * （不 preventDefault 的默认路径，对应验收“dialog 关闭、Kit 不动”）
         * ------------------------------------------------------------------ */
        await runCase(asset.label + '-T5', '宿主 dialog 默认 Esc 关闭自身且 Kit 保持打开', async () => {
            const setup = await page.evaluate(async () => {
                window.__cleanup();
                localStorage.clear();
                const p = NVUI.createPanel({
                    id: 't14-default',
                    mount: document.body,
                    onClose: () => { window.__kitClosed += 1; },
                });
                window.__kitPanel = p;
                window.__kitClosed = 0;
                p.open();
                await window.__wait(180);
                const host = document.createElement('dialog');
                host.id = 'host-default';
                host.innerHTML = '<button type="button" id="host-default-btn">host</button>';
                document.body.appendChild(host);
                host.showModal();
                host.querySelector('#host-default-btn').focus();
                return {
                    hostOpen: host.open,
                    kitHidden: p.overlay.hidden,
                    activeId: document.activeElement && document.activeElement.id,
                };
            });
            await page.waitForFunction(() => {
                const layer = document.querySelector('dialog.nvui-tl');
                return !!(layer && layer.classList.contains('is-host-modal'));
            }, null, { timeout: 3000 });

            await page.keyboard.press('Escape');
            await page.waitForTimeout(450);
            const after = await page.evaluate(() => {
                const host = document.getElementById('host-default');
                return {
                    hostOpen: !!(host && host.open),
                    kitHidden: window.__kitPanel.overlay.hidden,
                    kitClosed: window.__kitClosed,
                };
            });
            const pass = setup.hostOpen === true
                && setup.kitHidden === false
                && setup.activeId === 'host-default-btn'
                && after.hostOpen === false
                && after.kitHidden === false
                && after.kitClosed === 0;
            return { pass, detail: JSON.stringify({ setup, after }) };
        });

        await runCase(asset.label + '-E', '页面无 pageerror / console error', async () => ({
            pass: pageErrors.length === 0 && consoleErrors.length === 0,
            detail: JSON.stringify({ pageErrors, consoleErrors }),
        }));
    }

    await browser.close();
    await sandbox.close();

    const passed = results.filter((item) => item.pass).length;
    const failed = results.length - passed;
    console.log('\n\x1b[1m------------------------------------------------------------\x1b[0m');
    console.log('Summary: ' + passed + ' passed, ' + failed + ' failed, ' + results.length + ' total');
    if (failed > 0) {
        console.log('\x1b[31mFailed cases:\x1b[0m ' + results.filter((item) => !item.pass).map((item) => item.id).join(', '));
    }
    console.log('\x1b[1m------------------------------------------------------------\x1b[0m');
    process.exit(failed === 0 ? 0 : 1);
})().catch(async (err) => {
    console.error('[FATAL] ' + (err && err.stack ? err.stack : err));
    process.exit(1);
});
