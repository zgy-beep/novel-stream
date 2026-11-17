/**
 * NVUI Kit · destroy() close 事件派发时机 + NEW-18 挂载异常（自建验证脚本）
 *
 * 覆盖 lead 指定的 5 个验收点：
 *   1. document 级委托能收到 destroy 引发的 close 事件（NEW-16 核心验收点）
 *   2. destroy 后载体节点数归位（兜底定时器生效，不泄漏）
 *   3. mount 完全不可用 → 返回 null、不抛异常、有 error 级日志
 *   4. mount 无效但 body 可用 → 仍能创建、warn 级日志
 *   5. 正常路径不回归：destroy 后再 createPanel 能正常用
 *
 * 用法：node test/st-destroy-close-check.js <输出目录>
 * 说明：本脚本是工程师自建资产，不修改 test/st-review-*.js（QA 的资产）。
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const HOST_URL = 'http://127.0.0.1:8000/';
const OUT = process.argv[2];

(async () => {
    if (!OUT) {
        console.error('用法：node test/st-destroy-close-check.js <输出目录>');
        process.exit(2);
    }
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

    await page.goto(HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const checks = [];
    const assert = (name, pass, detail) => {
        checks.push({ name, pass: !!pass, detail: detail || '' });
        console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
    };

    /* ---------------------------------------------------------------
     * 1. document 级委托能收到 destroy 引发的 close 事件
     * ------------------------------------------------------------- */
    const r1 = await page.evaluate(async () => {
        const out = {};
        const countDialogs = () => document.querySelectorAll('dialog.nvui-tl').length;
        const countOverlays = () => document.querySelectorAll('.nvui-overlay.is-panel').length;

        const before = { dialogs: countDialogs(), overlays: countOverlays() };

        /* 场景 A：宿主用 document 捕获阶段委托（最常见姿势） */
        let docCapture = 0;
        const onDocClose = () => { docCapture += 1; };
        document.addEventListener('close', onDocClose, true);

        /* 场景 B：宿主直接监听 dialog 元素自身 */
        const p = NVUI.createPanel({ id: 'dcc_a', title: 'A' });
        p.open();
        await new Promise(r => setTimeout(r, 600));
        let onElement = 0;
        p.dialog.addEventListener('close', () => { onElement += 1; });

        p.destroy();
        await new Promise(r => setTimeout(r, 600));
        document.removeEventListener('close', onDocClose, true);

        out.before = before;
        out.docCaptureEvents = docCapture;
        out.onElementEvents = onElement;
        out.dialogGone = !document.getElementById('dcc_a-layer');
        out.dialogConnected = p.dialog ? p.dialog.isConnected : null;

        /* 对照组：手动 close()，元素留在 DOM —— document 委托应该收到 */
        const p2 = NVUI.createPanel({ id: 'dcc_ctl', title: 'CTL' });
        p2.open();
        await new Promise(r => setTimeout(r, 600));
        let ctl = 0;
        const onCtl = () => { ctl += 1; };
        document.addEventListener('close', onCtl, true);
        p2.dialog.close();
        await new Promise(r => setTimeout(r, 400));
        document.removeEventListener('close', onCtl, true);
        out.controlManualCloseEvents = ctl;

        return out;
    });

    assert('NEW-16 核心：document 级委托能收到 destroy 引发的 close 事件',
        r1.docCaptureEvents >= 1,
        `document 捕获委托收到 ${r1.docCaptureEvents} 次（对照组手动 close 收到 ${r1.controlManualCloseEvents} 次）`);
    assert('NEW-16：dialog 元素自身也能收到 close 事件',
        r1.onElementEvents >= 1,
        `元素自身收到 ${r1.onElementEvents} 次`);
    assert('NEW-16：destroy 后载体节点已摘除（无 DOM 泄漏）',
        r1.dialogGone === true && r1.dialogConnected === false,
        `dialogGone=${r1.dialogGone} isConnected=${r1.dialogConnected}`);

    /* ---------------------------------------------------------------
     * 2. destroy 后载体节点数归位（兜底定时器生效）
     *    —— 用「close() 被拒绝」的极端场景逼出兜底路径：
     *       把 dialog.close 临时改写成抛错，看节点是否仍被摘干净。
     * ------------------------------------------------------------- */
    const r2 = await page.evaluate(async () => {
        const out = {};
        const countDialogs = () => document.querySelectorAll('dialog.nvui-tl').length;
        const countOverlays = () => document.querySelectorAll('.nvui-overlay.is-panel').length;
        const before = { dialogs: countDialogs(), overlays: countOverlays() };

        const p = NVUI.createPanel({ id: 'dcc_fb', title: 'FB' });
        p.open();
        await new Promise(r => setTimeout(r, 600));
        const mid = { dialogs: countDialogs(), overlays: countOverlays() };

        /* 让 close() 抛错 —— 逼出 catch 分支（立即摘除）与「事件不派发」场景 */
        const origClose = p.dialog.close;
        p.dialog.close = function () { throw new Error('simulated close failure'); };

        let thrown = null;
        try {
            p.destroy();
        } catch (err) {
            thrown = String(err && err.message);
        }
        await new Promise(r => setTimeout(r, 300));
        const afterCatch = { dialogs: countDialogs(), overlays: countOverlays() };

        /* 再来一个：close() 静默不派发事件（只改 open 属性，不触发 close 事件） */
        const p2 = NVUI.createPanel({ id: 'dcc_fb2', title: 'FB2' });
        p2.open();
        await new Promise(r => setTimeout(r, 600));
        const mid2 = { dialogs: countDialogs(), overlays: countOverlays() };
        p2.dialog.close = function () { /* 什么都不做：不派发 close 事件 */ };
        p2.destroy();
        /* 兜底定时器 50ms —— 等 400ms 足够 */
        await new Promise(r => setTimeout(r, 400));
        const afterFallback = { dialogs: countDialogs(), overlays: countOverlays() };

        out.before = before;
        out.mid = mid;
        out.afterCatch = afterCatch;
        out.mid2 = mid2;
        out.afterFallback = afterFallback;
        out.thrownFromDestroy = thrown;
        out.dialogGoneCatch = !document.getElementById('dcc_fb-layer');
        out.dialogGoneFallback = !document.getElementById('dcc_fb2-layer');
        return out;
    });

    assert('NEW-16 兜底：close() 抛错时 destroy 不向调用方抛异常',
        r2.thrownFromDestroy === null,
        `destroy 抛出=${r2.thrownFromDestroy || '无'}`);
    assert('NEW-16 兜底：close() 抛错时节点仍被立即摘除（不泄漏）',
        r2.dialogGoneCatch === true && r2.afterCatch.dialogs === r2.before.dialogs
        && r2.afterCatch.overlays === r2.before.overlays,
        `dialogs ${r2.mid.dialogs}→${r2.afterCatch.dialogs}（基线 ${r2.before.dialogs}），`
        + `overlays ${r2.mid.overlays}→${r2.afterCatch.overlays}（基线 ${r2.before.overlays}）`);
    assert('NEW-16 兜底：close 事件未派发时 50ms 定时器兜底摘除（不泄漏）',
        r2.dialogGoneFallback === true && r2.afterFallback.dialogs === r2.before.dialogs
        && r2.afterFallback.overlays === r2.before.overlays,
        `dialogs ${r2.mid2.dialogs}→${r2.afterFallback.dialogs}（基线 ${r2.before.dialogs}），`
        + `overlays ${r2.mid2.overlays}→${r2.afterFallback.overlays}（基线 ${r2.before.overlays}）`);

    /* ---------------------------------------------------------------
     * 3. mount 完全不可用 → 返回 null、不抛异常、有 error 级日志
     * ------------------------------------------------------------- */
    const r3 = await page.evaluate(async () => {
        const out = { errors: [], warns: [] };
        const origError = console.error;
        const origWarn = console.warn;
        console.error = function () { out.errors.push(Array.prototype.join.call(arguments, ' ')); };
        console.warn = function () { out.warns.push(Array.prototype.join.call(arguments, ' ')); };
        let thrown = null;
        let result = 'not-called';
        try {
            /* opts.mount 是无效节点 → 回退 document.body（body 可用）→ 应能创建 */
            const pBad = NVUI.createPanel({ id: 'dcc_bad', title: 'BAD', mount: { notAnElement: true } });
            result = pBad === null ? 'null' : (pBad && typeof pBad.open === 'function' ? 'created' : 'other');
            out.badMountCreated = result === 'created';
            if (pBad && typeof pBad.destroy === 'function') { pBad.open(); await new Promise(r => setTimeout(r, 300)); pBad.destroy(); await new Promise(r => setTimeout(r, 200)); }
        } catch (err) {
            thrown = String(err && err.message);
        }
        out.result = result;
        out.thrown = thrown;

        /* mount 完全不可用：用一个「有 appendChild 但会抛错」的代理对象 */
        const hostileMount = {
            appendChild: function () { throw new TypeError('simulated appendChild failure'); }
        };
        let result2 = 'not-called';
        let thrown2 = null;
        try {
            const p = NVUI.createPanel({ id: 'dcc_hostile', title: 'HOSTILE', mount: hostileMount });
            result2 = p === null ? 'null' : 'created';
        } catch (err) {
            thrown2 = String(err && err.message);
        }
        out.result2 = result2;
        out.thrown2 = thrown2;

        await new Promise(r => setTimeout(r, 100));
        console.error = origError;
        console.warn = origWarn;
        out.errorCount = out.errors.length;
        out.warnCount = out.warns.length;
        out.errors = out.errors.slice(0, 5);
        out.warns = out.warns.slice(0, 5);
        return out;
    });

    assert('NEW-18：mount 无效但 body 可用 → 仍能创建（warn 级日志）',
        r3.result === 'created' && r3.thrown === null && r3.warnCount >= 1,
        `result=${r3.result} thrown=${r3.thrown || '无'} warn 条数=${r3.warnCount}`);
    assert('NEW-18：mount 的 appendChild 抛错 → 返回 null、异常不穿透',
        r3.result2 === 'null' && r3.thrown2 === null,
        `result=${r3.result2} thrown=${r3.thrown2 || '无'}`);
    assert('NEW-18：挂载失败有 error 级日志（不得静默）',
        r3.errorCount >= 1 && /挂载失败/.test(r3.errors.join(' | ')),
        `error 条数=${r3.errorCount}；首条=${(r3.errors[0] || '').slice(0, 90)}`);

    /* ---------------------------------------------------------------
     * 4. 正常路径不回归：destroy 后再 createPanel 能正常用
     * ------------------------------------------------------------- */
    const r4 = await page.evaluate(async () => {
        const out = {};
        const p = NVUI.createPanel({ id: 'dcc_reuse', title: 'REUSE' });
        p.open();
        await new Promise(r => setTimeout(r, 600));
        out.firstOpen = p.overlay && !p.overlay.hidden && p.dialog.open;
        p.destroy();
        await new Promise(r => setTimeout(r, 300));

        const p2 = NVUI.createPanel({ id: 'dcc_reuse', title: 'REUSE2' });
        p2.open();
        await new Promise(r => setTimeout(r, 600));
        out.secondOpen = p2.overlay && !p2.overlay.hidden && p2.dialog.open;
        out.secondId = p2.id;
        p2.destroy();
        await new Promise(r => setTimeout(r, 300));
        out.finalDialogCount = document.querySelectorAll('dialog.nvui-tl').length;
        return out;
    });

    assert('正常路径：destroy 后再 createPanel 能正常打开使用',
        r4.firstOpen === true && r4.secondOpen === true,
        `首次 open=${r4.firstOpen}；二次 open=${r4.secondOpen}（id=${r4.secondId}）`);

    /* ---------------------------------------------------------------
     * 5. pageerror 应为 0
     * ------------------------------------------------------------- */
    const pageErrors = logs.filter(l => l.startsWith('[pageerror]'));
    assert('全程无未捕获异常（pageerror = 0）',
        pageErrors.length === 0,
        `pageerror=${pageErrors.length}${pageErrors.length ? '；' + pageErrors[0].slice(0, 120) : ''}`);

    const failed = checks.filter(c => !c.pass).length;
    console.log(`\n总计 ${checks.length} | 通过 ${checks.length - failed} | 失败 ${failed}`);

    fs.writeFileSync(path.join(OUT, 'destroy-close-check.json'),
        JSON.stringify({ summary: { total: checks.length, failed }, checks, logs: logs.slice(-40) }, null, 2));

    await browser.close();
    process.exit(failed ? 1 : 0);
})().catch(err => {
    console.error('FATAL', err);
    process.exit(2);
});
