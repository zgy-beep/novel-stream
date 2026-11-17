/**
 * 实机回归：ISSUES.md #15 / #16 / #17 —— 宿主全局禁用 backdrop-filter 时的玻璃回退
 * v2.7.2 起：不再整块 `.nvui-solid`，改为 `.nvui-glass-fallback` 半透明回退；且可逆、可自愈。
 *
 * 验证：
 *   A. 基线：宿主 body 带 no-blur 时，`.nvui-glass` 探针 computed backdropFilter = none
 *      （浏览器仍支持，@supports 探测不到）。
 *   B. 修复：`NVUI.syncGlassFallback({force:true})` 返回 false，根节点挂 `.nvui-glass-fallback`
 *      （不再挂 `.nvui-solid`），面板背景为 token 派生 97% 不透明档且 backdrop-filter 关闭。
 *   C. 对照：摘掉 no-blur 后重探，supported 恢复 true、自动回退被移除，`.nvui-glass` 探针 blur 恢复。
 *   D. 用户 opt-out：手动加 `.nvui-solid` 时仍是不透明（优先级高于自动回退）。
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const KIT = path.resolve(__dirname, '..', '..');
const OUT = process.argv[2] || path.join(KIT, 'st-lab-out', 'st-glass-fallback');

const checks = [];
function check(name, cond, detail) {
    checks.push({ name, ok: !!cond, detail: detail || '' });
    console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    // 打开 kit lab 面板
    await page.evaluate(() => window.__NVUI_LAB__ && window.__NVUI_LAB__.open('basic'));
    await page.waitForTimeout(1200);

    // ---- A. 基线 ----
    const baseline = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'nvui-glass';
        probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
        const panel = document.querySelector('.nvui-panel');
        const pcs = panel ? getComputedStyle(panel) : null;
        const out = {
            bodyClass: document.body.className,
            htmlClass: document.documentElement.className,
            probeBackdrop: bf,
            panelBackdrop: pcs ? (pcs.backdropFilter || pcs.webkitBackdropFilter || '') : null,
            panelBg: pcs ? pcs.backgroundColor : null,
            hasNVUI: typeof window.NVUI !== 'undefined',
        };
        probe.remove();
        return out;
    });
    console.log('基线：', JSON.stringify(baseline, null, 2));

    check('宿主处于 no-blur 状态（body class 含 no-blur）',
        /no-blur/.test(baseline.bodyClass), baseline.bodyClass);
    check('宿主禁用了实际模糊（探针 computed backdropFilter = none，@supports 探测不到）',
        baseline.probeBackdrop === 'none' || !/blur/.test(baseline.probeBackdrop),
        'probe=' + baseline.probeBackdrop);
    check('面板本体不再声明 backdrop-filter（v2.7.2 单层玻璃）',
        baseline.panelBackdrop === 'none' || baseline.panelBackdrop === '',
        'panel=' + baseline.panelBackdrop);

    // ---- B. 修复：半透明回退 ----
    const after = await page.evaluate(() => {
        const supported = window.NVUI ? window.NVUI.syncGlassFallback({ force: true }) : null;
        const panel = document.querySelector('.nvui-panel');
        const pcs = panel ? getComputedStyle(panel) : null;
        const cs = panel ? pcs : null;
        return {
            supported,
            htmlClass: document.documentElement.className,
            panelBackdrop: cs ? (cs.backdropFilter || cs.webkitBackdropFilter || '') : null,
            panelBg: cs ? cs.backgroundColor : null,
        };
    });
    console.log('修复后：', JSON.stringify(after, null, 2));

    check('NVUI.syncGlassFallback() 正确识别出模糊不可用', after.supported === false, 'supported=' + after.supported);
    check('根节点自动挂上 .nvui-glass-fallback（半透明回退，不再整块 .nvui-solid）',
        /nvui-glass-fallback/.test(after.htmlClass) && !/nvui-solid/.test(after.htmlClass), after.htmlClass);
    check('面板回退为 97% 不透明档（token 派生 color-mix，极轻玻璃感）',
        /color\(srgb[^)]*\/\s*0\.97\s*\)/.test(after.panelBg || '') || /rgba\([^)]*,\s*0?\.97\s*\)/.test(after.panelBg || ''), 'bg=' + after.panelBg);
    check('回退后 backdrop-filter 已关闭', after.panelBackdrop === 'none', 'panel=' + after.panelBackdrop);

    await page.screenshot({ path: path.join(OUT, 'glass-fallback.png') });

    // ---- C. 对照：摘掉 no-blur 后自动恢复 ----
    const control = await page.evaluate(() => {
        document.body.classList.remove('no-blur');
        const supported = window.NVUI.syncGlassFallback({ force: true });
        const probe = document.createElement('div');
        probe.className = 'nvui-glass';
        probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
        document.body.appendChild(probe);
        const bf = getComputedStyle(probe).backdropFilter || '';
        probe.remove();
        const panel = document.querySelector('.nvui-panel');
        const panelBf = panel ? (getComputedStyle(panel).backdropFilter || '') : '';
        return { supported, htmlClass: document.documentElement.className, probe: bf, panelBf };
    });
    check('对照：移除 no-blur 后 supported 恢复 true', control.supported === true, 'supported=' + control.supported);
    check('对照：自动回退类被移除（可逆）', !/nvui-glass-fallback/.test(control.htmlClass), control.htmlClass);
    check('对照：探针 backdropFilter 恢复为 blur(...)', /blur/.test(control.probe), 'probe=' + control.probe);
    check('对照：面板自身 backdrop-filter 恢复为 blur(...)（背后模糊回来）', /blur/.test(control.panelBf), 'panel=' + control.panelBf);

    // ---- D. 用户主动实心优先 ----
    const solid = await page.evaluate(() => {
        document.documentElement.classList.add('nvui-solid');
        const panel = document.querySelector('.nvui-panel');
        const cs = panel ? getComputedStyle(panel) : null;
        return { bg: cs ? cs.backgroundColor : null, bf: cs ? (cs.backdropFilter || '') : null };
    });
    check('用户手动 .nvui-solid 优先级更高（不透明底 + 关闭模糊）',
        solid.bg === 'rgb(22, 26, 36)' && solid.bf === 'none', JSON.stringify(solid));
    await page.evaluate(() => document.documentElement.classList.remove('nvui-solid'));

    check('全程无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | '));

    fs.writeFileSync(path.join(OUT, 'glass-fallback.json'), JSON.stringify({ baseline, after, control, solid, checks }, null, 2));
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n实机结果：通过 ${checks.length - failed.length}，失败 ${failed.length}`);
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
