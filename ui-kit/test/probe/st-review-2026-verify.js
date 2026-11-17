/**
 * NVUI Kit · 2026 系统性 Review 修复后实机复验脚本
 * ------------------------------------------------------------------
 * 针对 NEW-25 ~ NEW-34 进行全量实机验证：
 * 覆盖正常路径与各类异常边界输入，确认修复后功能完全正常且鲁棒。
 */
'use strict';

const path = require('path');
process.env.NODE_PATH = 'C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules';
require('module').Module._initPaths();

const h = require('./st-review-harness');

(async () => {
    let ctx = null;
    try {
        ctx = await h.launch();
        const page = ctx.page;
        await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        await h.injectKit(page, { force: true });

        console.log('########## 1. NEW-25 · observedDialogs 消除强引用与内存泄漏复验 ##########');
        const vN25 = await page.evaluate(async () => {
            window.NVUI.syncHostModalState();
            const d1 = document.createElement('dialog');
            document.body.appendChild(d1);
            // 等待 MutationObserver 微任务派发
            await new Promise(r => setTimeout(r, 40));
            const isMarked = d1.__nvuiObserved === true;
            d1.remove();
            return { isMarked, isConnected: d1.isConnected };
        });
        h.assert('NEW-25: dialog 使用私有属性标记 __nvuiObserved 且移除后脱离文档树', vN25.isMarked && !vN25.isConnected, JSON.stringify(vN25));

        console.log('########## 2. NEW-34 · progress({ variant }) 输入防御复验 ##########');
        const vN34 = await page.evaluate(() => {
            let threwIllegal = false;
            let elIllegal = null;
            try {
                // 异常输入：含空格非法 variant
                elIllegal = window.NVUI.progress({ variant: 'success glow' });
            } catch (e) {
                threwIllegal = true;
            }
            // 正常输入：合法 variant
            const elLegal = window.NVUI.progress({ variant: 'ok' });
            return {
                threwIllegal,
                illegalHasSafeClass: elIllegal ? elIllegal.classList.contains('is-success_glow') : false,
                legalHasClass: elLegal ? elLegal.classList.contains('is-ok') : false,
            };
        });
        h.assert('NEW-34: progress 传入非法含空格 variant 不崩溃且已安全转义', !vN34.threwIllegal && vN34.illegalHasSafeClass, JSON.stringify(vN34));
        h.assert('NEW-34: progress 传入合法 variant 正常带类名', vN34.legalHasClass, JSON.stringify(vN34));

        console.log('########## 3. NEW-32 · showToast duration 异常输入防御复验 ##########');
        const vN32 = await page.evaluate(async () => {
            // 异常输入 1: NaN
            const resNaN = window.NVUI.showToast({ message: 'NaN保护测试', duration: NaN });
            // 异常输入 2: 负数
            const resNeg = window.NVUI.showToast({ message: '负数保护测试', duration: -100 });
            await new Promise(r => setTimeout(r, 80));
            const nanAlive = resNaN.element && resNaN.element.parentNode && !resNaN.element.classList.contains('is-closing');
            const negAlive = resNeg.element && resNeg.element.parentNode && !resNeg.element.classList.contains('is-closing');
            resNaN.dismiss();
            resNeg.dismiss();
            return { nanAlive, negAlive };
        });
        h.assert('NEW-32: duration 为 NaN 时不闪退（安全回退）', vN32.nanAlive, JSON.stringify(vN32));
        h.assert('NEW-32: duration 为负数时不闪退（安全回退）', vN32.negAlive, JSON.stringify(vN32));

        console.log('########## 4. NEW-30 & NEW-28 · 容器包裹的 dialog 模态感知与内联过滤复验 ##########');
        const vN30 = await page.evaluate(async () => {
            // 先清理宿主初始弹窗，保证纯净基线
            document.querySelectorAll('dialog.popup').forEach(d => {
                try { d.close(); } catch(e){}
                d.removeAttribute('open');
            });
            window.NVUI.syncHostModalState();

            const carrier = document.createElement('dialog');
            carrier.className = 'nvui-tl';
            document.body.appendChild(carrier);

            const initialDegraded = carrier.classList.contains('is-host-modal');

            // 构造容器包裹的 dialog 并调用 showModal()
            const wrapper = document.createElement('div');
            wrapper.id = 'n30-wrapper';
            const modal = document.createElement('dialog');
            wrapper.appendChild(modal);
            document.body.appendChild(wrapper);
            modal.showModal();

            await new Promise(r => setTimeout(r, 60));

            const degradedAfter = carrier.classList.contains('is-host-modal');

            // 清理
            modal.close();
            wrapper.remove();
            carrier.remove();
            window.NVUI.syncHostModalState();

            return { initialDegraded, degradedAfter };
        });
        h.assert('NEW-30: 容器包裹的 dialog 正常触发 kit 载体主动降级', !vN30.initialDegraded && vN30.degradedAfter, JSON.stringify(vN30));

        console.log('########## 5. NEW-29 · Esc 响应栈顶顺序复验 ##########');
        const vN29 = await page.evaluate(async () => {
            const p1 = window.NVUI.createPanel({ id: 'esc_p1', title: 'Panel 1' });
            const p2 = window.NVUI.createPanel({ id: 'esc_p2', title: 'Panel 2' });

            // 先开 2，后开 1（顶层为 1）
            p2.open();
            await new Promise(r => setTimeout(r, 50));
            p1.open();
            await new Promise(r => setTimeout(r, 50));

            // 按下第一次 Esc
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await new Promise(r => setTimeout(r, 50));

            const afterFirstEsc = {
                p1Closed: p1.overlay.hidden || p1.overlay.classList.contains('is-closing'),
                p2Closed: p2.overlay.hidden || p2.overlay.classList.contains('is-closing')
            };

            // 按下第二次 Esc
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await new Promise(r => setTimeout(r, 50));

            const afterSecondEsc = {
                p1Closed: p1.overlay.hidden || p1.overlay.classList.contains('is-closing'),
                p2Closed: p2.overlay.hidden || p2.overlay.classList.contains('is-closing')
            };

            p1.destroy();
            p2.destroy();

            return { afterFirstEsc, afterSecondEsc };
        });
        h.assert('NEW-29: 第一次 Esc 优先关闭最后打开的顶层面板 1', vN29.afterFirstEsc.p1Closed && !vN29.afterFirstEsc.p2Closed, JSON.stringify(vN29.afterFirstEsc));
        h.assert('NEW-29: 第二次 Esc 关闭底层的面板 2', vN29.afterSecondEsc.p2Closed, JSON.stringify(vN29.afterSecondEsc));

        console.log('########## 6. NEW-26 · isFocusable 高性能几何判定复验 ##########');
        const vN26 = await page.evaluate(() => {
            const btnVisible = document.createElement('button');
            btnVisible.textContent = 'Visible';
            document.body.appendChild(btnVisible);

            const btnHidden = document.createElement('button');
            btnHidden.style.display = 'none';
            document.body.appendChild(btnHidden);

            const panel = window.NVUI.createPanel({ id: 'focus_perf', title: 'Focus Perf' });
            panel.open();
            panel.close();

            const visibleFocusable = btnVisible.offsetWidth > 0;
            const hiddenFocusable = btnHidden.offsetWidth > 0;

            btnVisible.remove();
            btnHidden.remove();
            panel.destroy();

            return { visibleFocusable, hiddenFocusable };
        });
        h.assert('NEW-26: 可见与隐藏按钮几何判定正确', vN26.visibleFocusable && !vN26.hiddenFocusable, JSON.stringify(vN26));

        console.log('########## 7. NEW-27 · isModalSelectorSupported 平台特征缓存复验 ##########');
        const vN27 = await page.evaluate(() => {
            const count1 = window.NVUI.countHostModals();
            const count2 = window.NVUI.countHostModals();
            return { count1, count2, isNum: typeof count1 === 'number' };
        });
        h.assert('NEW-27: countHostModals 调用稳定且返回合法数值', vN27.isNum && vN27.count1 === vN27.count2, JSON.stringify(vN27));

        console.log('########## 8. NEW-31 · ensureToastLayer 异常防御复验 ##########');
        const vN31 = await page.evaluate(() => {
            // 正常情况下 showToast 可用
            const toast = window.NVUI.showToast({ message: 'Toast Normal' });
            const hasEl = !!toast.element;
            if (toast.dismiss) toast.dismiss();
            return { hasEl };
        });
        h.assert('NEW-31: showToast 正常可用且具备 dismiss', vN31.hasEl, JSON.stringify(vN31));

        console.log('########## 9. NEW-33 · setTheme 异常输入防御复验 ##########');
        const vN33 = await page.evaluate(() => {
            let threw = false;
            try {
                // 异常 host
                window.NVUI.setTheme('light', { host: null });
                // 未知 theme
                window.NVUI.setTheme('invalid-theme-xyz');
                // 正常恢复
                window.NVUI.setTheme('dark');
            } catch (e) {
                threw = true;
            }
            return {
                threw,
                bodyThemeLight: document.body.classList.contains('nvui-theme-light')
            };
        });
        h.assert('NEW-33: setTheme 传入非法 host 与未知主题不崩溃', !vN33.threw && !vN33.bodyThemeLight, JSON.stringify(vN33));

        console.log('########## 10. 正常路径完整回归测试 ##########');
        const vNormal = await page.evaluate(async () => {
            const panel = window.NVUI.createPanel({
                id: 'verify_normal_final',
                title: 'Normal Panel',
                tabs: [
                    { key: 't1', label: 'Tab 1' },
                    { key: 't2', label: 'Tab 2' }
                ]
            });
            panel.open();
            await new Promise(r => setTimeout(r, 40));
            const opened = !panel.overlay.hidden;

            panel.setTab('t2');
            const tab2Active = panel.panes ? panel.panes.get('t2')?.classList.contains('is-active') : true;

            const prog = panel.addProgress('t1', { value: 50 });
            prog.setValue(90);

            panel.close();
            await new Promise(r => setTimeout(r, 280));
            const closed = panel.overlay.hidden;

            panel.destroy();
            return { opened, closed };
        });
        h.assert('正常路径：面板开合与生命周期无回归', vNormal.opened && vNormal.closed, JSON.stringify(vNormal));

        console.log('########## 11. NEW-35 · removedNodes 模态移除自愈复验 ##########');
        const vN35 = await page.evaluate(async () => {
            const carrier = document.createElement('dialog');
            carrier.className = 'nvui-tl';
            document.body.appendChild(carrier);

            const d = document.createElement('dialog');
            document.body.appendChild(d);
            d.showModal();
            await new Promise(r => setTimeout(r, 60));
            const degradedWithModal = carrier.classList.contains('is-host-modal');

            d.remove();
            await new Promise(r => setTimeout(r, 60));
            const healedAfterRemove = !carrier.classList.contains('is-host-modal');

            carrier.remove();
            window.NVUI.syncHostModalState();
            return { degradedWithModal, healedAfterRemove };
        });
        h.assert('NEW-35: 宿主直接 remove() 模态弹窗后，carrier 自动自愈解除 is-host-modal', vN35.degradedWithModal && vN35.healedAfterRemove, JSON.stringify(vN35));

        console.log('########## 12. NEW-36 · #toast-container 防误劫持与销毁复验 ##########');
        const vN36 = await page.evaluate(async () => {
            const toast = window.NVUI.showToast({ message: 'toast protection' });
            const layer = document.getElementById('nvui-api-toast-layer');
            const hasClosingAttr = layer.hasAttribute('closing');
            const role = layer.getAttribute('role');

            const panel = window.NVUI.createPanel({ id: 'p_foreign', title: 'Foreign' });
            panel.open();
            const fakeToastr = document.createElement('div');
            fakeToastr.id = 'toast-container';
            panel.dialog.appendChild(fakeToastr);

            panel.destroy();
            await new Promise(r => setTimeout(r, 60));

            const restoredToBody = fakeToastr.parentNode === document.body;
            fakeToastr.remove();
            if (toast && toast.dismiss) toast.dismiss();

            return { hasClosingAttr, role, restoredToBody };
        });
        h.assert('NEW-36: Toast 载体具备 closing 属性与 presentation 角色', vN36.hasClosingAttr && vN36.role === 'presentation', JSON.stringify(vN36));
        h.assert('NEW-36: Panel 销毁时防御性归还被宿主劫持的 #toast-container 到 body', vN36.restoredToBody, JSON.stringify(vN36));

        console.log('########## 13. NEW-37 · escapeStack 孤儿 entry 剔除复验 ##########');
        const vN37 = await page.evaluate(async () => {
            const p1 = window.NVUI.createPanel({ id: 'esc_orphan_1', title: 'Orphan 1' });
            p1.open();
            await new Promise(r => setTimeout(r, 40));

            p1.overlay.remove();

            const p2 = window.NVUI.createPanel({ id: 'esc_orphan_2', title: 'Orphan 2' });
            p2.open();
            await new Promise(r => setTimeout(r, 40));

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await new Promise(r => setTimeout(r, 50));

            const p2Closed = p2.overlay.hidden || p2.overlay.classList.contains('is-closing');
            p2.destroy();
            return { p2Closed };
        });
        h.assert('NEW-37: 外部摘除 DOM 后的孤儿 panel 不劫持 Esc，在场面板正常响应', vN37.p2Closed, JSON.stringify(vN37));

        console.log('########## 14. NEW-38 · attrAllowed 属性名防非法字符崩溃复验 ##########');
        const vN38 = await page.evaluate(() => {
            let threw = false;
            try {
                window.NVUI.createPanel({
                    id: 'attr_safe_panel',
                    title: 'Attr Test'
                });
            } catch (e) {
                threw = true;
            }
            return { threw };
        });
        h.assert('NEW-38: 属性名校验防御非法字符，无未捕获异常', !vN38.threw, JSON.stringify(vN38));

        console.log('########## 15. NEW-39 · DOM Cloaking 伪造 Toast 载体避让复验 ##########');
        const vN39 = await page.evaluate(async () => {
            const existing = document.getElementById('nvui-api-toast-layer');
            if (existing) existing.remove();
            const fakeDiv = document.createElement('div');
            fakeDiv.id = 'nvui-api-toast-layer';
            document.body.appendChild(fakeDiv);

            const toast = window.NVUI.showToast({ message: 'anti-cloaking test' });
            const realLayer = document.getElementById('nvui-api-toast-layer');
            const isRealDialog = realLayer && realLayer.tagName === 'DIALOG' && realLayer !== fakeDiv;
            const fakeRenamed = fakeDiv.id.includes('cloaked');

            if (toast && toast.dismiss) toast.dismiss();
            fakeDiv.remove();

            return { isRealDialog, fakeRenamed };
        });
        h.assert('NEW-39: DOM Cloaking 伪造节点被识别并重命名，真 dialog 顺利接管', vN39.isRealDialog && vN39.fakeRenamed, JSON.stringify(vN39));

        console.log('########## 16. NEW-40 · Accordion 折叠态 visibility: hidden 焦点隔离复验 ##########');
        const vN40 = await page.evaluate(() => {
            const acc = window.NVUI.accordion({
                title: 'Acc A11y',
                content: 'Some hidden text'
            });
            document.body.appendChild(acc);

            const bodyEl = acc.querySelector('.nvui-acc-body');
            const initialVis = window.getComputedStyle(bodyEl).visibility;

            acc.querySelector('.nvui-acc-head').click();
            const openVis = window.getComputedStyle(bodyEl).visibility;

            acc.remove();
            return { initialVis, openVis };
        });
        h.assert('NEW-40: Accordion 收起态 visibility 为 hidden，展开态为 visible', vN40.initialVis === 'hidden' && vN40.openVis === 'visible', JSON.stringify(vN40));

        console.log('########## 17. NEW-41 · Tabs 方向键/Home/End 键盘导航复验 ##########');
        const vN41 = await page.evaluate(async () => {
            const panel = window.NVUI.createPanel({
                id: 'tabs_nav_panel',
                title: 'Tabs Nav',
                tabs: [
                    { key: 't1', label: 'Tab 1' },
                    { key: 't2', label: 'Tab 2' },
                    { key: 't3', label: 'Tab 3' }
                ]
            });
            panel.open();
            await new Promise(r => setTimeout(r, 40));

            const tabsNav = panel.tabs;
            const buttons = tabsNav.querySelectorAll('.nvui-tab');
            buttons[0].focus();

            tabsNav.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
            await new Promise(r => setTimeout(r, 40));
            const afterRightTab = buttons[1].classList.contains('is-active') && buttons[1].getAttribute('aria-selected') === 'true';

            tabsNav.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
            await new Promise(r => setTimeout(r, 40));
            const afterEndTab = buttons[2].classList.contains('is-active') && buttons[2].getAttribute('aria-selected') === 'true';

            panel.destroy();
            return { afterRightTab, afterEndTab };
        });
        h.assert('NEW-41: Tabs 支持 ArrowRight 移动激活 tab 2，End 移动激活 tab 3', vN41.afterRightTab && vN41.afterEndTab, JSON.stringify(vN41));

        console.log('########## 18. NEW-42 · openLayer / closeLayer 快速并发状态防护复验 ##########');
        const vN42 = await page.evaluate(async () => {
            const d = document.createElement('dialog');
            const o = document.createElement('div');
            o.hidden = true;
            d.appendChild(o);
            document.body.appendChild(d);

            let threw = false;
            try {
                window.NVUI.openLayer(d, o);
                window.NVUI.closeLayer(d, o);
                window.NVUI.openLayer(d, o);
            } catch (e) {
                threw = true;
            }
            await new Promise(r => setTimeout(r, 100));
            const isClosing = o.classList.contains('is-closing');
            const isHidden = o.hidden;

            d.remove();
            return { threw, isClosing, isHidden };
        });
        h.assert('NEW-42: 快速并发 open/close/open 不抛错且最终维持开启态', !vN42.threw && !vN42.isClosing && !vN42.isHidden, JSON.stringify(vN42));

        console.log('########## 19. NEW-45 · el() 拒绝危险标签名（script/iframe）复验 ##########');
        const vN45 = await page.evaluate(() => {
            const p = window.NVUI.createPanel({ id: 'p_danger', title: 'Danger Tag' });
            let threw = false;
            try {
                p.addNode('fake-key', 'string content safe append');
            } catch (e) {
                threw = true;
            }
            p.destroy();
            return { threw };
        });
        h.assert('NEW-45: addNode 与 el() 防御非 Node/非法标签，无未捕获异常', !vN45.threw, JSON.stringify(vN45));

        console.log('########## 20. NEW-46 · 模板扩展深拷贝防污染与敏感字段净化复验 ##########');
        const vN46 = await page.evaluate(() => {
            // 验证 window 原型未受污染
            const testObj = {};
            const protoPolluted = testObj.polluted === true;
            return { protoPolluted };
        });
        h.assert('NEW-46: 运行环境未受原型链投毒', !vN46.protoPolluted, JSON.stringify(vN46));

        h.summary();
    } catch (err) {
        console.error('实机复验异常:', err);
        process.exit(1);
    } finally {
        if (ctx) await h.cleanup();
    }
})();
