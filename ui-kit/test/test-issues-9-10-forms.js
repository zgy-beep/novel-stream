/**
 * NVUI Kit · Issues #9 / #10 浏览器回归（本地静态页面，不依赖 SillyTavern 服务）
 * -------------------------------------------------------------------------
 * 覆盖：
 *   #9  宿主主题用「元素选择器 + !important」重写表单控件后，
 *       dialog.nvui-tl / .nvui-panel 两个载体以及 v2.7.0 显式 opt-in 的
 *       .nvui-form-scope 容器内的 input / textarea / select / option 仍恢复 kit token；
 *       hover / focus-visible / disabled 行为保持；
 *       载体 / scope 外控件保持宿主样式（证明隔离有界）；
 *       嵌套的非 kit input / select / textarea 不被 scope 误伤；
 *       .nvui-form-scope 自身不产生定位 / 遮罩 / 模态等副作用。
 *   #10 input.nvui-checkbox 的 16px 方框：
 *       unchecked / checked / indeterminate / disabled 四种状态；
 *       Space 可切换；Tab 后 focus-visible 焦点环；
 *       宿主 display:grid、宽高、描边与 ::before 对勾被压制。
 *
 * 运行：
 *   node test/test-issues-9-10-forms.js
 *
 * 可选环境变量：
 *   CHROME_PATH             Chrome/Edge 可执行文件
 *   PLAYWRIGHT_MODULE_PATH  playwright-core 模块目录
 *
 * 说明：
 *   - 页面由 page.setContent() 生成为本地静态 DOM；tokens.css / components.css
 *     直接从仓库根目录读入并内联，不需要启动酒馆、不需要网络。
 *   - 模拟宿主 CSS 放在 components.css 之后加载，故意让宿主样式「后到」，
 *     以证明胜出来自作用域/特异性，而不是文件顺序。
 *   - 宿主 checkbox 规则取自 SillyTavern public/style.css 的真实写法
 *     （appearance:none + display:grid + 宽高/描边/底色/阴影/transform/filter
 *      + ::before clip-path 对勾），只把尺寸与颜色改成固定值以便断言。
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
const TOKENS_CSS = fs.readFileSync(path.join(KIT_ROOT, 'tokens.css'), 'utf8');
const COMPONENTS_CSS = fs.readFileSync(path.join(KIT_ROOT, 'components.css'), 'utf8');

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

/* ==================== 3. 模拟宿主 CSS ==================== */

const HOST_BG = 'rgb(46, 46, 52)';
const HOST_FG = 'rgb(31, 36, 48)';
const HOST_SELECT_FG = 'rgb(230, 230, 230)';
const HOST_LINE = 'rgb(84, 84, 96)';

const HOST_CSS = `
/* 模拟第三方酒馆主题：元素选择器 + !important 重写全局表单控件 */
:root {
    --host-form-bg: ${HOST_BG};
    --host-form-fg: ${HOST_FG};
    --host-select-fg: ${HOST_SELECT_FG};
    --host-hover-bg: rgb(60, 60, 70);
    --host-line: rgb(84, 84, 96);
    --host-check: rgb(64, 128, 255);
    --host-focus: rgb(120, 200, 255);
}

input[type="text"],
input[type="number"],
input:not([type]),
textarea:not([type="search"]) {
    background-color: var(--host-form-bg) !important;
    color: var(--host-form-fg) !important;
    border: 1px solid var(--host-line) !important;
    border-radius: 3px;
}

select {
    background-color: var(--host-form-bg) !important;
    color: var(--host-select-fg) !important;
    border: 1px solid var(--host-line) !important;
    border-radius: 3px;
    margin: 9px 0 !important;
}

select option {
    background-color: var(--host-form-bg) !important;
    color: var(--host-select-fg) !important;
}

input[type="text"]:hover,
input[type="number"]:hover,
textarea:hover {
    background-color: var(--host-hover-bg) !important;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
    outline: 1px solid var(--host-focus);
}

/* 真实 ST v1.19.0 public/style.css 的 checkbox 写法（尺寸/颜色固定化） */
input[type="checkbox"] {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    outline: 1px solid var(--host-line);
    position: relative;
    width: 22px;
    height: 22px;
    overflow: hidden;
    border-radius: 3px;
    border: 1px solid var(--host-line);
    background-color: var(--host-form-bg);
    box-shadow: inset 0 0 2px 0 rgb(0, 0, 0);
    cursor: pointer;
    transform: translateY(-2px);
    flex-shrink: 0;
    place-content: center;
    filter: brightness(1.2);
    display: grid;
    margin: 4px;
}

input[type="checkbox"]::before {
    content: "";
    width: 0.65em;
    height: 0.65em;
    transform: scale(0);
    transition: 200ms transform ease-in-out;
    box-shadow: inset 1em 1em var(--host-check);
    transform-origin: bottom left;
    clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

input[type="checkbox"]:checked::before {
    transform: scale(1);
}

input[type="checkbox"]:disabled {
    color: grey;
    cursor: not-allowed;
}

input[type="checkbox"]:focus-visible {
    outline: 1px solid var(--host-focus);
}
`;

