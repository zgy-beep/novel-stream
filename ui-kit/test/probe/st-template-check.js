/**
 * 验证 st-extension-template 在真实 SillyTavern 中可用
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    const R = {};

    // 1. 扩展是否被 ST 识别并加载
    R.ext = await page.evaluate(() => {
        const menu = document.getElementById('extensionsMenu');
        const btn = document.getElementById('my_plugin_menu_btn');
        return {
            menuExists: !!menu,
            buttonExists: !!btn,
            buttonText: btn?.textContent?.trim(),
            hasNVUI: typeof window.NVUI !== 'undefined',
            nvuiVersion: window.NVUI?.version,
        };
    });
    console.log('=== 1. 扩展加载 ===');
    console.log('  ', JSON.stringify(R.ext));

    await page.screenshot({ path: path.join(OUT, '10-st-with-extension.png') });

    // 2. 真实鼠标点击菜单按钮 → 面板是否打开
    //    extensionsMenu 是 Popper 浮层，由 fadeIn/fadeOut 控制显隐（不是 hidden class）
    await page.evaluate(() => {
        const btn = document.getElementById('extensionsMenuButton');
        if (btn) btn.click();
    });
    await page.waitForTimeout(800);
    R.open = await (async () => {
        const btn = page.locator('#my_plugin_menu_btn');
        try { await btn.click({ timeout: 5000 }); }
        catch { await btn.click({ force: true, timeout: 5000 }); }
        await page.waitForTimeout(1200);
        return await page.evaluate(() => {
            const scope = document.querySelector('#my_plugin_panel-layer');
            const overlay = document.querySelector('#my_plugin_panel-overlay');
            const panel = scope?.querySelector('.nvui-panel');
            const rect = panel?.getBoundingClientRect();
            return {
                ok: !!scope && !overlay?.hidden,
                title: scope?.querySelector('.nvui-panel-title')?.textContent?.trim(),
                tabs: Array.from(scope?.querySelectorAll('.nvui-tab') || []).map(t => t.textContent.trim()),
                switchCount: scope?.querySelectorAll('.nvui-switch-row').length,
                inputCount: scope?.querySelectorAll('.nvui-input-row').length,
                accCount: scope?.querySelectorAll('.nvui-acc').length,
                footerBtns: Array.from(scope?.querySelectorAll('.nvui-panel-footer .nvui-btn') || []).map(b => b.textContent.trim()),
                rect: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
                inViewport: rect ? (rect.top >= -1 && rect.bottom <= innerHeight + 1) : false,
            };
        });
    })();
    console.log('\n=== 2. 菜单打开面板 ===');
    console.log('  ', JSON.stringify(R.open, null, 2).replace(/\n/g, '\n  '));
    await page.screenshot({ path: path.join(OUT, '11-template-panel.png') });

    // 3. 切换 tab
    R.tab = await page.evaluate(async () => {
        const tabs = document.querySelectorAll('#my_plugin_panel-layer .nvui-tab');
        tabs[1]?.click();
        await new Promise(r => setTimeout(r, 900));
        const t = document.querySelector('#my_plugin_panel-layer .nvui-tab.is-active');
        const b = document.querySelector('#my_plugin_panel-layer .nvui-bottom-nav-item.is-active');
        const pane = document.querySelector('#my_plugin_panel-layer .nvui-tabpane.is-active');
        return { top: t?.textContent.trim(), bottom: b?.textContent.trim(), paneId: pane?.id, ariaCurrent: b?.getAttribute('aria-current') };
    });
    console.log('\n=== 3. tab 切换 ===');
    console.log('  ', JSON.stringify(R.tab));
    await page.screenshot({ path: path.join(OUT, '12-template-tab2.png') });

    // 4. 保存按钮 → 吐司 + 设置落盘（读模块导出的 extension_settings，不读 window）
    R.save = await page.evaluate(async () => {
        const btns = Array.from(document.querySelectorAll('#my_plugin_panel-layer .nvui-panel-footer .nvui-btn'));
        const saveBtn = btns.find(b => b.textContent.includes('保存'));
        saveBtn?.click();
        await new Promise(r => setTimeout(r, 800));
        const toast = document.querySelector('.nvui-toast');
        return {
            toastShown: !!toast,
            toastText: toast?.textContent?.trim(),
            hasWindowEs: typeof window.extension_settings !== 'undefined',
        };
    });
    console.log('\n=== 4. 保存与吐司 ===');
    console.log('  ', JSON.stringify(R.save));
    await page.screenshot({ path: path.join(OUT, '13-template-toast.png') });

    // 5. Esc 关闭 + 焦点归还（真实按键）
    //    契约对齐（2026-10-20 修正）：
    //      模板的 focusFallback 是 '#extensionsMenuButton'（见 st-extension-template/index.js）。
    //      触发按钮是 #my_plugin_menu_btn，但它位于 ST 的扩展菜单（Popper 浮层）里，
    //      菜单收起后该按钮不可聚焦 → 焦点归还链正确地降级到 focusFallback，
    //      所以关闭后 activeId 应当是 'extensionsMenuButton'。
    //      旧断言写死 'my_plugin_menu_btn' 属**断言过时**（行为本身是对的），故按契约对齐。
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    R.esc = await page.evaluate(() => {
        const overlay = document.querySelector('#my_plugin_panel-overlay');
        return {
            hidden: overlay?.hidden,
            activeId: document.activeElement?.id,
            // 按契约：焦点应落在 focusFallback 指向的 #extensionsMenuButton
            focusBackToFallback: document.activeElement?.id === 'extensionsMenuButton',
            // 旧断言目标（触发按钮）—— 菜单已收起，它不可聚焦，焦点不应落在这里
            focusBackToMenu: document.activeElement?.id === 'my_plugin_menu_btn',
        };
    });
    console.log('\n=== 5. Esc 关闭与焦点归还 ===');
    console.log('  ', JSON.stringify(R.esc));

    // 5b. 显式 focusFallback 覆盖：焦点应归还到 focusFallback 指定的那个元素
    //     （用一个自建面板，避免改动模板本身；opener 被移出文档 → 强制走 focusFallback 分支）
    R.focusFallback = await page.evaluate(async () => {
        // 让 ST 扩展菜单保持打开，使 #my_plugin_menu_btn 真正可见可聚焦
        document.getElementById('extensionsMenuButton')?.click();
        await new Promise(r => setTimeout(r, 700));

        const opener = document.createElement('button');
        opener.id = 'tpl_check_opener';
        opener.textContent = 'opener';
        document.body.appendChild(opener);
        opener.focus();

        const p = NVUI.createPanel({
            id: 'tpl_check_fb_panel',
            title: '焦点兜底探针',
            focusFallback: '#my_plugin_menu_btn',
        });
        p.open();
        await new Promise(r => setTimeout(r, 500));
        // 移除 opener → 焦点归还链的「触发元素」一级失效 → 必须落到 focusFallback
        opener.remove();
        p.close();
        await new Promise(r => setTimeout(r, 900));
        const activeId = document.activeElement?.id || null;
        p.destroy();
        return { activeId, returnedToFallback: activeId === 'my_plugin_menu_btn' };
    });
    console.log('\n=== 5b. 显式 focusFallback 生效（#my_plugin_menu_btn）===');
    console.log('  ', JSON.stringify(R.focusFallback));

    // 6. 开关交互是否回写设置
    await page.evaluate(() => {
        document.getElementById('extensionsMenuButton')?.click();
        document.getElementById('my_plugin_menu_btn')?.click();
    });
    await page.waitForTimeout(1000);
    R.interact = await page.evaluate(async () => {
        const sw = document.querySelector('#my_plugin_panel-layer .nvui-switch-row input');
        const before = window.__MY_PLUGIN__?.getSettings();
        sw?.click();
        await new Promise(r => setTimeout(r, 500));
        const after = window.__MY_PLUGIN__?.getSettings();
        return {
            beforeEnabled: before?.enabled,
            afterEnabled: after?.enabled,
            changed: before?.enabled !== after?.enabled,
            version: after?.version,
        };
    });
    console.log('\n=== 6. 开关交互与设置回写 ===');
    console.log('  ', JSON.stringify(R.interact));

    // 7. 移动端
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, '14-template-mobile.png') });
    const mob = await page.evaluate(() => {
        const scope = document.querySelector('#my_plugin_panel-layer');
        const p = scope?.querySelector('.nvui-panel');
        const tabs = scope?.querySelector('.nvui-tabs');
        const nav = scope?.querySelector('.nvui-bottom-nav');
        const r = p?.getBoundingClientRect();
        return {
            topTabs: tabs ? getComputedStyle(tabs).display : null,
            bottomNav: nav ? getComputedStyle(nav).display : null,
            rect: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) } : null,
            inViewport: r ? (r.top >= -1 && r.bottom <= innerHeight + 1) : false,
        };
    });
    console.log('\n=== 7. 移动端 ===');
    console.log('  ', JSON.stringify(mob));

    /* ============ 8. 断言汇总 ============ */
    /* 焦点归还按契约判定：
       - Esc 关闭模板面板 → 焦点落到 focusFallback('#extensionsMenuButton')；
       - 显式 focusFallback('#my_plugin_menu_btn') → 焦点落到 my_plugin_menu_btn。
       两者都是「焦点确实回到了契约指定的位置」，不是「焦点掉到 BODY」。 */
    const checks = [
        ['扩展被 ST 识别并加载', R.ext.menuExists && R.ext.buttonExists && R.ext.hasNVUI],
        ['菜单点击后面板正常打开', R.open.ok && R.open.inViewport],
        ['tab 切换生效（pane 与底部导航同步）', R.tab.paneId && R.tab.ariaCurrent === 'page'],
        ['保存触发吐司', R.save.toastShown],
        ['Esc 关闭面板', R.esc.hidden === true],
        ['Esc 关闭后焦点归还到 focusFallback(#extensionsMenuButton)', R.esc.focusBackToFallback === true],
        ['焦点未落回已收起的触发按钮（应降级到 focusFallback）', R.esc.focusBackToMenu === false],
        ['显式 focusFallback(#my_plugin_menu_btn) 生效', R.focusFallback.returnedToFallback === true],
        ['开关交互回写设置', R.interact.changed === true],
        ['移动端切底部导航（顶栏隐藏）', mob.topTabs === 'none' && mob.bottomNav === 'flex' && mob.inViewport],
    ];
    console.log('\n===== 断言汇总 =====');
    checks.forEach(([name, pass]) => console.log(`  ${pass ? '✅' : '❌'} ${name}`));
    const failed = checks.filter(([, pass]) => !pass).length;
    console.log(`\n总计 ${checks.length} | 通过 ${checks.length - failed} | 失败 ${failed}`);

    const errs = logs.filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));
    console.log('\n控制台错误:', errs.length ? errs.slice(0, 10).join('\n') : '(无)');
    fs.writeFileSync(path.join(OUT, 'template-check.json'),
        JSON.stringify({ R, mob, checks: checks.map(([name, pass]) => ({ name, pass })) }, null, 2));
    await browser.close();
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
