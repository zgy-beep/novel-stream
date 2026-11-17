/**
 * v2.9.0 / GH-#18 B6 回归：NVUI.setTheme('auto')
 * ---------------------------------------------------------------------------
 * 下游普遍自己写「系统深浅 + 宿主浅色」两套胶水。这里收进 setTheme：
 *   - 系统信号：matchMedia('(prefers-color-scheme: light)')，change 即时生效；
 *   - 宿主信号：切到 auto 那一刻 body 上已有的 .nvui-theme-light（宿主皮肤声明）；
 *   - 显式 'light' / 'dark' 会摘掉 auto 的监听，主权交回调用方。
 *
 * 覆盖：
 *   A1  系统深色 + auto → 无 .nvui-theme-light
 *   A2  系统切浅色 → 1 帧内加上类（matchMedia change 生效）
 *   A3  系统切回深色 → 类随之移除
 *   A4  宿主信号：深色系统 + body 已有类 → auto 保持浅色
 *   A5  显式 dark 覆盖 auto：之后系统再切浅色也不动（监听已摘）
 *   A6  显式 light 后调 auto（深色系统）→ 回到深色（不把自己写的类当宿主信号）
 *   A7  重复调用 auto 不叠加监听（listenerCounts.change 恒为 1）
 *   A8  切主题后令牌缓存失效：getToken('--nvui-bg', body) 跟着变
 *   A9  全程 0 pageerror / 0 console error
 *
 * 运行：node test/v290-theme-auto.spec.js
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
    <title>NVUI v2.9.0 B6 theme auto</title>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/components.css">
</head>
<body>
    <div class="nvui-scope" id="probe">宿主聊天区</div>
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
    console.log('\x1b[1m\x1b[35m  v2.9.0 B6 · setTheme(\'auto\')                            \x1b[0m');
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
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/favicon/i.test(m.text())) return;
        consoleErrors.push(m.text());
    });

    /* 初始必须是深色：Playwright 默认 light，而 A1 要验「深色系统下不加类」 */
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(sandbox.url, { waitUntil: 'domcontentloaded' });

    const ready = await page.evaluate(() => typeof window.NVUI === 'object'
        && window.NVUI !== null && typeof window.NVUI.setTheme === 'function'
        && typeof window.NVUI.diagnostics === 'function');
    if (!ready) {
        console.error('[FATAL] NVUI 未加载');
        await browser.close();
        await sandbox.close();
        process.exit(1);
    }

    await page.evaluate(() => {
        window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
        window.__light = () => document.body.classList.contains('nvui-theme-light');
        window.__frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
        /* emulateMedia 的 change 是异步派发的（不在同一个任务里），单等一帧不稳。
           这里逐帧轮询到「系统信号与类名都到位」，并记录信号翻转后过了几帧才生效。 */
        window.__armProbe = () => new Promise((resolve) => {
            const mq = window.matchMedia('(prefers-color-scheme: light)');
            const t0 = performance.now();
            const handler = () => {
                mq.removeEventListener('change', handler);
                resolve({
                    light: window.__light(),
                    matches: mq.matches,
                    ms: Math.round((performance.now() - t0) * 10) / 10,
                    timeout: false,
                });
            };
            mq.addEventListener('change', handler);
            setTimeout(() => {
                mq.removeEventListener('change', handler);
                resolve({ timeout: true, light: window.__light(), matches: mq.matches });
            }, 1500);
        });
        window.__awaitTheme = (wantLight) => new Promise((resolve) => {
            const mq = window.matchMedia('(prefers-color-scheme: light)');
            let frames = 0;
            let flippedAt = -1;
            (function tick() {
                if (flippedAt < 0 && mq.matches === wantLight) flippedAt = frames;
                if (mq.matches === wantLight && window.__light() === wantLight) {
                    return resolve({ ok: true, frames: frames, afterFlip: flippedAt < 0 ? 0 : frames - flippedAt });
                }
                if (++frames > 40) {
                    return resolve({ ok: false, frames: frames, light: window.__light(), mq: mq.matches });
                }
                requestAnimationFrame(tick);
            })();
        });
        window.__reset = () => {
            NVUI.setTheme('dark');
            document.body.classList.remove('nvui-theme-light');
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

    // ------------------------------------------------------------------ A1
    await run('A1', '系统深色 + auto → 不加 .nvui-theme-light', () => {
        window.__reset();
        NVUI.setTheme('auto');
        return window.__awaitTheme(false).then((r) => ({
            pass: r.ok && window.matchMedia('(prefers-color-scheme: light)').matches === false,
            detail: JSON.stringify(r),
        }));
    });

    // ------------------------------------------------------------------ A2
    await page.evaluate(() => { window.__probe = window.__armProbe(); });
    await page.emulateMedia({ colorScheme: 'light' });
    await run('A2', '系统切浅色 → change 事件到达时类名已更新（同帧生效）', () => window.__probe.then((r) => ({
        pass: !r.timeout && r.light === true && r.matches === true,
        detail: JSON.stringify(r),
    })));

    // ------------------------------------------------------------------ A3
    await page.evaluate(() => { window.__probe = window.__armProbe(); });
    await page.emulateMedia({ colorScheme: 'dark' });
    await run('A3', '系统切回深色 → 类随之移除（同帧生效）', () => window.__probe.then((r) => ({
        pass: !r.timeout && r.light === false && r.matches === false,
        detail: JSON.stringify(r),
    })));

    // ------------------------------------------------------------------ A4
    await run('A4', '宿主信号：深色系统 + body 已有类 → auto 保持浅色', () => {
        window.__reset();
        document.body.classList.add('nvui-theme-light');
        NVUI.setTheme('auto');
        return window.__frame().then(() => {
            const light = window.__light();
            document.body.classList.remove('nvui-theme-light');
            return {
                pass: light === true,
                detail: JSON.stringify({ light: light, mqLight: window.matchMedia('(prefers-color-scheme: light)').matches }),
            };
        });
    });

    // ------------------------------------------------------------------ A5
    await run('A5', '显式 dark 覆盖 auto：之后系统再切浅色也不动（监听已摘）', () => {
        NVUI.setTheme('dark');
        return window.__frame().then(() => ({ pass: window.__light() === false, detail: 'after dark' }));
    });
    await page.emulateMedia({ colorScheme: 'light' });
    await run('A5b', '显式 dark 后系统切浅色 → 仍保持深色', () => window.__wait(200).then(() => ({
        pass: window.__light() === false
            && window.matchMedia('(prefers-color-scheme: light)').matches === true,
        detail: JSON.stringify({
            light: window.__light(),
            mqLight: window.matchMedia('(prefers-color-scheme: light)').matches,
        }),
    })));

    // ------------------------------------------------------------------ A6
    await page.emulateMedia({ colorScheme: 'dark' });
    await run('A6', '显式 light 后调 auto（深色系统）→ 回到深色（不把自己写的类当宿主信号）', () => {
        window.__reset();
        NVUI.setTheme('light');
        const afterLight = window.__light();
        NVUI.setTheme('auto');
        return window.__frame().then(() => ({
            pass: afterLight === true && window.__light() === false,
            detail: JSON.stringify({ afterLight: afterLight, afterAuto: window.__light() }),
        }));
    });

    // ------------------------------------------------------------------ A7
    await run('A7', '重复调用 auto 不叠加监听（listenerCounts.change 恒为 1）', () => {
        NVUI.setTheme('auto');
        NVUI.setTheme('auto');
        NVUI.setTheme('auto');
        const counts = NVUI.diagnostics().listenerCounts;
        return {
            pass: (counts.change || 0) === 1,
            detail: JSON.stringify(counts),
        };
    });

    // ------------------------------------------------------------------ A8
    await run('A8', '切主题后令牌缓存失效：getToken(--nvui-bg, body) 跟着变', () => {
        NVUI.setTheme('dark');
        const dark = NVUI.getToken('--nvui-bg', document.body);
        NVUI.setTheme('light');
        const light = NVUI.getToken('--nvui-bg', document.body);
        const again = NVUI.getToken('--nvui-bg', document.body);
        NVUI.setTheme('dark');
        return {
            pass: !!dark && !!light && dark !== light && again === light,
            detail: JSON.stringify({ dark: dark, light: light }),
        };
    });

    // ------------------------------------------------------------------ A9
    await new Promise((r) => setTimeout(r, 200));
    record('A9', '全程 0 pageerror / 0 console error',
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
