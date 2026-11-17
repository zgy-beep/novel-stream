/**
 * Issue #16 回归：persist.size:false 必须完全不参与尺寸持久化
 * ---------------------------------------------------------------------------
 * 缺陷（v2.8.0）：下游用 createPanel({ persist: { size: false } }) 关掉尺寸持久化后，
 * 只要 nvui_state_<id> 里曾经存在过 size.width/height（旧版本存过、或用户拖拽过），
 * 重新打开面板时 applyClamping() 仍会读 loadedState.size 并写回内联 px，
 * 把下游 CSS（`height: var(--nvui-panel-max-h)` / 94vh）压掉。
 *
 * 覆盖：
 *   T1  复现主路径：预置旧 size + persist.size:false → 不写内联 height，高度回归 CSS token
 *   T2  历史遗留值被主动清掉：落盘后 size === null，tab / accordion 存档保留
 *   T3  门禁不误伤内联 px：调用方自己写的 px 高度仍被视口钳制（clamp 语义不变）
 *   T4  不误伤 persist.size:true：旧尺寸照常恢复
 *   T5  清理后再开：同名面板依然没有内联 height（不会死灰复燃）
 *   T6  完全没有 persist 时不写任何尺寸内联样式
 *   T7  旧存档 isMaximized:true + persist.size:false：不进最大化态、不写 calc 尺寸
 *   T13 全程 0 pageerror / 0 console error（置于末尾，涵盖 T1–T12）
 *
 * 尺寸语义矩阵（A1，2026-11-16）：
 *   T9  三项全关 {size:false,tab:false,accordion:false}：既不写存储也不写内联尺寸
 *   T10 persist:true 三项全开：尺寸照常恢复并回写
 *   T11 persist:{} 未显式关闭的项默认开启：空配置等价于全开
 *   T12 异步 StorageAdapter：size:false 下 size:null 落盘，tab/accordion 保留
 *
 * 运行（与仓库其它实机脚本同一套依赖解析顺序）：
 *   node test/issue-16-persist-size.js
 * 可选环境变量：
 *   ST_CHROME  Chrome 可执行文件路径（默认 C:/Program Files/Google/Chrome/Application/chrome.exe）
 * 依赖：playwright-core（NODE_PATH 或 resolvePlaywright 的兜底路径）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

function resolvePlaywright() {
    try {
        return require('playwright-core');
    } catch (e) {
        try {
            return require('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
        } catch (e2) {
            console.error('[FATAL] 无法解析 playwright-core: ' + e.message);
            console.error('        请设置 NODE_PATH 指向含 playwright-core 的 node_modules。');
            process.exit(1);
        }
    }
}

const { chromium } = resolvePlaywright();

const KIT_ROOT = path.resolve(__dirname, '..');
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
    <title>NVUI Issue #16 Regression</title>
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
    console.log('\x1b[1m\x1b[35m  Issue #16 · persist.size:false 尺寸隔离开关回归           \x1b[0m');
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const text = m.text();
        if (/favicon/i.test(text)) return;
        consoleErrors.push(text);
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

    /* 页面内共用工具：存档预置 / 面板工厂 / 状态读取 / 量高 */
    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__key = (id) => 'nvui_state_' + id;
        window.__seed = (id, state) => localStorage.setItem('nvui_state_' + id, JSON.stringify(state));
        window.__state = (id) => {
            try { return JSON.parse(localStorage.getItem('nvui_state_' + id) || 'null'); }
            catch (e) { return 'PARSE_ERROR'; }
        };
        window.__open = (opts) => {
            const p = NVUI.createPanel(opts);
            p.open();
            return p;
        };
        window.__metrics = (p) => {
            const el = p.panel;
            const rect = el.getBoundingClientRect();
            /* v3.0.0：尺寸载体是 CSS 变量，内联 px 停写。这里读「kit 实际施加的尺寸」：
               变量优先，其次才是 v2.x 遗留的内联 px（legacy 开关下仍会写）。 */
            const applied = (axis) => {
                const v = el.style.getPropertyValue(axis === 'h' ? '--nvui-panel-h' : '--nvui-panel-w');
                if (v) return v;
                return (axis === 'h' ? el.style.height : el.style.width) || '';
            };
            return {
                appliedHeight: applied('h'),
                appliedWidth: applied('w'),
                rectHeight: Math.round(rect.height),
                maximized: el.classList.contains('is-maximized'),
            };
        };
        /* 下游典型做法：用 CSS 变量接管面板高度 */
        window.__setToken = (name, value) => document.documentElement.style.setProperty(name, value);
        window.__staleSize = { width: 720, height: 400, isMaximized: false };
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
    await run('T1', '预置旧 size + persist.size:false：不写内联 height，高度回到 CSS token', () => {
        localStorage.clear();
        window.__setToken('--nvui-panel-max-h', '94vh'); // 下游接管：1440x900 下期望 846px
        window.__seed('p16-t1', {
            version: 1,
            size: window.__staleSize,
            tab: 'main',
            accordion: { a1: true },
        });
        const p = window.__open({ id: 'p16-t1', title: 'T1', persist: { size: false, tab: true, accordion: true } });
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            const expected = Math.round(window.innerHeight * 0.94);
            p.destroy();
            window.__setToken('--nvui-panel-max-h', '');
            return {
                pass: m.appliedHeight === '' && Math.abs(m.rectHeight - expected) <= 2,
                detail: JSON.stringify({ ...m, expected, viewportH: window.innerHeight }),
            };
        });
    });

    // ------------------------------------------------------------------ T2
    await run('T2', '历史遗留 size 被主动清掉，tab / accordion 存档保留', () => {
        localStorage.clear();
        window.__seed('p16-t2', {
            version: 1,
            size: window.__staleSize,
            tab: 'main',
            accordion: { keep: true },
        });
        const p = window.__open({ id: 'p16-t2', title: 'T2', persist: { size: false, tab: true, accordion: true } });
        return window.__wait(120).then(() => {
            p.destroy();
            return window.__wait(80).then(() => {
                const st = window.__state('p16-t2');
                return {
                    /* 本例面板无 tabs：tab 解析不出 key 时存 null 是既有语义；
                       关键是 size 被清成 null，而 accordion 存档不受影响。 */
                    pass: !!st && st.size === null
                        && st.tab === null
                        && !!st.accordion && st.accordion.keep === true,
                    detail: JSON.stringify(st),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T3
    await run('T3', '门禁不误伤内联 px：调用方写死的超高仍被视口钳制', () => {
        localStorage.clear();
        window.__seed('p16-t3', { version: 1, size: window.__staleSize, tab: null, accordion: null });
        const p = window.__open({ id: 'p16-t3', title: 'T3', persist: { size: false, tab: true, accordion: true } });
        /* 调用方（或拖拽）自己写的 px 高度：仍必须被视口钳制 */
        p.setSize(720, 5000);
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return {
                pass: parseInt(m.appliedHeight || '0', 10) < 5000
                    && parseInt(m.appliedHeight || '0', 10) <= window.innerHeight
                    && m.rectHeight <= window.innerHeight,
                detail: JSON.stringify({ ...m, viewportH: window.innerHeight }),
            };
        });
    });

    // ------------------------------------------------------------------ T4
    await run('T4', 'persist.size:true 不误伤：旧尺寸照常恢复', () => {
        localStorage.clear();
        window.__seed('p16-t4', { version: 1, size: { width: 720, height: 400, isMaximized: false }, tab: null, accordion: null });
        const p = window.__open({ id: 'p16-t4', title: 'T4', persist: { size: true, tab: true, accordion: true } });
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return {
                pass: m.appliedHeight === '400px' && m.rectHeight === 400,
                detail: JSON.stringify(m),
            };
        });
    });

    // ------------------------------------------------------------------ T5
    await run('T5', '清理后再开同名面板：依然没有内联 height（不会死灰复燃）', () => {
        localStorage.clear();
        /* 模拟「已被清理过」的存档：size 已为 null，tab/accordion 还在 */
        window.__seed('p16-t5', { version: 1, size: null, tab: null, accordion: { keep: true } });
        window.__setToken('--nvui-panel-max-h', '94vh');
        const p = window.__open({ id: 'p16-t5', title: 'T5', persist: { size: false, tab: true, accordion: true } });
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            const expected = Math.round(window.innerHeight * 0.94);
            p.destroy();
            window.__setToken('--nvui-panel-max-h', '');
            return window.__wait(80).then(() => {
                const st = window.__state('p16-t5');
                return {
                    pass: m.appliedHeight === '' && Math.abs(m.rectHeight - expected) <= 2
                        && !!st && st.size === null && !!st.accordion && st.accordion.keep === true,
                    detail: JSON.stringify({ ...m, expected, savedSize: st && st.size, savedAcc: st && st.accordion }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T6
    await run('T6', '完全没有 persist 时不写任何尺寸内联样式', () => {
        const p = window.__open({ id: 'p16-t6', title: 'T6' });
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return {
                pass: m.appliedHeight === '' && m.appliedWidth === ''
                    && window.__state('p16-t6') === null,
                detail: JSON.stringify({ ...m, state: window.__state('p16-t6') }),
            };
        });
    });

    // ------------------------------------------------------------------ T7
    await run('T7', '旧存档 isMaximized:true + persist.size:false：不进最大化态', () => {
        localStorage.clear();
        window.__seed('p16-t7', {
            version: 1,
            size: { width: 900, height: 700, isMaximized: true },
            tab: null,
            accordion: null,
        });
        const p = window.__open({ id: 'p16-t7', title: 'T7', persist: { size: false, tab: true, accordion: true } });
        return window.__wait(120).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return {
                pass: m.maximized === false && m.appliedHeight === ''
                    && !/calc\(100v[w|h]/.test(m.appliedHeight),
                detail: JSON.stringify(m),
            };
        });
    });

    // ------------------------------------------------------------------ T9
    await run('T9', '三项全关（size/tab/accordion:false）：既不写存储也不写内联尺寸', () => {
        localStorage.clear();
        /* timestamp 是「有没有被重写」的指纹：全关时存档必须原样不动 */
        window.__seed('p16-t9', {
            version: 1,
            timestamp: 111,
            size: window.__staleSize,
            tab: 'ghost',
            accordion: { keep: true },
        });
        const p = window.__open({
            id: 'p16-t9', title: 'T9',
            persist: { size: false, tab: false, accordion: false },
        });
        return window.__wait(150).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return window.__wait(120).then(() => {
                const st = window.__state('p16-t9');
                return {
                    pass: m.appliedHeight === '' && m.appliedWidth === ''
                        && !!st && st.timestamp === 111
                        && !!st.size && st.size.width === 720
                        && st.tab === 'ghost'
                        && !!st.accordion && st.accordion.keep === true,
                    detail: JSON.stringify({ ...m, stored: st }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T10
    await run('T10', 'persist:true 三项全开：尺寸照常恢复并回写', () => {
        localStorage.clear();
        window.__seed('p16-t10', {
            version: 1,
            size: { width: 720, height: 400, isMaximized: false },
            tab: null,
            accordion: null,
        });
        const p = window.__open({ id: 'p16-t10', title: 'T10', persist: true });
        return window.__wait(150).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return window.__wait(120).then(() => {
                const st = window.__state('p16-t10');
                return {
                    pass: m.appliedHeight === '400px' && m.appliedWidth === '720px' && m.rectHeight === 400
                        && !!st && !!st.size && st.size.w === 720 && st.size.h === 400,
                    detail: JSON.stringify({ ...m, savedSize: st && st.size }),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T11
    await run('T11', 'persist:{} 未显式关闭的项默认开启（空配置等价于全开）', () => {
        localStorage.clear();
        const p = window.__open({ id: 'p16-t11', title: 'T11', persist: {} });
        return window.__wait(150).then(() => {
            p.destroy();
            return window.__wait(120).then(() => {
                const st = window.__state('p16-t11');
                /* 「参与持久化」= 落的是 size 对象（对比 T9 的原样不动 / T2 的 null）；
                   高度可以为 null —— 关闭时面板已隐藏，offsetHeight 读不到是既有语义。 */
                return {
                    pass: !!st && !!st.size && st.size.w === 720
                        && Object.prototype.hasOwnProperty.call(st, 'tab')
                        && Object.prototype.hasOwnProperty.call(st, 'accordion'),
                    detail: JSON.stringify(st),
                };
            });
        });
    });

    // ------------------------------------------------------------------ T12
    await run('T12', '异步 StorageAdapter：size:false 下 size:null 落盘，tab/accordion 保留', () => {
        localStorage.clear();
        window.__asyncStore = {};
        window.__asyncGets = [];
        window.__asyncAdapter = {
            get: function (key) {
                window.__asyncGets.push(key);
                return Promise.resolve(window.__asyncStore[key] || null);
            },
            set: function (key, val) {
                window.__asyncStore[key] = val;
                return Promise.resolve();
            },
            delete: function (key) {
                delete window.__asyncStore[key];
                return Promise.resolve();
            },
        };
        window.__asyncStore['nvui_state_p16-t12'] = {
            version: 1,
            size: window.__staleSize,
            tab: null,
            accordion: { a1: true },
        };
        const p = window.__open({
            id: 'p16-t12', title: 'T12',
            persist: { size: false, tab: true, accordion: true, storage: window.__asyncAdapter },
        });
        return window.__wait(200).then(() => {
            const m = window.__metrics(p);
            p.destroy();
            return window.__wait(200).then(() => {
                const st = window.__asyncStore['nvui_state_p16-t12'];
                return {
                    pass: window.__asyncGets.length === 1
                        && window.__asyncGets[0] === 'nvui_state_p16-t12'
                        && m.appliedHeight === ''
                        && !!st && st.size === null
                        && !!st.accordion && st.accordion.a1 === true,
                    detail: JSON.stringify({ metrics: m, gets: window.__asyncGets, stored: st }),
                };
            });
        });
    });

    // ----------------------------------------------------------------- T13
    await new Promise((r) => setTimeout(r, 120));
    record('T13', '全程 0 pageerror / 0 console error（涵盖 T1–T12）',
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
