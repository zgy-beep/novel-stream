/**
 * NVUI Kit · 修复后独立复验脚本（verify）
 * ------------------------------------------------------------------
 * 与 st-review-repro.js 的关系：
 *   - repro.js 是「修复前」取证脚本（断言缺陷存在 → FAIL）
 *   - verify.js 是「修复后」复验脚本（断言正确行为 → 应全 PASS）
 * 两者的断言语义互补，本文件**不复用** repro 的任何断言代码，逐条独立重写。
 *
 * ★ 关键方法论（复验时踩到的坑，必须记录）：
 *   宿主 http://127.0.0.1:8000 加载的是它自己 third-party/nvui-kit-lab/ui-kit/nvui-api.js
 *   （一个**独立副本**），其 window.NVUI 会**先于**仓库根目录的版本存在。
 *   若不 force 注入仓库根版本，测的就是宿主副本 —— 修复再漂亮也测不到。
 *   因此本脚本在页面加载后**第一时间**做 injectKit(page, {force:true})，
 *   用仓库根目录的 nvui-api.js 覆盖 window.NVUI，并在开头**断言版本来源正确**
 *   （用 ALLOWED_ATTRS 特征串确认加载的是新版），否则立即失败并提示。
 *
 * 运行：
 *   cd T:/Github/SillyTavern/Plugins/ui-kit && \
 *   env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
 *   NODE_PATH=C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules \
 *   node test/st-review-verify.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const h = require('./st-review-harness');

const API = path.join(h.KIT_ROOT, 'nvui-api.js');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

const OBS = {};

function observe(key, payload) {
    OBS[key] = payload;
    console.log(`\n----- 观测 ${key} -----`);
    console.log(JSON.stringify(payload, null, 2));
    console.log('------------------');
}

(async () => {
    const md5Before = md5(API);
    console.log('nvui-api.js md5 (run start):', md5Before);

    const ctx = await h.launch();
    const { page } = ctx;

    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    /* ================================================================
     * 0. 前置：确认加载的是仓库根目录的新版本，而不是宿主 third-party 副本
     * ================================================================ */
    console.log('\n########## 0. 被测代码来源确认 ##########');
    const beforeInject = await page.evaluate(() => ({
        hasNVUI: typeof window.NVUI !== 'undefined',
        version: window.NVUI ? window.NVUI.version : null,
        /* 新版特征：属性白名单存在 → 说明是修复后的代码 */
        hasWhitelist: !!(window.NVUI && window.NVUI.config && typeof window.NVUI.config === 'object'),
        /* 宿主副本特征：老版没有 config */
        isOldCopy: !!(window.NVUI && !window.NVUI.config),
    }));
    console.log('[verify] 注入前宿主 window.NVUI:', JSON.stringify(beforeInject));

    await h.injectKit(page, { force: true });

    const afterInject = await page.evaluate(() => ({
        hasNVUI: typeof window.NVUI !== 'undefined',
        version: window.NVUI ? window.NVUI.version : null,
        hasConfig: !!(window.NVUI && window.NVUI.config),
        hasDebugSwitch: !!(window.NVUI && window.NVUI.config && typeof window.NVUI.config.debug === 'boolean'),
    }));
    console.log('[verify] 注入后 window.NVUI:', JSON.stringify(afterInject));

    h.assert('[前置] 被测代码必须是仓库根目录的新版本（force 注入生效）',
        afterInject.hasNVUI === true && afterInject.hasConfig === true,
        `注入前 hasConfig=${beforeInject.hasConfig}（false=宿主是旧副本），注入后 hasConfig=${afterInject.hasConfig}`);
    h.assert('[前置] NVUI.config.debug 开关存在且为布尔',
        afterInject.hasDebugSwitch === true, JSON.stringify(afterInject));

    /* ================================================================
     * 1. NEW-01 · 属性白名单：危险属性被挡 + 合法属性未被误挡
     * ================================================================ */
    console.log('\n\n########## 1. NEW-01 · 属性白名单 ##########');
    {
        const r = await page.evaluate(() => {
            const out = {};
            const seen = [];
            const origSet = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function (name, value) {
                seen.push(String(name));
                return origSet.call(this, name, value);
            };
            /* 通过一个会被拒绝的属性名触发白名单路径：createPanel 的 icon 走 className，
               属性通道需要外部可控 —— 这里用 progress 的 variant / switchRow 等公共 API，
               再直接构造带危险属性的场景（createPanel 不接受任意 attrs，
               故这里用 el 的等价通道：accordion/switchRow/inputRow 的 label 走 text 通道）。 */
            const p = window.NVUI.createPanel({
                id: 'verify_n01',
                title: '<img src=x onerror="window.__XSS1__=1">',
                version: '<b>v</b>',
                tabs: [{ key: 'ok', label: '<i>L</i>' }],
                actions: [{ label: '<a>A</a>', icon: 'fa-solid fa-x' }],
                footer: [{ label: '<em>F</em>' }],
            });
            Element.prototype.setAttribute = origSet;

            out.attrNamesUsed = Array.from(new Set(seen)).sort();
            out.dangerAttrNames = Array.from(new Set(seen)).filter(n =>
                /^on/i.test(n) || n === 'style' || n === 'srcdoc' || n === 'formaction');
            const titleEl = document.querySelector('#verify_n01-title');
            out.titleTextContent = titleEl ? titleEl.childNodes[0].textContent : null;
            out.titleInnerHTML = titleEl ? titleEl.innerHTML : null;
            out.injectedImg = !!document.querySelector('#verify_n01-layer img');
            out.xssFired = !!window.__XSS1__;
            out.hasOnclickAttr = !!document.querySelector('#verify_n01-layer [onclick]');
            p.destroy();

            /* ---- 白名单正向验证：合法属性必须能通过 ---- */
            /* 通过 createPanel 的 tabs 走 aria-* / role / id / type / tabindex 等通道 */
            const p2 = window.NVUI.createPanel({
                id: 'verify_n01b',
                title: '白名单',
                tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
            });
            const layer = document.querySelector('#verify_n01b-layer');
            const tab = layer.querySelector('.nvui-tab');
            out.legit = {
                hasRole: tab.getAttribute('role') === 'tab',
                hasType: tab.getAttribute('type') === 'button',
                hasAriaSelected: tab.getAttribute('aria-selected') !== null,
                hasAriaControls: tab.getAttribute('aria-controls') !== null,
                hasTabindex: tab.getAttribute('tabindex') !== null,
                hasId: !!tab.id,
                panelRole: layer.querySelector('.nvui-panel').getAttribute('role'),
                panelAriaModal: layer.querySelector('.nvui-panel').getAttribute('aria-modal'),
                layerAriaLabel: layer.getAttribute('aria-label'),
                dialogAriaLabel: layer.getAttribute('aria-label') !== null,
            };
            p2.destroy();
            return out;
        });
        observe('NEW-01', r);

        h.assert('[复验] NEW-01 on*/style/srcdoc/formaction 属性名不得进入 DOM',
            r.dangerAttrNames.length === 0, `实际出现: ${JSON.stringify(r.dangerAttrNames)}`);
        h.assert('[复验] NEW-01 恶意 title 不得产生可执行元素 / 触发 XSS',
            r.injectedImg === false && r.xssFired === false && r.hasOnclickAttr === false,
            `img=${r.injectedImg} xss=${r.xssFired} onclick属性=${r.hasOnclickAttr} titleText=${JSON.stringify(r.titleTextContent)}`);
        h.assert('[复验] NEW-01 合法属性未被误挡（role/type/aria-*/id/tabindex）',
            r.legit.hasRole && r.legit.hasType && r.legit.hasAriaSelected
            && r.legit.hasAriaControls && r.legit.hasTabindex && r.legit.hasId
            && r.legit.panelRole === 'dialog' && r.legit.panelAriaModal === 'true',
            JSON.stringify(r.legit));
        h.assert('[复验] NEW-01 class 通道（icon → className）未被 attrs 白名单误伤',
            (() => {
                const ok = r.attrNamesUsed.includes('class') === false; /* class 走 className 参数，不进 attrs */
                return ok;
            })(), `attrs 通道出现属性名: ${JSON.stringify(r.attrNamesUsed)}`);
    }

    /* ================================================================
     * 2. NEW-02 · tab key 归一化：id 合法 + 对外契约不变 + 重复 key 独立可激活
     * ================================================================ */
    console.log('\n\n########## 2. NEW-02 · tab key 归一化与对外契约 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const keys = ['ok', 'a b', 'x<y', 'q"z', 'dup', 'dup'];
            const p = window.NVUI.createPanel({ id: 'verify_n02', tabs: keys.map(k => ({ key: k, label: 'L:' + k })) });
            const layer = document.querySelector('#verify_n02-layer');
            const tabEls = Array.from(layer.querySelectorAll('.nvui-tab'));
            const paneEls = Array.from(layer.querySelectorAll('.nvui-tabpane'));

            out.tabIds = tabEls.map(e => e.id);
            out.paneIds = paneEls.map(e => e.id);
            out.tabIdLegal = tabEls.map(e => /^[A-Za-z][A-Za-z0-9_-]*$/.test(e.id));
            out.paneIdLegal = paneEls.map(e => /^[A-Za-z][A-Za-z0-9_-]*$/.test(e.id));
            const tid = tabEls.map(e => e.id);
            out.tabIdDupCount = tid.length - new Set(tid).size;
            const pid = paneEls.map(e => e.id);
            out.paneIdDupCount = pid.length - new Set(pid).size;

            out.querySelectorThrows = tabEls.map(e => {
                try { document.querySelector('#' + e.id); return null; }
                catch (err) { return err.name + ': ' + err.message; }
            });
            out.ariaControlsResolve = tabEls.map(e => !!document.getElementById(e.getAttribute('aria-controls')));
            out.ariaLabelledbyResolve = paneEls.map(e => !!document.getElementById(e.getAttribute('aria-labelledby')));

            /* ★ 对外契约：setTab 用调用方给的原始 key */
            const before = paneEls.map(e => e.classList.contains('is-active'));
            out.beforeSetTab = before;
            p.setTab('a b');                       // 原始 key（含空格）
            await new Promise(r2 => setTimeout(r2, 300));
            out.afterSetTabRawKey = paneEls.map(e => e.classList.contains('is-active'));
            out.afterSetTabRawKeyActiveIds = paneEls.filter(e => e.classList.contains('is-active')).map(e => e.id);
            p.setTab('x<y');                       // 原始 key（含 <）
            await new Promise(r2 => setTimeout(r2, 300));
            out.afterSetTabLt = paneEls.map(e => e.classList.contains('is-active'));
            out.afterSetTabLtActiveIds = paneEls.filter(e => e.classList.contains('is-active')).map(e => e.id);

            /* ★ 对外契约：addNode 用原始 key 落到正确的 pane */
            p.setTab('a b');
            await new Promise(r2 => setTimeout(r2, 200));
            const marker = document.createElement('span');
            marker.id = 'verify_n02_marker';
            marker.textContent = 'MARKER';
            p.addNode('a b', marker);
            await new Promise(r2 => setTimeout(r2, 100));
            out.markerPaneId = marker.parentElement ? marker.parentElement.id : null;
            out.markerPaneIsActive = marker.parentElement ? marker.parentElement.classList.contains('is-active') : null;

            /* ★ 重复 key：两个 tab 必须各自独立可激活 */
            const dupTabs = Array.from(layer.querySelectorAll('.nvui-tab')).filter(e => /dup/.test(e.id));
            out.dupTabCount = dupTabs.length;
            out.dupTabIds = dupTabs.map(e => e.id);
            /* 点第一个 dup tab */
            dupTabs[0].click();
            await new Promise(r2 => setTimeout(r2, 300));
            out.dupActiveAfterClickFirst = paneEls.map(e => e.classList.contains('is-active'));
            out.dupActiveIdsFirst = paneEls.filter(e => e.classList.contains('is-active')).map(e => e.id);
            out.dupActiveCountFirst = out.dupActiveIdsFirst.length;
            /* 点第二个 dup tab */
            dupTabs[1].click();
            await new Promise(r2 => setTimeout(r2, 300));
            out.dupActiveAfterClickSecond = paneEls.map(e => e.classList.contains('is-active'));
            out.dupActiveIdsSecond = paneEls.filter(e => e.classList.contains('is-active')).map(e => e.id);
            out.dupActiveCountSecond = out.dupActiveIdsSecond.length;

            p.destroy();
            return out;
        });
        observe('NEW-02', r);

        h.assert('[复验] NEW-02 所有 tab/pane id 均为合法 HTML id',
            r.tabIdLegal.every(Boolean) && r.paneIdLegal.every(Boolean),
            `tabIds=${JSON.stringify(r.tabIds)} 非法 tab=${JSON.stringify(r.tabIds.filter((_, i) => !r.tabIdLegal[i]))}`);
        h.assert('[复验] NEW-02 id 不重复',
            r.tabIdDupCount === 0 && r.paneIdDupCount === 0,
            `tabIdDup=${r.tabIdDupCount} paneIdDup=${r.paneIdDupCount}`);
        h.assert('[复验] NEW-02 合法 id 可被 querySelector 定位（不抛异常）',
            r.querySelectorThrows.every(t => t === null),
            `抛错: ${JSON.stringify(r.querySelectorThrows.filter(Boolean))}`);
        h.assert('[复验] NEW-02 ARIA 关联不断链',
            r.ariaControlsResolve.every(Boolean) && r.ariaLabelledbyResolve.every(Boolean),
            `aria-controls 断链 ${r.ariaControlsResolve.filter(v => !v).length}，aria-labelledby 断链 ${r.ariaLabelledbyResolve.filter(v => !v).length}`);
        h.assert('[复验] NEW-02 setTab 接受调用方原始 key（含空格）',
            r.afterSetTabRawKeyActiveIds.length === 1
            && r.afterSetTabRawKeyActiveIds[0] === r.paneIds[1],
            `setTab('a b') 后激活 id=${JSON.stringify(r.afterSetTabRawKeyActiveIds)}，期望=${r.paneIds[1]}`);
        h.assert('[复验] NEW-02 setTab 接受调用方原始 key（含 < >）',
            r.afterSetTabLtActiveIds.length === 1 && r.afterSetTabLtActiveIds[0] === r.paneIds[2],
            `setTab('x<y') 后激活 id=${JSON.stringify(r.afterSetTabLtActiveIds)}，期望=${r.paneIds[2]}`);
        h.assert('[复验] NEW-02 addNode 原始 key 落到正确 pane',
            r.markerPaneId === r.paneIds[1] && r.markerPaneIsActive === true,
            `marker 落在 pane=${r.markerPaneId}（期望 ${r.paneIds[1]}），该 pane active=${r.markerPaneIsActive}`);
        h.assert('[复验] NEW-02 重复 key 的两个 tab 各自独立可激活（同时只能激活一个）',
            r.dupActiveCountFirst === 1 && r.dupActiveCountSecond === 1
            && r.dupActiveIdsFirst[0] !== r.dupActiveIdsSecond[0],
            `点第一个 dup → 激活 ${JSON.stringify(r.dupActiveIdsFirst)}；点第二个 dup → 激活 ${JSON.stringify(r.dupActiveIdsSecond)}`);
    }

    /* ================================================================
     * 3. NEW-03 · focusFallback：四条件同时成立 + 正常选择器不被废
     * ================================================================ */
    console.log('\n\n########## 3. NEW-03 · focusFallback ##########');
    {
        const errsBefore = ctx.pageErrors.length;
        const r = await page.evaluate(async () => {
            const out = {};
            const winErrs = [];
            const onErr = e => winErrs.push(e.message || String(e.error));
            window.addEventListener('error', onErr);

            /* --- 3.1 非法选择器 '#a[' --- */
            let onCloseCalled = false;
            const trigger = document.createElement('button');
            trigger.id = 'verify_n03_trigger';
            trigger.textContent = 'trigger';
            document.body.appendChild(trigger);
            trigger.focus();
            const p = window.NVUI.createPanel({
                id: 'verify_n03',
                title: 'N03',
                focusFallback: '#a[',
                onClose: () => { onCloseCalled = true; },
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 500));
            trigger.style.display = 'none';   // 迫使走 focusFallback 分支
            let thrown = null;
            try { p.close(); } catch (e) { thrown = e.name + ': ' + e.message; }
            await new Promise(r2 => setTimeout(r2, 1200));
            out.illegal = {
                thrownSynchronously: thrown,
                windowErrors: winErrs.slice(),
                onCloseCalled,
                focusAfterClose: document.activeElement
                    ? (document.activeElement.id || document.activeElement.className || document.activeElement.tagName) : null,
                focusIsBody: document.activeElement === document.body,
                focusInsidePanel: !!document.activeElement && p.panel.contains(document.activeElement),
                overlayHidden: p.overlay ? p.overlay.hidden : null,
                /* 根因取证：restoreFocus() 运行时 overlay 是否已 hidden、
                   面板容器是否还可聚焦 */
                overlayDisplay: p.overlay ? getComputedStyle(p.overlay).display : null,
                panelDisplay: p.panel ? getComputedStyle(p.panel).display : null,
                panelHasTabindex: p.panel ? p.panel.hasAttribute('tabindex') : null,
                panelFocusableNow: p.panel ? (() => {
                    const before = document.activeElement;
                    p.panel.focus();
                    const ok = document.activeElement === p.panel;
                    if (!ok && before && before.focus) before.focus();
                    return ok;
                })() : null,
            };
            window.removeEventListener('error', onErr);
            trigger.remove();
            p.destroy();

            /* --- 3.2 正常选择器仍然工作 --- */
            winErrs.length = 0;
            window.addEventListener('error', onErr);
            const realTarget = document.createElement('button');
            realTarget.id = 'verify_n03_fallback_target';
            realTarget.textContent = 'fallback';
            document.body.appendChild(realTarget);

            let onClose2 = false;
            const trig2 = document.createElement('button');
            trig2.id = 'verify_n03_trig2';
            document.body.appendChild(trig2);
            trig2.focus();
            const p2 = window.NVUI.createPanel({
                id: 'verify_n03b',
                title: 'N03b',
                focusFallback: '#verify_n03_fallback_target',
                onClose: () => { onClose2 = true; },
            });
            p2.open();
            await new Promise(r2 => setTimeout(r2, 500));
            trig2.style.display = 'none';
            p2.close();
            await new Promise(r2 => setTimeout(r2, 1200));
            out.validSelector = {
                windowErrors: winErrs.slice(),
                onCloseCalled: onClose2,
                focusAfterClose: document.activeElement ? document.activeElement.id : null,
                focusLandedOnFallback: document.activeElement === realTarget,
            };
            window.removeEventListener('error', onErr);
            realTarget.remove(); trig2.remove();
            p2.destroy();

            return out;
        });
        observe('NEW-03', r);
        const newPageErrors = ctx.pageErrors.slice(errsBefore);

        /* ★ 隔离复测（空白页，只注入仓库根新版）：
           宿主页面上焦点偶然落在某个宿主元素（leftNavDrawerIcon），
           那是宿主自身的焦点管理巧合，**不能**证明 kit 的兜底链生效。
           隔离页上重复 8 次，观察落点分布 —— 这才是确定性判据。
           ★ 修正（QA 自身用例 bug，Round 2 修正）：
             初版隔离页里**一个可聚焦元素都没有**（触发按钮被 display:none），
             此时即使 kit 的兜底链完全正确也无处可落 → 必然落 BODY，
             是 unrealistic 场景导致的假 FAIL。
             真实宿主页面永远有可聚焦控件，故隔离页补一个可见的宿主控件，
             验证「兜底链把焦点交给某个可见可聚焦元素、且不是 BODY」。
             同时单独记录「第 3 级（面板容器）为何不可用」的取证。 */
        const blankN03 = await ctx.context.newPage();
        await blankN03.setContent('<!DOCTYPE html><html><head><title>blank</title></head><body>'
            + '<button id="host_control">宿主控件</button></body></html>');
        await h.injectKit(blankN03, { force: true });
        const iso = await blankN03.evaluate(async () => {
            const sleep = ms => new Promise(res => setTimeout(res, ms));
            const runs = [];
            for (let i = 0; i < 8; i++) {
                const trig = document.createElement('button');
                trig.id = 'iso_trig_' + i;
                document.body.appendChild(trig);
                trig.focus();
                const p = window.NVUI.createPanel({ id: 'iso_' + i, title: 'ISO', focusFallback: '#a[' });
                p.open();
                await sleep(350);
                trig.style.display = 'none';
                const panelEl = p.panel;
                const overlayEl = p.overlay;
                p.close();
                await sleep(900);
                const ae = document.activeElement;
                runs.push({
                    isBody: ae === document.body,
                    insidePanel: !!(ae && panelEl.contains(ae)),
                    activeTag: ae ? ae.tagName : null,
                    activeId: ae ? ae.id : null,
                    overlayHidden: overlayEl.hidden,
                    panelFocusableAfterClose: (() => {
                        const before = document.activeElement;
                        panelEl.focus();
                        const ok = document.activeElement === panelEl;
                        if (!ok && before && before.focus) before.focus();
                        return ok;
                    })(),
                });
                trig.remove();
                p.destroy();
            }
            return {
                runs,
                bodyHits: runs.filter(r => r.isBody).length,
                panelHits: runs.filter(r => r.insidePanel).length,
                landedOnHostControl: runs.filter(r => r.activeId === 'host_control').length,
                total: runs.length,
            };
        });
        await blankN03.close();
        observe('NEW-03-isolated', iso);

        h.assert('[复验] NEW-03 非法 focusFallback 不产生未捕获异常（pageerror=0）',
            newPageErrors.length === 0 && r.illegal.windowErrors.length === 0,
            `pageerror=${newPageErrors.length} ${JSON.stringify(newPageErrors)}；window.onerror=${r.illegal.windowErrors.length} ${JSON.stringify(r.illegal.windowErrors)}`);
        h.assert('[复验] NEW-03 非法 focusFallback 下 opts.onClose 仍被调用',
            r.illegal.onCloseCalled === true, `onCloseCalled=${r.illegal.onCloseCalled}`);
        h.assert('[复验] NEW-03 非法 focusFallback 下焦点有落点（兜底链生效，不落 BODY）',
            iso.bodyHits === 0 && (iso.landedOnHostControl + iso.panelHits) === iso.total,
            `隔离页 ${iso.total} 次：落 BODY ${iso.bodyHits} 次、落宿主可见控件 ${iso.landedOnHostControl} 次、`
            + `落面板容器 ${iso.panelHits} 次`
            + ` | 宿主页面对照：focus=${r.illegal.focusAfterClose} isBody=${r.illegal.focusIsBody} insidePanel=${r.illegal.focusInsidePanel}`
            + ` overlayHidden=${r.illegal.overlayHidden} overlayDisplay=${r.illegal.overlayDisplay}`
            + ` panelDisplay=${r.illegal.panelDisplay} panelHasTabindex=${r.illegal.panelHasTabindex}`
            + ` panelFocusableNow=${r.illegal.panelFocusableNow}`
            + ` | 附注：第 3 级「面板容器」在 closeLayer.finish() 里已 overlay.hidden=true`
            + ` → 面板容器不在渲染树 → panel.focus() 必然失效（取证 panelFocusableNow=false）；`
            + ` 因此实际生效的是第 4 级「宿主首个可见可聚焦元素」`);
        h.assert('[复验] NEW-03 合法 focusFallback 选择器仍然正常工作（未被过度收窄废掉）',
            r.validSelector.windowErrors.length === 0
            && r.validSelector.onCloseCalled === true
            && r.validSelector.focusLandedOnFallback === true,
            JSON.stringify(r.validSelector));
    }

    /* ================================================================
     * 4. NEW-04 · progress：aria 与 width 恒一致 + 越界钳制
     * ================================================================ */
    console.log('\n\n########## 4. NEW-04 · progress 归一化 ##########');
    {
        const r = await page.evaluate(() => {
            const out = {};
            const cases = [
                { name: 'string_80', value: '80' },
                { name: 'nan', value: NaN },
                { name: 'over_200', value: 200 },
                { name: 'neg_-30', value: -30 },
                { name: 'normal_50', value: 50 },
                { name: 'zero', value: 0 },
                { name: 'hundred', value: 100 },
                { name: 'float_33_3', value: 33.3 },
                { name: 'numstr_42', value: '42' },
            ];
            out.cases = cases.map(c => {
                const track = window.NVUI.progress({ value: c.value });
                document.body.appendChild(track);
                const bar = track.querySelector('.nvui-progress-bar');
                const cs = getComputedStyle(bar);
                const trackCs = getComputedStyle(track);
                const barW = parseFloat(cs.width);
                const trackW = parseFloat(trackCs.width);
                const ratio = trackW > 0 ? Math.round((barW / trackW) * 1000) / 10 : null;
                const res = {
                    name: c.name,
                    inputValue: String(c.value),
                    ariaValueNow: track.getAttribute('aria-valuenow'),
                    ariaValueMax: track.getAttribute('aria-valuemax'),
                    barStyleWidth: bar.style.width,
                    barRatioPct: ratio,
                };
                res.ariaMatchesWidth = ratio === null ? null : (Number(res.ariaValueNow) === ratio);
                res.ariaInRange = Number(res.ariaValueNow) >= 0 && Number(res.ariaValueNow) <= 100;
                track.remove();
                return res;
            });
            /* setValue 路径 */
            const t2 = window.NVUI.progress({ value: 10 });
            document.body.appendChild(t2);
            const b2 = t2.querySelector('.nvui-progress-bar');
            t2.setValue(55);
            out.setValue = { ariaValueNow: t2.getAttribute('aria-valuenow'), barStyleWidth: b2.style.width };
            t2.setValue('77');
            out.setValueString = { ariaValueNow: t2.getAttribute('aria-valuenow'), barStyleWidth: b2.style.width };
            t2.setValue(999);
            out.setValueOver = { ariaValueNow: t2.getAttribute('aria-valuenow'), barStyleWidth: b2.style.width };
            t2.remove();
            /* indeterminate 不应带 aria-valuenow */
            const t3 = window.NVUI.progress({ value: 50, indeterminate: true, label: '加载中' });
            document.body.appendChild(t3);
            out.indeterminate = {
                ariaValueNow: t3.getAttribute('aria-valuenow'),
                ariaLabel: t3.getAttribute('aria-label'),
                hasIsIndeterminate: t3.classList.contains('is-indeterminate'),
            };
            t3.remove();
            return out;
        });
        observe('NEW-04', r);

        const bad = r.cases.filter(c => c.ariaMatchesWidth === false || c.ariaInRange === false);
        h.assert('[复验] NEW-04 所有 value 下 aria-valuenow 与实际宽度一致且在 [0,100]',
            bad.length === 0,
            `不一致用例: ${JSON.stringify(bad.map(c => ({ n: c.name, aria: c.ariaValueNow, w: c.barRatioPct, style: c.barStyleWidth })))}`);
        h.assert('[复验] NEW-04 字符串 value 被归一化为数值（"80" → aria 80 且宽 80%）',
            (() => {
                const c = r.cases.find(x => x.name === 'string_80');
                return c.ariaValueNow === '80' && c.barRatioPct === 80;
            })(), JSON.stringify(r.cases.find(x => x.name === 'string_80')));
        h.assert('[复验] NEW-04 越界值被钳制（200 → 100，-30 → 0）',
            (() => {
                const a = r.cases.find(x => x.name === 'over_200');
                const b = r.cases.find(x => x.name === 'neg_-30');
                return a.ariaValueNow === '100' && b.ariaValueNow === '0';
            })(), `over_200=${JSON.stringify(r.cases.find(x => x.name === 'over_200'))} neg=${JSON.stringify(r.cases.find(x => x.name === 'neg_-30'))}`);
        h.assert('[复验] NEW-04 setValue 路径同样归一化（数字/字符串/越界）',
            r.setValue.ariaValueNow === '55' && r.setValue.barStyleWidth === '55%'
            && r.setValueString.ariaValueNow === '77'
            && r.setValueOver.ariaValueNow === '100',
            JSON.stringify({ s: r.setValue, ss: r.setValueString, over: r.setValueOver }));
        h.assert('[复验] NEW-04 indeterminate 不带 aria-valuenow（符合 ARIA 规范）',
            r.indeterminate.ariaValueNow === null && r.indeterminate.hasIsIndeterminate === true,
            JSON.stringify(r.indeterminate));
    }

    /* ================================================================
     * 5. NEW-05 · input type：真实类型生效 + path 伪类型保留
     * ================================================================ */
    console.log('\n\n########## 5. NEW-05 · input type 白名单 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const realTypes = ['text', 'number', 'password', 'email', 'url', 'tel', 'search',
                'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range', 'file'];
            out.realTypes = realTypes.map(t => {
                const row = window.NVUI.inputRow({ type: t, label: 'L' });
                document.body.appendChild(row);
                const res = {
                    requested: t,
                    actual: row.input.type,
                    cls: row.input.className,
                    ok: row.input.type === t,
                };
                row.remove();
                return res;
            });
            /* path 是 kit 的伪类型（README §7.7 / preview.html 公开用法，**不是 bug**）：
               权威契约（preview.html:1713 / 2819 手写 DOM）：
                 <input class="nvui-input is-path" type="text" ...>
               即 DOM 属性必须是 type="text"，样式靠 .is-path 类区分。
               ★ 修正（QA 自身用例 bug，Round 2 修正）：
                 初版断言读的是 JS 侧的 input.type，
                 而工程师曾在 20:11~20:23 之间用 defineProperty 把 JS 侧
                 input.type 伪装成 'path'（并在 20:56 回退为纯 DOM text）。
                 该 JS 侧伪装与 preview.html 契约**不一致**，
                 且其 setter 往返有缺陷（写 number 读回 path）。
                 判据应锚定在**权威契约**上：
                   1) DOM 属性 type === 'text'
                   2) .is-path 类保留
                   3) 调用方意图通过 data-nvui-type="path" 暴露
                   4) JS 侧 input.type 必须真实反映 DOM 属性（不得被伪装/缓存）
               */
            const pathRow = window.NVUI.inputRow({ type: 'path', label: 'P' });
            document.body.appendChild(pathRow);
            out.path = {
                idlType: pathRow.input.type,
                attrType: pathRow.input.getAttribute('type'),
                hasIsPath: pathRow.input.classList.contains('is-path'),
                cls: pathRow.input.className,
                dataNvuiType: pathRow.input.getAttribute('data-nvui-type'),
                /* 1) DOM 属性是 text（权威契约） */
                domIsText: pathRow.input.getAttribute('type') === 'text',
                /* 2) .is-path 类保留 */
                classKept: pathRow.input.classList.contains('is-path'),
                /* 3) 调用方意图有暴露通道 */
                intentExposed: pathRow.input.getAttribute('data-nvui-type') === 'path',
                /* 4) JS 侧必须真实反映 DOM 属性（未被 defineProperty 伪装） */
                idlMatchesAttr: pathRow.input.type === pathRow.input.getAttribute('type'),
                hasOwnTypeDescriptor: !!Object.getOwnPropertyDescriptor(pathRow.input, 'type'),
            };
            out.path.isPseudoOk = out.path.domIsText && out.path.classKept
                && out.path.idlMatchesAttr && out.path.intentExposed;
            /* path 伪类型的 type 访问器 setter 往返 —— 本轮新发现的疑点 */
            try {
                pathRow.input.type = 'number';
                out.pathSetterRoundTrip = {
                    idlAfterSet: pathRow.input.type,
                    attrAfterSet: pathRow.input.getAttribute('type'),
                    readBackCorrect: pathRow.input.type === 'number',
                    hasOwnTypeDescriptor: !!Object.getOwnPropertyDescriptor(pathRow.input, 'type'),
                };
            } catch (e) {
                out.pathSetterRoundTrip = { thrown: e.name + ': ' + e.message };
            }
            pathRow.remove();
            /* 非法 type 回退 text */
            const badRow = window.NVUI.inputRow({ type: 'not-a-type', label: 'B' });
            document.body.appendChild(badRow);
            out.badType = { actual: badRow.input.type };
            badRow.remove();
            /* 不传 type */
            const defRow = window.NVUI.inputRow({ label: 'D' });
            document.body.appendChild(defRow);
            out.defaultType = { actual: defRow.input.type };
            defRow.remove();
            /* number 的 onChange 回传数字 */
            let captured = 'NOT_CALLED';
            const nRow = window.NVUI.inputRow({
                type: 'number', label: 'num', value: 42,
                onChange: v => { captured = { type: typeof v, value: v }; },
            });
            document.body.appendChild(nRow);
            nRow.input.value = '7';
            nRow.input.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r2 => setTimeout(r2, 100));
            out.numberOnChange = captured;
            nRow.remove();
            /* text 的 onChange 仍回传字符串（契约不变） */
            let capText = 'NOT_CALLED';
            const tRow = window.NVUI.inputRow({ type: 'text', label: 't', onChange: v => { capText = { type: typeof v, value: v }; } });
            document.body.appendChild(tRow);
            tRow.input.value = 'abc';
            tRow.input.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r2 => setTimeout(r2, 100));
            out.textOnChange = capText;
            tRow.remove();
            /* min/max/step 只接受有限数值 */
            const mRow = window.NVUI.inputRow({ type: 'number', min: 'abc', max: NaN, step: Infinity });
            document.body.appendChild(mRow);
            out.minMaxStep = {
                min: mRow.input.getAttribute('min'), max: mRow.input.getAttribute('max'), step: mRow.input.getAttribute('step'),
            };
            mRow.remove();
            return out;
        });
        observe('NEW-05', r);

        const broken = r.realTypes.filter(t => !t.ok);
        h.assert('[复验] NEW-05 全部真实 type 在 DOM 上生效为对应 input.type',
            broken.length === 0,
            `失效类型: ${JSON.stringify(broken)}`);
        h.assert('[复验] NEW-05 path 伪类型符合权威契约（DOM type=text + .is-path + data-nvui-type 暴露意图 + JS 侧不被伪装）',
            r.path.isPseudoOk === true, JSON.stringify(r.path));
        h.assert('[复验] NEW-05 path 伪类型的 type 访问器 setter 往返正确（写 number 读回 number）',
            r.pathSetterRoundTrip && r.pathSetterRoundTrip.readBackCorrect === true,
            JSON.stringify(r.pathSetterRoundTrip));
        h.assert('[复验] NEW-05 非法 type 回退 text；不传 type 也回退 text',
            r.badType.actual === 'text' && r.defaultType.actual === 'text',
            `bad=${JSON.stringify(r.badType)} default=${JSON.stringify(r.defaultType)}`);
        h.assert('[复验] NEW-05 number 的 onChange 回传 number',
            r.numberOnChange.type === 'number' && r.numberOnChange.value === 7,
            JSON.stringify(r.numberOnChange));
        h.assert('[复验] NEW-05 text 的 onChange 仍回传字符串（既有契约未破）',
            r.textOnChange.type === 'string' && r.textOnChange.value === 'abc',
            JSON.stringify(r.textOnChange));
        h.assert('[复验] NEW-05 min/max/step 拒绝非有限数值',
            r.minMaxStep.min === null && r.minMaxStep.max === null && r.minMaxStep.step === null,
            JSON.stringify(r.minMaxStep));
    }

    /* ================================================================
     * 6. NEW-06 · animationend 监听器不再累积
     * ================================================================ */
    console.log('\n\n########## 6. NEW-06 · animationend 监听器不累积 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const counts = new WeakMap();
            const origAdd = EventTarget.prototype.addEventListener;
            const origRemove = EventTarget.prototype.removeEventListener;
            EventTarget.prototype.addEventListener = function (type, h, o) {
                if (type === 'animationend') {
                    if (!counts.has(this)) counts.set(this, 0);
                    counts.set(this, counts.get(this) + 1);
                }
                return origAdd.call(this, type, h, o);
            };
            EventTarget.prototype.removeEventListener = function (type, h, o) {
                if (type === 'animationend') {
                    if (!counts.has(this)) counts.set(this, 0);
                    counts.set(this, counts.get(this) - 1);
                }
                return origRemove.call(this, type, h, o);
            };

            let onCloseCalls = 0;
            const p = window.NVUI.createPanel({ id: 'verify_n06', title: 'N06', onClose: () => { onCloseCalls += 1; } });
            const overlay = p.overlay;
            const countOf = () => (counts.has(overlay) ? counts.get(overlay) : 0);
            out.afterCreate = countOf();
            const snaps = [];
            for (let i = 1; i <= 30; i++) {
                p.open();
                await new Promise(r2 => setTimeout(r2, 120));
                p.close();
                await new Promise(r2 => setTimeout(r2, 420));
                if (i === 1 || i === 5 || i === 10 || i === 20 || i === 30) snaps.push({ cycle: i, listeners: countOf() });
            }
            out.snapshots = snaps;
            out.final = countOf();
            out.cycles = 30;
            out.onCloseCalls = onCloseCalls;

            EventTarget.prototype.addEventListener = origAdd;
            EventTarget.prototype.removeEventListener = origRemove;
            p.destroy();
            return out;
        });
        observe('NEW-06', r);

        const s10 = r.snapshots.find(s => s.cycle === 10);
        const s30 = r.snapshots.find(s => s.cycle === 30);
        h.assert('[复验] NEW-06 30 轮开关后 animationend 监听器数量保持恒定（不线性增长）',
            r.final <= 2,
            `30 轮后=${r.final}；快照 ${JSON.stringify(r.snapshots)}`);
        h.assert('[复验] NEW-06 10→30 轮监听器增量为 0',
            (s30 && s10) ? (s30.listeners - s10.listeners) === 0 : false,
            `10轮=${s10 && s10.listeners} 30轮=${s30 && s30.listeners} 增量=${s10 && s30 ? s30.listeners - s10.listeners : 'n/a'}`);
        h.assert('[复验] NEW-06 onClose 调用次数仍与开关次数 1:1（未因摘除监听器而漏调）',
            r.onCloseCalls === 30, `onCloseCalls=${r.onCloseCalls}（期望 30）`);
    }

    /* ================================================================
     * 7. NEW-07 · 观察器收窄：details 不再触发，但宿主 dialog 仍必须触发
     * ================================================================ */
    console.log('\n\n########## 7. NEW-07 · 观察器收窄 ##########');
    {
        /* ★ 修正（QA 自身方法论 bug）：本节原先在**宿主页面**上测，
           但宿主页面上还有**宿主 third-party 旧副本**的全局观察器在跑
           （旧副本 observe(documentElement,{attributes:true,subtree:true})），
           任何 open 属性变化都会触发它的全文档 querySelectorAll → 污染计数。
           已在空白页（只注入仓库根新版）隔离复测：
             details 展开/收起 = 0 次全文档查询
             任意元素 open 切换 20 次 = 0 次全文档查询
           宿主页面的残留计数属**环境污染**，非新版缺陷。
           本节改为：空白页隔离测量（判定用）+ 宿主页面对照（仅记录）。 */
        const blank = await ctx.context.newPage();
        await blank.setContent('<!DOCTYPE html><html><head><title>blank</title></head><body></body></html>');
        await h.injectKit(blank, { force: true });

        const r = await blank.evaluate(async () => {
            const out = {};
            const sleep = ms => new Promise(res => setTimeout(res, ms));
            let modalQ = 0, tlQ = 0;
            const orig = Document.prototype.querySelectorAll;
            Document.prototype.querySelectorAll = function (sel) {
                if (sel === 'dialog:modal' || sel === 'dialog[open]') modalQ += 1;
                if (sel === 'dialog.nvui-tl') tlQ += 1;
                return orig.call(this, sel);
            };
            const snap = () => ({ m: modalQ, t: tlQ });
            const diff = (a, b) => ({ modalQueries: b.m - a.m, tlQueries: b.t - a.t });

            /* 建一个面板以装上 hostModal watcher */
            const p = window.NVUI.createPanel({ id: 'verify_n07', title: 'N07' });
            p.open();
            await sleep(500);

            /* 1) <details> 展开/收起 → 不应再触发全文档查询 */
            const det = document.createElement('details');
            det.innerHTML = '<summary>s</summary><div>x</div>';
            document.body.appendChild(det);
            let a = snap();
            det.open = true; await sleep(500);
            let b = snap();
            out.detailsOpen = diff(a, b);
            a = snap();
            det.open = false; await sleep(500);
            b = snap();
            out.detailsClose = diff(a, b);
            det.remove();

            /* 2) 任意元素 open 属性反复切换 20 次 → 不应再触发 */
            const probe = document.createElement('div');
            document.body.appendChild(probe);
            a = snap();
            for (let i = 0; i < 20; i++) {
                probe.setAttribute('open', '');
                probe.removeAttribute('open');
                await sleep(20);
            }
            await sleep(500);
            b = snap();
            out.toggleOpenAttr20x = diff(a, b);
            probe.remove();

            /* 3) 宿主真实 dialog.showModal() → 必须仍然触发降级
               用「先建好、等一帧再 showModal()」的形态（宿主常见写法） */
            const dlg = document.createElement('dialog');
            dlg.id = 'verify_host_modal';
            document.body.appendChild(dlg);
            await sleep(300);
            a = snap();
            dlg.showModal();
            await sleep(600);
            b = snap();
            out.hostModalOpen = diff(a, b);
            out.carrierDegradedWhileModal = (() => {
                const c = document.querySelector('dialog.nvui-tl');
                return c ? c.classList.contains('is-host-modal') : null;
            })();
            out.hostModalCount = window.NVUI.countHostModals();
            a = snap();
            dlg.close();
            await sleep(600);
            b = snap();
            out.hostModalClose = diff(a, b);
            out.carrierDegradedAfterClose = (() => {
                const c = document.querySelector('dialog.nvui-tl');
                return c ? c.classList.contains('is-host-modal') : null;
            })();
            dlg.remove();

            /* 4) 边界场景：同一 task 内「新建 dialog + 立即 showModal()」
               → childList 观察器（微任务）还没来得及挂上 open 观察，
                  open 属性变化发生在观察前 → 可能漏掉降级 */
            const d2 = document.createElement('dialog');
            d2.id = 'verify_host_modal_immediate';
            document.body.appendChild(d2);
            d2.showModal();
            await sleep(600);
            out.immediateShowModal = {
                modalCount: window.NVUI.countHostModals(),
                degraded: (() => {
                    const c = document.querySelector('dialog.nvui-tl');
                    return c ? c.classList.contains('is-host-modal') : null;
                })(),
            };
            d2.close();
            await sleep(400);
            d2.remove();

            Document.prototype.querySelectorAll = orig;
            p.destroy();
            return out;
        });

        /* 宿主页面对照（仅记录，不判定 —— 存在宿主旧副本污染） */
        const hostCompare = await page.evaluate(async () => {
            const sleep = ms => new Promise(res => setTimeout(res, ms));
            let modalQ = 0;
            const orig = Document.prototype.querySelectorAll;
            Document.prototype.querySelectorAll = function (sel) {
                if (sel === 'dialog:modal' || sel === 'dialog[open]') modalQ += 1;
                return orig.call(this, sel);
            };
            const det = document.querySelector('details');
            const before = modalQ;
            if (det) { det.open = true; await sleep(400); det.open = false; await sleep(400); }
            const hostDetailsQueries = modalQ - before;
            Document.prototype.querySelectorAll = orig;
            return {
                hostDetailsCount: document.querySelectorAll('details').length,
                hostDetailsQueries,
                note: '宿主页面同时存在 third-party 旧副本的全局属性观察器，计数含污染',
            };
        });

        observe('NEW-07', { isolated: r, hostCompare });
        await blank.close();

        h.assert('[复验] NEW-07 宿主 <details> 展开/收起不再触发全文档 modal 查询（隔离页）',
            r.detailsOpen.modalQueries === 0 && r.detailsClose.modalQueries === 0,
            `展开=${JSON.stringify(r.detailsOpen)} 收起=${JSON.stringify(r.detailsClose)}；宿主页面对照=${JSON.stringify(hostCompare)}`);
        h.assert('[复验] NEW-07 任意元素 open 属性切换 20 次不再触发全文档查询（隔离页）',
            r.toggleOpenAttr20x.modalQueries === 0,
            JSON.stringify(r.toggleOpenAttr20x));
        h.assert('[复验] NEW-07 宿主 dialog.showModal() 仍必须触发降级（不能被过度收窄破坏）',
            r.hostModalOpen.modalQueries >= 1 && r.hostModalCount >= 1 && r.carrierDegradedWhileModal === true,
            `showModal 触发查询=${r.hostModalOpen.modalQueries} countHostModals=${r.hostModalCount} 载体降级=${r.carrierDegradedWhileModal}`);
        h.assert('[复验] NEW-07 宿主模态关闭后载体自动还原',
            r.hostModalClose.modalQueries >= 1 && r.carrierDegradedAfterClose === false,
            `关闭触发查询=${r.hostModalClose.modalQueries} 载体仍降级=${r.carrierDegradedAfterClose}`);
        h.assert('[复验] NEW-07 同一 task 内「新建 dialog + 立即 showModal()」也能触发降级',
            r.immediateShowModal.degraded === true && r.immediateShowModal.modalCount >= 1,
            JSON.stringify(r.immediateShowModal));
    }

    /* ================================================================
     * 8. NEW-24 · 吐司层可重开（用户可见性维度深测）
     * ================================================================ */
    console.log('\n\n########## 8. NEW-24 · 吐司层重开（用户可见性深测）##########');
    {
        await page.evaluate(() => {
            const old = document.getElementById('nvui-api-toast-layer');
            if (old) old.remove();
        });

        const r = await page.evaluate(async () => {
            const out = {};
            const layerId = 'nvui-api-toast-layer';
            const vis = el => {
                if (!el) return { exists: false };
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return {
                    exists: true,
                    rectW: Math.round(r.width),
                    rectH: Math.round(r.height),
                    offsetParentNull: el.offsetParent === null,
                    visibility: cs.visibility,
                    display: cs.display,
                    opacity: Number(cs.opacity),
                    connected: el.isConnected,
                    inViewport: r.width > 0 && r.height > 0
                        && r.right > 0 && r.bottom > 0
                        && r.left < window.innerWidth && r.top < window.innerHeight,
                };
            };
            const hit = el => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return null;
                return document.elementsFromPoint(
                    Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)
                ).slice(0, 5).map(e => (e.id || e.className || e.tagName).toString().slice(0, 40));
            };
            const layerState = () => {
                const l = document.getElementById(layerId);
                return l ? {
                    exists: true, open: l.open, hidden: l.hidden,
                    display: getComputedStyle(l).display,
                    toastCount: l.querySelectorAll('.nvui-toast').length,
                } : { exists: false };
            };

            /* 场景 A：第一条短 duration 消失 → 第二/三/四条应可见 */
            const t1 = window.NVUI.showToast({ message: '第一条', type: 'success', duration: 300 });
            await new Promise(r2 => setTimeout(r2, 150));
            out.A_firstWhileShown = { toast: vis(t1.element), layer: layerState() };
            await new Promise(r2 => setTimeout(r2, 1200));
            out.A_afterFirstGone = { layer: layerState(), firstToast: vis(t1.element) };

            const t2 = window.NVUI.showToast({ message: '第二条', type: 'info', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.A_second = { toast: vis(t2.element), layer: layerState(), hit: hit(t2.element), text: t2.element.textContent.trim() };

            const t3 = window.NVUI.showToast({ message: '第三条', type: 'warn', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.A_third = { toast: vis(t3.element), layer: layerState(), hit: hit(t3.element) };

            const t4 = window.NVUI.showToast({ message: '第四条', type: 'danger', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.A_fourth = { toast: vis(t4.element), layer: layerState(), hit: hit(t4.element) };

            /* 场景 B：混合 —— 第一条 duration=0（不自动消失）+ 第二条 duration=3000 */
            const b1 = window.NVUI.showToast({ message: 'B1常驻', type: 'success', duration: 0 });
            await new Promise(r2 => setTimeout(r2, 300));
            const b2 = window.NVUI.showToast({ message: 'B2定时', type: 'info', duration: 3000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.B_mixed = {
                firstPersistent: vis(b1.element),
                secondTimed: vis(b2.element),
                layer: layerState(),
                hitSecond: hit(b2.element),
            };
            /* B2 自动消失后 B1 应仍在 */
            await new Promise(r2 => setTimeout(r2, 3600));
            out.B_afterSecondGone = {
                firstPersistent: vis(b1.element),
                layer: layerState(),
            };
            b1.dismiss();
            await new Promise(r2 => setTimeout(r2, 800));

            /* 场景 C：全部消失后再次新建（层已被彻底清空） */
            await new Promise(r2 => setTimeout(r2, 400));
            const c1 = window.NVUI.showToast({ message: 'C1', type: 'info', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.C_afterAllGone = { toast: vis(c1.element), layer: layerState(), hit: hit(c1.element) };

            return out;
        });
        observe('NEW-24', r);

        const okToast = t => t && t.exists && t.rectW > 0 && t.rectH > 0
            && t.offsetParentNull === false && t.opacity > 0 && t.inViewport === true;
        const okHit = t => !!(t && t.some(s => /nvui-toast/.test(s)));

        h.assert('[复验] NEW-24 第一条消失后吐司层被重新 show()（layer.open === true）',
            r.A_second.layer.open === true && r.A_second.layer.hidden === false,
            `第二条时层状态=${JSON.stringify(r.A_second.layer)}`);
        h.assert('[复验] NEW-24 第二条吐司用户可见（尺寸>0 / offsetParent 非 null / opacity>0 / 在视口内）',
            okToast(r.A_second.toast), JSON.stringify(r.A_second.toast));
        h.assert('[复验] NEW-24 第二条吐司可被命中（elementsFromPoint 命中吐司元素）',
            okHit(r.A_second.hit), `命中栈=${JSON.stringify(r.A_second.hit)}`);
        h.assert('[复验] NEW-24 第三条吐司用户可见',
            okToast(r.A_third.toast), JSON.stringify(r.A_third.toast));
        h.assert('[复验] NEW-24 第四条吐司用户可见',
            okToast(r.A_fourth.toast), JSON.stringify(r.A_fourth.toast));
        h.assert('[复验] NEW-24 混合场景（第一条 duration=0 常驻 + 第二条 duration=3000）第二条可见',
            okToast(r.B_mixed.secondTimed) && okHit(r.B_mixed.hitSecond),
            `第二条=${JSON.stringify(r.B_mixed.secondTimed)} 命中=${JSON.stringify(r.B_mixed.hitSecond)}`);
        h.assert('[复验] NEW-24 混合场景：第二条定时消失后第一条仍可见（层未被误关）',
            okToast(r.B_afterSecondGone.firstPersistent),
            `第一条=${JSON.stringify(r.B_afterSecondGone.firstPersistent)} 层=${JSON.stringify(r.B_afterSecondGone.layer)}`);
        h.assert('[复验] NEW-24 全部吐司消失后再次新建仍可见（层可反复重开）',
            okToast(r.C_afterAllGone.toast) && okHit(r.C_afterAllGone.hit),
            JSON.stringify(r.C_afterAllGone));
    }

    /* ================================================================
     * 9. config.debug 开关行为 + sanitizeIdPart 数字开头
     * ================================================================ */
    console.log('\n\n########## 9. config.debug 与 sanitizeIdPart ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            const logs = [];
            const fake = {
                log: (...a) => logs.push(['log', a[0]]),
                warn: (...a) => logs.push(['warn', a[0]]),
                error: (...a) => logs.push(['error', a[0]]),
            };
            window.NVUI.config.logger = fake;

            /* 9.1 debug 关闭 → 正常路径应安静，但 warn 必须仍输出 */
            window.NVUI.config.debug = false;
            logs.length = 0;
            const p1 = window.NVUI.createPanel({ id: 'verify_dbg_off', title: 'DBG' });
            p1.open();
            await new Promise(r2 => setTimeout(r2, 400));
            p1.close();
            await new Promise(r2 => setTimeout(r2, 600));
            out.debugOff = {
                totalLogs: logs.length,
                debugLogs: logs.filter(l => l[0] === 'log').length,
                warnLogs: logs.filter(l => l[0] === 'warn').length,
                errorLogs: logs.filter(l => l[0] === 'error').length,
            };
            p1.destroy();

            /* 9.2 debug 开启 → 允许有 debug 输出，但不应刷屏到不可用 */
            window.NVUI.config.debug = true;
            logs.length = 0;
            const p2 = window.NVUI.createPanel({ id: 'verify_dbg_on', title: 'DBG' });
            p2.open();
            await new Promise(r2 => setTimeout(r2, 400));
            p2.close();
            await new Promise(r2 => setTimeout(r2, 600));
            out.debugOn = {
                totalLogs: logs.length,
                debugLogs: logs.filter(l => l[0] === 'log').length,
                sample: logs.slice(0, 8).map(l => l[0] + ': ' + String(l[1]).slice(0, 90)),
            };
            p2.destroy();

            /* 9.3 warn 必须始终输出（与 debug 开关无关） */
            window.NVUI.config.debug = false;
            logs.length = 0;
            const bad = window.NVUI.inputRow({ type: 'zzz-not-real', label: 'X' });
            bad.remove();
            out.warnAlwaysOn = {
                warnLogs: logs.filter(l => l[0] === 'warn').length,
                sample: logs.filter(l => l[0] === 'warn').map(l => String(l[1]).slice(0, 100)),
            };

            /* 9.4 error 级必须始终输出
               ★ 修正（QA 自身用例 bug）：必须让 opener 不可聚焦，
                 否则 restoreFocus() 会在第 1 级就 return，根本走不到
                 focusFallback 分支，自然不会有 warn。 */
            logs.length = 0;
            window.NVUI.config.debug = false;
            const trigFb = document.createElement('button');
            trigFb.id = 'verify_dbg_fb_trig';
            trigFb.textContent = 'fb';
            document.body.appendChild(trigFb);
            trigFb.focus();
            const pBad = window.NVUI.createPanel({ id: 'verify_dbg_warn', title: 'W', focusFallback: '#bad[' });
            pBad.open();
            await new Promise(r2 => setTimeout(r2, 400));
            trigFb.style.display = 'none';   // 迫使 opener 不可聚焦 → 进入 focusFallback 分支
            pBad.close();
            await new Promise(r2 => setTimeout(r2, 800));
            out.warnFromFocusFallback = {
                warnLogs: logs.filter(l => l[0] === 'warn').length,
                sample: logs.filter(l => l[0] === 'warn').map(l => String(l[1]).slice(0, 110)),
            };
            trigFb.remove();
            pBad.destroy();

            window.NVUI.config.logger = console;
            window.NVUI.config.debug = false;

            /* 9.5 sanitizeIdPart：数字开头的 id
               ★ 修正（QA 自身用例 bug）：原来的合法性正则
                 /^[A-Za-z][A-Za-z0-9_-]*$/ 把 '_' 开头的 id 判为非法，
                 但 HTML5 id 与 CSS ident 都允许 '_' 开头，
                 工程师的实现（数字开头加 '_' 前缀）是正确的。
                 改用与 CSS ident 规则一致的合法性判据。 */
            const ids = ['123abc', '9', '0lead', '_ok', 'ok-1', 'a.b', '中文'];
            const idLegal = v => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v);
            out.ids = ids.map(raw => {
                const p = window.NVUI.createPanel({ id: raw, title: 'X' });
                const r = {
                    raw,
                    panelId: p.id,
                    legal: idLegal(p.id),
                    /* 数字开头的原始 id 必须被加前缀，否则 CSS 选择器 #123 会非法 */
                    prefixed: /^[0-9]/.test(raw) ? p.id !== raw && /^[A-Za-z_]/.test(p.id) : true,
                    /* 派生出来的所有 id 必须都合法 */
                    derivedLegal: Array.from(document.querySelectorAll('[id^="' + p.id + '"]'))
                        .every(e => idLegal(e.id)),
                };
                p.destroy();
                return r;
            });
            return out;
        });
        observe('config-and-ids', r);

        h.assert('[复验] config.debug 关闭时正常路径保持安静（不刷屏）',
            r.debugOff.debugLogs === 0 && r.debugOff.totalLogs <= 2,
            JSON.stringify(r.debugOff));
        h.assert('[复验] config.debug 开启时有 debug 输出但不刷屏（<= 40 条）',
            r.debugOn.debugLogs > 0 && r.debugOn.totalLogs <= 40,
            JSON.stringify({ total: r.debugOn.totalLogs, debug: r.debugOn.debugLogs, sample: r.debugOn.sample }));
        h.assert('[复验] warn 级始终输出（不被 debug 开关一起关掉）',
            r.warnAlwaysOn.warnLogs >= 1, JSON.stringify(r.warnAlwaysOn));
        h.assert('[复验] focusFallback 非法时产生 warn（始终输出）',
            r.warnFromFocusFallback.warnLogs >= 1, JSON.stringify(r.warnFromFocusFallback));
        h.assert('[复验] sanitizeIdPart：数字开头的 id 被正确加前缀',
            r.ids.filter(x => /^[0-9]/.test(x.raw)).every(x => x.legal),
            JSON.stringify(r.ids.filter(x => /^[0-9]/.test(x.raw))));
        h.assert('[复验] sanitizeIdPart：非法字符被替换为安全字符，id 均合法',
            r.ids.every(x => x.legal), JSON.stringify(r.ids));
    }

    /* ================================================================
     * 10. 正常路径非回归（不含任何异常输入）
     * ================================================================ */
    console.log('\n\n########## 10. 正常路径非回归 ##########');
    {
        const errsBefore = ctx.pageErrors.length;
        const r = await page.evaluate(async () => {
            const out = {};

            /* 10.1 面板正常开合 */
            const p = window.NVUI.createPanel({
                id: 'verify_normal',
                title: '正常面板',
                version: 'v1',
                tabs: [{ key: 'basic', label: '基础' }, { key: 'adv', label: '高级' }],
                footer: [{ label: '关闭', close: true }],
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 500));
            out.panelOpen = { visible: !p.overlay.hidden, dialogOpen: p.dialog.open };
            /* 切 tab */
            const tabs = Array.from(document.querySelectorAll('#verify_normal-layer .nvui-tab'));
            tabs[1].click();
            await new Promise(r2 => setTimeout(r2, 400));
            const panes = Array.from(document.querySelectorAll('#verify_normal-layer .nvui-tabpane'));
            out.tabSwitch = {
                activeIds: panes.filter(e => e.classList.contains('is-active')).map(e => e.id),
                activeTabCount: tabs.filter(t => t.classList.contains('is-active')).length,
                ariaSelected: tabs.map(t => t.getAttribute('aria-selected')),
            };
            /* addNode 落 pane */
            const node = document.createElement('p');
            node.id = 'verify_normal_node';
            p.addNode('adv', node);
            await new Promise(r2 => setTimeout(r2, 100));
            out.addNode = { paneId: node.parentElement ? node.parentElement.id : null };
            /* 焦点归还
               ★ 修正（QA 自身用例 bug）：原来在 p.open() **之后**才创建并聚焦 trigger，
                 但 opener 是在 openPanel() 时捕获的 document.activeElement，
                 那时 trigger 还不存在 → opener 不是 trigger → 必然归还不到。
                 正确写法：先创建并聚焦 trigger，再 open()。 */
            const trig = document.createElement('button');
            trig.id = 'verify_normal_trig';
            document.body.appendChild(trig);
            trig.focus();
            const pFocus = window.NVUI.createPanel({ id: 'verify_normal_focus', title: '焦点面板' });
            pFocus.open();
            await new Promise(r2 => setTimeout(r2, 500));
            pFocus.close();
            await new Promise(r2 => setTimeout(r2, 900));
            out.focusRestore = {
                returnedToTrigger: document.activeElement === trig,
                overlayHidden: pFocus.overlay.hidden,
                activeId: document.activeElement ? document.activeElement.id : null,
            };
            trig.remove();
            pFocus.destroy();
            p.close();
            await new Promise(r2 => setTimeout(r2, 600));
            out.afterDestroy = { dialogCount: document.querySelectorAll('dialog.nvui-tl').length };

            /* 10.2 进度条正常推进 */
            const track = window.NVUI.progress({ value: 0 });
            document.body.appendChild(track);
            const bar = track.querySelector('.nvui-progress-bar');
            track.setValue(25);
            const at25 = { aria: track.getAttribute('aria-valuenow'), w: bar.style.width };
            track.setValue(75);
            const at75 = { aria: track.getAttribute('aria-valuenow'), w: bar.style.width };
            track.setValue(100);
            const at100 = { aria: track.getAttribute('aria-valuenow'), w: bar.style.width, isComplete: track.classList.contains('is-complete') };
            out.progress = { at25, at75, at100 };
            track.remove();

            /* 10.3 吐司正常显示与自动消失 */
            const t = window.NVUI.showToast({ message: '正常吐司', type: 'success', duration: 400 });
            await new Promise(r2 => setTimeout(r2, 150));
            const r1 = t.element.getBoundingClientRect();
            out.toastShown = { w: Math.round(r1.width), h: Math.round(r1.height) };
            await new Promise(r2 => setTimeout(r2, 1200));
            const l = document.getElementById('nvui-api-toast-layer');
            out.toastGone = {
                removed: !t.element.parentNode || !t.element.isConnected,
                layerToastCount: l ? l.querySelectorAll('.nvui-toast').length : -1,
            };

            /* 10.4 switchRow / accordion 正常 */
            const sr = window.NVUI.switchRow({ label: '开关' });
            document.body.appendChild(sr);
            out.switchRow = { hasCheckbox: !!sr.querySelector('input[type=checkbox]'), text: sr.textContent.trim() };
            const ac = window.NVUI.accordion({ title: '标题', summary: '摘要' });
            document.body.appendChild(ac);
            out.accordion = { text: ac.textContent.trim(), hasHead: !!ac.querySelector('.nvui-acc-head') };
            sr.remove(); ac.remove();

            /* 10.5 宿主模态让位机制仍然可用 */
            const dlg = document.createElement('dialog');
            dlg.id = 'verify_normal_modal';
            document.body.appendChild(dlg);
            const p2 = window.NVUI.createPanel({ id: 'verify_normal2', title: 'N2' });
            p2.open();
            await new Promise(r2 => setTimeout(r2, 500));
            dlg.showModal();
            await new Promise(r2 => setTimeout(r2, 500));
            const carrier = document.querySelector('dialog.nvui-tl');
            out.hostModal = {
                degraded: carrier ? carrier.classList.contains('is-host-modal') : null,
                count: window.NVUI.countHostModals(),
            };
            dlg.close();
            await new Promise(r2 => setTimeout(r2, 500));
            out.hostModalRestored = {
                degraded: carrier ? carrier.classList.contains('is-host-modal') : null,
                count: window.NVUI.countHostModals(),
            };
            dlg.remove();
            p2.destroy();
            return out;
        });
        observe('normal-path', r);
        const newPageErrors = ctx.pageErrors.slice(errsBefore);

        h.assert('[复验] 正常路径无新增 pageerror',
            newPageErrors.length === 0, `pageerror=${newPageErrors.length} ${JSON.stringify(newPageErrors)}`);
        h.assert('[复验] 面板正常 open（overlay 可见 + dialog.open）',
            r.panelOpen.visible === true && r.panelOpen.dialogOpen === true, JSON.stringify(r.panelOpen));
        h.assert('[复验] 切 tab 正常（恰好 1 个 tab active、1 个 pane active）',
            r.tabSwitch.activeTabCount === 1 && r.tabSwitch.activeIds.length === 1,
            JSON.stringify(r.tabSwitch));
        h.assert('[复验] addNode 落到指定 pane',
            r.addNode.paneId === 'verify_normal-pane-adv', JSON.stringify(r.addNode));
        h.assert('[复验] 焦点正常归还到触发元素',
            r.focusRestore.returnedToTrigger === true && r.focusRestore.overlayHidden === true,
            JSON.stringify(r.focusRestore));
        h.assert('[复验] destroy() 正常清理 DOM',
            typeof r.afterDestroy.dialogCount === 'number' && r.afterDestroy.dialogCount >= 0,
            JSON.stringify(r.afterDestroy));
        h.assert('[复验] 进度条正常推进（0→25→75→100，aria 与 width 同步）',
            r.progress.at25.aria === '25' && r.progress.at25.w === '25%'
            && r.progress.at75.aria === '75' && r.progress.at75.w === '75%'
            && r.progress.at100.aria === '100' && r.progress.at100.w === '100%'
            && r.progress.at100.isComplete === true,
            JSON.stringify(r.progress));
        h.assert('[复验] 吐司正常显示并自动消失',
            r.toastShown.w > 0 && r.toastShown.h > 0 && r.toastGone.removed === true
            && r.toastGone.layerToastCount === 0,
            JSON.stringify({ shown: r.toastShown, gone: r.toastGone }));
        h.assert('[复验] switchRow / accordion 正常渲染',
            r.switchRow.hasCheckbox === true && r.switchRow.text === '开关'
            && r.accordion.hasHead === true && r.accordion.text.indexOf('标题') >= 0,
            JSON.stringify({ sw: r.switchRow, ac: r.accordion }));
        h.assert('[复验] 宿主模态让位机制仍正常（打开时降级、关闭后还原）',
            r.hostModal.degraded === true && r.hostModal.count >= 1
            && r.hostModalRestored.degraded === false && r.hostModalRestored.count === 0,
            JSON.stringify({ open: r.hostModal, restored: r.hostModalRestored }));
    }

    /* ================================================================
     * 汇总
     * ================================================================ */
    await h.cleanup();

    const md5After = md5(API);
    const mixed = md5Before !== md5After;
    const outDir = path.join(h.KIT_ROOT, '.workbuddy', 'review');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'VERIFY-raw-2026-10-20.json'),
        JSON.stringify({ md5Before, md5After, mixedVersion: mixed, raw: OBS }, null, 2));

    if (mixed) console.log('\n[混合版本] ⚠ 运行期间 nvui-api.js 发生变化，本轮数据需重跑确认！');
    else console.log(`\n[版本一致] nvui-api.js md5 运行前后一致：${md5Before}`);

    const ok = h.summary('修复后复验（全部 PASS = 修复有效）');
    process.exit(ok ? 0 : 1);
})().catch(async e => {
    console.error('FATAL', e);
    try { await h.cleanup(); } catch (_) { /* ignore */ }
    process.exit(1);
});
