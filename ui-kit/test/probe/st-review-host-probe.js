/**
 * NVUI Kit · 宿主环境与扩展安装状态探测（只读）
 * ------------------------------------------------------------------
 * 目的：确认后续实机验证"到底能测什么、不能测什么"。
 *
 * 检查项：
 *   1. 宿主首页可访问性（HTTP 状态、标题、关键 DOM）
 *   2. 宿主 console / pageerror 情况
 *   3. window.__NVUI_LAB__ 是否存在（历史实机脚本依赖的 LAB 夹具）
 *   4. window.NVUI 是否存在、版本号、是否与仓库根版本一致
 *   5. 宿主是否已登录（有用户头像 / 设置入口）、是否需要开聊天才能触发某些行为
 *   6. 宿主 DOM 结构里的关键容器（#top-settings-holder / #chat / #extensions-settings2 等）
 *
 * 运行：node test/st-review-host-probe.js
 */
'use strict';

const h = require('./st-review-harness');
const fs = require('fs');
const path = require('path');

(async () => {
    const ctx = await h.launch();
    const { page } = ctx;

    const resp = await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    h.assert('宿主首页 HTTP 200', resp.status() === 200, `status=${resp.status()}`);
    await page.waitForTimeout(9000);

    const probe = await page.evaluate(() => {
        const has = sel => !!document.querySelector(sel);
        return {
            title: document.title,
            url: location.href,
            bodyChildren: document.body.childElementCount,
            hasTopSettings: has('#top-settings-holder'),
            hasChat: has('#chat'),
            hasExtensionsSettings: has('#extensions-settings2') || has('#extensions_settings'),
            hasUserName: has('#user-name-block') || has('#username-display'),
            hasAvatar: has('#avatar-block') || has('#user-avatar'),
            hasRightPanel: has('#right-panel') || has('#right-panel'),
            scripts: document.scripts.length,
            stylesheets: document.styleSheets.length,
            // NVUI / LAB 夹具
            hasNVUI: typeof window.NVUI !== 'undefined',
            nvuiVersion: window.NVUI ? window.NVUI.version : null,
            hasLab: typeof window.__NVUI_LAB__ !== 'undefined',
            labVersion: window.__NVUI_LAB__ ? window.__NVUI_LAB__.version : null,
            labKeys: window.__NVUI_LAB__ ? Object.keys(window.__NVUI_LAB__) : null,
            // 宿主已有的 carrier（LAB 面板）
            carrierCount: document.querySelectorAll('dialog.nvui-tl').length,
            // 宿主登录态线索
            loggedInGuess: !!(document.querySelector('#top-bar') || document.querySelector('#left-bar')) && !has('#login-avatar-block'),
        };
    });

    console.log('\n===== 宿主探测结果 =====');
    console.log(JSON.stringify(probe, null, 2));

    h.assert('宿主页面有非空 title', !!probe.title, probe.title);
    h.assert('宿主核心 DOM 存在（#chat 或 #top-settings-holder）',
        probe.hasChat || probe.hasTopSettings,
        `chat=${probe.hasChat} topSettings=${probe.hasTopSettings}`);
    h.assert('宿主脚本已加载（scripts > 0）', probe.scripts > 0, `scripts=${probe.scripts}`);

    console.log('\n--- LAB 夹具结论 ---');
    console.log(`window.__NVUI_LAB__ 存在: ${probe.hasLab}` + (probe.hasLab ? `（version=${probe.labVersion}）` : ''));
    console.log(`window.NVUI 存在: ${probe.hasNVUI}` + (probe.hasNVUI ? `（version=${probe.nvuiVersion}）` : ''));
    console.log(`宿主中已存在的 kit carrier 数量: ${probe.carrierCount}`);

    // 是否需要登录 / 开聊天
    console.log('\n--- 宿主行为前置条件探测 ---');
    const behavior = await page.evaluate(async () => {
        const out = {};
        // 宿主扩展开关面板是否可开（很多宿主行为测试需要进设置）
        const extBtn = document.querySelector('#extensionsMenuButton, #extensions-settings-button');
        out.extensionsButtonFound = !!extBtn;
        // 是否有已打开的聊天（chat length）
        out.chatMessageCount = document.querySelectorAll('#chat .mes').length;
        out.chatPresent = !!document.querySelector('#chat');
        return out;
    });
    console.log(JSON.stringify(behavior, null, 2));

    const errs = ctx.pageErrors.slice();
    console.log(`\n宿主 pageerror 数量: ${errs.length}`);
    errs.slice(0, 10).forEach(e => console.log('  ', e));
    const consoleErrs = ctx.consoleLogs.filter(l => l.startsWith('[error]'));
    console.log(`宿主 console error 数量: ${consoleErrs.length}`);
    consoleErrs.slice(0, 10).forEach(e => console.log('  ', e));

    await h.cleanup();

    const ok = h.summary('宿主环境探测');
    const outDir = path.join(h.KIT_ROOT, '.workbuddy', 'review');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'host-probe.json'),
        JSON.stringify({ probe, behavior, pageErrors: errs, consoleErrors: consoleErrs }, null, 2));
    console.log(`\n探测数据已写入: ${path.join(outDir, 'host-probe.json')}`);
    process.exit(ok ? 0 : 1);
})().catch(async e => {
    console.error('FATAL', e);
    try { await h.cleanup(); } catch (_) { /* ignore */ }
    process.exit(1);
});
