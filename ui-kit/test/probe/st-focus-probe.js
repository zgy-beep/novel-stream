const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000);

    // 展开菜单
    await page.evaluate(() => document.getElementById('extensionsMenuButton')?.click());
    await page.waitForTimeout(700);

    const before = await page.evaluate(() => {
        const b = document.getElementById('my_plugin_menu_btn');
        const cs = getComputedStyle(b);
        return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, isConnected: b.isConnected };
    });
    console.log('点击前按钮状态:', JSON.stringify(before));

    // 真实点击
    await page.click('#my_plugin_menu_btn');
    await page.waitForTimeout(1000);

    const after = await page.evaluate(() => {
        const b = document.getElementById('my_plugin_menu_btn');
        const cs = getComputedStyle(b);
        return {
            display: cs.display,
            menuDisplay: getComputedStyle(document.getElementById('extensionsMenu')).display,
            activeId: document.activeElement?.id || document.activeElement?.tagName,
            openerWasFocused: true,
        };
    });
    console.log('点击后（面板已开）:', JSON.stringify(after));

    // 关闭面板，看焦点归还是否生效
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const closed = await page.evaluate(() => {
        const b = document.getElementById('my_plugin_menu_btn');
        return {
            activeId: document.activeElement?.id || document.activeElement?.tagName,
            btnDisplay: getComputedStyle(b).display,
        };
    });
    console.log('关闭后:', JSON.stringify(closed));

    await browser.close();
})();