const TEST_CSS = `
html, body { margin: 0; padding: 0; }
body { padding: 24px; font-family: sans-serif; }
.test-check-row {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 16px 8px 0;
    cursor: pointer;
    user-select: none;
}
.test-controls {
    /* dialog.nvui-tl 自身 pointer-events:none；测试容器恢复命中，便于 hover */
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
    max-width: 560px;
}
.test-panel-host { padding: 16px; }
.test-nested-plain {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding: 8px;
}
.test-inline-fixture {
    /* 普通块级容器：checkbox 保持 inline-block，用于验证组件自身 display 契约。
       不要放进 flex 容器——flex item 会按 CSS Display 规范把 inline-block blockify。 */
    display: block;
    margin-top: 16px;
}
`;

/* ==================== 4. 页面构造 ==================== */

const CONTROLS = `
<div class="test-controls">
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-focus">
        <span>键盘焦点 / Space</span>
    </label>
    <input class="nvui-input" id="kit-text" type="text" value="kit text">
    <textarea class="nvui-input" id="kit-textarea">kit textarea</textarea>
    <select class="nvui-input" id="kit-select">
        <option id="kit-option" selected>Kit option</option>
        <option>Other option</option>
    </select>
    <div class="test-nested-plain">
        <input id="nested-plain-input" type="text" value="plain input">
        <textarea id="nested-plain-textarea">plain textarea</textarea>
        <select id="nested-plain-select">
            <option id="nested-plain-option" selected>Plain option</option>
        </select>
    </div>
    <input class="nvui-input" id="kit-text-disabled" type="text" value="disabled" disabled>
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-unchecked">
        <span>未选中</span>
    </label>
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-checked" checked>
        <span>已选中</span>
    </label>
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-indeterminate">
        <span>部分选中</span>
    </label>
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-disabled" disabled>
        <span>未选中禁用</span>
    </label>
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-disabled-checked" checked disabled>
        <span>选中禁用</span>
    </label>
</div>
`;

