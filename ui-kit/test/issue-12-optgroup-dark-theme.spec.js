/**
 * NVUI Kit · Issue #12 浏览器回归（本地静态页面，不依赖 SillyTavern 服务）
 * -------------------------------------------------------------------------
 * 复现：深色 Windows Chrome 原生 select 弹层把 optgroup 行画在浅色默认底上，
 *      而 group 文字继承 --nvui-text（浅色），形成白底浅字。
 *
 * 覆盖（根目录资源 + st-extension-template/ui-kit 副本，各跑一遍）：
 *   - dialog.nvui-tl / .nvui-panel 两个真实载体；
 *   - 深色、浅色（主题类在载体上）、浅色（主题类在祖先上）；
 *   - optgroup 背景/文字 = --nvui-bg-2 / --nvui-text；
 *   - option 背景/文字不回归，disabled option 仍保持 token 皮肤；
 *   - select 的 color-scheme 随主题为 dark / light；
 *   - 宿主「元素选择器 + !important」不能夺走 group；
 *   - 载体外 select / optgroup / option 保持宿主样式，color-scheme 保持 normal；
 *
 * 运行：
 *   node test/issue-12-optgroup-dark-theme.spec.js
 *
 * 可选环境变量：
 *   CHROME_PATH             Chrome/Edge 可执行文件
 *   PLAYWRIGHT_MODULE_PATH  playwright-core 模块目录
 *
 * 平台限制：原生 select 展开后的 popup 由浏览器/OS 绘制，headless 只能断言
 * computed style，无法像素级验证 popup 内部行。本 spec 用 computed style +
 * color-scheme 作为可回归的契约；真实 popup 截图仍需人工在 Windows Chrome 复核。
 */
'use strict';

const fs = require('fs');
const path = require('path');

/* ==================== 1. 依赖与浏览器 ==================== */

/* 依赖解析统一到 scripts/resolve-browser.js（Roadmap A2） */
const browserDeps = require('../scripts/resolve-browser');

function loadPlaywright() {
    return browserDeps.loadPlaywright();
}

function resolveChrome() {
    return browserDeps.resolveChrome();
}

let chromium;
try {
    ({ chromium } = loadPlaywright());
} catch (err) {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
}

const CHROME_PATH = resolveChrome();
if (!CHROME_PATH) {
    console.error('[FATAL] 未找到 Chrome/Edge；请设置 CHROME_PATH，例如\n'
        + '  $env:CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"');
    process.exit(1);
}

const KIT_ROOT = path.resolve(__dirname, '..');
const ASSETS = [
    {
        label: 'root',
        dir: KIT_ROOT,
    },
    {
        label: 'template',
        dir: path.join(KIT_ROOT, 'st-extension-template', 'ui-kit'),
    },
];

for (const asset of ASSETS) {
    for (const file of ['tokens.css', 'components.css']) {
        const target = path.join(asset.dir, file);
        if (!fs.existsSync(target)) {
            console.error(`[FATAL] 缺少资源：${target}`);
            process.exit(1);
        }
    }
}

/* ==================== 2. 断言收集 ==================== */

const results = [];

