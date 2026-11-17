/**
 * NVUI Kit · ST 实机探针（#16 · 宿主 showModal 模态弹窗与 kit 浮层的层级关系）
 *
 * 背景：ST 宿主 `public/scripts/popup.js` 用 `dlg.showModal()` 打开弹窗，
 *       模态会进入浏览器 top layer（优先级高于任何 z-index）。
 *       待办 #16 假设：此时 kit 浮层会被宿主模态压住 → 需改 popover=manual。
 *
 * 本探针实测三件事：
 *   1. 宿主模态打开时，kit 面板是否真的在宿主模态**之下**（命中栈判定）；
 *   2. 宿主模态打开时，**页面是否 inert**（宿主是否可交互被禁用）；
 *   3. 用户在这种状态下**能否与 kit 浮层交互**（能否点到底下的按钮）。
 *
 * 若 (1) 成立但 (2)(3) 同时成立（宿主已禁交互），则「被压住」是模态语义的
 * 正确表现，不构成可用性缺陷 → #16 应改判为「不修」而非「需破坏性变更」。
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];

function check(pass, name, detail) {
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
    return pass;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const R = {};

    /* 打开 kit 面板 */
    await page.evaluate(() => window.__NVUI_LAB__.open('basic'));
    await page.waitForTimeout(1200);

    R.beforeModal = await page.evaluate(() => {
        const panel = document.querySelector('.nvui-panel');
        const pr = panel.getBoundingClientRect();
        const stack = document.elementsFromPoint(
            Math.round(pr.left + pr.width / 2),
            Math.round(pr.top + pr.height / 2)
        ).map(e => e.id || (e.className || '').toString().slice(0, 30) || e.tagName);
        return { stack: stack.slice(0, 4) };
    });

    /* 打开宿主模态（用 ST 自己的 popup API 路径：构造一个 showModal 的 dialog，
       与 popup.js 同机制） */
    R.withHostModal = await page.evaluate(async () => {
        const dlg = document.createElement('dialog');
        dlg.id = 'perf-host-modal';
        dlg.style.cssText = 'width:420px;padding:24px;';
        dlg.innerHTML = '<p style="margin:0">宿主模态弹窗</p>';
        document.body.appendChild(dlg);
        dlg.showModal();

        await new Promise(r => setTimeout(r, 300));

        const panel = document.querySelector('.nvui-panel');
        const pr = panel.getBoundingClientRect();
        const stack = document.elementsFromPoint(
            Math.round(pr.left + pr.width / 2),
            Math.round(pr.top + pr.height / 2)
        ).map(e => e.id || (e.className || '').toString().slice(0, 30) || e.tagName);

        /* 页面是否被 inert（模态语义） */
        const bodyInert = document.body.hasAttribute('inert') ||
            document.querySelector('body > *:not(dialog[open])')?.hasAttribute('inert') === true;
        const inertSupported = 'inert' in HTMLElement.prototype;
        // 直接测：尝试聚焦一个 kit 按钮
        const btn = panel.querySelector('button');
        let focusWorked = false;
        if (btn) {
            btn.focus();
            focusWorked = document.activeElement === btn;
        }
        // 尝试派发点击是否能命中 kit 按钮（命中栈第一层是不是 kit）
        const hitIsKit = stack.some((s, i) => i === 0 && /nvui/.test(s));

        const out = {
            topStack: stack.slice(0, 4),
            kitOnTop: hitIsKit,
            inertSupported,
            bodyInert,
            focusWorked,
            modalOpen: dlg.open,
        };
        dlg.close();
        dlg.remove();
        return out;
    });

    await page.waitForTimeout(600);

    R.afterModal = await page.evaluate(() => {
        const panel = document.querySelector('.nvui-panel');
        const pr = panel.getBoundingClientRect();
        const stack = document.elementsFromPoint(
            Math.round(pr.left + pr.width / 2),
            Math.round(pr.top + pr.height / 2)
        ).map(e => e.id || (e.className || '').toString().slice(0, 30) || e.tagName);
        return { stack: stack.slice(0, 4), kitOnTop: /nvui/.test(stack[0] || '') };
    });

    console.log('=== #16 实机数据 ===');
    console.log(JSON.stringify(R, null, 2));

    console.log('\n=== 判定 ===');
    const w = R.withHostModal;
    check(w.modalOpen, '宿主模态（showModal）成功打开');
    check(w.inertSupported, '浏览器支持 inert 属性（模态语义生效的前提）');
    check(!w.kitOnTop, '宿主模态打开时 kit 浮层确实在宿主模态之下（层级事实确认）');
    check(!w.focusWorked, '宿主模态打开时 kit 浮层内的元素无法获得焦点（宿主已禁交互）');
    check(R.afterModal.kitOnTop, '宿主模态关闭后 kit 浮层层级立即还原');

    console.log(`\n控制台错误: ${errors.length ? errors.join(' | ') : '(无)'}`);
    fs.writeFileSync(path.join(OUT, 'modal-layer.json'), JSON.stringify({ R, errors }, null, 2));
    await browser.close();
})();
