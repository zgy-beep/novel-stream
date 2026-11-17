/**
 * NVUI Kit · 第四轮（9 条中低危）独立复验脚本
 * ------------------------------------------------------------------
 * 定位：与 st-review-verify.js（第三轮 7 条高危）互补，本脚本只覆盖
 *      第四轮新增修复的 9 条：NEW-09 / 10 / 11 / 12 / 13 / 15 / 16 / 18 / 22。
 *
 * ★ 独立性与方法论：
 *   1. 不采信工程师自测结论，全部自己跑、自己判；
 *   2. 每条都用**行为级**判据（spy 计数 / 真实 DOM / 真实事件），
 *      不只读源码字符串；
 *   3. NEW-22 特别复核「非本地门禁测法是否真的有效」——
 *      工程师的脚本用 addInitScript 覆写 window.location.hostname，
 *      而门禁实现读的就是 window.location.hostname，
 *      **覆写可能让请求根本没走到非本地分支**。
 *      本脚本改用「真实非本地域名 + --host-resolver-rules」，
 *      并额外做「反证实验」：把 hostname 覆写回本地值时门禁必须重新放行，
 *      以证明测试确实在探测门禁而不是被兜住。
 *
 * 只读：不修改任何产品代码。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright-core');
const h = require('./st-review-harness');

const API = path.join(h.KIT_ROOT, 'nvui-api.js');
const COMPONENTS = path.join(h.KIT_ROOT, 'components.css');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

const OBS = {};
function observe(key, payload) {
    OBS[key] = payload;
    console.log(`\n----- 观测 ${key} -----`);
    console.log(JSON.stringify(payload, null, 2));
    console.log('------------------');
}

(async () => {
    const md5Before = { api: md5(API), components: md5(COMPONENTS) };
    console.log('nvui-api.js md5 (run start):', md5Before.api);
    console.log('components.css md5 (run start):', md5Before.components);

    const browser = await chromium.launch({
        executablePath: h.CHROME,
        args: [
            '--no-sandbox', '--disable-dev-shm-usage',
            /* NEW-22：把 example.com 解析到本地 8000 —— 这样页面能真实加载，
               而 window.location.hostname 真的是 example.com（非本地），
               门禁会走**真实的非本地分支**（不是被 hostname 覆写伪造出来的）。 */
            '--host-resolver-rules=MAP example.com 127.0.0.1:8000',
        ],
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));

    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    await h.injectKit(page, { force: true });

    const loaded = await page.evaluate(() => ({
        hasNVUI: typeof window.NVUI !== 'undefined',
        hasConfig: !!(window.NVUI && window.NVUI.config),
        hasInvalidateTokenCache: !!(window.NVUI && typeof window.NVUI.invalidateTokenCache === 'function'),
    }));
    console.log('[r4] 注入后 window.NVUI:', JSON.stringify(loaded));

    h.assert('[第四轮·前置] 被测代码是仓库根目录定版（force 注入生效）',
        loaded.hasNVUI === true && loaded.hasConfig === true, JSON.stringify(loaded));

    /* ================================================================
     * NEW-09 · 切 tab 只切旧/新两个 pane（不再全量遍历）
     * ================================================================ */
    console.log('\n\n########## NEW-09 · 切 tab 不全量遍历 pane ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            /* 造一个 8 个 tab 的面板 */
            const keys = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'];
            const p = window.NVUI.createPanel({
                id: 'r4_n09',
                title: 'N09',
                tabs: keys.map((k, i) => ({ key: k, label: 'T' + (i + 1) })),
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 600));

            /* spy：统计每个 pane 元素在切 tab 时被 classList 操作了几次 */
            const panes = Array.from(document.querySelectorAll('#r4_n09-layer .nvui-tabpane'));
            const hits = new Map();
            panes.forEach(el => {
                hits.set(el, 0);
                const origAdd = el.classList.add.bind(el.classList);
                const origRemove = el.classList.remove.bind(el.classList);
                const origToggle = el.classList.toggle.bind(el.classList);
                el.classList.add = function (...a) { hits.set(el, hits.get(el) + 1); return origAdd(...a); };
                el.classList.remove = function (...a) { hits.set(el, hits.get(el) + 1); return origRemove(...a); };
                el.classList.toggle = function (...a) { hits.set(el, hits.get(el) + 1); return origToggle(...a); };
            });

            const tabs = Array.from(document.querySelectorAll('#r4_n09-layer .nvui-tab'));
            tabs[0].click();                 // 先确保有一个确定的起点
            await new Promise(r2 => setTimeout(r2, 300));
            hits.forEach((_, el) => hits.set(el, 0));   // 归零，只统计「切一次 tab」

            tabs[3].click();                 // ← 被观测的这一次切换
            await new Promise(r2 => setTimeout(r2, 400));

            const counts = Array.from(hits.values());
            out.paneCount = panes.length;
            out.touchedPanes = counts.filter(c => c > 0).length;
            out.totalClassOps = counts.reduce((a, b) => a + b, 0);
            out.perPane = counts;
            out.activeTabCount = document.querySelectorAll('#r4_n09-layer .nvui-tab.is-active').length;
            out.activePaneCount = document.querySelectorAll('#r4_n09-layer .nvui-tabpane.is-active').length;
            out.activePaneId = (document.querySelector('#r4_n09-layer .nvui-tabpane.is-active') || {}).id;
            p.destroy();
            return out;
        });
        observe('NEW-09', r);
        h.assert('[第四轮] NEW-09 切 tab 只触及旧/新两个 pane（不全量遍历 N 个）',
            r.touchedPanes <= 2 && r.totalClassOps <= 4,
            `panel 有 ${r.paneCount} 个 pane，本次切换触及 ${r.touchedPanes} 个、classList 操作 ${r.totalClassOps} 次`
            + `（全量遍历会触及 ${r.paneCount} 个）；perPane=${JSON.stringify(r.perPane)}`);
        h.assert('[第四轮] NEW-09 切 tab 后仍恰好 1 个 tab active + 1 个 pane active',
            r.activeTabCount === 1 && r.activePaneCount === 1,
            `activeTabCount=${r.activeTabCount} activePaneCount=${r.activePaneCount} activePaneId=${r.activePaneId}`);
    }

    /* ================================================================
     * NEW-10 · getToken 令牌缓存 + invalidateTokenCache
     * ================================================================ */
    console.log('\n\n########## NEW-10 · getToken 令牌缓存 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            out.api = {
                hasInvalidate: typeof window.NVUI.invalidateTokenCache === 'function',
                hasGetToken: typeof window.NVUI.getToken === 'function',
            };
            /* spy getComputedStyle 的调用次数（getToken 读令牌必然触发） */
            const origGCS = window.getComputedStyle;
            let gcsCalls = 0;
            window.getComputedStyle = function (...a) { gcsCalls += 1; return origGCS.apply(window, a); };

            /* 预热 */
            window.NVUI.getToken('--nvui-z-layer');
            const afterWarm = gcsCalls;
            /* 连续读 20 次同一个令牌 */
            for (let i = 0; i < 20; i++) window.NVUI.getToken('--nvui-z-layer');
            const after20 = gcsCalls;
            out.calls = { afterWarm, after20, deltaFor20Reads: after20 - afterWarm };
            out.value1 = window.NVUI.getToken('--nvui-z-layer');

            /* 缓存必须可失效：失效后再读应重新取一次 */
            gcsCalls = 0;
            if (typeof window.NVUI.invalidateTokenCache === 'function') window.NVUI.invalidateTokenCache();
            window.NVUI.getToken('--nvui-z-layer');
            out.afterInvalidate = { gcsCalls, value: window.NVUI.getToken('--nvui-z-layer') };

            /* 外部改样式 → 签名失效机制应能感知（若实现了 class/style 签名） */
            document.documentElement.style.setProperty('--nvui-z-layer', '123456');
            const v2 = window.NVUI.getToken('--nvui-z-layer');
            out.afterExternalChange = { value: v2, expected: '123456' };

            window.getComputedStyle = origGCS;
            return out;
        });
        observe('NEW-10', r);
        h.assert('[第四轮] NEW-10 导出 NVUI.invalidateTokenCache() 且可调用',
            r.api.hasInvalidate === true && r.api.hasGetToken === true, JSON.stringify(r.api));
        h.assert('[第四轮] NEW-10 getToken 有缓存（连续读 20 次不重复取计算样式）',
            r.calls.deltaFor20Reads <= 2,
            `预热后 gcs=${r.calls.afterWarm}，再读 20 次后 gcs=${r.calls.after20}，增量=${r.calls.deltaFor20Reads}`);
        h.assert('[第四轮] NEW-10 invalidateTokenCache() 能让缓存失效（失效后重新取值）',
            r.afterInvalidate.gcsCalls >= 1 && r.afterInvalidate.value === r.value1,
            JSON.stringify(r.afterInvalidate));
        h.assert('[第四轮] NEW-10 宿主外部改令牌后 getToken 能读到新值',
            r.afterExternalChange.value === '123456',
            JSON.stringify(r.afterExternalChange));
    }

    /* ================================================================
     * NEW-11 · preview.html resize 监听 rAF 合并
     * NEW-12 · preview.html 吐司定时器 dismiss 时 clearTimeout
     * ================================================================ */
    console.log('\n\n########## NEW-11 / NEW-12 · preview.html 行为 ##########');
    {
        /* preview.html 是独立页面，需单独加载并注入 kit 资产 */
        const pv = await context.newPage();
        const pvErrors = [];
        pv.on('pageerror', e => pvErrors.push(e.message));
        const pvUrl = 'file:///' + path.join(h.KIT_ROOT, 'preview.html').replace(/\\/g, '/');
        await pv.goto(pvUrl, { waitUntil: 'domcontentloaded' });
        await pv.waitForTimeout(2500);
        /* preview.html 自带 kit 脚本吗？若自带则直接用，否则注入 */
        const pvHas = await pv.evaluate(() => typeof window.NVUI !== 'undefined');
        if (!pvHas) {
            await pv.addStyleTag({ path: path.join(h.KIT_ROOT, 'tokens.css') });
            await pv.addStyleTag({ path: path.join(h.KIT_ROOT, 'components.css') });
            await pv.addScriptTag({ path: API });
        }

        const r = await pv.evaluate(async () => {
            const out = {};
            out.hasNVUI = typeof window.NVUI !== 'undefined';

            /* --- NEW-11：连续触发多次 resize，统计指示器同步函数被调用次数 --- */
            const origRAF = window.requestAnimationFrame;
            let rafCount = 0;
            window.requestAnimationFrame = function (cb) {
                rafCount += 1;
                return origRAF.call(window, cb);
            };
            /* preview 里的 apiSyncRaf 调度器：连发 30 次 resize */
            rafCount = 0;
            for (let i = 0; i < 30; i++) {
                window.dispatchEvent(new Event('resize'));
            }
            await new Promise(r2 => setTimeout(r2, 400));
            out.new11 = { rafScheduledDuring30Resizes: rafCount };
            window.requestAnimationFrame = origRAF;

            /* --- NEW-12：preview.html **自有**吐司的定时器在 dismiss 时被 clearTimeout
                   注意：NEW-12 针对的是 preview.html 内部的 spawnToast/dismissToast
                   （toast.__toastTimer，4.2s 自动消失），不是 kit 的 NVUI.showToast。
                   测法：包一层 window.setTimeout/clearTimeout 记录存活定时器 id；
                   点击 preview 页面上的 [data-pv-toast] 按钮触发一条自有吐司；
                   再点该吐司上的关闭按钮 → dismissToast → 应清掉它的自动消失定时器。
                   对照：另一条不手动关闭的吐司，其定时器在 4.2s 后自然消失（不被提前清）。 */
            const origST = window.setTimeout;
            const origCT = window.clearTimeout;
            const live = new Set();
            const cleared = [];
            window.setTimeout = function (fn, ms) {
                const id = origST.call(window, fn, ms);
                live.add(id);
                return id;
            };
            window.clearTimeout = function (id) {
                live.delete(id);
                cleared.push(id);
                return origCT.call(window, id);
            };
            await new Promise(r2 => setTimeout(r2, 100));

            /* 触发一条 preview.html 自有吐司（走页面内 data-pv-toast → spawnToast） */
            const beforeCount = live.size;
            const trigger = document.querySelector('[data-pv-toast]');
            out.new12 = { note: 'preview.html 自有吐司 spawnToast/dismissToast', beforeCount, triggerFound: !!trigger };
            if (trigger) trigger.click();
            await new Promise(r2 => setTimeout(r2, 400));

            const toasts = Array.from(document.querySelectorAll('#pv-toast-stack .nvui-toast'));
            out.new12.toastCount = toasts.length;
            /* 关键：必须**在点击前**捕获 timer id —— dismissToast 会把 __toastTimer 置 0 */
            const capturedTimerId = toasts.length ? toasts[0].__toastTimer : null;
            out.new12.timerIdBeforeDismiss = capturedTimerId || null;
            /* 手动关闭第一条 → dismissToast → 应 clearTimeout(它的 timer) */
            const btn = toasts[0] ? toasts[0].querySelector('.nvui-icon-btn') : null;
            out.new12.closeBtnFound = !!btn;
            if (btn) btn.click();
            await new Promise(r2 => setTimeout(r2, 300));
            out.new12.clearedAfterManualDismiss = cleared.length;
            out.new12.timerIdCleared = capturedTimerId
                ? cleared.indexOf(capturedTimerId) !== -1 : null;
            out.new12.liveAfterDismiss = live.size;
            out.new12.toastStillInDom = document.querySelectorAll('#pv-toast-stack .nvui-toast').length;

            window.setTimeout = origST;
            window.clearTimeout = origCT;
            return out;
        });
        observe('NEW-11/12', r);
        await pv.close();

        h.assert('[第四轮] NEW-11 preview.html 连发 30 次 resize 被 rAF 合并（未逐次同步）',
            r.new11.rafScheduledDuring30Resizes <= 3,
            `30 次 resize 触发 requestAnimationFrame 调度 ${r.new11.rafScheduledDuring30Resizes} 次`
            + `（未合并则应 ≈30）`);
        h.assert('[第四轮] NEW-12 preview.html 自有吐司：手动关闭后其自动消失定时器被 clearTimeout（无残留）',
            r.new12.toastCount >= 1 && r.new12.timerIdCleared === true,
            JSON.stringify(r.new12));
    }

    /* ================================================================
     * NEW-13 · components.css will-change 且 !important 预算未破
     * ================================================================ */
    console.log('\n\n########## NEW-13 · components.css 预算 ##########');
    {
        const css = fs.readFileSync(COMPONENTS, 'utf8');
        /* 复刻 test/test-ui-kit.js 的 importantCount 口径（这是「!important 预算 ≤ 8」
           隐性契约的权威实现）：
             componentsClean = stripComments(componentsCss)
           —— 只去注释，**不**去 prefers-reduced-motion 块（降级块里的
           animation/transition/scroll-behavior !important 本身就是允许的）。
           然后：
             importantCount = (componentsClean.match(/!important/g)||[]).length
             badImportantLines = 含 !important 且不匹配白名单正则的行 */
        const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
        const componentsClean = stripComments(css);
        const importantCount = (componentsClean.match(/!important/g) || []).length;
        const importantLines = componentsClean.split(/\r?\n/).filter(l => l.includes('!important'));
        const badImportantLines = importantLines.filter(l =>
            !/(::before|content:|display:|animation-|animation-delay|transition-|scroll-behavior)/.test(l));

        const r = {
            rawImportant: (css.match(/!important/g) || []).length,
            strippedImportant: importantCount,
            budget: 8,
            willChangeCount: (componentsClean.match(/will-change\s*:/g) || []).length,
            willChangeTransformCount: (componentsClean.match(/will-change\s*:\s*transform/g) || []).length,
            willChangeWithImportant: (componentsClean.match(/will-change:[^;]*!important/g) || []).length,
            willChangeLines: componentsClean.split(/\r?\n/).map((l, i) => [i + 1, l.trim()]).filter(x => /will-change\s*:/.test(x[1])),
            importantLines,
            badImportantLines,
        };
        observe('NEW-13', r);
        h.assert('[第四轮] NEW-13 components.css !important 预算未破（stripComments 后 <= 8）',
            r.strippedImportant <= 8, `stripComments 后 !important 计数=${r.strippedImportant}（预算 8）；原始计数=${r.rawImportant}`);
        h.assert('[第四轮] NEW-13 components.css 的 !important 仍只用于宿主隔离 / 动效降级',
            r.badImportantLines.length === 0, r.badImportantLines.slice(0, 3).join(' | '));
        h.assert('[第四轮] NEW-13 components.css 新增了 will-change（合成层提升，且只用 transform、未带 !important）',
            r.willChangeCount >= 1 && r.willChangeTransformCount === r.willChangeCount && r.willChangeWithImportant === 0,
            `will-change 声明 ${r.willChangeCount} 处（transform ${r.willChangeTransformCount}，带 !important ${r.willChangeWithImportant}）：${JSON.stringify(r.willChangeLines)}`);
    }

    /* ================================================================
     * NEW-15 · addNode 无效 key 不落 body + opts.active 回退正常
     * ================================================================ */
    console.log('\n\n########## NEW-15 · addNode 回退链 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const p = window.NVUI.createPanel({
                id: 'r4_n15',
                title: 'N15',
                tabs: [{ key: 'one', label: '一' }, { key: 'two', label: '二' }, { key: 'three', label: '三' }],
                active: 'two',
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 600));
            out.activePaneId = (document.querySelector('#r4_n15-layer .nvui-tabpane.is-active') || {}).id;

            /* 1) 有效 key → 落到对应 pane */
            const n1 = document.createElement('p'); n1.id = 'r4_n15_valid';
            p.addNode('three', n1);
            await new Promise(r2 => setTimeout(r2, 100));
            out.validKey = { parentId: n1.parentElement ? n1.parentElement.id : null, isBody: n1.parentElement === document.body };

            /* 2) 无效 key → 不落 body；优先落当前激活 pane */
            const n2 = document.createElement('p'); n2.id = 'r4_n15_invalid';
            p.addNode('__no_such_key__', n2);
            await new Promise(r2 => setTimeout(r2, 100));
            out.invalidKey = {
                parentId: n2.parentElement ? n2.parentElement.id : null,
                parentTag: n2.parentElement ? n2.parentElement.tagName : null,
                parentClass: n2.parentElement ? n2.parentElement.className : null,
                isBody: n2.parentElement === document.body,
                insidePanel: !!(n2.parentElement && p.panel.contains(n2.parentElement)),
                isActivePane: !!(n2.parentElement && n2.parentElement.classList.contains('is-active')),
            };

            /* 3) opts.active 指向不存在 key → 回退正常（面板仍能开、有且仅有 1 个 active） */
            const p3 = window.NVUI.createPanel({
                id: 'r4_n15b', title: 'N15b',
                tabs: [{ key: 'x', label: 'X' }, { key: 'y', label: 'Y' }],
                active: '__missing__',
            });
            const openOk = typeof p3.open === 'function';
            let openErr = null;
            try { p3.open(); } catch (e) { openErr = e.name + ': ' + e.message; }
            await new Promise(r2 => setTimeout(r2, 500));
            out.badActive = {
                openOk, openErr,
                activeTabCount: document.querySelectorAll('#r4_n15b-layer .nvui-tab.is-active').length,
                activePaneCount: document.querySelectorAll('#r4_n15b-layer .nvui-tabpane.is-active').length,
                visible: p3.overlay ? !p3.overlay.hidden : null,
            };
            p3.destroy();
            p.destroy();
            return out;
        });
        observe('NEW-15', r);
        h.assert('[第四轮] NEW-15 addNode 有效 key 落到对应 pane',
            r.validKey.parentId === 'r4_n15-pane-three' && r.validKey.isBody === false,
            JSON.stringify(r.validKey));
        h.assert('[第四轮] NEW-15 addNode 无效 key 不落 body（落在某个 pane 内）',
            r.invalidKey.isBody === false && r.invalidKey.insidePanel === true
            && !!r.invalidKey.parentClass && r.invalidKey.parentClass.indexOf('nvui-tabpane') !== -1,
            JSON.stringify(r.invalidKey));
        h.assert('[第四轮] NEW-15 addNode 无效 key 优先落「当前激活 pane」（可见）',
            r.invalidKey.isActivePane === true,
            `回退落点=${r.invalidKey.parentId} isActivePane=${r.invalidKey.isActivePane}（当前激活 pane=${r.activePaneId}）`);
        h.assert('[第四轮] NEW-15 opts.active 指向不存在 key 时回退正常（面板可开、恰好 1 个 active）',
            r.badActive.openErr === null && r.badActive.visible === true
            && r.badActive.activeTabCount === 1 && r.badActive.activePaneCount === 1,
            JSON.stringify(r.badActive));
    }

    /* ================================================================
     * NEW-16 · destroy() 触发 dialog.close()
     * ================================================================ */
    console.log('\n\n########## NEW-16 · destroy 触发 close 事件 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            /* 场景 A：宿主把监听器挂在 document 捕获阶段（kit 自己的
               installHostModalWatcher 也是这个姿势） */
            const p = window.NVUI.createPanel({ id: 'r4_n16', title: 'N16' });
            p.open();
            await new Promise(r2 => setTimeout(r2, 500));
            const dlg = document.getElementById('r4_n16-layer');
            out.dialogOpenBefore = dlg ? dlg.open : null;
            let closeEvents = 0;
            const onClose = () => { closeEvents += 1; };
            document.addEventListener('close', onClose, true);
            p.destroy();
            await new Promise(r2 => setTimeout(r2, 400));
            document.removeEventListener('close', onClose, true);
            out.closeEvents = closeEvents;
            out.dialogExists = !!document.getElementById('r4_n16-layer');
            out.dialogOpenAfter = dlg ? dlg.open : null;
            out.dialogConnectedAfter = dlg ? dlg.isConnected : null;

            /* 场景 B：宿主把监听器直接挂在 dialog 元素上（kit 对外返回 p.dialog） */
            const p2 = window.NVUI.createPanel({ id: 'r4_n16b', title: 'N16b' });
            p2.open();
            await new Promise(r2 => setTimeout(r2, 500));
            const d2 = p2.dialog;
            let own = 0;
            if (d2) d2.addEventListener('close', () => { own += 1; });
            const openBefore = d2 ? d2.open : null;
            p2.destroy();
            await new Promise(r2 => setTimeout(r2, 400));
            out.own = {
                openBefore,
                openAfter: d2 ? d2.open : null,
                connectedAfter: d2 ? d2.isConnected : null,
                closeEventsOnElement: own,
            };

            /* 场景 C：对照实验 —— 手动 close()（元素留在 DOM）时 close 事件是否到 document */
            const p3 = window.NVUI.createPanel({ id: 'r4_n16c', title: 'N16c' });
            p3.open();
            await new Promise(r2 => setTimeout(r2, 400));
            const d3 = document.getElementById('r4_n16c-layer');
            let docEvt = 0;
            const h3 = () => { docEvt += 1; };
            document.addEventListener('close', h3, true);
            d3.close();
            await new Promise(r2 => setTimeout(r2, 200));
            document.removeEventListener('close', h3, true);
            out.controlManualClose = { docEvents: docEvt, openAfter: d3.open };
            return out;
        });
        observe('NEW-16', r);
        h.assert('[第四轮] NEW-16 destroy() 确实调用了 dialog.close()（open 由 true 变 false，且 close 事件在元素上派发）',
            r.dialogOpenBefore === true && r.dialogOpenAfter === false
            && r.own.closeEventsOnElement >= 1,
            `destroy 前 open=${r.dialogOpenBefore} → destroy 后 open=${r.dialogOpenAfter}；`
            + `dialog 元素自身收到 close 事件 ${r.own.closeEventsOnElement} 次`);
        h.assert('[第四轮·风险] NEW-16 宿主在 document 捕获阶段能收到 destroy 引发的 close 事件'
            + '（对照组：手动 close() 且元素仍在 DOM 时能收到）',
            r.closeEvents >= 1 && r.controlManualClose.docEvents >= 1,
            `destroy 引发 document 级 close 事件=${r.closeEvents} 次；`
            + `对照（手动 close，元素留在 DOM）document 级 close 事件=${r.controlManualClose.docEvents} 次；`
            + `destroy 后 dialog 仍在 DOM=${r.dialogExists}、isConnected=${r.dialogConnectedAfter}`);
    }

    /* ================================================================
     * NEW-18 · mount 不可用 → error + 返回 null 不抛错
     * ================================================================ */
    console.log('\n\n########## NEW-18 · mount 降级 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const origError = console.error;
            const origWarn = console.warn;
            const errors = [], warns = [];
            console.error = (...a) => { errors.push(String(a[0])); };
            console.warn = (...a) => { warns.push(String(a[0])); };

            /* 1) mount 完全不可用（null）且 body 也不可用 —— body 不可用很难构造，
                  这里用「mount 是非法值」验证「不抛错 + 仍能降级到 body」；
                  「body 也不可用」用注入假 body 的方式单独构造。 */
            let thrown1 = null, res1 = null;
            try { res1 = window.NVUI.createPanel({ id: 'r4_n18a', title: 'A', mount: '#not-a-real-node' }); }
            catch (e) { thrown1 = e.name + ': ' + e.message; }
            out.invalidMount = {
                thrown: thrown1,
                returnedNull: res1 === null,
                hasController: !!res1 && typeof res1.open === 'function',
                warnCount: warns.length,
                warnSample: warns.slice(0, 2),
                errorCount: errors.length,
            };
            if (res1 && typeof res1.destroy === 'function') res1.destroy();
            errors.length = 0; warns.length = 0;

            /* 2) body 也不可用 —— 把 document.body 置为 null
                  （kit 的守卫条件是 `!mountNode || typeof mountNode.appendChild !== 'function'`，
                  即 body 为 null 时才走「挂载点不可用 → error + return null」分支） */
            const realBody = document.body;
            Object.defineProperty(document, 'body', { value: null, configurable: true });
            let thrown2 = null, res2 = null;
            try { res2 = window.NVUI.createPanel({ id: 'r4_n18b', title: 'B', mount: '#also-not-real' }); }
            catch (e) { thrown2 = e.name + ': ' + e.message; }
            Object.defineProperty(document, 'body', { value: realBody, configurable: true });
            out.noBody = {
                thrown: thrown2,
                returnedNull: res2 === null,
                errorCount: errors.length,
                errorSample: errors.slice(0, 2),
            };

            /* 3) 额外观察项（非验收断言）：body 的 appendChild 本身抛异常时，
                  kit 的守卫只检查「appendChild 是否为函数」，异常会穿透到调用方。
                  这里如实记录，交由报告披露。 */
            errors.length = 0; warns.length = 0;
            const fakeBody2 = { appendChild() { throw new Error('appendChild-boom'); } };
            Object.defineProperty(document, 'body', { value: fakeBody2, configurable: true });
            let thrown3 = null;
            try { window.NVUI.createPanel({ id: 'r4_n18c', title: 'C' }); }
            catch (e) { thrown3 = e.name + ': ' + e.message; }
            Object.defineProperty(document, 'body', { value: realBody, configurable: true });
            out.appendingThrows = { thrown: thrown3, errorCount: errors.length };

            console.error = origError;
            console.warn = origWarn;
            return out;
        });
        observe('NEW-18', r);
        h.assert('[第四轮] NEW-18 mount 无效但 body 可用 → warn 且仍能创建（不抛错）',
            r.invalidMount.thrown === null && r.invalidMount.hasController === true
            && r.invalidMount.warnCount >= 1,
            JSON.stringify(r.invalidMount));
        h.assert('[第四轮] NEW-18 mount 与 body 均不可用 → error 且返回 null（不抛错）',
            r.noBody.thrown === null && r.noBody.returnedNull === true && r.noBody.errorCount >= 1,
            JSON.stringify(r.noBody));
    }

    /* ================================================================
     * NEW-22 · getSettings 仅本地暴露（★ 复核门禁测法是否真的有效）
     * ================================================================ */
    console.log('\n\n########## NEW-22 · getSettings 本地门禁 ##########');
    {
        /* 构造四个真实场景（全部指向**同一台本机宿主**）：
           A) http://127.0.0.1:8000/   → hostname 在白名单 → 暴露
           B) http://localhost:8000/   → hostname 在白名单 → 暴露
           C) http://example.com:8000/ → 经 --host-resolver-rules 解析到本机，
              但 hostname 是真实的 example.com（非白名单）→ 不暴露
           D) 同 C，但用 addInitScript 尝试覆写 window.location.hostname
              —— 用来验证「覆写是否真的生效」（Chrome 下 location 不可重定义）

           A/B 与 C 之间**只有 hostname 不同**（同一台服务器、同一份页面），
           暴露结果却相反 ⇒ 门禁确实由 location.hostname 分支驱动。 */
        const probe = async (url, overrideHostname, label) => {
            const ctx2 = await browser.newContext();
            const pg = await ctx2.newPage();
            let overrideResult = null;
            if (overrideHostname) {
                await pg.addInitScript((hn) => {
                    try {
                        const ok = Object.defineProperty(window.location, 'hostname',
                            { get: () => hn, configurable: true });
                        window.__OVERRIDE_RESULT__ = { applied: !!ok };
                    } catch (err) {
                        window.__OVERRIDE_RESULT__ = { applied: false, error: String(err) };
                    }
                }, overrideHostname);
            }
            const errs = [];
            pg.on('pageerror', e => errs.push(String(e)));
            await pg.goto(url, { waitUntil: 'domcontentloaded' });
            await pg.waitForTimeout(4000);
            const data = await pg.evaluate(() => {
                const api = window.__MY_PLUGIN__;
                /* 在页内复算门禁表达式（与 st-extension-template/index.js 同一逻辑），
                   用于证明「分支条件就是 hostname 白名单」 */
                const hn = window.location.hostname;
                const gateWouldPass = (hn === 'localhost' || hn === '127.0.0.1'
                    || hn === '::1' || hn === '[::1]'
                    || window.location.protocol === 'file:');
                return {
                    hostname: hn,
                    origin: window.location.origin,
                    hasApi: !!api,
                    hasOpen: !!(api && typeof api.open === 'function'),
                    hasGetSettings: !!(api && typeof api.getSettings === 'function'),
                    keys: api ? Object.keys(api) : [],
                    title: document.title,
                    gateWouldPass,
                    overrideResult: window.__OVERRIDE_RESULT__ || null,
                };
            });
            await ctx2.close();
            return { label, url, overrideHostname, data, errors: errs };
        };

        const localIp = await probe(h.HOST_URL, null, 'A-local-127.0.0.1');
        const localName = await probe('http://localhost:8000/', null, 'B-local-localhost');
        const remote = await probe('http://example.com:8000/', null, 'C-real-example.com');
        const remoteOverridden = await probe('http://example.com:8000/', '127.0.0.1',
            'D-example.com-hostname-override-attempt');

        const r = { localIp, localName, remote, remoteOverridden };
        observe('NEW-22', r);

        h.assert('[第四轮] NEW-22 本地宿主（127.0.0.1）暴露 getSettings（业务入口不被误伤）',
            localIp.data.hasGetSettings === true && localIp.data.hasOpen === true,
            JSON.stringify(localIp.data));
        h.assert('[第四轮] NEW-22 本地宿主（localhost）暴露 getSettings',
            localName.data.hasGetSettings === true && localName.data.hasOpen === true,
            JSON.stringify(localName.data));
        h.assert('[第四轮] NEW-22 非本地真实宿主（真实 example.com，解析到同一台本机）不暴露 getSettings'
            + '（且确实走到了非本地分支）',
            remote.data.hasGetSettings === false && remote.data.hasOpen === true
            && remote.data.hostname === 'example.com' && remote.data.origin.indexOf('example.com') !== -1
            && remote.data.gateWouldPass === false,
            JSON.stringify(remote.data));
        h.assert('[第四轮·测法] NEW-22 门禁由 location.hostname 驱动：'
            + '同一台服务器上仅 hostname 不同（localhost 暴露 / example.com 不暴露），'
            + '且页内复算的门禁表达式与实际暴露结果一致',
            localName.data.hasGetSettings === true && remote.data.hasGetSettings === false
            && localName.data.gateWouldPass === true && remote.data.gateWouldPass === false
            && localName.data.hostname !== remote.data.hostname,
            `localhost: hasGetSettings=${localName.data.hasGetSettings} gateWouldPass=${localName.data.gateWouldPass}；`
            + `example.com: hasGetSettings=${remote.data.hasGetSettings} gateWouldPass=${remote.data.gateWouldPass}`);
        h.assert('[第四轮·测法] NEW-22 复核：addInitScript 覆写 window.location.hostname 在 Chrome 下'
            + '不生效（故「反证实验」必须改用同服务器异 hostname 的对照法）',
            remoteOverridden.data.overrideResult
            ? remoteOverridden.data.overrideResult.applied === false
                || remoteOverridden.data.hostname !== '127.0.0.1'
            : true,
            `覆写结果=${JSON.stringify(remoteOverridden.data.overrideResult)}；`
            + `实际 hostname=${remoteOverridden.data.hostname}（期望 127.0.0.1，若为 example.com 说明覆写未生效）`);
        h.assert('[第四轮] NEW-22 四个场景均无 pageerror',
            localIp.errors.length === 0 && localName.errors.length === 0
            && remote.errors.length === 0 && remoteOverridden.errors.length === 0,
            JSON.stringify({ localIp: localIp.errors, localName: localName.errors,
                remote: remote.errors, overridden: remoteOverridden.errors }));
    }

    /* ================================================================
     * 汇总
     * ================================================================ */
    console.log('\n[harness] pageerror 数量:', pageErrors.length);
    pageErrors.slice(0, 10).forEach(e => console.log('  [pageerror]', e));
    await browser.close();

    const md5After = { api: md5(API), components: md5(COMPONENTS) };
    const consistent = md5Before.api === md5After.api && md5Before.components === md5After.components;
    console.log('\n[版本一致] nvui-api.js md5 前后：', md5Before.api, '->', md5After.api);
    console.log('[版本一致] components.css md5 前后：', md5Before.components, '->', md5After.components);
    console.log(consistent
        ? '[版本一致] ✅ 运行期间产品代码未变动，本轮数据有效'
        : '[混合版本] ⚠ 运行期间产品代码发生变化，本轮数据作废！');
    h.assert('[第四轮·前置] 运行期间产品代码 md5 未变动（无混合版本）',
        consistent, `${md5Before.api} -> ${md5After.api} / ${md5Before.components} -> ${md5After.components}`);

    fs.writeFileSync(
        path.join(h.KIT_ROOT, '.workbuddy', 'review', 'VERIFY-r4-raw-2026-10-20.json'),
        JSON.stringify({ OBS, md5Before, md5After }, null, 2));

    h.summary('第四轮确认复验（9 条中低危）');
    const allPassed = h.summary('');
    process.exit(allPassed ? 0 : 1);
})().catch(e => { console.error('R4 VERIFY ERROR:', e); process.exit(1); });
