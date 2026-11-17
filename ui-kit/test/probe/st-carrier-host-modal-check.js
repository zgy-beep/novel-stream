/**
 * NVUI Kit · ST 实机回归（v2.4.0 · 浮层载体与宿主模态的让位机制）
 *
 * 背景（v2.4.0 新增结论）：
 *   - 宿主用 showModal() 打开弹窗时，会给**整个文档**加 inert，
 *     而 inert 元素**不参与命中测试**（elementsFromPoint 不返回）→ kit 浮层
 *     在宿主模态期间既压不过、也点不到。
 *   - popover="manual" 同样压不过 showModal()（top layer 内部模态优先）。
 *   → 正确策略不是"硬压"，而是**主动让位**：给 kit 载体加 `.is-host-modal`，
 *     降级为不可点 + 压暗，等宿主模态关闭后自动还原。
 *
 * 本脚本验证 6 件事：
 *   1. 无宿主模态时载体无 .is-host-modal（正常态）；
 *   2. 宿主 showModal() 打开后，载体自动加 .is-host-modal（watcher 生效）；
 *   3. 降级态下 kit 面板不可命中（pointer-events:none 生效）；
 *   4. getCarrierState() 返回 hostModalCount>0 / degraded=true；
 *   5. 宿主模态关闭后，载体自动移除 .is-host-modal（还原）；
 *   6. countHostModals() 排除 kit 自身载体（不自我降级）。
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

    /* --- 1. 正常态 --- */
    R.normal = await page.evaluate(() => {
        const carrier = document.querySelector('dialog.nvui-tl');
        const overlay = carrier && carrier.querySelector('.nvui-overlay');
        const state = window.NVUI.getCarrierState();
        return {
            hasCarrier: !!carrier,
            degradedClass: carrier ? carrier.classList.contains('is-host-modal') : null,
            /* 载体本身永远 pointer-events:none（透明放行），子浮层才恢复 auto */
            overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
            opacity: carrier ? getComputedStyle(carrier).opacity : null,
            hostModalCount: state.hostModalCount,
            degraded: state.degraded,
            carrierZ: state.carrierZ,
            carrierCount: state.carriers.length,
        };
    });

    /* --- 2~4. 宿主模态打开 --- */
    R.modalOpen = await page.evaluate(async () => {
        const dlg = document.createElement('dialog');
        dlg.id = 'carrier-host-modal';
        dlg.style.cssText = 'width:420px;padding:24px;';
        dlg.innerHTML = '<p style="margin:0">宿主模态弹窗</p>';
        document.body.appendChild(dlg);
        dlg.showModal();
        await new Promise(r => setTimeout(r, 500));

        const carrier = document.querySelector('dialog.nvui-tl');
        const panel = document.querySelector('.nvui-panel');
        const pr = panel.getBoundingClientRect();
        const stack = document.elementsFromPoint(
            Math.round(pr.left + pr.width / 2),
            Math.round(pr.top + pr.height / 2)
        ).map(e => e.id || (e.className || '').toString().slice(0, 30) || e.tagName);

        const cs = getComputedStyle(carrier);
        const overlay = carrier.querySelector('.nvui-overlay');
        const state = window.NVUI.getCarrierState();

        const out = {
            degradedClass: carrier.classList.contains('is-host-modal'),
            pointerEvents: cs.pointerEvents,
            overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
            opacity: cs.opacity,
            filter: cs.filter,
            kitHit: stack.some(s => /nvui/.test(s)),
            hitStack: stack.slice(0, 4),
            hostModalCount: state.hostModalCount,
            degraded: state.degraded,
            carrierDegraded: state.carriers.map(c => c.degraded),
            countApi: window.NVUI.countHostModals(),
        };
        dlg.close();
        dlg.remove();
        return out;
    });

    await page.waitForTimeout(600);

    /* --- 5. 还原 --- */
    R.afterClose = await page.evaluate(() => {
        const carrier = document.querySelector('dialog.nvui-tl');
        const overlay = carrier.querySelector('.nvui-overlay');
        const state = window.NVUI.getCarrierState();
        return {
            degradedClass: carrier.classList.contains('is-host-modal'),
            overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
            opacity: getComputedStyle(carrier).opacity,
            hostModalCount: state.hostModalCount,
            degraded: state.degraded,
        };
    });

    /* --- 6. 计数不包含 kit 自身载体 --- */
    R.selfCount = await page.evaluate(async () => {
        const before = window.NVUI.countHostModals();
        /* 强制把 kit 载体设为模态，验证计数仍排除它 */
        const carrier = document.querySelector('dialog.nvui-tl');
        carrier.setAttribute('open', '');
        const dlg = document.createElement('dialog');
        dlg.style.cssText = 'width:300px;';
        document.body.appendChild(dlg);
        dlg.showModal();
        await new Promise(r => setTimeout(r, 300));
        const withOne = window.NVUI.countHostModals();
        dlg.close();
        dlg.remove();
        carrier.removeAttribute('open');
        return { before, withOne };
    });

    console.log('=== v2.4.0 载体 / 宿主模态 实机数据 ===');
    console.log(JSON.stringify(R, null, 2));

    console.log('\n=== 判定 ===');
    check(R.normal.hasCarrier, 'kit 浮层载体（dialog.nvui-tl）已创建');
    check(!R.normal.degradedClass, '正常态：载体无 .is-host-modal');
    check(R.normal.overlayPointerEvents === 'auto', '正常态：子浮层可命中（pointer-events: auto）', String(R.normal.overlayPointerEvents));
    check(R.normal.hostModalCount === 0, '正常态：countHostModals() === 0');
    check(R.normal.degraded === false, '正常态：getCarrierState().degraded === false');
    check(R.normal.carrierZ === '1000000', '正常态：载体 z-index 为 1000000（--nvui-z-layer）', String(R.normal.carrierZ));

    check(R.modalOpen.degradedClass, '宿主模态打开后：载体自动加 .is-host-modal（watcher 生效）');
    check(R.modalOpen.pointerEvents === 'none', '降级态：载体 pointer-events === none（不可点）', R.modalOpen.pointerEvents);
    check(R.modalOpen.overlayPointerEvents === 'none', '降级态：子浮层 pointer-events === none（让位宿主模态）', String(R.modalOpen.overlayPointerEvents));
    check(Number(R.modalOpen.opacity) < 1, '降级态：载体被压暗（opacity < 1）', R.modalOpen.opacity);
    check(R.modalOpen.hostModalCount >= 1, '宿主模态打开后：countHostModals() >= 1', String(R.modalOpen.hostModalCount));
    check(R.modalOpen.degraded === true, '宿主模态打开后：getCarrierState().degraded === true');
    check(R.modalOpen.carrierDegraded.every(Boolean), '宿主模态打开后：所有载体均标记为 degraded');
    check(R.modalOpen.countApi >= 1, 'countHostModals() API 本身可独立调用');

    check(!R.afterClose.degradedClass, '宿主模态关闭后：载体自动移除 .is-host-modal（还原）');
    check(R.afterClose.overlayPointerEvents === 'auto', '还原后：子浮层恢复可命中（pointer-events: auto）', String(R.afterClose.overlayPointerEvents));
    check(R.afterClose.hostModalCount === 0, '还原后：countHostModals() === 0');
    check(R.afterClose.degraded === false, '还原后：getCarrierState().degraded === false');

    check(R.selfCount.withOne === 1, 'countHostModals() 排除 kit 自身载体（不自我降级）', `withOne=${R.selfCount.withOne}`);

    console.log(`\n控制台错误: ${errors.length ? errors.join(' | ') : '(无)'}`);
    fs.writeFileSync(path.join(OUT, 'carrier-host-modal.json'), JSON.stringify({ R, errors }, null, 2));
    await browser.close();
})();
