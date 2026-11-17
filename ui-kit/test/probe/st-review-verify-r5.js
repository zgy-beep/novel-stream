/**
 * NVUI Kit · 第五轮最终收口验证（QA 资产，只读）
 * ------------------------------------------------------------------
 * 目的：针对 team-lead 最终收口确认的 4 个验收点，做**多轮**独立实测：
 *   A. NEW-16 核心：document.addEventListener('close', ...) 级委托能收到
 *      destroy 引发的 close 事件 —— 至少 5 轮，确认**稳定收到**而非偶然。
 *   B. DOM 不泄漏：destroy 后载体节点数必须归位（兜底定时器生效），
 *      等不到 close 事件时也不能残留。
 *   C. NEW-18：mount 完全不可用 → 返回 null、异常不穿透、有 error 级日志；
 *      mount 无效但 body 可用 → 仍能创建 + warn 级日志。
 *   D. 正常路径不回归：destroy 后再 createPanel 能正常用；
 *      面板正常开合不受「延迟摘除」影响。
 *
 * 与既有脚本的差异（刻意加强）：
 *   - NEW-16 用 **6 轮**独立循环，每轮都断言 document 委托**恰好 ≥1 次**，
 *     并记录每轮实际次数；任一轮为 0 即 FAIL（不接受偶发通过）。
 *   - 严格区分「document 级委托」与「元素自身监听」两条通道：
 *     两条分别计数、分别断言，且额外断言 **document 级 ≥ 元素自身**
 *     —— 若实现退化为「只有元素自身能收到」，本断言必然 FAIL。
 *   - 对照组：手动 close() 且元素留在 DOM → document 委托应收到 1 次。
 *   - 泄漏检查用**基线对比**（宿主页面本身可能存在其他扩展的载体节点），
 *     不硬编码 0。
 *   - 额外记录 destroy() 返回后**同步**快照的节点可见性，
 *     用于量化「异步摘除」的 ≤50ms 窗口（预期行为，非缺陷）。
 *
 * 只读：不修改任何产品代码。
 */
'use strict';

const h = require('./st-review-harness');

const ROUNDS = 6;