function check(name, cond, detail) {
    const pass = !!cond;
    results.push({ name, pass });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? '  ->  ' + detail : ''}`);
    return pass;
}

function expectEq(name, actual, expected, extra) {
    return check(name, actual === expected,
        `期望 ${expected} / 实际 ${actual}${extra ? ' / ' + extra : ''}`);
}

function summary(title) {
    const total = results.length;
    const passed = results.filter((item) => item.pass).length;
    const failed = total - passed;
    console.log(`\n===== ${title} =====`);
    console.log(`总计 ${total} | 通过 ${passed} | 失败 ${failed}`);
    if (failed) {
        console.log('\n失败明细：');
        results.filter((item) => !item.pass).forEach((item) => console.log(`  - ${item.name}`));
    }
    return failed === 0;
}

/* ==================== 3. 宿主样式与页面 ==================== */

/* 宿主用「元素选择器 + !important」重写表单控件；载体外必须生效，载体内必须被 kit 夺回。 */
const HOST_BG = 'rgb(250, 0, 250)';
const HOST_FG = 'rgb(0, 180, 0)';
const HOST_CSS = `
body { margin: 0; padding: 16px; background: #ffffff; color: #111111; }
select,
select option,
select optgroup {
    background-color: ${HOST_BG} !important;
    color: ${HOST_FG} !important;
}
`;

const CONTROLS = `
<select class="nvui-input" id="kit-select">
    <optgroup label="Group A" id="kit-group">
        <option id="kit-option" value="a1">A1</option>
        <option id="kit-option-disabled" value="a2" disabled>A2 disabled</option>
    </optgroup>
    <optgroup label="Group B">
        <option value="b1">B1</option>
    </optgroup>
</select>
`;

function buildHtml(asset, carrier, theme) {
    const themeOnCarrier = theme === 'light' ? ' nvui-theme-light' : '';
    let carrierMarkup;
    if (carrier === 'dialog') {
        carrierMarkup = `<dialog class="nvui-tl${themeOnCarrier}" id="carrier" open>${CONTROLS}</dialog>`;
    } else {
        carrierMarkup = `<div class="nvui-panel${themeOnCarrier}" id="carrier">${CONTROLS}</div>`;
    }
    if (theme === 'light-ancestor') {
        carrierMarkup = `<div class="nvui-scope nvui-theme-light" id="theme-ancestor">${carrierMarkup}</div>`;
    }

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>NVUI Kit Issue #12 · ${asset.label} / ${carrier} / ${theme}</title>
<style>${asset.tokens}</style>
<style>${asset.components}</style>
<style>${HOST_CSS}</style>
</head>
<body class="nvui-scope">
    <p>载体外宿主 select（反向断言）</p>
    <select id="outside-select">
        <optgroup label="Host Group" id="outside-group">
            <option id="outside-option">H1</option>
        </optgroup>
    </select>
    ${carrierMarkup}
</body>
</html>`;
}

/* ==================== 4. 页面内快照 ==================== */

function readState() {
    const carrier = document.getElementById('carrier');

    const readToken = (name, prop) => {
        const probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'absolute';
        probe.style.left = '-9999px';
        probe.style.top = '0';
        probe.style.width = '1px';
        probe.style.height = '1px';
        carrier.appendChild(probe);
        if (prop === 'color') {
            probe.style.color = `var(${name})`;
        } else {
            probe.style.backgroundColor = `var(${name})`;
        }
        const value = getComputedStyle(probe)[prop];
        probe.remove();
        return value;
    };

    const read = (id) => {
        const el = document.getElementById(id);
        const style = getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            colorScheme: style.colorScheme,
        };
    };

    return {
        tokens: {
            bg2: readToken('--nvui-bg-2', 'backgroundColor'),
            text: readToken('--nvui-text', 'color'),
            inputBg: readToken('--nvui-input-bg', 'backgroundColor'),
        },
        select: read('kit-select'),
        group: read('kit-group'),
        option: read('kit-option'),
        disabledOption: read('kit-option-disabled'),
        outsideSelect: read('outside-select'),
        outsideGroup: read('outside-group'),
        outsideOption: read('outside-option'),
    };
}

/* ==================== 5. 对比度 ==================== */

