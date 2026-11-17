/**
 * NVUI Kit · 修复前独立复现取证脚本（repro）
 * ------------------------------------------------------------------
 * 目的：在工程师修复**之前**，为架构师静态审查报告（.workbuddy/review/AUDIT-2026-10-20.md）
 *       中的 7 条高危缺陷建立可重复运行的**实机基线数据**，
 *       并对静态结论做实机证伪/证实。修复后复跑本脚本，FAIL 应翻转为 PASS。
 *
 * ============================ 断言语义（重要） ============================
 * 本脚本的断言**一律断言「正确行为」**：
 *   - 修复前（缺陷存在）→ 该断言 FAIL
 *   - 修复后（缺陷修复）→ 该断言 PASS
 * 断言名统一以 `[缺陷]` 开头 + 缺陷编号，便于 diff 前后两次运行结果。
 * 每条缺陷另有「缺陷复现观测」段落，输出原始数值（而非仅结论），
 * 以 [缺陷存在] / [已修复] 标注当前状态。
 *
 * 运行：
 *   cd T:/Github/SillyTavern/Plugins/ui-kit && \
 *   env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
 *   NODE_PATH=C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules \
 *   node test/st-review-repro.js
 *
 * 注意：脚本会记录运行开始/结束时 nvui-api.js 的 md5，若两者不一致，
 *       说明运行期间源码被改动，输出会带 [混合版本] 警告。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const h = require('./st-review-harness');

const API = path.join(h.KIT_ROOT, 'nvui-api.js');

function md5(file) {
    return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

const OBS = {};   // 原始观测数据
const DEFECT_STATE = {}; // 每条缺陷的「缺陷存在」判定（文本标注用）

function observe(key, payload) {
    OBS[key] = payload;
    console.log(`\n----- 观测 ${key} -----`);
    console.log(JSON.stringify(payload, null, 2));
    console.log('------------------');
}

function markDefect(id, present, note) {
    DEFECT_STATE[id] = { present, note };
    console.log(`[${present ? '缺陷存在' : '已修复'}] ${id} ${note}`);
}

(async () => {
    const md5Before = md5(API);
    console.log('nvui-api.js md5 (run start):', md5Before);

    const ctx = await h.launch();
    const { page } = ctx;

    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    /* ================================================================
     * NEW-01 · el() 的 setAttribute 无白名单 —— 可达性取证
     * ================================================================ */
    console.log('\n\n########## NEW-01 · el() 属性通道可达性 ##########');
    {
        const r = await page.evaluate(() => {
            const out = {};
            /* 1) el() 是否导出到 NVUI 公共 API —— 外部能否直接调用 */
            out.elExported = typeof window.NVUI.el;
            out.nvuiApiKeys = Object.keys(window.NVUI);

            /* 2) 运行时取证：patch Element.prototype.setAttribute，
             *    记录 createPanel 过程中出现的**全部属性名**，
             *    用来判断「用户可控数据是否会流进属性名位置」。 */
            const attrNames = [];
            const attrValues = {};
            const origSet = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function (name, value) {
                attrNames.push(String(name));
                if (!attrValues[String(name)]) attrValues[String(name)] = [];
                if (attrValues[String(name)].length < 3) attrValues[String(name)].push(String(value).slice(0, 80));
                return origSet.call(this, name, value);
            };

            const hostileTitle = '<img src=x onerror="window.__XSS__=1">';
            const hostileKey = 'k<onclick=alert(1)>';
            const p = window.NVUI.createPanel({
                id: 'repro_n01',
                title: hostileTitle,
                version: '<b>v</b>',
                tabs: [{ key: hostileKey, label: '<i>L</i>' }, { key: 'ok', label: 'OK' }],
                actions: [{ label: '<a>A</a>', icon: 'fa-solid fa-x' }],
                footer: [{ label: '<em>F</em>' }],
            });
            Element.prototype.setAttribute = origSet;

            out.attrNameSet = Array.from(new Set(attrNames)).sort();
            out.attrNameCount = attrNames.length;
            out.attrSampleValues = attrValues;
            /* 危险属性名是否出现 */
            const dangerNames = attrNames.filter(n =>
                /^on/i.test(n) || n === 'style' || n === 'srcdoc' || n === 'href' || n === 'src' || n === 'formaction');
            out.dangerAttrNames = Array.from(new Set(dangerNames));

            /* 3) 用户数据实际落在哪个通道 */
            const titleEl = document.querySelector('#repro_n01-title');
            out.titleTextContent = titleEl ? titleEl.childNodes[0].textContent : null;
            out.titleHasElementChild = titleEl ? titleEl.childNodes.length > 1 : null;
            out.titleInnerHTML = titleEl ? titleEl.innerHTML : null;
            out.injectedImg = !!document.querySelector('#repro_n01-layer img');
            out.xssFired = !!window.__XSS__;

            const tabBtn = document.querySelector('[id^="repro_n01-tab-"]');
            out.tabIdRaw = tabBtn ? tabBtn.id : null;
            out.tabIdLegal = out.tabIdRaw ? /^[A-Za-z][A-Za-z0-9_-]*$/.test(out.tabIdRaw) : null;

            const pane = document.querySelector('[id^="repro_n01-pane-"]');
            out.paneIdRaw = pane ? pane.id : null;

            p.destroy();
            return out;
        });

        observe('NEW-01', r);

        /* 可达性判定 */
        const reachableExternally = r.elExported !== 'undefined';
        const dangerReached = r.dangerAttrNames.length > 0;
        const xssFired = r.xssFired;
        const injectedElement = r.injectedImg;

        markDefect('NEW-01', dangerReached || injectedElement || xssFired,
            `属性名通道: 用户数据未流入属性名; 危险属性名出现 ${r.dangerAttrNames.length} 种; 注入元素=${injectedElement}; XSS=${xssFired}`);

        h.assert('[缺陷] NEW-01 el() 不应允许 on*/style/srcdoc 等危险属性名进入 DOM',
            dangerReached === false,
            `实际出现的危险属性名: ${JSON.stringify(r.dangerAttrNames)}`);
        h.assert('[缺陷] NEW-01 恶意 title 不得产生可执行 DOM 元素',
            injectedElement === false && xssFired === false,
            `注入img=${injectedElement} XSS触发=${xssFired} titleTextContent=${JSON.stringify(r.titleTextContent)}`);
        h.assert('[缺陷] NEW-01 el() 不应作为公共 API 暴露属性构造能力',
            reachableExternally === false,
            `NVUI.el 类型=${r.elExported}（undefined=未导出，外部无法直接调用）`);
        /* 附加：属性名是否全部为字面量（内部可控） */
        const literalOnly = r.attrNameSet.every(n =>
            /^(id|role|aria-[a-z]+|type|hidden|title|tabindex|value|class|data-[a-z-]+|for|href|name|min|max|step|placeholder|disabled|open|src|srcset|alt|width|height|colspan|rows|content|rel|target|download|style|lang|dir)$/.test(n)
            || /^aria-/.test(n) || /^data-/.test(n));
        h.assert('[缺陷] NEW-01 全部属性名应来自 kit 内部字面量白名单',
            literalOnly, `出现的属性名: ${JSON.stringify(r.attrNameSet)}`);
    }

    /* ================================================================
     * NEW-02 · tabs[].key 未校验即拼进 DOM id
     * ================================================================ */
    console.log('\n\n########## NEW-02 · tabs[].key 注入 DOM id ##########');
    {
        const r = await page.evaluate(() => {
            const out = {};
            const keys = ['ok', 'a b', 'x<y', 'q"z', 'dup', 'dup'];
            const p = window.NVUI.createPanel({
                id: 'repro_n02',
                tabs: keys.map(k => ({ key: k, label: 'L:' + k })),
            });
            const layer = document.querySelector('#repro_n02-layer');
            const tabEls = Array.from(layer.querySelectorAll('.nvui-tab'));
            const paneEls = Array.from(layer.querySelectorAll('.nvui-tabpane'));

            out.tabIds = tabEls.map(e => e.id);
            out.paneIds = paneEls.map(e => e.id);
            out.tabIdLegal = tabEls.map(e => /^[A-Za-z][A-Za-z0-9_-]*$/.test(e.id));
            out.paneIdLegal = paneEls.map(e => /^[A-Za-z][A-Za-z0-9_-]*$/.test(e.id));
            out.tabIdDupCount = tabEls.map(e => e.id).length - new Set(tabEls.map(e => e.id)).size;
            const pid = paneEls.map(e => e.id);
            out.paneIdDupCount = pid.length - new Set(pid).size;

            /* 非法 id 对 querySelector 的影响 */
            out.querySelectorThrows = [];
            tabEls.forEach(e => {
                try { document.querySelector('#' + e.id); out.querySelectorThrows.push(null); }
                catch (err) { out.querySelectorThrows.push(err.name + ': ' + err.message); }
            });

            /* ARIA 链路：tab 的 aria-controls → 是否指向存在的 pane；pane 的 aria-labelledby → tab */
            out.ariaControlsResolve = tabEls.map(e => {
                const target = e.getAttribute('aria-controls');
                const el = document.getElementById(target);
                return { controls: target, exists: !!el, tag: el ? el.tagName : null };
            });
            out.ariaLabelledbyResolve = paneEls.map(e => {
                const target = e.getAttribute('aria-labelledby');
                const el = document.getElementById(target);
                return { labelledby: target, exists: !!el, tag: el ? el.tagName : null };
            });

            /* 重复 key 是否导致 pane 静默丢失：DOM 中 .nvui-tabpane 数量 vs 期望 */
            out.paneCountInDom = paneEls.length;
            out.paneCountExpected = keys.length;
            /* 哪些 pane 永远无法被激活（重复 key 时 map 只保留最后一个） */
            const activeStates = paneEls.map(e => e.classList.contains('is-active'));
            out.paneActiveFlags = activeStates;

            /* 切到 'dup' 看第一个 dup pane 是否还能被激活 */
            const dupTab = tabEls[tabEls.length - 2];
            dupTab.click();
            out.afterDupClickActive = paneEls.map(e => e.classList.contains('is-active'));
            out.afterDupClickActiveIds = paneEls.map(e => e.id);

            p.destroy();
            return out;
        });

        observe('NEW-02', r);

        const illegalTabs = r.tabIdLegal.filter(v => !v).length;
        const illegalPanes = r.paneIdLegal.filter(v => !v).length;
        const thrown = r.querySelectorThrows.filter(Boolean).length;
        const brokenAria = r.ariaControlsResolve.filter(x => !x.exists).length
            + r.ariaLabelledbyResolve.filter(x => !x.exists).length;
        const lost = r.paneCountExpected - r.paneCountInDom;
        const dupPane = r.paneIdDupCount > 0;

        markDefect('NEW-02', illegalTabs > 0 || thrown > 0 || brokenAria > 0 || dupPane || lost > 0,
            `非法tabId=${illegalTabs} 非法paneId=${illegalPanes} querySelector抛错=${thrown} ARIA断链=${brokenAria} 重复paneId=${r.paneIdDupCount} DOM pane数=${r.paneCountInDom}/期望${r.paneCountExpected}`);

        h.assert('[缺陷] NEW-02 tabs key 不应产生非法 DOM id',
            illegalTabs === 0 && illegalPanes === 0,
            `非法 tabId ${illegalTabs} 个: ${JSON.stringify(r.tabIds.filter((_, i) => !r.tabIdLegal[i]))}`);
        h.assert('[缺陷] NEW-02 非法 id 不应导致 querySelector 抛异常',
            thrown === 0, `抛错 ${thrown} 处: ${JSON.stringify(r.querySelectorThrows.filter(Boolean))}`);
        h.assert('[缺陷] NEW-02 tab/pane 的 ARIA 关联不应断链',
            brokenAria === 0,
            `aria-controls 断链 ${r.ariaControlsResolve.filter(x => !x.exists).length}，aria-labelledby 断链 ${r.ariaLabelledbyResolve.filter(x => !x.exists).length}`);
        h.assert('[缺陷] NEW-02 重复 key 不应造成 pane id 重复或面板静默丢失',
            dupPane === false && lost === 0,
            `重复 paneId=${r.paneIdDupCount} DOM pane=${r.paneCountInDom} 期望=${r.paneCountExpected}`);
    }

    /* ================================================================
     * NEW-03 · focusFallback 非法选择器抛未捕获异常
     * ================================================================ */
    console.log('\n\n########## NEW-03 · focusFallback 非法选择器 ##########');
    {
        const pageErrorsBefore = ctx.pageErrors.length;
        const r = await page.evaluate(async () => {
            const out = {};
            const errs = [];
            const onErr = e => errs.push(e.message || String(e.error));
            window.addEventListener('error', onErr);

            let onCloseCalled = false;
            const trigger = document.createElement('button');
            trigger.id = 'repro_n03_trigger';
            trigger.textContent = 'trigger';
            document.body.appendChild(trigger);
            trigger.focus();

            const p = window.NVUI.createPanel({
                id: 'repro_n03',
                title: 'N03',
                focusFallback: '#a[',
                onClose: () => { onCloseCalled = true; },
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 500));
            out.opened = p.overlay ? !p.overlay.hidden : null;

            /* 让 opener 变得不可聚焦（模拟宿主菜单收起），迫使走 focusFallback 分支 */
            trigger.style.display = 'none';

            let thrownInClose = null;
            try {
                p.close();
            } catch (e) {
                thrownInClose = e.name + ': ' + e.message;
            }
            await new Promise(r2 => setTimeout(r2, 1200));

            out.thrownSynchronously = thrownInClose;
            out.uncaughtErrors = errs.slice();
            out.onCloseCalled = onCloseCalled;
            out.focusAfterClose = document.activeElement ? document.activeElement.id || document.activeElement.tagName : null;
            out.overlayHidden = p.overlay ? p.overlay.hidden : null;

            window.removeEventListener('error', onErr);
            trigger.remove();
            p.destroy();
            return out;
        });

        observe('NEW-03', r);
        const newPageErrors = ctx.pageErrors.slice(pageErrorsBefore);

        markDefect('NEW-03', (newPageErrors.length + r.uncaughtErrors.length + (r.thrownSynchronously ? 1 : 0)) > 0,
            `未捕获错误 ${r.uncaughtErrors.length + newPageErrors.length} 条；onClose 被调用=${r.onCloseCalled}；焦点落点=${r.focusAfterClose}`);

        h.assert('[缺陷] NEW-03 非法 focusFallback 选择器不应产生未捕获异常',
            (newPageErrors.length + r.uncaughtErrors.length) === 0,
            `pageerror=${newPageErrors.length} window.onerror=${r.uncaughtErrors.length} 内容=${JSON.stringify(r.uncaughtErrors.concat(newPageErrors)).slice(0, 400)}`);
        h.assert('[缺陷] NEW-03 非法 focusFallback 不应打断 onClose 回调',
            r.onCloseCalled === true, `onClose 被调用=${r.onCloseCalled}`);
        h.assert('[缺陷] NEW-03 非法 focusFallback 不应让焦点掉到 body',
            r.focusAfterClose !== null && r.focusAfterClose !== 'BODY',
            `关闭后焦点落点=${r.focusAfterClose}`);
    }

    /* ================================================================
     * NEW-04 · progress() 的 aria-valuenow 与 width 不一致
     * ================================================================ */
    console.log('\n\n########## NEW-04 · progress() aria/width 不一致 ##########');
    {
        const r = await page.evaluate(() => {
            const out = {};
            const cases = [
                { name: 'string_80', value: '80' },
                { name: 'nan', value: NaN },
                { name: 'over_200', value: 200 },
                { name: 'normal_50', value: 50 },
            ];
            out.cases = cases.map(c => {
                const track = window.NVUI.progress({ value: c.value });
                document.body.appendChild(track);
                const bar = track.querySelector('.nvui-progress-bar');
                const cs = getComputedStyle(bar);
                const trackCs = getComputedStyle(track);
                const barW = parseFloat(cs.width);
                const trackW = parseFloat(trackCs.width);
                const res = {
                    name: c.name,
                    inputValue: String(c.value),
                    inputType: typeof c.value,
                    ariaValueNow: track.getAttribute('aria-valuenow'),
                    ariaValueMax: track.getAttribute('aria-valuemax'),
                    barStyleWidth: bar.style.width,
                    barComputedWidthPx: cs.width,
                    trackComputedWidthPx: trackCs.width,
                    barRatioPct: trackW > 0 ? Math.round((barW / trackW) * 1000) / 10 : null,
                };
                res.ariaMatchesWidth = (res.barRatioPct === null)
                    ? null
                    : (Number(res.ariaValueNow) === res.barRatioPct);
                track.remove();
                return res;
            });
            /* setValue 路径（对照：setValue 是否自愈） */
            const t2 = window.NVUI.progress({ value: '80' });
            document.body.appendChild(t2);
            t2.setValue(50);
            const b2 = t2.querySelector('.nvui-progress-bar');
            out.setValueAfter = {
                ariaValueNow: t2.getAttribute('aria-valuenow'),
                barStyleWidth: b2.style.width,
            };
            t2.remove();
            return out;
        });

        observe('NEW-04', r);

        const str80 = r.cases.find(c => c.name === 'string_80');
        const nan = r.cases.find(c => c.name === 'nan');
        const over = r.cases.find(c => c.name === 'over_200');
        const norm = r.cases.find(c => c.name === 'normal_50');

        const defects = [];
        if (String(str80.ariaValueNow) !== '80' || str80.barRatioPct !== 80) defects.push('string_80');
        if (nan.ariaMatchesWidth === false || nan.barStyleWidth.indexOf('NaN') >= 0) defects.push('nan');
        if (Number(over.ariaValueNow) > 100 || over.ariaMatchesWidth === false) defects.push('over_200');

        markDefect('NEW-04', defects.length > 0,
            `不一致用例: ${JSON.stringify(defects)}；string_80 aria=${str80.ariaValueNow} width%=${str80.barRatioPct}；nan aria=${nan.ariaValueNow} width=${nan.barStyleWidth}；over_200 aria=${over.ariaValueNow} width%=${over.barRatioPct}`);

        h.assert('[缺陷] NEW-04 字符串 value 应与 width 一致（aria-valuenow=80 且宽度 80%）',
            String(str80.ariaValueNow) === '80' && str80.barRatioPct === 80,
            `aria=${str80.ariaValueNow} width%=${str80.barRatioPct} style=${str80.barStyleWidth}`);
        h.assert('[缺陷] NEW-04 NaN value 应归零且 aria 与 width 一致',
            nan.ariaMatchesWidth === true && nan.barStyleWidth.indexOf('NaN') < 0,
            `aria=${nan.ariaValueNow} style=${nan.barStyleWidth} ratio=${nan.barRatioPct}`);
        h.assert('[缺陷] NEW-04 超界 value 应钳制到 100 且 aria 不越界',
            Number(over.ariaValueNow) <= 100 && over.ariaMatchesWidth === true,
            `aria=${over.ariaValueNow}（max=${over.ariaValueMax}）width%=${over.barRatioPct}`);
        h.assert('[缺陷] NEW-04 合法 value 不应被误判（回归护栏）',
            norm.ariaMatchesWidth === true, `aria=${norm.ariaValueNow} width%=${norm.barRatioPct}`);
    }

    /* ================================================================
     * NEW-05 · inputRow() 的 type 无白名单
     * ================================================================ */
    console.log('\n\n########## NEW-05 · inputRow type 无白名单 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            /* 类型覆盖清单：
               - 原生类型（REAL_TYPES 判据）：必须原样落到 DOM type 属性
               - path 伪类型：DOM 契约为 type="text" + .is-path（见下方口径说明）
               - number：单独验证 onChange 回参类型 */
            const types = ['text', 'number', 'path', 'email', 'url', 'tel', 'search', 'date', 'time',
                'month', 'week', 'datetime-local', 'password', 'range', 'color', 'file'];
            out.types = types.map(t => {
                const row = window.NVUI.inputRow({ type: t, label: 'L_' + t });
                document.body.appendChild(row);
                const res = { requested: t, actual: row.input.type, inputTag: row.input.tagName };
                if (t === 'path') {
                    /* path 伪类型的权威契约取证（见下方 markDefect 处的口径说明） */
                    out.pathClass = row.input.className;
                    out.pathDataNvuiType = row.input.getAttribute('data-nvui-type');
                    out.pathIdlType = row.input.type;
                    out.pathHasOwnDescriptor = !!Object.getOwnPropertyDescriptor(row.input, 'type');
                }
                row.remove();
                return res;
            });
            /* number 的 onChange 回参类型 */
            let captured = 'NOT_CALLED';
            const rowN = window.NVUI.inputRow({
                type: 'number', label: 'num', value: 42,
                onChange: v => { captured = { type: typeof v, value: v }; },
            });
            document.body.appendChild(rowN);
            rowN.input.value = '7';
            rowN.input.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r2 => setTimeout(r2, 100));
            out.numberOnChange = captured;
            rowN.remove();
            /* 无 type 时 */
            const rowD = window.NVUI.inputRow({ label: 'default' });
            document.body.appendChild(rowD);
            out.defaultType = rowD.input.type;
            rowD.remove();
            return out;
        });

        observe('NEW-05', r);

        const pathRow = r.types.find(t => t.requested === 'path');
        /* ★★★ 断言口径修正（QA 自有脚本，Round 3 修正，特此留痕）★★★

           原始断言（Round 2）：
             lost = types.filter(t => t.requested !== 'text' && t.requested !== 'number' && t.actual === 'text')
             assert('NEW-05 type:"path" 不应被静默改写为 text', pathRow.actual === 'path')

           修正原因（**不是为了让测试变绿而弱化断言**，而是原断言的前提本身有误）：
             1. 权威契约（preview.html:1713 / 2819 手写 DOM、README §7.7 样式表）
                明确规定 path 伪类型在 DOM 上就是：
                    <input class="nvui-input is-path" type="text" ...>
                即 **DOM 属性 type="text" 是正确形态**，不是缺陷。
             2. team-lead 第三轮任务书也明确写道：
                「`path` 是 kit 伪类型，DOM 仍是 text + `.is-path` 类，是公开用法不是 bug」
             3. 因此把 path 算进 lost 集合、以及要求 JS 侧 input.type === 'path'，
                都是**我的 Round 2 断言前提错误**，而非源码缺陷。
             4. 附带实证：工程师曾在 20:11~20:23 之间用 Object.defineProperty
                把 JS 侧 input.type 伪装成 'path'，该版本存在真实缺陷 ——
                setter 写 DOM 属性但 getter 恒返回 'path'，
                导致 `input.type = 'number'` 后读回仍是 'path'（往返不一致）；
                工程师在 20:56 已回退该实现（改为 data-nvui-type="path" 暴露意图），
                与权威契约一致。

           修正后的判据（与权威契约对齐，且比原断言更强）：
             · path 的 DOM 属性必须是 type="text"
             · path 必须保留 .is-path 类
             · path 必须通过 data-nvui-type="path" 暴露调用方意图
             · JS 侧 input.type 必须真实反映 DOM 属性（不得被 defineProperty 伪装）
             · path 之外的真实类型（email/url/tel/search/date/color/file）
               不得被静默塌缩为 text —— **这一条原样保留，是 NEW-05 的核心**
        */
        const REAL_TYPES = ['email', 'url', 'tel', 'search', 'date', 'time', 'month', 'week',
            'datetime-local', 'password', 'range', 'color', 'file'];
        const lost = r.types.filter(t => REAL_TYPES.indexOf(t.requested) !== -1 && t.actual === 'text');
        const numberType = r.types.find(t => t.requested === 'number');
        const pathContract = {
            domType: pathRow.actual,
            domIsText: pathRow.actual === 'text',
            hasIsPath: !!(r.pathClass && r.pathClass.indexOf('is-path') !== -1),
            dataNvuiType: r.pathDataNvuiType,
            intentExposed: r.pathDataNvuiType === 'path',
            idlMatchesAttr: r.pathIdlType === pathRow.actual,
            hasOwnTypeDescriptor: !!r.pathHasOwnDescriptor,
        };
        const pathOk = pathContract.domIsText && pathContract.hasIsPath
            && pathContract.intentExposed && pathContract.idlMatchesAttr
            && !pathContract.hasOwnTypeDescriptor;

        markDefect('NEW-05', !pathOk || lost.length > 0 || r.numberOnChange.type !== 'number',
            `path 契约=${JSON.stringify(pathContract)}；真实类型塌缩 ${JSON.stringify(lost.map(t => t.requested + '→' + t.actual))}；number onChange 回参类型=${r.numberOnChange.type}`);

        h.assert('[缺陷] NEW-05 path 伪类型符合权威契约（DOM type=text + .is-path + data-nvui-type 暴露意图 + JS 侧不被伪装）',
            pathOk, JSON.stringify(pathContract));
        h.assert('[缺陷] NEW-05 email/url/tel/search/date/color/file 不应被静默塌缩为 text',
            lost.length === 0,
            `被改写的类型: ${JSON.stringify(lost.map(t => t.requested + '→' + t.actual))}`);
        h.assert('[缺陷] NEW-05 number 类型的 onChange 应回传 number 而非字符串',
            r.numberOnChange.type === 'number',
            `实际回参类型=${r.numberOnChange.type} 值=${JSON.stringify(r.numberOnChange.value)}`);
        h.assert('[缺陷] NEW-05 number 类型仍应保持 number（回归护栏）',
            numberType.actual === 'number', `actual=${numberType.actual}`);
    }

    /* ================================================================
     * NEW-06 · closeLayer 的 animationend 监听器只增不减
     * ================================================================ */
    console.log('\n\n########## NEW-06 · closeLayer animationend 监听器累积 ##########');
    {
        const r = await page.evaluate(async () => {
            const out = {};
            /* patch EventTarget.prototype.addEventListener / removeEventListener 计数 */
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

            const p = window.NVUI.createPanel({ id: 'repro_n06', title: 'N06' });
            const overlay = p.overlay;
            const countOf = () => (counts.has(overlay) ? counts.get(overlay) : 0);

            out.afterCreate = countOf();
            const snapshots = [];
            for (let i = 1; i <= 30; i++) {
                p.open();
                await new Promise(r2 => setTimeout(r2, 120));
                p.close();
                await new Promise(r2 => setTimeout(r2, 420));
                if (i === 1 || i === 5 || i === 10 || i === 20 || i === 30) {
                    snapshots.push({ cycle: i, animationendListeners: countOf() });
                }
            }
            out.snapshots = snapshots;
            out.final = countOf();
            out.cycles = 30;

            EventTarget.prototype.addEventListener = origAdd;
            EventTarget.prototype.removeEventListener = origRemove;
            p.destroy();
            return out;
        });

        observe('NEW-06', r);

        const s30 = r.snapshots.find(s => s.cycle === 30);
        const s10 = r.snapshots.find(s => s.cycle === 10);
        const growth = (s30 && s10) ? s30.animationendListeners - s10.animationendListeners : null;
        const linear = growth === 20; // 10→30 周期应恰好 +20，若线性增长

        markDefect('NEW-06', r.final > 2,
            `animationend 监听器：创建后=${r.afterCreate}，10轮=${s10 && s10.animationendListeners}，30轮=${s30 && s30.animationendListeners}，增量=${growth}（线性=${linear}）`);

        h.assert('[缺陷] NEW-06 面板反复开关后 overlay 的 animationend 监听器不应线性增长',
            r.final <= 2,
            `30 轮开关后监听器数=${r.final}；快照 ${JSON.stringify(r.snapshots)}`);
        h.assert('[缺陷] NEW-06 20 轮额外开关的监听器增量应为 0（而非 +20）',
            growth === 0, `10→30 轮增量=${growth}（线性增长时为 +20）`);
    }

    /* ================================================================
     * NEW-24 · 吐司层关闭后永不重开 → 第二条及以后吐司不可见
     * ================================================================ */
    console.log('\n\n########## NEW-24 · 吐司层关闭后不可重开（本批最关键）##########');
    {
        /* 清理可能存在的历史吐司层，保证从"从未创建过"的状态开始 */
        await page.evaluate(() => {
            const old = document.getElementById('nvui-api-toast-layer');
            if (old) old.remove();
        });

        const r = await page.evaluate(async () => {
            const out = {};
            const layerId = 'nvui-api-toast-layer';

            const vis = (el) => {
                if (!el) return { exists: false };
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return {
                    exists: true,
                    rectW: Math.round(r.width),
                    rectH: Math.round(r.height),
                    rectTop: Math.round(r.top),
                    offsetParentNull: el.offsetParent === null,
                    visibility: cs.visibility,
                    display: cs.display,
                    opacity: cs.opacity,
                    connected: el.isConnected,
                };
            };

            /* 第 1 条吐司：短 duration，让它自然消失并触发层关闭 */
            const t1 = window.NVUI.showToast({ message: '第一条吐司', type: 'success', duration: 300 });
            await new Promise(r2 => setTimeout(r2, 150));
            out.firstToastVisibleWhileShown = vis(t1.element);
            out.layerWhileFirstShown = (() => {
                const l = document.getElementById(layerId);
                return l ? { open: l.open, hidden: l.hidden, display: getComputedStyle(l).display } : null;
            })();

            /* 等第一条完全退场（退场动画 + 兜底 260ms） */
            await new Promise(r2 => setTimeout(r2, 1200));
            out.afterFirstGone = (() => {
                const l = document.getElementById(layerId);
                return l
                    ? {
                        exists: true, open: l.open, hidden: l.hidden,
                        display: getComputedStyle(l).display,
                        toastCount: l.querySelectorAll('.nvui-toast').length,
                    }
                    : { exists: false };
            })();
            out.firstToastAfterGone = vis(t1.element);

            /* 第 2 条吐司：应当可见 */
            const t2 = window.NVUI.showToast({ message: '第二条吐司', type: 'info', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 500));
            out.secondToast = vis(t2.element);
            out.layerAfterSecond = (() => {
                const l = document.getElementById(layerId);
                return l
                    ? {
                        exists: true, open: l.open, hidden: l.hidden,
                        display: getComputedStyle(l).display,
                        visibility: getComputedStyle(l).visibility,
                        toastCount: l.querySelectorAll('.nvui-toast').length,
                        secondInLayer: !!l.querySelector('.nvui-toast'),
                    }
                    : { exists: false };
            })();
            out.secondToastText = t2.element ? t2.element.textContent.trim() : null;
            out.secondToastParent = t2.element ? (t2.element.parentElement && t2.element.parentElement.className) : null;

            /* 命中测试：第二条吐司中心点上最顶层的元素是谁 */
            out.hitTest = (() => {
                const el = t2.element;
                if (!el) return null;
                const r = el.getBoundingClientRect();
                const stack = document.elementsFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
                return stack.slice(0, 4).map(e => (e.id || e.className || e.tagName).toString().slice(0, 40));
            })();

            /* 第 3 条：同样不可见 */
            const t3 = window.NVUI.showToast({ message: '第三条吐司', type: 'warn', duration: 5000 });
            await new Promise(r2 => setTimeout(r2, 400));
            out.thirdToast = vis(t3.element);

            return out;
        });

        observe('NEW-24', r);

        const secondInvisible = r.secondToast
            && (r.secondToast.rectW === 0 || r.secondToast.rectH === 0
                || r.secondToast.offsetParentNull === true
                || r.secondToast.visibility === 'hidden'
                || r.secondToast.display === 'none');
        const layerNotOpen = r.layerAfterSecond && r.layerAfterSecond.open === false;
        const layerClosedBefore = r.afterFirstGone && r.afterFirstGone.open === false;

        markDefect('NEW-24', !!(secondInvisible || (layerNotOpen && layerClosedBefore)),
            `第一条消失后层状态=${JSON.stringify(r.afterFirstGone)}；第二条可见性=${JSON.stringify(r.secondToast)}；第二条后层状态=${JSON.stringify(r.layerAfterSecond)}`);

        h.assert('[缺陷] NEW-24 第一条吐司消失后，吐司层应能被重新 show()（layer.open === true）',
            !(r.layerAfterSecond && r.layerAfterSecond.open === false),
            `layer.open=${r.layerAfterSecond && r.layerAfterSecond.open} hidden=${r.layerAfterSecond && r.layerAfterSecond.hidden} display=${r.layerAfterSecond && r.layerAfterSecond.display}`);
        h.assert('[缺陷] NEW-24 第二条吐司必须可见（有非零尺寸且未被隐藏）',
            !secondInvisible,
            `第二条: ${JSON.stringify(r.secondToast)}`);
        h.assert('[缺陷] NEW-24 第二条吐司应可被命中（elementsFromPoint 命中吐司元素）',
            !!(r.hitTest && r.hitTest.some(s => /nvui-toast/.test(s))),
            `命中栈: ${JSON.stringify(r.hitTest)}`);
        h.assert('[缺陷] NEW-24 第三条吐司同样应可见',
            !(r.thirdToast && (r.thirdToast.rectW === 0 || r.thirdToast.rectH === 0 || r.thirdToast.offsetParentNull === true)),
            `第三条: ${JSON.stringify(r.thirdToast)}`);
    }

    /* ================================================================
     * NEW-07 · syncHostModalState() 触发频率（量化测量）
     * ================================================================ */
    console.log('\n\n########## NEW-07 · syncHostModalState 触发频率 ##########');
    {
        /* 先注入我们的 NVUI 副本并 patch MutationObserver，
         * 以便只统计"我们这份实例"的 watcher 触发次数（隔离宿主 LAB 自带的实例）。 */
        await page.evaluate(() => {
            window.__reproObs = { observerCallbacks: 0, openAttrMutations: 0, modalQueries: 0, tlQueries: 0 };
            const OrigMO = window.MutationObserver;
            window.MutationObserver = function (cb) {
                const wrapped = function (records, obs) {
                    window.__reproObs.observerCallbacks += 1;
                    for (let i = 0; i < records.length; i++) {
                        if (records[i].type === 'attributes' && records[i].attributeName === 'open') {
                            window.__reproObs.openAttrMutations += 1;
                        }
                    }
                    return cb.call(this, records, obs);
                };
                return new OrigMO(wrapped);
            };
            window.MutationObserver.prototype = OrigMO.prototype;
            /* 统计 countHostModals / syncHostModalState 里的全文档查询次数 */
            const origQSA = Document.prototype.querySelectorAll;
            Document.prototype.querySelectorAll = function (sel) {
                if (sel === 'dialog:modal' || sel === 'dialog[open]') window.__reproObs.modalQueries += 1;
                if (sel === 'dialog.nvui-tl') window.__reproObs.tlQueries += 1;
                return origQSA.call(this, sel);
            };
        });

        /* 重新注入一份 NVUI（force），让 watcher 装在我们打了补丁的 MutationObserver 上 */
        await h.injectKit(page, { force: true });

        const r = await page.evaluate(async () => {
            const out = {};
            const snap = () => JSON.parse(JSON.stringify(window.__reproObs));

            /* 0) 基线：静置 3 秒，不做任何交互 */
            await new Promise(r2 => setTimeout(r2, 500));
            const before = snap();
            await new Promise(r2 => setTimeout(r2, 3000));
            const idle = snap();
            out.idleBaseline = {
                observerCallbacks: idle.observerCallbacks - before.observerCallbacks,
                openAttrMutations: idle.openAttrMutations - before.openAttrMutations,
                modalQueries: idle.modalQueries - before.modalQueries,
                tlQueries: idle.tlQueries - before.tlQueries,
            };

            /* 1) 打开一个 kit 面板 */
            const p = window.NVUI.createPanel({ id: 'repro_n07', title: 'N07' });
            const b1 = snap();
            p.open();
            await new Promise(r2 => setTimeout(r2, 800));
            const a1 = snap();
            out.openKitPanel = {
                observerCallbacks: a1.observerCallbacks - b1.observerCallbacks,
                openAttrMutations: a1.openAttrMutations - b1.openAttrMutations,
                modalQueries: a1.modalQueries - b1.modalQueries,
                tlQueries: a1.tlQueries - b1.tlQueries,
            };

            /* 2) 关闭 kit 面板 */
            const b2 = snap();
            p.close();
            await new Promise(r2 => setTimeout(r2, 900));
            const a2 = snap();
            out.closeKitPanel = {
                observerCallbacks: a2.observerCallbacks - b2.observerCallbacks,
                openAttrMutations: a2.openAttrMutations - b2.openAttrMutations,
                modalQueries: a2.modalQueries - b2.modalQueries,
                tlQueries: a2.tlQueries - b2.tlQueries,
            };

            /* 3) 宿主式模态：dialog.showModal() */
            const dlg = document.createElement('dialog');
            dlg.id = 'repro_host_modal';
            document.body.appendChild(dlg);
            const b3 = snap();
            dlg.showModal();
            await new Promise(r2 => setTimeout(r2, 800));
            const a3 = snap();
            out.hostModalOpen = {
                observerCallbacks: a3.observerCallbacks - b3.observerCallbacks,
                openAttrMutations: a3.openAttrMutations - b3.openAttrMutations,
                modalQueries: a3.modalQueries - b3.modalQueries,
                tlQueries: a3.tlQueries - b3.tlQueries,
            };

            /* 4) 关闭宿主模态 */
            const b4 = snap();
            dlg.close();
            await new Promise(r2 => setTimeout(r2, 800));
            const a4 = snap();
            out.hostModalClose = {
                observerCallbacks: a4.observerCallbacks - b4.observerCallbacks,
                openAttrMutations: a4.openAttrMutations - b4.openAttrMutations,
                modalQueries: a4.modalQueries - b4.modalQueries,
                tlQueries: a4.tlQueries - b4.tlQueries,
            };
            dlg.remove();

            /* 5) 宿主真实 UI 交互：点击扩展菜单按钮 + 点击聊天区 */
            const b5 = snap();
            const extBtn = document.querySelector('#extensionsMenuButton, #extensions-settings-button, #user-settings-button');
            if (extBtn) extBtn.click();
            await new Promise(r2 => setTimeout(r2, 900));
            const a5 = snap();
            out.hostUiClick = {
                clicked: !!extBtn,
                observerCallbacks: a5.observerCallbacks - b5.observerCallbacks,
                openAttrMutations: a5.openAttrMutations - b5.openAttrMutations,
                modalQueries: a5.modalQueries - b5.modalQueries,
                tlQueries: a5.tlQueries - b5.tlQueries,
            };

            /* 6) 切换任意元素的 open 属性 20 次（模拟宿主频繁开关 dialog） */
            const probe = document.createElement('div');
            document.body.appendChild(probe);
            const b6 = snap();
            for (let i = 0; i < 20; i++) {
                probe.setAttribute('open', '');
                probe.removeAttribute('open');
                await new Promise(r2 => setTimeout(r2, 20));
            }
            await new Promise(r2 => setTimeout(r2, 600));
            const a6 = snap();
            out.toggleOpenAttr20x = {
                observerCallbacks: a6.observerCallbacks - b6.observerCallbacks,
                openAttrMutations: a6.openAttrMutations - b6.openAttrMutations,
                modalQueries: a6.modalQueries - b6.modalQueries,
                tlQueries: a6.tlQueries - b6.tlQueries,
            };
            probe.remove();

            out.totals = snap();
            p.destroy();
            return out;
        });

        observe('NEW-07', r);

        const perToggleModalQueries = r.toggleOpenAttr20x.modalQueries / 20;
        markDefect('NEW-07', perToggleModalQueries > 0.2,
            `每次 open 属性切换触发 modal 查询 ${perToggleModalQueries.toFixed(2)} 次；`
            + `静置 3s 触发 ${r.idleBaseline.modalQueries} 次；`
            + `开面板 ${r.openKitPanel.modalQueries} 次 / 关面板 ${r.closeKitPanel.modalQueries} 次；`
            + `宿主模态开 ${r.hostModalOpen.modalQueries} / 关 ${r.hostModalClose.modalQueries}`);

        h.assert('[缺陷] NEW-07 单次 open 属性变更不应触发超过 0.5 次全文档 modal 查询（应有节流/缓存）',
            perToggleModalQueries <= 0.5,
            `实测 ${perToggleModalQueries.toFixed(2)} 次/切换（20 次切换共 ${r.toggleOpenAttr20x.modalQueries} 次 querySelectorAll('dialog:modal')）`);
        h.assert('[缺陷] NEW-07 静置 3 秒不应持续触发全文档查询（观察器应收窄）',
            r.idleBaseline.modalQueries <= 2,
            `静置 3s 触发 ${r.idleBaseline.modalQueries} 次 querySelectorAll`);
    }

    /* ================================================================
     * NEW-08 · 切 tab 的布局次数/耗时 + 帧间隔（按 README §13.6 方法论）
     * ================================================================ */
    console.log('\n\n########## NEW-08 · 切 tab 性能（帧间隔为准）##########');
    {
        const cdp = await ctx.context.newCDPSession(page);
        await cdp.send('Performance.enable');

        const r = await page.evaluate(async () => {
            const out = {};
            /* 造一个多 tab 面板（贴近真实使用） */
            const p = window.NVUI.createPanel({
                id: 'repro_n08',
                title: 'N08',
                tabs: [
                    { key: 'basic', label: '基础' }, { key: 'adv', label: '高级' },
                    { key: 'data', label: '数据' }, { key: 'about', label: '关于' },
                ],
            });
            p.open();
            await new Promise(r2 => setTimeout(r2, 900));

            /* 帧间隔采集：rAF 逐帧记录时间戳 */
            const collectFrames = (ms) => new Promise(resolve => {
                const stamps = [];
                const t0 = performance.now();
                function tick(now) {
                    stamps.push(now);
                    if (now - t0 < ms) requestAnimationFrame(tick);
                    else resolve(stamps);
                }
                requestAnimationFrame(tick);
            });
            const stats = (stamps) => {
                if (stamps.length < 3) return null;
                const deltas = [];
                for (let i = 1; i < stamps.length; i++) deltas.push(stamps[i] - stamps[i - 1]);
                const sorted = deltas.slice().sort((a, b) => a - b);
                const p = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
                const over = deltas.filter(d => d > 16.7 * 1.5).length;
                const over33 = deltas.filter(d => d > 33.4).length;
                return {
                    frames: deltas.length,
                    p50: Math.round(p(0.5) * 100) / 100,
                    p95: Math.round(p(0.95) * 100) / 100,
                    max: Math.round(Math.max.apply(null, deltas) * 100) / 100,
                    avg: Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 100) / 100,
                    overBudget16_7: over,
                    overBudget33_4: over33,
                };
            };

            /* 基线：静止不动的帧间隔 */
            const baseStamps = await collectFrames(1000);
            out.baseline = stats(baseStamps);

            /* 切 tab 时的帧间隔（切 3 次，覆盖指示器动画期） */
            const tabs = Array.from(document.querySelectorAll('#repro_n08-layer .nvui-tab'));
            const switchStamps = [];
            const p2 = (async () => {
                switchStamps.push(...await collectFrames(1200));
            })();
            await new Promise(r2 => setTimeout(r2, 100));
            for (const t of [tabs[1], tabs[2], tabs[3]]) {
                t.click();
                await new Promise(r2 => setTimeout(r2, 350));
            }
            await p2;
            out.switching = stats(switchStamps);

            out.tabCount = tabs.length;
            p.close();
            await new Promise(r2 => setTimeout(r2, 500));
            p.destroy();
            return out;
        });

        /* CDP 布局指标 */
        const m = await cdp.send('Performance.getMetrics');
        const pick = n => {
            const hit = m.metrics.find(x => x.name === n);
            return hit ? hit.value : null;
        };
        r.cdp = {
            LayoutCount: pick('LayoutCount'),
            RecalcStyleCount: pick('RecalcStyleCount'),
            LayoutDuration: pick('LayoutDuration'),
            ScriptDuration: pick('ScriptDuration'),
            TaskDuration: pick('TaskDuration'),
        };
        observe('NEW-08', r);

        const base = r.baseline, sw = r.switching;
        /* 方法论（README §13.6）：判定性能问题必须看帧间隔，不能只看累计布局耗时 */
        const frameDelta = sw && base ? (sw.p95 - base.p95) : null;
        const perceptible = sw && base && (sw.p95 > base.p95 + 4 || sw.overBudget16_7 > base.overBudget16_7 + 2);

        markDefect('NEW-08', !!perceptible,
            `基线 p95=${base && base.p95}ms/超预算帧 ${base && base.overBudget16_7}；`
            + `切 tab p95=${sw && sw.p95}ms/超预算帧 ${sw && sw.overBudget16_7}/max ${sw && sw.max}ms；`
            + `p95 差=${frameDelta === null ? 'n/a' : frameDelta.toFixed(2) + 'ms'} → ${perceptible ? '可感知卡顿' : '不可感知'}`);

        h.assert('[缺陷] NEW-08 切 tab 的帧间隔 p95 不应比静止基线恶化超过 4ms（§13.6 判据）',
            !perceptible,
            `基线 p95=${base && base.p95}ms，切 tab p95=${sw && sw.p95}ms，差=${frameDelta === null ? 'n/a' : frameDelta.toFixed(2)}ms，`
            + `超 16.7ms×1.5 预算帧 基线 ${base && base.overBudget16_7} vs 切 tab ${sw && sw.overBudget16_7}`);
        h.assert('[缺陷] NEW-08 切 tab 不应出现超过 33.4ms 的长帧',
            !!(sw && sw.overBudget33_4 === 0),
            `长帧数=${sw && sw.overBudget33_4}，max=${sw && sw.max}ms`);
    }

    /* ================================================================
     * 汇总
     * ================================================================ */
    await h.cleanup();

    const md5After = md5(API);
    const mixed = md5Before !== md5After;

    const summary = {
        md5Before,
        md5After,
        mixedVersion: mixed,
        defectState: DEFECT_STATE,
        raw: OBS,
    };
    const outDir = path.join(h.KIT_ROOT, '.workbuddy', 'review');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'REPRO-raw-2026-10-20.json'), JSON.stringify(summary, null, 2));

    console.log('\n===== 缺陷状态一览 =====');
    Object.entries(DEFECT_STATE).forEach(([k, v]) => {
        console.log(`  [${v.present ? '缺陷存在' : '已修复'}] ${k} — ${v.note}`);
    });
    if (mixed) {
        console.log('\n[混合版本] ⚠ 运行期间 nvui-api.js 发生变化（md5 前后不一致），本轮数据需重跑确认！');
    } else {
        console.log(`\n[版本一致] nvui-api.js md5 运行前后一致：${md5Before}`);
    }
    console.log(`\n原始数据已写入: ${path.join(outDir, 'REPRO-raw-2026-10-20.json')}`);

    const ok = h.summary('修复前复现（断言 FAIL = 缺陷存在；修复后应全部 PASS）');
    process.exit(ok ? 0 : 1);
})().catch(async e => {
    console.error('FATAL', e);
    try { await h.cleanup(); } catch (_) { /* ignore */ }
    process.exit(1);
});