(async () => {
    const ctx = await h.launch();
    const page = ctx.page;

    /* ============ 加载宿主 ============ */
    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    /* 强制注入仓库根目录最新版（绕过宿主 third-party 副本的 window.NVUI 抢占） */
    await h.injectKit(page, { force: true });

    const gate = await page.evaluate(() => ({
        has: typeof window.NVUI !== 'undefined',
        hasConfig: !!(window.NVUI && window.NVUI.config),
        version: window.NVUI && window.NVUI.version,
    }));
    h.assert('[前置] 仓库根 kit 注入成功（hasConfig）', gate.has && gate.hasConfig,
        JSON.stringify(gate));

    /* ================================================================
     * A · NEW-16 核心：document 级委托，多轮稳定性
     * ================================================================ */
    const new16 = await page.evaluate(async (roundsN) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const countDialogs = () => document.querySelectorAll('dialog.nvui-tl').length;
        const countOverlays = () => document.querySelectorAll('.nvui-overlay.is-panel').length;

        /* --- 通道 1：document 级捕获委托（宿主最常见姿势） --- */
        let docCapture = 0;
        const onDocCapture = () => { docCapture += 1; };
        document.addEventListener('close', onDocCapture, true);

        /* --- 通道 2：document 级冒泡监听（验证 close 不冒泡这一事实） --- */
        let docBubble = 0;
        const onDocBubble = () => { docBubble += 1; };
        document.addEventListener('close', onDocBubble, false);

        /* --- 通道 3：dialog 元素自身监听（每轮独立计数器，见循环内） --- */
        let selfEvents = 0; /* 仅作累计参考，实际判定用每轮 roundSelf */

        const baseline = { dialogs: countDialogs(), overlays: countOverlays() };
        const rounds = [];

        for (let i = 0; i < roundsN; i++) {
            const before = { doc: docCapture, bubble: docBubble };

            const p = NVUI.createPanel({ id: 'r5_n16_' + i, title: 'R5-' + i });
            p.open();
            await sleep(500);

            /* 每轮用独立计数器，避免跨轮累加导致 delta 失真 */
            let roundSelf = 0;
            p.dialog.addEventListener('close', () => { roundSelf += 1; });

            const mid = { dialogs: countDialogs(), overlays: countOverlays() };

            p.destroy();
            /* 同步快照：记录 destroy() 返回瞬间节点是否仍可见（异步摘除窗口） */
            const syncSnapshot = {
                dialogs: countDialogs(),
                overlays: countOverlays(),
                connected: p.dialog ? p.dialog.isConnected : null,
            };
            /* 等足兜底窗口（50ms）后再等一拍，确保摘除彻底 */
            await sleep(300);

            const after = { dialogs: countDialogs(), overlays: countOverlays() };

            rounds.push({
                round: i + 1,
                docCaptureDelta: docCapture - before.doc,
                docBubbleDelta: docBubble - before.bubble,
                selfDelta: roundSelf,
                mid: mid,
                syncSnapshot: syncSnapshot,
                after: after,
                dialogConnectedAfter: p.dialog ? p.dialog.isConnected : null,
            });
        }

        document.removeEventListener('close', onDocCapture, true);
        document.removeEventListener('close', onDocBubble, false);

        /* --- 对照组：手动 close()，元素留在 DOM → document 委托应收到 1 次 --- */
        let ctl = 0;
        const onCtl = () => { ctl += 1; };
        const pc = NVUI.createPanel({ id: 'r5_n16_ctl', title: 'CTL' });
        pc.open();
        await sleep(500);
        document.addEventListener('close', onCtl, true);
        pc.dialog.close();
        await sleep(300);
        document.removeEventListener('close', onCtl, true);
        const ctlAfter = { dialogs: countDialogs(), overlays: countOverlays() };
        /* 手工清理对照组载体，避免残留影响后续用例 */
        if (pc.dialog && pc.dialog.parentNode) pc.dialog.parentNode.removeChild(pc.dialog);
        if (pc.overlay && pc.overlay.parentNode) pc.overlay.parentNode.removeChild(pc.overlay);

        return {
            baseline: baseline,
            rounds: rounds,
            totalDocCapture: docCapture,
            totalSelf: rounds.reduce((a, r) => a + r.selfDelta, 0),
            controlDocEvents: ctl,
            controlAfter: ctlAfter,
        };
    }, ROUNDS);

    h.assert('[NEW-16] 基线已记录（宿主页面初始载体数）',
        typeof new16.baseline.dialogs === 'number', JSON.stringify(new16.baseline));

    /* A1：每一轮的 document 级委托都必须收到 ≥1 次 —— 任一轮为 0 即 FAIL */
    const zeroRounds = new16.rounds.filter(r => r.docCaptureDelta < 1);
    h.assert(`[NEW-16] document 级委托连续 ${ROUNDS} 轮均收到 destroy 引发的 close 事件（不得偶发）`,
        zeroRounds.length === 0,
        `各轮 document 委托次数 = [${new16.rounds.map(r => r.docCaptureDelta).join(', ')}]；`
        + `总次数 = ${new16.totalDocCapture}`);

    /* A2：document 级委托的总次数应恰好等于轮数（不多不少，排除事件重复派发） */
    h.assert(`[NEW-16] document 级委托总次数恰好 = ${ROUNDS}（每轮 1 次，无重复派发）`,
        new16.totalDocCapture === ROUNDS,
        `实际 = ${new16.totalDocCapture}`);

    /* A3：每轮元素自身也应收到 1 次 */
    const zeroSelf = new16.rounds.filter(r => r.selfDelta < 1);
    h.assert(`[NEW-16] dialog 元素自身监听连续 ${ROUNDS} 轮均收到 close 事件`,
        zeroSelf.length === 0,
        `各轮自身次数 = [${new16.rounds.map(r => r.selfDelta).join(', ')}]`);

    /* A4：document 级 >= 元素自身 —— 若实现退化为「只有元素自身能收到」，此断言必然 FAIL */
    h.assert('[NEW-16] document 级委托接收次数 ≥ 元素自身接收次数（防止退化为仅元素自身生效）',
        new16.totalDocCapture >= new16.totalSelf,
        `document 级 = ${new16.totalDocCapture}，元素自身 = ${new16.totalSelf}`);

    /* A5：对照组 —— 手动 close() 留 DOM 时 document 委托也应收 1 次（证明测法本身有效） */
    h.assert('[NEW-16] 对照组：手动 close() 且元素留在 DOM → document 委托收到 1 次（测法有效性证明）',
        new16.controlDocEvents === 1,
        `对照组 document 委托 = ${new16.controlDocEvents} 次`);

    /* A6：close 事件不冒泡（事实记录，不作通过/失败判定） */
    const bubbleTotal = new16.rounds.reduce((a, r) => a + r.docBubbleDelta, 0);
    h.assert('[NEW-16·事实] close 事件不冒泡（document 冒泡监听次数为 0）',
        bubbleTotal === 0,
        `document 冒泡监听累计 = ${bubbleTotal} 次（符合 HTML 规范：不冒泡）`);

    /* ================================================================
     * B · DOM 不泄漏
     * ================================================================ */
    const leak = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const countDialogs = () => document.querySelectorAll('dialog.nvui-tl').length;
        const countOverlays = () => document.querySelectorAll('.nvui-overlay.is-panel').length;
        const baseline = { dialogs: countDialogs(), overlays: countOverlays() };
        const out = { baseline: baseline };

        /* B1：正常 destroy —— 等足兜底窗口后必须归位 */
        const p = NVUI.createPanel({ id: 'r5_leak_ok', title: 'OK' });
        p.open();
        await sleep(500);
        const mid = { dialogs: countDialogs(), overlays: countOverlays() };
        p.destroy();
        await sleep(300);
        out.normal = { mid: mid, after: { dialogs: countDialogs(), overlays: countOverlays() } };

        /* B2：close() 抛错 —— catch 分支必须立即摘净 */
        const p2 = NVUI.createPanel({ id: 'r5_leak_throw', title: 'THROW' });
        p2.open();
        await sleep(500);
        const mid2 = { dialogs: countDialogs(), overlays: countOverlays() };
        p2.dialog.close = function () { throw new TypeError('simulated close failure'); };
        let thrown = null;
        try { p2.destroy(); } catch (err) { thrown = String(err && err.message); }
        await sleep(300);
        out.throws = {
            mid: mid2,
            after: { dialogs: countDialogs(), overlays: countOverlays() },
            thrownFromDestroy: thrown,
        };

        /* B3：close() 静默不派发事件 —— 50ms 兜底定时器必须摘净 */
        const p3 = NVUI.createPanel({ id: 'r5_leak_silent', title: 'SILENT' });
        p3.open();
        await sleep(500);
        const mid3 = { dialogs: countDialogs(), overlays: countOverlays() };
        p3.dialog.close = function () { /* 不派发 close 事件 */ };
        p3.destroy();
        await sleep(400);
        out.silent = { mid: mid3, after: { dialogs: countDialogs(), overlays: countOverlays() } };

        return out;
    });

    h.assert('[泄漏] 正常 destroy 后载体节点数归位到基线',
        leak.normal.after.dialogs === leak.baseline.dialogs
        && leak.normal.after.overlays === leak.baseline.overlays,
        `dialogs ${leak.normal.mid.dialogs}→${leak.normal.after.dialogs}，`
        + `overlays ${leak.normal.mid.overlays}→${leak.normal.after.overlays}（基线 `
        + `${leak.baseline.dialogs}/${leak.baseline.overlays}）`);

    h.assert('[泄漏] close() 抛错时 destroy 不向调用方抛异常，且节点仍被摘净',
        leak.throws.thrownFromDestroy === null
        && leak.throws.after.dialogs === leak.baseline.dialogs
        && leak.throws.after.overlays === leak.baseline.overlays,
        `destroy 抛出 = ${leak.throws.thrownFromDestroy || '无'}；`
        + `dialogs ${leak.throws.mid.dialogs}→${leak.throws.after.dialogs}，`
        + `overlays ${leak.throws.mid.overlays}→${leak.throws.after.overlays}（基线 `
        + `${leak.baseline.dialogs}/${leak.baseline.overlays}）`);

    h.assert('[泄漏] close() 静默不派发事件时，50ms 兜底定时器摘净节点（不残留）',
        leak.silent.after.dialogs === leak.baseline.dialogs
        && leak.silent.after.overlays === leak.baseline.overlays,
        `dialogs ${leak.silent.mid.dialogs}→${leak.silent.after.dialogs}，`
        + `overlays ${leak.silent.mid.overlays}→${leak.silent.after.overlays}（基线 `
        + `${leak.baseline.dialogs}/${leak.baseline.overlays}）`);

    /* ================================================================
     * C · NEW-18
     * ================================================================ */
    const new18 = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const out = { errors: [], warns: [] };
        const origError = console.error;
        const origWarn = console.warn;
        console.error = function () { out.errors.push(Array.prototype.join.call(arguments, ' ')); };
        console.warn = function () { out.warns.push(Array.prototype.join.call(arguments, ' ')); };

        /* C1：mount 完全不可用 —— appendChild 抛错 */
        const hostile = { appendChild: function () { throw new TypeError('simulated'); } };
        let r1 = 'not-called';
        let thrown1 = null;
        try {
            const p = NVUI.createPanel({ id: 'r5_n18_hostile', title: 'H', mount: hostile });
            r1 = p === null ? 'null' : (p ? 'created' : 'other');
        } catch (err) { thrown1 = String(err && err.message); }
        out.hostile = { result: r1, thrown: thrown1 };

        /* C2：mount 无效但 body 可用 —— 应回退 body 并能创建 */
        let r2 = 'not-called';
        let thrown2 = null;
        let opened = null;
        try {
            const p = NVUI.createPanel({ id: 'r5_n18_bad', title: 'B', mount: { notAnElement: true } });
            r2 = p === null ? 'null' : (p && typeof p.open === 'function' ? 'created' : 'other');
            if (p && typeof p.open === 'function') {
                p.open();
                await sleep(500);
                opened = !!(p.overlay && !p.overlay.hidden && p.dialog.open);
                p.destroy();
                await sleep(200);
            }
        } catch (err) { thrown2 = String(err && err.message); }
        out.badMount = { result: r2, thrown: thrown2, opened: opened };

        await sleep(100);
        console.error = origError;
        console.warn = origWarn;
        out.errorCount = out.errors.length;
        out.warnCount = out.warns.length;
        out.errors = out.errors.slice(0, 6);
        out.warns = out.warns.slice(0, 6);
        return out;
    });

    h.assert('[NEW-18] mount 完全不可用（appendChild 抛错）→ 返回 null 且异常不穿透',
        new18.hostile.result === 'null' && new18.hostile.thrown === null,
        `result = ${new18.hostile.result}，穿透异常 = ${new18.hostile.thrown || '无'}`);

    h.assert('[NEW-18] mount 完全不可用时有 error 级日志（不得静默）',
        new18.errorCount >= 1 && /挂载失败/.test(new18.errors.join(' | ')),
        `error 条数 = ${new18.errorCount}；首条 = ${(new18.errors[0] || '').slice(0, 100)}`);

    h.assert('[NEW-18] mount 无效但 body 可用 → 回退 body、仍能创建并正常打开（+ warn 级日志）',
        new18.badMount.result === 'created' && new18.badMount.thrown === null
        && new18.badMount.opened === true && new18.warnCount >= 1,
        `result = ${new18.badMount.result}，穿透异常 = ${new18.badMount.thrown || '无'}，`
        + `opened = ${new18.badMount.opened}，warn 条数 = ${new18.warnCount}`);

    /* ================================================================
     * D · 正常路径不回归
     * ================================================================ */
    const regress = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const out = {};

        /* D1：destroy 后再 createPanel 能正常开合 */
        const p = NVUI.createPanel({ id: 'r5_reg_a', title: 'A' });
        p.open();
        await sleep(500);
        out.firstOpen = !!(p.overlay && !p.overlay.hidden && p.dialog.open);
        p.destroy();
        await sleep(300);

        const p2 = NVUI.createPanel({ id: 'r5_reg_a', title: 'A2' });
        p2.open();
        await sleep(500);
        out.secondOpen = !!(p2.overlay && !p2.overlay.hidden && p2.dialog.open);
        /* 二次 open 后再 close（而非 destroy），确认普通开合不受延迟摘除影响 */
        p2.close();
        await sleep(500);
        out.closedAfterClose = !(p2.overlay && !p2.overlay.hidden) && !p2.dialog.open;
        p2.destroy();
        await sleep(300);

        /* D2：连续 3 次 destroy/create 循环后载体数归位（无累积泄漏） */
        const countDialogs = () => document.querySelectorAll('dialog.nvui-tl').length;
        const base = countDialogs();
        for (let i = 0; i < 3; i++) {
            const q = NVUI.createPanel({ id: 'r5_reg_loop_' + i, title: 'L' + i });
            q.open();
            await sleep(350);
            q.destroy();
            await sleep(300);
        }
        out.loopBaseline = base;
        out.loopAfter = countDialogs();

        /* D3：destroy 同步快照 —— 记录异步摘除窗口（预期行为，非缺陷） */
        const pz = NVUI.createPanel({ id: 'r5_reg_sync', title: 'S' });
        pz.open();
        await sleep(400);
        pz.destroy();
        out.syncConnectedRightAfterDestroy = pz.dialog ? pz.dialog.isConnected : null;
        await sleep(300);
        out.connectedAfterWait = pz.dialog ? pz.dialog.isConnected : null;

        return out;
    });

    h.assert('[回归] destroy 后再 createPanel 能正常打开使用',
        regress.firstOpen === true && regress.secondOpen === true,
        `首次 = ${regress.firstOpen}，二次 = ${regress.secondOpen}`);

    h.assert('[回归] 面板普通 close() 开合不受「延迟摘除」影响',
        regress.closedAfterClose === true,
        `close() 后 overlay hidden 且 dialog.open = false → ${regress.closedAfterClose}`);

    h.assert('[回归] 连续 3 次 create/destroy 循环后载体节点数无累积泄漏',
        regress.loopAfter === regress.loopBaseline,
        `dialogs ${regress.loopBaseline} → ${regress.loopAfter}`);

    h.assert('[回归·预期行为] destroy 后延迟摘除：同步快照仍可见、等待后已摘除',
        regress.syncConnectedRightAfterDestroy === true && regress.connectedAfterWait === false,
        `destroy() 返回瞬间 isConnected = ${regress.syncConnectedRightAfterDestroy}（预期仍可见，`
        + `异步摘除窗口 ≤50ms）；等待 300ms 后 isConnected = ${regress.connectedAfterWait}`);

    /* ================================================================
     * 收尾
     * ================================================================ */
    const allPassed = h.summary('第五轮最终收口确认（NEW-16 多轮 / NEW-18 / 泄漏 / 回归）');
    await h.cleanup();
    process.exit(allPassed ? 0 : 1);
})().catch(err => {
    console.error('FATAL', err);
    process.exit(2);
});