function parseRgb(value) {
    const match = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([r, g, b]) {
    const channel = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(fg, bg) {
    const a = parseRgb(fg);
    const b = parseRgb(bg);
    if (!a || !b) return 0;
    const l1 = luminance(a);
    const l2 = luminance(b);
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
}

/* ==================== 6. 主流程 ==================== */

(async () => {
    let browser = null;
    const pageErrors = [];
    let exitCode = 0;

    try {
        browser = await chromium.launch({
            executablePath: CHROME_PATH,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        });
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', (err) => {
            pageErrors.push(err.message);
            console.log(`[pageerror] ${err.message}`);
        });

        const carriers = ['dialog', 'panel'];
        const themes = ['dark', 'light', 'light-ancestor'];

        for (const asset of ASSETS) {
            asset.tokens = fs.readFileSync(path.join(asset.dir, 'tokens.css'), 'utf8');
            asset.components = fs.readFileSync(path.join(asset.dir, 'components.css'), 'utf8');

            for (const carrier of carriers) {
                for (const theme of themes) {
                    const label = `${asset.label} / ${carrier} / ${theme}`;
                    const expectedScheme = theme === 'dark' ? 'dark' : 'light';

                    await page.setContent(buildHtml(asset, carrier, theme), { waitUntil: 'load' });
                    await page.waitForTimeout(100);
                    const data = await page.evaluate(readState);

                    /* ---- optgroup / option 使用 Kit token，且宿主 !important 未夺走 ---- */
                    expectEq(`${label} optgroup background = --nvui-bg-2`,
                        data.group.backgroundColor, data.tokens.bg2);
                    expectEq(`${label} optgroup color = --nvui-text`,
                        data.group.color, data.tokens.text);
                    expectEq(`${label} option background = --nvui-bg-2`,
                        data.option.backgroundColor, data.tokens.bg2);
                    expectEq(`${label} option color = --nvui-text`,
                        data.option.color, data.tokens.text);
                    expectEq(`${label} disabled option background 仍是 --nvui-bg-2`,
                        data.disabledOption.backgroundColor, data.tokens.bg2);
                    expectEq(`${label} disabled option color 仍是 --nvui-text`,
                        data.disabledOption.color, data.tokens.text);

                    check(`${label} 宿主 !important 未夺走 optgroup 底色`,
                        data.group.backgroundColor !== HOST_BG,
                        `host=${HOST_BG} / kit=${data.group.backgroundColor}`);
                    check(`${label} 宿主 !important 未夺走 optgroup 文字色`,
                        data.group.color !== HOST_FG,
                        `host=${HOST_FG} / kit=${data.group.color}`);

                    /* ---- #12 的核心：group 文字在 group 底色上可读（白底浅字不再出现） ---- */
                    const groupContrast = contrast(data.group.color, data.group.backgroundColor);
                    check(`${label} optgroup 文字/底色对比度 >= 4.5:1`,
                        groupContrast >= 4.5, `${groupContrast.toFixed(2)}:1`);

                    /* ---- select 原生弹层跟随主题 ---- */
                    expectEq(`${label} select color-scheme = ${expectedScheme}`,
                        data.select.colorScheme, expectedScheme);
                    expectEq(`${label} select background = --nvui-input-bg`,
                        data.select.backgroundColor, data.tokens.inputBg);

                    /* ---- 载体外保持宿主样式（隔离有界） ---- */
                    expectEq(`${label} 载体外 select background 保持宿主`,
                        data.outsideSelect.backgroundColor, HOST_BG);
                    expectEq(`${label} 载体外 select color 保持宿主`,
                        data.outsideSelect.color, HOST_FG);
                    expectEq(`${label} 载体外 select color-scheme 保持 normal`,
                        data.outsideSelect.colorScheme, 'normal');
                    expectEq(`${label} 载体外 optgroup background 保持宿主`,
                        data.outsideGroup.backgroundColor, HOST_BG);
                    expectEq(`${label} 载体外 optgroup color 保持宿主`,
                        data.outsideGroup.color, HOST_FG);
                    expectEq(`${label} 载体外 option background 保持宿主`,
                        data.outsideOption.backgroundColor, HOST_BG);
                    expectEq(`${label} 载体外 option color 保持宿主`,
                        data.outsideOption.color, HOST_FG);

                }
            }
        }

        check('页面无 JavaScript 运行时错误', pageErrors.length === 0, pageErrors.join(' | '));
    } catch (err) {
        console.error(`[FATAL] ${err && err.stack ? err.stack : err}`);
        exitCode = 1;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }

    const ok = summary('Issue #12 optgroup / select dark theme regression');
    process.exit(ok && exitCode === 0 ? 0 : 1);
})();