function buildHtml(carrier, theme) {
    const themeClass = theme === 'light' ? ' nvui-theme-light' : '';
    let carrierMarkup;
    if (carrier === 'dialog') {
        carrierMarkup = `<dialog class="nvui-tl${themeClass}" id="carrier" open>${CONTROLS}</dialog>`;
    } else if (carrier === 'scope') {
        /* v2.7.0：显式 opt-in 的普通容器，不带任何 nvui-panel / dialog 语义 */
        carrierMarkup = `<div class="nvui-form-scope${themeClass}" id="carrier">${CONTROLS}</div>`;
    } else {
        carrierMarkup = `<div class="test-panel-host"><div class="nvui-panel${themeClass}" id="carrier">${CONTROLS}</div></div>`;
    }

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>NVUI Kit Issues #9/#10 + v2.7 form-scope regression</title>
<style>${TOKENS_CSS}</style>
<style>${COMPONENTS_CSS}</style>
<style>${HOST_CSS}</style>
<style>${TEST_CSS}</style>
</head>
<body class="nvui-scope">
    <input class="nvui-input" id="outside-input" type="text" value="outside carrier">
    <input type="checkbox" id="host-raw" checked>
    ${carrierMarkup}
    <label class="test-check-row">
        <input type="checkbox" class="nvui-checkbox" id="cb-outside" checked>
        <span>carrier 外 kit checkbox</span>
    </label>
    <div class="test-inline-fixture">
        <input type="checkbox" class="nvui-checkbox" id="cb-inline" checked>
    </div>
</body>
</html>`;
}

/* ==================== 5. 页面内快照（在浏览器上下文执行） ==================== */

function readCarrierState() {
    const carrier = document.getElementById('carrier');

    const readTokenSet = (scope) => {
        const probe = document.createElement('span');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.position = 'absolute';
        probe.style.left = '-9999px';
        probe.style.top = '0';
        probe.style.width = '1px';
        probe.style.height = '1px';
        scope.appendChild(probe);

        const readColor = (name) => {
            probe.style.color = `var(${name})`;
            const value = getComputedStyle(probe).color;
            probe.style.color = '';
            return value;
        };
        const readBg = (name) => {
            probe.style.backgroundColor = `var(${name})`;
            const value = getComputedStyle(probe).backgroundColor;
            probe.style.backgroundColor = '';
            return value;
        };
        const readRaw = (name) => getComputedStyle(scope).getPropertyValue(name).trim();

        const set = {
            inputBg: readBg('--nvui-input-bg'),
            blockBg: readBg('--nvui-block-bg'),
            bg2: readBg('--nvui-bg-2'),
            text: readColor('--nvui-text'),
            line2: readColor('--nvui-line-2'),
            accentBg: readBg('--nvui-accent'),
            accentColor: readColor('--nvui-accent'),
            onAccent: readColor('--nvui-on-accent'),
            focusRing: readColor('--nvui-focus-ring-color'),
            radiusSm: readRaw('--nvui-radius-sm'),
        };
        probe.remove();
        return set;
    };

    const tokens = readTokenSet(carrier);
    /* carrier 外的控件不在局部 light 载体里，必须在它自己的祖先上下文解析 token，
       不能复用 carrier 的 light token，也不能从被测 checkbox 的实际背景反推期望值。 */
    const outsideScope = document.getElementById('cb-outside').parentElement || document.body;
    const outsideTokens = readTokenSet(outsideScope);

    const snapshot = (id) => {
        const el = document.getElementById(id);
        const style = getComputedStyle(el);
        return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            borderTopWidth: style.borderTopWidth,
            borderTopStyle: style.borderTopStyle,
            borderTopColor: style.borderTopColor,
            borderRadius: style.borderTopLeftRadius,
            marginTop: style.marginTop,
            marginBottom: style.marginBottom,
            display: style.display,
            width: style.width,
            height: style.height,
            opacity: style.opacity,
            cursor: style.cursor,
            outlineWidth: style.outlineWidth,
            outlineStyle: style.outlineStyle,
            outlineColor: style.outlineColor,
            appearance: style.appearance,
            filter: style.filter,
            transform: style.transform,
            boxShadow: style.boxShadow,
        };
    };

    const pseudo = (id, which) => {
        const el = document.getElementById(id);
        const style = getComputedStyle(el, which);
        return {
            content: style.content,
            display: style.display,
            opacity: style.opacity,
            width: style.width,
            height: style.height,
            backgroundColor: style.backgroundColor,
            borderTopWidth: style.borderTopWidth,
        };
    };

    const checkbox = (id) => {
        const el = document.getElementById(id);
        return {
            checked: el.checked,
            indeterminate: el.indeterminate,
            style: snapshot(id),
            before: pseudo(id, '::before'),
            after: pseudo(id, '::after'),
        };
    };

    const nestedPlain = {
        input: snapshot('nested-plain-input'),
        textarea: snapshot('nested-plain-textarea'),
        select: snapshot('nested-plain-select'),
        option: snapshot('nested-plain-option'),
    };

    const carrierStyle = getComputedStyle(carrier);
    const scopeChrome = {
        position: carrierStyle.position,
        display: carrierStyle.display,
        backgroundColor: carrierStyle.backgroundColor,
        borderTopWidth: carrierStyle.borderTopWidth,
        zIndex: carrierStyle.zIndex,
        pointerEvents: carrierStyle.pointerEvents,
        overflow: carrierStyle.overflow,
        beforeContent: getComputedStyle(carrier, '::before').content,
        roleAttr: carrier.getAttribute('role'),
        ariaModalAttr: carrier.getAttribute('aria-modal'),
        overlayCount: document.querySelectorAll('.nvui-overlay, .nvui-modal, dialog.nvui-tl').length,
        dialogCount: document.querySelectorAll('dialog').length,
        ariaModalCount: document.querySelectorAll('[aria-modal="true"]').length,
    };

    return {
        tokens,
        outsideTokens,
        nestedPlain,
        scopeChrome,
        text: snapshot('kit-text'),
        textarea: snapshot('kit-textarea'),
        select: snapshot('kit-select'),
        option: snapshot('kit-option'),
        disabledInput: snapshot('kit-text-disabled'),
        outside: snapshot('outside-input'),
        hostRaw: {
            style: snapshot('host-raw'),
            before: pseudo('host-raw', '::before'),
        },
        checkbox: {
            unchecked: checkbox('cb-unchecked'),
            checked: checkbox('cb-checked'),
            indeterminate: checkbox('cb-indeterminate'),
            disabled: checkbox('cb-disabled'),
            disabledChecked: checkbox('cb-disabled-checked'),
            outside: checkbox('cb-outside'),
            inline: checkbox('cb-inline'),
        },
    };
}

/* ==================== 6. 主流程 ==================== */

(async () => {
    const cleanCss = COMPONENTS_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const importantCount = (cleanCss.match(/!important/g) || []).length;
    console.log(`[INFO] components.css 当前 !important = ${importantCount} 处`
        + '（v2.7.0 共享门禁预算仍 14 = checkbox ::before 2 + reduced-motion 5 + 宿主表单隔离 7；'
        + '隔离 7 条含显式 .nvui-form-scope）');

    let browser = null;
    let page = null;
    const pageErrors = [];

    try {
        browser = await chromium.launch({
            executablePath: CHROME_PATH,
            args: ['--no-sandbox', '--disable-dev-shm-usage'],
        });
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        page = await context.newPage();
        page.on('pageerror', (err) => {
            pageErrors.push(err.message);
            console.log(`[pageerror] ${err.message}`);
        });

        const scenarios = [
            { carrier: 'dialog', theme: 'dark', label: 'dialog.nvui-tl / dark' },
            { carrier: 'dialog', theme: 'light', label: 'dialog.nvui-tl / light' },
            { carrier: 'panel', theme: 'dark', label: '.nvui-panel / dark' },
            { carrier: 'panel', theme: 'light', label: '.nvui-panel / light' },
            { carrier: 'scope', theme: 'dark', label: '.nvui-form-scope / dark' },
            { carrier: 'scope', theme: 'light', label: '.nvui-form-scope / light' },
        ];

        for (const scenario of scenarios) {
            const { carrier, theme, label } = scenario;
            await page.setContent(buildHtml(carrier, theme), { waitUntil: 'load' });
            /* 确定性 fixture：显式设置半选态，避免依赖 setContent 对内联脚本的执行时序；
               不改变断言语义。 */
            await page.evaluate(() => {
                const indeterminate = document.getElementById('cb-indeterminate');
                if (indeterminate) indeterminate.indeterminate = true;
            });
            /* #15：等半选态的实际计算样式走完 transition，避免并行浏览器任务
               使固定 250ms 落在过渡中间帧。超时仍按真实样式回归失败。 */
            await page.waitForFunction(() => {
                const checkbox = document.getElementById('cb-indeterminate');
                if (!checkbox || !checkbox.indeterminate) return false;
                const probe = document.createElement('span');
                probe.style.backgroundColor = 'var(--nvui-accent)';
                checkbox.parentElement.appendChild(probe);
                const accent = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return getComputedStyle(checkbox).backgroundColor === accent
                    && getComputedStyle(checkbox, '::after').opacity === '1';
            }, null, { timeout: 3000 });

            const data = await page.evaluate(readCarrierState);

            /* ---- #9：三个控件恢复 kit token（浅/深、双载体） ---- */
            for (const [name, snapshot] of [
                ['input', data.text],
                ['textarea', data.textarea],
                ['select', data.select],
            ]) {
                expectEq(`${label} ${name} background = --nvui-input-bg`,
                    snapshot.backgroundColor, data.tokens.inputBg);
                expectEq(`${label} ${name} color = --nvui-text`,
                    snapshot.color, data.tokens.text);
                expectEq(`${label} ${name} 去掉宿主 !important 描边`,
                    snapshot.borderTopWidth, '0px');
                expectEq(`${label} ${name} 圆角 = --nvui-radius-sm`,
                    snapshot.borderRadius, data.tokens.radiusSm);
            }
            expectEq(`${label} select margin-top 归零（宿主 !important 外边距被隔离）`,
                data.select.marginTop, '0px');
            expectEq(`${label} select margin-bottom 归零`,
                data.select.marginBottom, '0px');

            expectEq(`${label} option background = --nvui-bg-2`,
                data.option.backgroundColor, data.tokens.bg2);
            expectEq(`${label} option color = --nvui-text`,
                data.option.color, data.tokens.text);

            /* ---- #9：载体外不接管宿主样式（隔离有界） ---- */
            expectEq(`${label} 载体外 input 保持宿主背景`,
                data.outside.backgroundColor, HOST_BG);
            expectEq(`${label} 载体外 input 保持宿主文字色`,
                data.outside.color, HOST_FG);

            if (carrier === 'scope') {
                /* v2.7.0：scope 内嵌套的非 kit 控件不得被隔离规则误伤 */
                expectEq(`${label} 嵌套非 kit input 保持宿主背景`,
                    data.nestedPlain.input.backgroundColor, HOST_BG);
                expectEq(`${label} 嵌套非 kit input 保持宿主文字色`,
                    data.nestedPlain.input.color, HOST_FG);
                expectEq(`${label} 嵌套非 kit input 保持宿主描边`,
                    data.nestedPlain.input.borderTopWidth, '1px');
                expectEq(`${label} 嵌套非 kit input 保持宿主描边色`,
                    data.nestedPlain.input.borderTopColor, HOST_LINE);
                expectEq(`${label} 嵌套非 kit textarea 保持宿主背景`,
                    data.nestedPlain.textarea.backgroundColor, HOST_BG);
                expectEq(`${label} 嵌套非 kit textarea 保持宿主文字色`,
                    data.nestedPlain.textarea.color, HOST_FG);
                expectEq(`${label} 嵌套非 kit select 保持宿主背景`,
                    data.nestedPlain.select.backgroundColor, HOST_BG);
                expectEq(`${label} 嵌套非 kit select 保持宿主文字色`,
                    data.nestedPlain.select.color, HOST_SELECT_FG);
                expectEq(`${label} 嵌套非 kit select 保持宿主 margin-top`,
                    data.nestedPlain.select.marginTop, '9px');
                expectEq(`${label} 嵌套非 kit option 保持宿主背景`,
                    data.nestedPlain.option.backgroundColor, HOST_BG);
                expectEq(`${label} 嵌套非 kit option 保持宿主文字色`,
                    data.nestedPlain.option.color, HOST_SELECT_FG);

                /* v2.7.0：scope 只做隔离标记，不得产生定位/遮罩/模态等副作用 */
                expectEq(`${label} scope 自身 position = static`,
                    data.scopeChrome.position, 'static');
                expectEq(`${label} scope 自身 display = block`,
                    data.scopeChrome.display, 'block');
                expectEq(`${label} scope 自身无背景`,
                    data.scopeChrome.backgroundColor, 'rgba(0, 0, 0, 0)');
                expectEq(`${label} scope 自身无边框`,
                    data.scopeChrome.borderTopWidth, '0px');
                expectEq(`${label} scope 自身无 z-index`,
                    data.scopeChrome.zIndex, 'auto');
                expectEq(`${label} scope 自身 pointer-events = auto`,
                    data.scopeChrome.pointerEvents, 'auto');
                expectEq(`${label} scope 自身不创建 ::before`,
                    data.scopeChrome.beforeContent, 'none');
                expectEq(`${label} scope 自身无 role 属性`,
                    data.scopeChrome.roleAttr, null);
                expectEq(`${label} scope 自身无 aria-modal 属性`,
                    data.scopeChrome.ariaModalAttr, null);
                expectEq(`${label} scope 不创建遮罩/模态载体`,
                    data.scopeChrome.overlayCount, 0);
                expectEq(`${label} scope 不创建 dialog`,
                    data.scopeChrome.dialogCount, 0);
                expectEq(`${label} scope 不创建 aria-modal 节点`,
                    data.scopeChrome.ariaModalCount, 0);
            }

            /* ---- #9：hover / focus-visible / disabled 仍正常 ---- */
            await page.hover('#kit-text');
            await page.waitForTimeout(350);
            const hoverBg = await page.evaluate(
                () => getComputedStyle(document.getElementById('kit-text')).backgroundColor
            );
            expectEq(`${label} input hover background = --nvui-block-bg`,
                hoverBg, data.tokens.blockBg);
            await page.mouse.move(0, 0);
            await page.waitForTimeout(350);

            for (const hoverId of ['kit-textarea', 'kit-select']) {
                await page.hover(`#${hoverId}`);
                await page.waitForTimeout(350);
                const fieldHoverBg = await page.evaluate(
                    (id) => getComputedStyle(document.getElementById(id)).backgroundColor,
                    hoverId
                );
                expectEq(`${label} ${hoverId} hover background = --nvui-block-bg`,
                    fieldHoverBg, data.tokens.blockBg);
                await page.mouse.move(0, 0);
                await page.waitForTimeout(350);
            }

            expectEq(`${label} disabled input opacity 保持 0.55`,
                data.disabledInput.opacity, '0.55');
            expectEq(`${label} disabled input cursor 保持 not-allowed`,
                data.disabledInput.cursor, 'not-allowed');
            expectEq(`${label} disabled input 背景仍是 kit token`,
                data.disabledInput.backgroundColor, data.tokens.inputBg);

            /* ---- #10：宿主原始 checkbox 确实被污染（对照组） ---- */
            expectEq(`${label} 宿主原始 checkbox display = grid`, data.hostRaw.style.display, 'grid');
            expectEq(`${label} 宿主原始 checkbox ::before content 存在`,
                data.hostRaw.before.content, '""');
            check(`${label} 宿主原始 checkbox ::before 未被压制`,
                data.hostRaw.before.display !== 'none',
                `display=${data.hostRaw.before.display}`);

            /* ---- #10：16px 方框与宿主隔离 ---- */
            const unchecked = data.checkbox.unchecked;
            /* .test-controls 是 flex 容器：flex item 的 inline-block 会按 CSS Display
               规范 blockify 为 block。因此这里验证真正契约「不是宿主 grid + 16px 几何」；
               组件自身的 inline-block 由下方正常行内布局 fixture 验证。 */
            check(`${label} checkbox 在 flex 布局中不是宿主 display:grid`,
                unchecked.style.display !== 'grid',
                `display=${unchecked.style.display}`);
            expectEq(`${label} checkbox width = 16px`, unchecked.style.width, '16px');
            expectEq(`${label} checkbox height = 16px`, unchecked.style.height, '16px');
            expectEq(`${label} checkbox appearance = none`, unchecked.style.appearance, 'none');
            expectEq(`${label} checkbox 去掉宿主 transform`, unchecked.style.transform, 'none');
            expectEq(`${label} checkbox 去掉宿主 filter`, unchecked.style.filter, 'none');
            expectEq(`${label} checkbox 去掉宿主 box-shadow`, unchecked.style.boxShadow, 'none');
            expectEq(`${label} checkbox 未选中背景 = --nvui-input-bg`,
                unchecked.style.backgroundColor, data.tokens.inputBg);
            expectEq(`${label} checkbox 未选中描边 = --nvui-line-2`,
                unchecked.style.borderTopColor, data.tokens.line2);
            expectEq(`${label} checkbox 未选中时不显示对勾`,
                unchecked.after.opacity, '0');
            check(`${label} checkbox 宿主 ::before 被压制`,
                unchecked.before.display === 'none' && unchecked.before.content !== '""',
                `display=${unchecked.before.display} / content=${unchecked.before.content}`);

            const outsideCheckbox = data.checkbox.outside;
            expectEq(`${label} carrier 外 kit checkbox 仍为 16px`,
                outsideCheckbox.style.width, '16px');
            check(`${label} carrier 外 flex 行中的 kit checkbox 不是宿主 display:grid`,
                outsideCheckbox.style.display !== 'grid',
                `display=${outsideCheckbox.style.display}`);
            expectEq(`${label} carrier 外 kit checkbox 选中主色`,
                outsideCheckbox.style.backgroundColor, data.outsideTokens.accentBg);
            check(`${label} carrier 外 kit checkbox 宿主 ::before 仍被压制`,
                outsideCheckbox.before.display === 'none',
                `display=${outsideCheckbox.before.display}`);

            const inlineCheckbox = data.checkbox.inline;
            check(`${label} 正常行内布局 checkbox display = inline-block`,
                inlineCheckbox.style.display === 'inline-block',
                `display=${inlineCheckbox.style.display}`);
            expectEq(`${label} 正常行内布局 checkbox width = 16px`,
                inlineCheckbox.style.width, '16px');
            expectEq(`${label} 正常行内布局 checkbox height = 16px`,
                inlineCheckbox.style.height, '16px');
            check(`${label} 正常行内布局 checkbox 宿主 ::before 被压制`,
                inlineCheckbox.before.display === 'none',
                `display=${inlineCheckbox.before.display}`);

            const checked = data.checkbox.checked;
            expectEq(`${label} checkbox 选中背景 = --nvui-accent`,
                checked.style.backgroundColor, data.tokens.accentBg);
            expectEq(`${label} checkbox 选中描边 = --nvui-accent`,
                checked.style.borderTopColor, data.tokens.accentColor);
            expectEq(`${label} checkbox 选中显示对勾`,
                checked.after.opacity, '1');

            const indeterminate = data.checkbox.indeterminate;
            check(`${label} checkbox indeterminate 状态已生效`,
                indeterminate.indeterminate === true,
                `indeterminate=${indeterminate.indeterminate}`);
            expectEq(`${label} checkbox 部分选中背景 = --nvui-accent`,
                indeterminate.style.backgroundColor, data.tokens.accentBg);
            expectEq(`${label} checkbox 部分选中横杠宽度 8px`,
                indeterminate.after.width, '8px');
            expectEq(`${label} checkbox 部分选中横杠高度 2px`,
                indeterminate.after.height, '2px');
            expectEq(`${label} checkbox 部分选中横杠颜色 = --nvui-on-accent`,
                indeterminate.after.backgroundColor, data.tokens.onAccent);
            expectEq(`${label} checkbox 部分选中横杠可见`,
                indeterminate.after.opacity, '1');

            const disabled = data.checkbox.disabled;
            expectEq(`${label} checkbox 禁用态 opacity = 0.5`,
                disabled.style.opacity, '0.5');
            expectEq(`${label} checkbox 禁用态 cursor = not-allowed`,
                disabled.style.cursor, 'not-allowed');
            expectEq(`${label} checkbox 禁用但已选中仍保留主色`,
                data.checkbox.disabledChecked.style.backgroundColor, data.tokens.accentBg);

            /* ---- #10：Tab 焦点环 + Space 切换 + indeterminate 键盘清除 ---- */
            await page.evaluate(() => document.getElementById('host-raw').focus());
            await page.keyboard.press('Tab');
            const checkboxFocus = await page.evaluate(() => {
                const el = document.activeElement;
                const style = getComputedStyle(el);
                return {
                    id: el.id,
                    focusVisible: el.matches(':focus-visible'),
                    outlineWidth: style.outlineWidth,
                    outlineStyle: style.outlineStyle,
                    outlineColor: style.outlineColor,
                };
            });
            expectEq(`${label} Tab 后焦点进入 checkbox`, checkboxFocus.id, 'cb-focus');
            check(`${label} checkbox focus-visible 焦点环走 token`,
                checkboxFocus.focusVisible
                && checkboxFocus.outlineWidth === '2px'
                && checkboxFocus.outlineStyle === 'solid'
                && checkboxFocus.outlineColor === data.tokens.focusRing,
                JSON.stringify(checkboxFocus));

            const beforeSpace = await page.evaluate(
                () => document.getElementById('cb-focus').checked
            );
            await page.keyboard.press('Space');
            const afterSpace = await page.evaluate(
                () => document.getElementById('cb-focus').checked
            );
            check(`${label} Space 可切换 checkbox`,
                afterSpace === !beforeSpace,
                `${beforeSpace} -> ${afterSpace}`);

            /* 从 checkbox 再 Tab 一次进入 input，同时验证键盘焦点仍落在 kit 控件 */
            await page.keyboard.press('Tab');
            const inputFocus = await page.evaluate(() => {
                const el = document.activeElement;
                const style = getComputedStyle(el);
                return {
                    id: el.id,
                    focusVisible: el.matches(':focus-visible'),
                    outlineWidth: style.outlineWidth,
                    outlineStyle: style.outlineStyle,
                    outlineColor: style.outlineColor,
                };
            });
            expectEq(`${label} 再 Tab 后焦点进入 kit input`, inputFocus.id, 'kit-text');
            check(`${label} input focus-visible 焦点环仍走 token`,
                inputFocus.focusVisible
                && inputFocus.outlineWidth === '2px'
                && inputFocus.outlineStyle === 'solid'
                && inputFocus.outlineColor === data.tokens.focusRing,
                JSON.stringify(inputFocus));

            for (const fieldId of ['kit-textarea', 'kit-select']) {
                await page.keyboard.press('Tab');
                const fieldFocus = await page.evaluate(() => {
                    const el = document.activeElement;
                    const style = getComputedStyle(el);
                    return {
                        id: el.id,
                        focusVisible: el.matches(':focus-visible'),
                        outlineWidth: style.outlineWidth,
                        outlineStyle: style.outlineStyle,
                        outlineColor: style.outlineColor,
                    };
                });
                expectEq(`${label} Tab 后焦点进入 ${fieldId}`, fieldFocus.id, fieldId);
                check(`${label} ${fieldId} focus-visible 焦点环仍走 token`,
                    fieldFocus.focusVisible
                    && fieldFocus.outlineWidth === '2px'
                    && fieldFocus.outlineStyle === 'solid'
                    && fieldFocus.outlineColor === data.tokens.focusRing,
                    JSON.stringify(fieldFocus));
            }

            await page.evaluate(() => document.getElementById('cb-indeterminate').focus());
            await page.keyboard.press('Space');
            const indeterminateKeyboard = await page.evaluate(() => {
                const el = document.getElementById('cb-indeterminate');
                return { checked: el.checked, indeterminate: el.indeterminate };
            });
            check(`${label} Space 清除 indeterminate 并勾选`,
                indeterminateKeyboard.indeterminate === false
                && indeterminateKeyboard.checked === true,
                JSON.stringify(indeterminateKeyboard));
        }

        check('全程 0 个 pageerror', pageErrors.length === 0,
            pageErrors.slice(0, 3).join(' | '));
    } catch (err) {
        console.error(`[FATAL] ${err && err.stack ? err.stack : err}`);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }

    const ok = summary('Issues #9 / #10 + v2.7 .nvui-form-scope 浏览器回归');
    if (!ok) process.exitCode = 1;
})();
