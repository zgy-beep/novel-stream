/**
 * SillyTavern UI Kit v2.8.0「Flat Glass」· 规范守护测试（独立项目）
 * 运行方式（在本目录下）: node test/test-ui-kit.js（或 npm test）
 *
 * 本文件只读取本项目内的文件，不依赖任何外部仓库/父目录，因此
 * 整个 ui-kit 目录可以被任意移动后直接运行。
 *
 * 覆盖：
 *  0) 项目文件结构、package.json 版本/元数据（2.8.0 + Flat Glass）；
 *  1) token 完整性：CORE_TOKENS 显式登记 tokens.css 全部令牌（防漏登记/防幽灵/防僵尸），
 *     深色 110 / 浅色覆盖 47，命名合法，README 全覆盖；
 *  2) 配色规范：组件禁用硬编码颜色、颜色声明走 token、深/浅主题 WCAG AA、
 *     核心 token 金标准逐值锁定，以及 v2 新增的「玻璃 AA 合成对比度」验算
 *     （sRGB 逐通道 blend：宿主最坏情况 -> overlay-bg -> glass-bg / glass-bg-strong）；
 *  3) 组件清单：components.css / preview.html / README.md 三方覆盖（80 个类名）；
 *  4) 关键实现红线：top-layer、宿主 checkbox 隔离、玻璃（backdrop-filter + -webkit- 前缀）、
 *     能力降级（@supports / .nvui-solid / prefers-reduced-transparency / forced-colors / 窄屏）、
 *     动效体系（16 个关键帧全部被引用且只改合成友好属性）、reduced-motion（含 animation-delay）、
 *     focus ring 统一 token、折叠 grid-template-rows 0fr/1fr + nvui-acc-inner、
 *     弹窗/遮罩进出场、toast/progress/skeleton/status-dot、扁平优先（静态区块无投影/渐变/描边）；
 *     v2.0.1 补强：数字输入框原生 spinner 隐藏、标签面板/开关/进度条新动效、popover 玻璃正文色；
 *     v2.0.1 追加：标签页粘连指示器（--nvui-tab-ind-*）+ preview 强制播放动效演示开关；
 *     v2.1.0 新增：SillyTavern 插件面板布局标准（桌面居中面板 / 手机底部抽屉 + 底部导航）；
 *     v2.1.1 打磨：描边再减弱、输入框单圈 1.5px 焦点环、面板固定尺寸不跳变、浮层滚动条隐藏但可滚动；
 *     v2.2.0 新增：圆角玻璃去 1px 外框（柔光/投影成形）+ 设计调用 API（nvui-api.js）+ tokens.json + AI-GUIDE.md；
 *     v2.3.0 修复：非模态 dialog.show() 不进 top layer 的载体层级 bug（新增 --nvui-z-layer 载体档位
 *              + 宿主 z-30 遮挡回归断言 + 文档错误论断修正）；
 *  5) 作用域红线：无裸元素选择器、类名前缀、!important 数量与白名单；
 *  6) 预览页离线可用、深浅/实心/动效/API 演示、URL 参数（?theme=light / ?solid=1 / ?panel=1 / ?api=1）；
 *  7) 文档契约：14 章节、宿主/可访问性要点、v2 设计语言、10.3-10.7 迁移、面板布局标准、JS API/AI 指南、AUDIT.md、取值防漂移；
 *  8) 版本与包信息自洽（六处一致，可独立发布/移动）；
 *  9) 防模板漂移：st-extension-template/ui-kit/ 下四个资产文件逐文件用 crypto 计算 md5
 *     与根目录比对（含机器可读镜像 tokens.json），并单独守护副本 tokens.json 的版本号与 --nvui-z-layer。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KIT = path.join(__dirname, '..'); // 本文件位于 <ui-kit>/test/
const FILES = {
    tokens: path.join(KIT, 'tokens.css'),
    components: path.join(KIT, 'components.css'),
    readme: path.join(KIT, 'README.md'),
    preview: path.join(KIT, 'preview.html'),
    pkg: path.join(KIT, 'package.json'),
    license: path.join(KIT, 'LICENSE'),
    changelog: path.join(KIT, 'CHANGELOG.md'),
    gitignore: path.join(KIT, '.gitignore'),
    audit: path.join(KIT, 'AUDIT.md'),
    api: path.join(KIT, 'nvui-api.js'),
    tplIndex: path.join(KIT, 'st-extension-template', 'index.js'),
    tokensJson: path.join(KIT, 'tokens.json'),
    aiGuide: path.join(KIT, 'AI-GUIDE.md'),
    self: __filename,
};

let pass = 0;
let fail = 0;
function check(name, cond, detail = '', showDetailOnPass = false) {
    if (cond) {
        pass++;
        console.log(`[PASS] ${name}${showDetailOnPass && detail ? '  ->  ' + detail : ''}`);
    } else {
        fail++;
        console.error(`[FAIL] ${name}${detail ? '  ->  ' + detail : ''}`);
    }
}

const readText = (p) => fs.readFileSync(p, 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const normalizeValue = (v) => String(v).replace(/\s+/g, ' ').trim().toLowerCase();
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 完整标识符匹配：token/类名后不能紧跟 [\w-]（避免 --nvui-text 命中 --nvui-text-2、nvui-btn 命中 nvui-btn-row） */
const containsExact = (text, value) => new RegExp(escapeRe(value) + '(?![\\w-])').test(text);

/** 取 selector 之后第一个完整 { ... } 块的内容（按大括号配平） */
function blockAfter(css, selector) {
    const i = css.indexOf(selector);
    if (i < 0) return null;
    const open = css.indexOf('{', i);
    if (open < 0) return null;
    let depth = 0;
    for (let j = open; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') {
            depth--;
            if (depth === 0) return css.slice(open + 1, j);
        }
    }
    return null;
}

/** 解析一个块里所有 --nvui-* 定义 */
function tokenMap(css, selector) {
    const body = blockAfter(css, selector);
    const out = {};
    if (!body) return out;
    for (const m of body.matchAll(/(--nvui-[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
}

/** 解析规则选择器（含 @media 内层），跳过 @keyframes 内部 */
function collectSelectors(css) {
    const selectors = [];
    let depth = 0;
    let selStart = 0;
    let inKeyframes = 0;
    for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (ch === '{') {
            const raw = css.slice(selStart, i).trim();
            if (raw.startsWith('@keyframes')) inKeyframes = depth + 1;
            else if (raw.startsWith('@')) { /* @media/@supports 等，下一层继续检查 */ }
            else if (depth > 0 && inKeyframes === depth) { /* keyframe 步骤选择器，跳过 */ }
            else selectors.push({ selector: raw, depth });
            depth++;
            selStart = i + 1;
        } else if (ch === '}') {
            depth--;
            if (inKeyframes === depth + 1) inKeyframes = 0;
            selStart = i + 1;
        }
    }
    return selectors;
}

/**
 * 解析组件样式表为规则数组（选择器 / 声明体 / 所在 at-rule 上下文）。
 * 跳过 @keyframes（关键帧单独由 parseKeyframes 解析），保留 @media/@supports 上下文。
 */
function parseRules(css) {
    const rules = [];
    const atStack = [];
    let selStart = 0;
    let i = 0;
    while (i < css.length) {
        const ch = css[i];
        if (ch === '{') {
            const raw = css.slice(selStart, i).trim();
            if (/^@(?:-webkit-)?keyframes\b/.test(raw)) {
                let depth = 1;
                let j = i + 1;
                while (j < css.length && depth > 0) {
                    if (css[j] === '{') depth++;
                    else if (css[j] === '}') depth--;
                    j++;
                }
                i = j;
                selStart = i;
                continue;
            }
            if (raw.startsWith('@')) {
                atStack.push(raw);
                i++;
                selStart = i;
                continue;
            }
            let depth = 1;
            let j = i + 1;
            while (j < css.length && depth > 0) {
                if (css[j] === '{') depth++;
                else if (css[j] === '}') depth--;
                j++;
            }
            rules.push({ selector: raw, body: css.slice(i + 1, j - 1), context: atStack.slice() });
            i = j;
            selStart = i;
            continue;
        }
        if (ch === '}') {
            atStack.pop();
            i++;
            selStart = i;
            continue;
        }
        i++;
    }
    return rules;
}

/** 解析全部 @keyframes 名称与声明体 */
function parseKeyframes(css) {
    const out = [];
    const re = /@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g;
    let m;
    while ((m = re.exec(css))) {
        const open = css.indexOf('{', m.index);
        let depth = 0;
        let j = open;
        for (; j < css.length; j++) {
            if (css[j] === '{') depth++;
            else if (css[j] === '}') {
                depth--;
                if (depth === 0) break;
            }
        }
        out.push({ name: m[1], body: css.slice(open + 1, j) });
        re.lastIndex = j + 1;
    }
    return out;
}

// ==================== 颜色计算（WCAG + 玻璃合成） ====================
function hexToRgb(hex) {
    const s = String(hex).trim().replace(/^#/, '');
    const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    if (!/^[0-9a-fA-F]{6}$/.test(n)) return null;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function relLuminance(rgb) {
    const f = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(hexA, hexB) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    if (!a || !b) return 0;
    const la = relLuminance(a);
    const lb = relLuminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * 解析颜色：支持 #hex（3/4/6/8 位）与 rgb()/rgba()（逗号或空格分隔）。
 * 返回 { r, g, b, a }（0-255 + 0-1），无法解析返回 null。
 */
function parseColor(value) {
    const s = String(value).trim().toLowerCase();
    const hex = s.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
        let h = hex[1];
        if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
        if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(h)) return null;
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        };
    }
    const fn = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/);
    if (!fn) return null;
    const alpha = fn[4] === undefined ? 1 : (fn[4].endsWith('%') ? parseFloat(fn[4]) / 100 : parseFloat(fn[4]));
    return { r: parseFloat(fn[1]), g: parseFloat(fn[2]), b: parseFloat(fn[3]), a: alpha };
}

/** sRGB 逐通道 alpha 混合：over 叠到 base（base 为 [r,g,b] 数组，可含小数） */
function blend(baseRgb, overValue) {
    const over = parseColor(overValue);
    if (!over) return null;
    const a = over.a;
    return [
        over.r * a + baseRgb[0] * (1 - a),
        over.g * a + baseRgb[1] * (1 - a),
        over.b * a + baseRgb[2] * (1 - a),
    ];
}

/** 两个 rgb 颜色（[r,g,b] 数组）的 WCAG 对比度 */
function contrastRgb(rgbA, rgbB) {
    const la = relLuminance(rgbA);
    const lb = relLuminance(rgbB);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

/** 宿主底色 -> 依次叠加各半透明层 -> 与文字 token 的合成对比度 */
function ratioOnGlass(hostHex, layers, textValue) {
    let bg = hexToRgb(hostHex);
    const text = parseColor(textValue);
    if (!bg || !text) return { ratio: 0, bg: null };
    for (const layer of layers) {
        bg = blend(bg, layer);
        if (!bg) return { ratio: 0, bg: null };
    }
    return { ratio: contrastRgb(bg, [text.r, text.g, text.b]), bg };
}

const fmtRgb = (rgb) => (rgb ? `rgb(${rgb.map((v) => v.toFixed(1)).join(', ')})` : '不可解析');

// ==================== 读取 ====================
const tokensCss = readText(FILES.tokens);
const componentsCss = readText(FILES.components);
const readme = readText(FILES.readme);
const preview = readText(FILES.preview);
const pkg = JSON.parse(readText(FILES.pkg));
const license = readText(FILES.license);
const changelog = readText(FILES.changelog);
const aiGuide = readText(FILES.aiGuide);
const testSrc = readText(FILES.self);
const apiSrc = readText(FILES.api);
const auditExists = fs.existsSync(FILES.audit);
const audit = auditExists ? readText(FILES.audit) : '';

const tokensClean = stripComments(tokensCss);
const componentsClean = stripComments(componentsCss);
const previewClean = stripComments(preview);

const componentRules = parseRules(componentsClean);
const componentKeyframes = parseKeyframes(componentsClean);

/** 选择器匹配器：精确到「类名/选择器边界」，避免 .nvui-btn 误匹配 .nvui-btn-row */
function selRe(text) {
    return new RegExp(escapeRe(text) + '(?![\\w-])');
}
function rulesFor(text) {
    const re = selRe(text);
    return componentRules.filter((r) => re.test(r.selector));
}
function hasRule(text, bodyRe) {
    return rulesFor(text).some((r) => bodyRe.test(r.body));
}
function hasRuleInCtx(text, ctxRe, bodyRe) {
    return rulesFor(text).some((r) => r.context.some((c) => ctxRe.test(c)) && bodyRe.test(r.body));
}
function contextRules(ctxRe) {
    return componentRules.filter((r) => r.context.some((c) => ctxRe.test(c)));
}
function joinedBodies(list) {
    return list.map((r) => r.body).join('\n');
}
/** 仅取「选择器完全等于该基础类」的规则体（排除 :hover/.is-* 等状态变体） */
function plainRuleBodies(selectorText) {
    return componentRules
        .filter((r) => r.selector.split(',').some((sel) => sel.trim() === selectorText))
        .map((r) => r.body);
}

/** v2.0.1 必须存在的 16 个关键帧（契约 §4 + §13，新增 nvui-tabpane-in / nvui-switch-on） */
const EXPECTED_KEYFRAMES = [
    'nvui-spin', 'nvui-fade-in', 'nvui-slide-up', 'nvui-pop-in',
    'nvui-overlay-in', 'nvui-overlay-out', 'nvui-modal-in', 'nvui-modal-out',
    'nvui-toast-in', 'nvui-toast-out', 'nvui-tab-select', 'nvui-tabpane-in',
    'nvui-switch-on', 'nvui-shimmer', 'nvui-progress-indeterminate', 'nvui-pulse',
];

// ==================== 0. 独立项目结构与版本 ====================
console.log('\n=== 0. 独立项目结构与版本 ===');
const REQUIRED_FILES = {
    'tokens.css': FILES.tokens,
    'components.css': FILES.components,
    'preview.html': FILES.preview,
    'README.md': FILES.readme,
    'package.json': FILES.pkg,
    'LICENSE': FILES.license,
    'CHANGELOG.md': FILES.changelog,
    'test/test-ui-kit.js': FILES.self,
    '.gitignore': FILES.gitignore,
    'nvui-api.js': FILES.api,
    'tokens.json': FILES.tokensJson,
    'AI-GUIDE.md': FILES.aiGuide,
};
for (const [name, p] of Object.entries(REQUIRED_FILES)) {
    check(`独立项目文件存在：${name}`, fs.existsSync(p) && fs.statSync(p).size > 10, p);
}
const KIT_VERSION = pkg.version;
check('package.json 版本为合法 semver',
    /^\d+\.\d+\.\d+$/.test(String(KIT_VERSION)), String(KIT_VERSION));
check('package.json 声明 MIT 许可且与 LICENSE 文件一致',
    pkg.license === 'MIT' && /^MIT License/.test(license));
check('package.json scripts.test 指向项目内测试（可 npm test）',
    pkg.scripts && pkg.scripts.test === 'node test/test-ui-kit.js',
    JSON.stringify(pkg.scripts));
check('package.json 描述与关键词更新为 Flat Glass 主题',
    /flat glass/i.test(String(pkg.description || ''))
    && ['glassmorphism', 'motion', 'flat-design'].every((k) => Array.isArray(pkg.keywords) && pkg.keywords.includes(k)),
    `description=${pkg.description} / keywords=${JSON.stringify(pkg.keywords)}`);

// ---- v2.2.0 新增：设计调用 API 运行时门禁（零依赖、Node 可直接加载、无 DOM 依赖） ----
let nvuiApi = null;
let nvuiApiLoadError = '';
try {
    nvuiApi = require(FILES.api);
} catch (err) {
    nvuiApiLoadError = err && err.message ? err.message : String(err);
}
check('nvui-api.js 零依赖运行时可在 Node 直接 require（加载时不访问 DOM）',
    !!nvuiApi && !nvuiApiLoadError, nvuiApiLoadError);
const API_FUNCTIONS = ['createPanel', 'showToast', 'switchRow', 'inputRow', 'accordion',
    'progress', 'openLayer', 'closeLayer', 'getToken', 'setTheme', 'clearLayoutState'];
const missingApiFunctions = API_FUNCTIONS.filter((fn) => !nvuiApi || typeof nvuiApi[fn] !== 'function');
check('nvui-api.js 导出设计调用 API 齐全（11 个函数）且 version 与 kit 一致',
    !!nvuiApi && nvuiApi.version === KIT_VERSION && missingApiFunctions.length === 0,
    missingApiFunctions.length ? `缺少: ${missingApiFunctions.join(', ')}` : `version=${nvuiApi && nvuiApi.version}`);

// ==================== 1. Token 完整性 ====================
console.log('\n=== 1. Token 完整性 ===');
const darkMap = tokenMap(tokensClean, ':root,');
const lightMap = tokenMap(tokensClean, '.nvui-theme-light {');
const allTokens = new Set(Object.keys(darkMap).concat(Object.keys(lightMap)).filter((k) => k.startsWith('--nvui-')));
/** tokens.css 中出现的全部令牌定义（含任何作用域，防漏登记） */
const definedTokens = new Set([...tokensClean.matchAll(/(--nvui-[\w-]+)\s*:/g)].map((m) => m[1]));

/**
 * CORE_TOKENS：tokens.css v2.8.0 全部 111 个令牌的「显式固化清单」。
 * 故意运行时从文件读取，防止令牌被静默删除/漏登记；新增令牌必须同步登记到这里。
 * 金标准（GOLDEN_*）另行锁定关键取值。
 */
const CORE_TOKENS = [
    '--nvui-bg', '--nvui-bg-2', '--nvui-bg-3', '--nvui-block-bg', '--nvui-block-bg-2', '--nvui-input-bg',
    '--nvui-code-bg', '--nvui-overlay-bg', '--nvui-switch-off-bg', '--nvui-knob', '--nvui-knob-off',
    '--nvui-on-accent',
    '--nvui-glass-bg', '--nvui-glass-bg-strong', '--nvui-glass-line', '--nvui-glass-highlight',
    '--nvui-glass-blur', '--nvui-glass-blur-sm', '--nvui-glass-saturate', '--nvui-line', '--nvui-line-2',
    '--nvui-dash', '--nvui-block-line', '--nvui-block-line-2', '--nvui-text', '--nvui-text-2',
    '--nvui-text-3', '--nvui-accent', '--nvui-accent-2', '--nvui-accent-strong', '--nvui-accent-strong-hover',
    '--nvui-accent-bg', '--nvui-accent-bg-hover', '--nvui-accent-line', '--nvui-ok', '--nvui-ok-bg',
    '--nvui-ok-line', '--nvui-warn', '--nvui-warn-bg', '--nvui-warn-line', '--nvui-danger',
    '--nvui-danger-bg', '--nvui-danger-line', '--nvui-info', '--nvui-info-bg', '--nvui-info-line',
    '--nvui-focus-ring-color', '--nvui-focus-ring-w', '--nvui-focus-ring-offset', '--nvui-radius-xs',
    '--nvui-radius-sm', '--nvui-radius', '--nvui-radius-lg', '--nvui-radius-xl', '--nvui-radius-pill',
    '--nvui-space-05', '--nvui-space-1', '--nvui-space-15', '--nvui-space-2', '--nvui-space-25',
    '--nvui-space-3', '--nvui-space-4', '--nvui-space-5', '--nvui-space-6', '--nvui-fs-2xs', '--nvui-fs-xs',
    '--nvui-fs-sm', '--nvui-fs-md', '--nvui-fs-lg', '--nvui-fs-xl', '--nvui-fs-2xl', '--nvui-fw-regular',
    '--nvui-fw-medium', '--nvui-fw-semibold', '--nvui-fw-bold', '--nvui-lh-tight', '--nvui-lh-normal',
    '--nvui-lh-relaxed', '--nvui-lh-loose', '--nvui-shadow-modal', '--nvui-shadow-pop',
    '--nvui-duration-fast', '--nvui-duration-base', '--nvui-duration-slow', '--nvui-ease-standard',
    '--nvui-ease-emphasized', '--nvui-ease-spring', '--nvui-transition', '--nvui-transition-slow',
    '--nvui-spin-duration', '--nvui-shimmer-duration', '--nvui-pulse-duration', '--nvui-stagger-step',
    '--nvui-enter-distance', '--nvui-skeleton-bg', '--nvui-skeleton-shine', '--nvui-control-h',
    '--nvui-switch-w', '--nvui-switch-h', '--nvui-switch-knob', '--nvui-switch-knob-offset',
    '--nvui-switch-knob-on', '--nvui-modal-width', '--nvui-modal-max-h',
    '--nvui-panel-width', '--nvui-panel-max-h', '--nvui-z-layer',
    '--nvui-z-floating', '--nvui-z-overlay', '--nvui-z-tooltip',
    '--nvui-kit-version',
];
const CORE_SET = new Set(CORE_TOKENS);

check('CORE_TOKENS 显式登记 tokens.css 全量令牌（111 个且无重复）',
    CORE_TOKENS.length === 111 && CORE_SET.size === 111,
    `清单 ${CORE_TOKENS.length} 个 / 去重 ${CORE_SET.size} 个`);
const notRegistered = [...definedTokens].filter((t) => !CORE_SET.has(t));
check('tokens.css 定义的每个令牌都在 CORE_TOKENS 中（防漏登记）',
    notRegistered.length === 0, `未登记: ${notRegistered.slice(0, 12).join(', ')}`);
const missingTokens = CORE_TOKENS.filter((t) => !definedTokens.has(t));
check('CORE_TOKENS 每项都在 tokens.css 中有定义（防幽灵令牌）',
    missingTokens.length === 0, `缺少定义: ${missingTokens.slice(0, 12).join(', ')}`);
check('token 命名规范（--nvui- 前缀 + kebab-case）',
    [...allTokens].every((t) => /^--nvui-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)));
check('深色主题令牌在 :root/.nvui-scope 作用域定义（>= 100 个）', Object.keys(darkMap).length >= 100,
    `实际 ${Object.keys(darkMap).length} 个`);

const LIGHT_REQUIRED = [
    '--nvui-text', '--nvui-accent-strong', '--nvui-overlay-bg',
    '--nvui-glass-bg', '--nvui-glass-bg-strong', '--nvui-glass-line', '--nvui-glass-highlight',
    '--nvui-skeleton-bg', '--nvui-skeleton-shine', '--nvui-focus-ring-color',
];
const missingLight = LIGHT_REQUIRED.filter((t) => !lightMap[t]);
check('浅色主题覆盖块 >= 46 个令牌（含玻璃 4 色/骨架屏/焦点环，实际 47）',
    Object.keys(lightMap).length >= 46 && missingLight.length === 0,
    `实际 ${Object.keys(lightMap).length} 个${missingLight.length ? '，缺少覆盖: ' + missingLight.join(', ') : ''}`);
check('tokens.css 文件头声明当前版本「Flat Glass」设计语言',
    tokensCss.includes('ui-kit v' + KIT_VERSION) && /Flat Glass/.test(tokensCss));

// ---- v2.2.0 新增：tokens.json 机器可读镜像与 tokens.css 逐值一致 ----
const tokensJson = JSON.parse(readText(FILES.tokensJson));
const tokensJsonDrift = [];
for (const [label, cssMap, jsonMap] of [['dark', darkMap, tokensJson.dark], ['light', lightMap, tokensJson.light]]) {
    const cssKeys = Object.keys(cssMap).filter((k) => k.startsWith('--nvui-'));
    const map = jsonMap || {};
    for (const k of cssKeys) {
        if (!(k in map)) tokensJsonDrift.push(`${label}:${k} 缺失`);
        else if (normalizeValue(cssMap[k]) !== normalizeValue(map[k])) tokensJsonDrift.push(`${label}:${k} 值漂移`);
    }
    for (const k of Object.keys(map)) {
        if (!(k in cssMap)) tokensJsonDrift.push(`${label}:${k} 多余`);
    }
}
check('tokens.json 与 tokens.css 解析结果逐值一致（dark 111 / light 47 覆盖）',
    !!tokensJson.dark && Object.keys(tokensJson.dark).length === 111
    && !!tokensJson.light && Object.keys(tokensJson.light).length === 47
    && tokensJson.version === KIT_VERSION
    && tokensJsonDrift.length === 0,
    tokensJsonDrift.slice(0, 6).join(' | '));

/* v3.0.0 / C3：tokens.json schema v2 = 值结构不变 + 每个 token 一条元信息。
   值结构刻意没动（dark/light 仍是扁平映射），所以下游解析器零改动；
   新增的 meta 让「令牌面板 / 类型校验 / AI 按语义挑 token」有东西可读。 */
const TOKEN_TYPES = ['color', 'length', 'duration', 'easing', 'number', 'font', 'shadow', 'alias', 'keyword', 'other'];
const metaMissing = tokensJson.schema === 2 && tokensJson.meta
    ? Object.keys(tokensJson.dark).filter((k) => !tokensJson.meta[k]
        || !tokensJson.meta[k].group || !tokensJson.meta[k].type
        || TOKEN_TYPES.indexOf(tokensJson.meta[k].type) === -1)
    : ['<缺少 schema 2 或 meta>'];
const metaGroups = tokensJson.meta ? new Set(Object.values(tokensJson.meta).map((m) => m.group)) : new Set();
check('tokens.json schema v2：meta 覆盖全部 token，group/type 齐全且类型在词表内',
    tokensJson.schema === 2 && !!tokensJson.groupDescriptions
    && metaMissing.length === 0 && metaGroups.size >= 8,
    `缺 ${metaMissing.length} 项（${metaMissing.slice(0, 4).join(', ')}）/ ${metaGroups.size} 组`);

const usedVars = new Set([...componentsClean.matchAll(/var\(\s*(--nvui-[\w-]+)/g)].map((m) => m[1]));
/**
 * JS 运行时写入的几何变量（契约 §13.5.1：由 JS 计算标签位置后 setProperty 写入），
 * 不是设计令牌，不进 tokens.css / CORE_TOKENS，因此不参与「必须有定义」检查。
 */
const RUNTIME_VARS = new Set([
    '--nvui-tab-ind-x', '--nvui-tab-ind-y', '--nvui-tab-ind-w', '--nvui-tab-ind-h',
    /* v3.0.0 / C1：面板尺寸载体。JS 写、CSS 读，值为 px 或 calc()；
       它不是「有默认取值的设计令牌」（空表示交给 kit 默认值），因此不进 tokens.css。 */
    '--nvui-panel-w', '--nvui-panel-h',
]);
const undefinedVars = [...usedVars].filter((t) => !allTokens.has(t) && !RUNTIME_VARS.has(t));
check('components.css 引用的 token 全部有定义（JS 运行时几何变量除外）', undefinedVars.length === 0,
    `未定义: ${undefinedVars.join(', ')}`);
const unusedTokens = CORE_TOKENS.filter((t) => !usedVars.has(t) && !containsExact(previewClean, t));
check('每个 token 至少在组件或预览页中被使用（无僵尸令牌）', unusedTokens.length === 0,
    `未使用: ${unusedTokens.slice(0, 12).join(', ')}`);
const undocumented = CORE_TOKENS.filter((t) => !containsExact(readme, t));
check('每个核心 token 都在 README 规范表格中出现（文档不滞后）', undocumented.length === 0,
    `未记录: ${undocumented.slice(0, 12).join(', ')}`);

// ==================== 2. 配色规范 ====================
console.log('\n=== 2. 配色规范 ===');
const rawColorInComponents = [...componentsClean.matchAll(/#[0-9a-fA-F]{3,8}\b|(?:rgb|hsl)a?\(/g)];
check('components.css 禁止硬编码颜色（#hex / rgb / hsl 零命中）', rawColorInComponents.length === 0,
    `命中: ${rawColorInComponents.slice(0, 5).map((m) => m[0]).join(', ')}`);

const colorDeclRe = /(?:^|[;{\n])\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|box-shadow|outline|fill)\s*:\s*([^;{}]+);/g;
const badColorDecls = [];
for (const m of componentsClean.matchAll(colorDeclRe)) {
    const value = m[1].trim();
    if (/^(?:none|transparent|inherit|currentColor|0)$/i.test(value)) continue;
    if (value.includes('var(--nvui-')) continue;
    badColorDecls.push(value);
}
check('颜色/背景/边框/阴影声明全部引用 var(--nvui-*)',
    badColorDecls.length === 0, badColorDecls.slice(0, 5).join(' | '));

/** 核心 token 金标准：锁死规范取值，防止静默改色（改这里必须同时升版本并更新 CHANGELOG） */
const GOLDEN_DARK = {
    '--nvui-bg': '#161a24',
    '--nvui-bg-2': '#1c2130',
    '--nvui-bg-3': '#232939',
    '--nvui-block-bg': 'rgba(255, 255, 255, 0.05)',
    '--nvui-block-bg-2': 'rgba(255, 255, 255, 0.078)',
    '--nvui-line': 'rgba(255, 255, 255, 0.05)',
    '--nvui-line-2': 'rgba(255, 255, 255, 0.08)',
    '--nvui-dash': 'rgba(255, 255, 255, 0.14)',
    '--nvui-block-line': 'rgba(255, 255, 255, 0.04)',
    '--nvui-block-line-2': 'rgba(255, 255, 255, 0.07)',
    '--nvui-overlay-bg': 'rgba(6, 8, 14, 0.62)',
    '--nvui-text': '#e9ecf3',
    '--nvui-text-2': '#98a1b3',
    '--nvui-text-3': '#7d879b',
    '--nvui-accent': '#8b6dff',
    '--nvui-accent-2': '#a997ff',
    '--nvui-accent-strong': '#6d4df2',
    '--nvui-accent-strong-hover': '#5b3fd6',
    '--nvui-accent-bg': 'rgba(139, 109, 255, 0.14)',
    '--nvui-accent-line': 'rgba(139, 109, 255, 0.4)',
    '--nvui-ok': '#4ade80',
    '--nvui-warn': '#fbbf24',
    '--nvui-danger': '#f87171',
    '--nvui-info': '#3498db',
    '--nvui-on-accent': '#ffffff',
    '--nvui-radius': '12px',
    '--nvui-radius-xl': '20px',
    // v2.5.0 插件面板尺寸令牌（桌面居中 720px 黄金尺寸）
    '--nvui-panel-width': '720px',
    '--nvui-panel-max-h': '88vh',
    // v2.2.0 玻璃层（深色：line 改「表面内直线分隔」，highlight 用作柔和顶光）
    '--nvui-glass-bg': 'rgba(22, 26, 36, 0.64)',
    '--nvui-glass-bg-strong': 'rgba(22, 26, 36, 0.8)',
    '--nvui-glass-line': 'rgba(255, 255, 255, 0.06)',
    '--nvui-glass-highlight': 'rgba(255, 255, 255, 0.05)',
    '--nvui-glass-blur': '20px',
    '--nvui-glass-blur-sm': '12px',
    '--nvui-glass-saturate': '150%',
    // v2 焦点环
    '--nvui-focus-ring-color': 'var(--nvui-accent)',
    '--nvui-focus-ring-w': '2px',
    '--nvui-focus-ring-offset': '2px',
    // v2 动效体系
    '--nvui-duration-fast': '120ms',
    '--nvui-duration-base': '200ms',
    '--nvui-duration-slow': '320ms',
    '--nvui-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
    '--nvui-ease-emphasized': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    '--nvui-ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    '--nvui-transition': 'var(--nvui-duration-fast) var(--nvui-ease-standard)',
    '--nvui-transition-slow': 'var(--nvui-duration-slow) var(--nvui-ease-emphasized)',
    '--nvui-shimmer-duration': '1.4s',
    '--nvui-pulse-duration': '1.8s',
    '--nvui-stagger-step': '45ms',
    '--nvui-enter-distance': '10px',
    // v2 骨架屏
    '--nvui-skeleton-bg': 'rgba(255, 255, 255, 0.055)',
    '--nvui-skeleton-shine': 'rgba(255, 255, 255, 0.12)',
};
const goldenDrift = Object.entries(GOLDEN_DARK)
    .filter(([token, expected]) => normalizeValue(darkMap[token]) !== normalizeValue(expected))
    .map(([token, expected]) => `${token}: 期望 ${expected} / 实际 ${darkMap[token]}`);
check('深色主题核心 token 与金标准逐值一致（防静默改色）',
    goldenDrift.length === 0, goldenDrift.join(' | '));

const GOLDEN_LIGHT = {
    '--nvui-bg': '#f7f8fc',
    '--nvui-text': '#1f2430',
    '--nvui-text-2': '#4a5365',
    '--nvui-text-3': '#5f6879',
    '--nvui-accent': '#6d4df2',
    '--nvui-accent-2': '#5b3fd6',
    '--nvui-accent-strong': '#6d4df2',
    '--nvui-accent-strong-hover': '#5b3fd6',
    '--nvui-ok': '#15803d',
    '--nvui-warn': '#b45309',
    '--nvui-danger': '#dc2626',
    '--nvui-info': '#1d4ed8',
    '--nvui-overlay-bg': 'rgba(15, 23, 42, 0.3)',
    // v2.1.1 浅色分隔/描边再减弱（line 系列 + 玻璃受光边）
    '--nvui-line': 'rgba(15, 23, 42, 0.06)',
    '--nvui-line-2': 'rgba(15, 23, 42, 0.1)',
    '--nvui-dash': 'rgba(15, 23, 42, 0.18)',
    '--nvui-block-line': 'rgba(15, 23, 42, 0.045)',
    '--nvui-block-line-2': 'rgba(15, 23, 42, 0.07)',
    // v2.0.1 浅色玻璃层（strong 更透 / 描边更淡；glass-bg 与 overlay 不变）
    '--nvui-glass-bg': 'rgba(255, 255, 255, 0.78)',
    '--nvui-glass-bg-strong': 'rgba(255, 255, 255, 0.8)',
    '--nvui-glass-line': 'rgba(255, 255, 255, 0.28)',
    '--nvui-glass-highlight': 'rgba(255, 255, 255, 0.4)',
    // v2 浅色焦点环必须覆盖（否则继承根节点深色 accent）
    '--nvui-focus-ring-color': 'var(--nvui-accent)',
    // v2 浅色骨架屏
    '--nvui-skeleton-bg': 'rgba(15, 23, 42, 0.05)',
    '--nvui-skeleton-shine': 'rgba(15, 23, 42, 0.1)',
};
const lightDrift = Object.entries(GOLDEN_LIGHT)
    .filter(([token, expected]) => normalizeValue(lightMap[token]) !== normalizeValue(expected))
    .map(([token, expected]) => `${token}: 期望 ${expected} / 实际 ${lightMap[token]}`);
check('浅色主题核心 token 与金标准逐值一致',
    lightDrift.length === 0, lightDrift.join(' | '));

const darkBg = darkMap['--nvui-bg'];
const ratioPairs = [
    ['--nvui-text', 7], ['--nvui-text-2', 4.5], ['--nvui-text-3', 4.5],
    ['--nvui-accent', 4.5], ['--nvui-accent-2', 4.5],
    ['--nvui-ok', 4.5], ['--nvui-warn', 4.5], ['--nvui-danger', 4.5], ['--nvui-info', 4.5],
];
for (const [token, min] of ratioPairs) {
    const ratio = contrast(darkMap[token], darkBg);
    check(`深色主题 ${token} 对比度 >= ${min}:1`, ratio >= min, `实际 ${ratio.toFixed(2)}:1`);
}
check('深色主题主按钮白字对比度 >= 4.5:1（--nvui-accent-strong）',
    contrast('#ffffff', darkMap['--nvui-accent-strong']) >= 4.5,
    `实际 ${contrast('#ffffff', darkMap['--nvui-accent-strong']).toFixed(2)}:1`);
check('深色主题主按钮悬停白字对比度 >= 4.5:1',
    contrast('#ffffff', darkMap['--nvui-accent-strong-hover']) >= 4.5,
    `实际 ${contrast('#ffffff', darkMap['--nvui-accent-strong-hover']).toFixed(2)}:1`);

const lightBg = lightMap['--nvui-bg'];
const lightPairs = [
    ['--nvui-text', 7], ['--nvui-text-2', 4.5], ['--nvui-text-3', 4.5],
    ['--nvui-accent', 4.5], ['--nvui-accent-2', 4.5],
    ['--nvui-ok', 4.5], ['--nvui-warn', 4.5], ['--nvui-danger', 4.5], ['--nvui-info', 4.5],
];
for (const [token, min] of lightPairs) {
    const ratio = contrast(lightMap[token], lightBg);
    check(`浅色主题 ${token} 对比度 >= ${min}:1`, ratio >= min, `实际 ${ratio.toFixed(2)}:1`);
}
check('浅色主题主按钮白字对比度 >= 4.5:1',
    contrast('#ffffff', lightMap['--nvui-accent-strong']) >= 4.5,
    `实际 ${contrast('#ffffff', lightMap['--nvui-accent-strong']).toFixed(2)}:1`);

check('text-3 为相对旧实现的已记录升级（README 说明提亮一档）',
    contrast(darkMap['--nvui-text-3'], darkBg) >= 4.5 && readme.includes('提亮一档'));
check('填充按钮主色 accent-strong 说明白字 AA 对比度',
    readme.includes('--nvui-accent-strong') && readme.includes('白字 5.26:1'));

// ---- v2 删除项与玻璃阴影金标准 ----
check('--nvui-shadow-accent 已删除（tokens.css / components.css 无残留）',
    !tokensClean.includes('--nvui-shadow-accent') && !componentsClean.includes('--nvui-shadow-accent'));
const glassInset = 'inset 0 1px 0 var(--nvui-glass-highlight)';
check('深色 --nvui-shadow-modal / --nvui-shadow-pop 改为玻璃阴影（含内高光）',
    normalizeValue(darkMap['--nvui-shadow-modal']).includes(glassInset)
    && normalizeValue(darkMap['--nvui-shadow-pop']).includes(glassInset));
check('浅色 --nvui-shadow-modal / --nvui-shadow-pop 改为玻璃阴影（含内高光）',
    normalizeValue(lightMap['--nvui-shadow-modal']).includes(glassInset)
    && normalizeValue(lightMap['--nvui-shadow-pop']).includes(glassInset));

// ---- 玻璃 AA 安全合成对比度（v2 核心卖点） ----
const GLASS_TOKENS = ['--nvui-glass-bg', '--nvui-glass-bg-strong', '--nvui-glass-line', '--nvui-glass-highlight'];
const badGlassTokens = [];
for (const [label, map] of [['深色', darkMap], ['浅色', lightMap]]) {
    for (const token of GLASS_TOKENS) {
        const c = parseColor(map[token]);
        if (!c || !(c.a > 0 && c.a < 1)) badGlassTokens.push(`${label}${token}=${map[token]}`);
    }
    const ov = parseColor(map['--nvui-overlay-bg']);
    if (!ov || !(ov.a > 0 && ov.a < 1)) badGlassTokens.push(`${label}--nvui-overlay-bg=${map['--nvui-overlay-bg']}`);
}
check('深/浅玻璃 4 色与 overlay-bg 均为半透明颜色（AA 合成计算前提）',
    badGlassTokens.length === 0, badGlassTokens.join(' | '));

check('玻璃 AA 合成计算辅助函数自检（parseColor / sRGB blend / 黑白 21:1）',
    Math.abs(contrastRgb([255, 255, 255], [0, 0, 0]) - 21) < 0.001
    && (() => {
        const rgb = hexToRgb('#161a24');
        return rgb && rgb[0] === 22 && rgb[1] === 26 && rgb[2] === 36;
    })()
    && (() => {
        const c = parseColor('rgba(22, 26, 36, 0.64)');
        return c && Math.abs(c.a - 0.64) < 1e-9;
    })()
    && (() => {
        const b = blend([255, 255, 255], 'rgba(22, 26, 36, 0.8)');
        return b && Math.abs(b[0] - 68.6) < 0.01;
    })());

/** 输出实际合成比值，便于与 tokens.css 头注释的「AA 安全」声明对照 */
function glassAACheck(label, hostHex, layers, textToken, textValue) {
    const { ratio, bg } = ratioOnGlass(hostHex, layers, textValue);
    check(`${label} ${textToken} 合成对比度 >= 4.5:1`, ratio >= 4.5,
        `实际 ${ratio.toFixed(2)}:1（合成底色 ${fmtRgb(bg)}）`, true);
}
// 深色弹窗级：最坏情况宿主纯白（遮罩 0.62 + 玻璃 0.64，双值均承诺 AA）
glassAACheck('深色弹窗玻璃（#ffffff -> overlay-bg -> glass-bg）', '#ffffff',
    [darkMap['--nvui-overlay-bg'], darkMap['--nvui-glass-bg']], '--nvui-text', darkMap['--nvui-text']);
glassAACheck('深色弹窗玻璃（#ffffff -> overlay-bg -> glass-bg）', '#ffffff',
    [darkMap['--nvui-overlay-bg'], darkMap['--nvui-glass-bg']], '--nvui-text-2', darkMap['--nvui-text-2']);
// 深色 popover 级：强玻璃降到 0.80 后只承诺正文 --nvui-text（契约 §13.2）
glassAACheck('深色 popover 玻璃（#ffffff -> glass-bg-strong）', '#ffffff',
    [darkMap['--nvui-glass-bg-strong']], '--nvui-text', darkMap['--nvui-text']);
const darkStrongText2 = ratioOnGlass('#ffffff', [darkMap['--nvui-glass-bg-strong']], darkMap['--nvui-text-2']);
check('深色 popover 强玻璃 text-2 不承诺 AA（§13.2 政策：popover 正文改用 --nvui-text）',
    darkStrongText2.ratio < 4.5,
    `实际 ${darkStrongText2.ratio.toFixed(2)}:1，因此 floating/tooltip/toast/glass 正文必须用 --nvui-text`);
// 浅色弹窗级：最坏情况宿主纯黑（遮罩 0.30 + 玻璃 0.78）
glassAACheck('浅色弹窗玻璃（#000000 -> overlay-bg -> glass-bg）', '#000000',
    [lightMap['--nvui-overlay-bg'], lightMap['--nvui-glass-bg']], '--nvui-text', lightMap['--nvui-text']);
glassAACheck('浅色弹窗玻璃（#000000 -> overlay-bg -> glass-bg）', '#000000',
    [lightMap['--nvui-overlay-bg'], lightMap['--nvui-glass-bg']], '--nvui-text-2', lightMap['--nvui-text-2']);
// 浅色 popover 级：强玻璃 0.80 仍承诺双值（契约 §13.2）
glassAACheck('浅色 popover 玻璃（#000000 -> glass-bg-strong）', '#000000',
    [lightMap['--nvui-glass-bg-strong']], '--nvui-text', lightMap['--nvui-text']);
glassAACheck('浅色 popover 玻璃（#000000 -> glass-bg-strong）', '#000000',
    [lightMap['--nvui-glass-bg-strong']], '--nvui-text-2', lightMap['--nvui-text-2']);

// AA 政策落地：popover 级玻璃组件正文必须走 --nvui-text（不能再用 text-2）
const POPOVER_GLASS_CLASSES = ['.nvui-floating', '.nvui-tooltip', '.nvui-toast', '.nvui-glass'];
const missingPopoverTextColor = POPOVER_GLASS_CLASSES.filter((selector) =>
    !plainRuleBodies(selector).some((body) => /color:\s*var\(--nvui-text\)/.test(body)));
check('popover 级玻璃组件基础规则 color 为 var(--nvui-text)（强玻璃只承诺正文 AA）',
    missingPopoverTextColor.length === 0, `缺少: ${missingPopoverTextColor.join(', ')}`);

// 实算与契约 §13.2 参考值互校（防 AA 表口述与实现漂移）
const AA_REFERENCE = [
    ['深色弹窗 text', '#ffffff', [darkMap['--nvui-overlay-bg'], darkMap['--nvui-glass-bg']], darkMap['--nvui-text'], 10.33],
    ['深色弹窗 text-2', '#ffffff', [darkMap['--nvui-overlay-bg'], darkMap['--nvui-glass-bg']], darkMap['--nvui-text-2'], 4.70],
    ['深色 popover text', '#ffffff', [darkMap['--nvui-glass-bg-strong']], darkMap['--nvui-text'], 7.76],
    ['浅色弹窗 text', '#000000', [lightMap['--nvui-overlay-bg'], lightMap['--nvui-glass-bg']], lightMap['--nvui-text'], 9.31],
    ['浅色弹窗 text-2', '#000000', [lightMap['--nvui-overlay-bg'], lightMap['--nvui-glass-bg']], lightMap['--nvui-text-2'], 4.64],
    ['浅色 popover text', '#000000', [lightMap['--nvui-glass-bg-strong']], lightMap['--nvui-text'], 9.66],
    ['浅色 popover text-2', '#000000', [lightMap['--nvui-glass-bg-strong']], lightMap['--nvui-text-2'], 4.81],
];
const aaReferenceDrift = AA_REFERENCE
    .map(([label, host, layers, textValue, expected]) => ({
        label,
        expected,
        actual: ratioOnGlass(host, layers, textValue).ratio,
    }))
    .filter(({ expected, actual }) => Math.abs(expected - actual) > 0.02)
    .map(({ label, expected, actual }) => `${label}: 期望 ${expected.toFixed(2)} / 实际 ${actual.toFixed(2)}`);
check('玻璃 AA 实算值与契约 §13.2 参考值一致（±0.02）',
    aaReferenceDrift.length === 0, aaReferenceDrift.join(' | '));

// ==================== 3. 组件清单三方覆盖 ====================
console.log('\n=== 3. 组件清单（样式/预览/文档三方覆盖） ===');
const COMPONENT_CLASSES = [
    'nvui-scope', 'nvui-form-scope', 'nvui-sr-only', 'nvui-overlay', 'nvui-modal', 'nvui-modal-header',
    'nvui-modal-title', 'nvui-modal-ver', 'nvui-modal-actions', 'nvui-modal-body', 'nvui-modal-footer',
    'nvui-icon-btn', 'nvui-btn', 'nvui-btn-row', 'nvui-switch-row', 'nvui-checkbox', 'nvui-input-row', 'nvui-input',
    'nvui-tabs', 'nvui-tab', 'nvui-tabpane', 'nvui-tabs-indicator', 'nvui-acc', 'nvui-acc-head', 'nvui-acc-title',
    'nvui-acc-summary', 'nvui-acc-chev', 'nvui-acc-body', 'nvui-section-title', 'nvui-hint',
    'nvui-alert', 'nvui-status-line', 'nvui-status-time', 'nvui-status-file', 'nvui-badge',
    'nvui-chip', 'nvui-chip-count', 'nvui-empty', 'nvui-spinner', 'nvui-floating',
    'nvui-floating-handle', 'nvui-tooltip', 'nvui-stack', 'nvui-row', 'nvui-grow', 'nvui-divider',
    'nvui-muted', 'nvui-muted-2', 'nvui-accent-text', 'nvui-ok-text', 'nvui-warn-text',
    'nvui-danger-text', 'nvui-info-text', 'nvui-code', 'nvui-tl', 'nvui-theme-light',
    // v2.0.0 新增 14 个类名（契约 §3.2）
    'nvui-glass', 'nvui-solid', 'nvui-acc-inner',
    'nvui-toast', 'nvui-toast-stack',
    'nvui-progress', 'nvui-progress-bar', 'nvui-progress-field', 'nvui-skeleton', 'nvui-status-dot',
    'nvui-resize', 'nvui-input-msg',
    'nvui-fade-in', 'nvui-slide-up', 'nvui-pop-in', 'nvui-stagger', 'nvui-pulse',
    // v2.1.0 新增 10 个类名：SillyTavern 插件面板布局标准（契约 §14）
    'nvui-panel', 'nvui-panel-header', 'nvui-panel-title', 'nvui-panel-actions', 'nvui-panel-body',
    'nvui-panel-footer', 'nvui-panel-heading', 'nvui-sheet-handle', 'nvui-bottom-nav', 'nvui-bottom-nav-item',
    // v2.8.0 新增 1 个类名：默认按钮组
    'nvui-actions',
];
check('COMPONENT_CLASSES 清单为 v2.9.0 的 84 个类名（v2.8.0 的 81 + progress-field + resize + input-msg）',
    COMPONENT_CLASSES.length === 84 && new Set(COMPONENT_CLASSES).size === 84,
    `实际 ${COMPONENT_CLASSES.length} 个 / 去重 ${new Set(COMPONENT_CLASSES).size} 个`);
const kitAllSources = [tokensClean, componentsClean, previewClean].join('\n');
const missingInCss = COMPONENT_CLASSES.filter((c) => !containsExact(kitAllSources, '.' + c));
const missingInPreview = COMPONENT_CLASSES.filter((c) => !containsExact(previewClean, c));
const missingInDoc = COMPONENT_CLASSES.filter((c) => !containsExact(readme, c));
check('组件类名在 kit CSS 中全部有实现', missingInCss.length === 0, missingInCss.join(', '));
check('组件类名在 preview.html 中全部有示例', missingInPreview.length === 0, missingInPreview.join(', '));
check('组件类名在 README 中全部有说明', missingInDoc.length === 0, missingInDoc.join(', '));

// ==================== 4. 关键实现红线 ====================
console.log('\n=== 4. 关键实现红线 ===');

// ---- 4.1 top-layer 载体（v1 保留） ----
const tlBodies = joinedBodies(rulesFor('dialog.nvui-tl'));
check('top-layer 载体：fixed 铺满视口 + 100dvh 兜底',
    /position:\s*fixed/.test(tlBodies) && /100dvh/.test(tlBodies));
check('top-layer 载体：pointer-events:none（不挡页面）', /pointer-events:\s*none/.test(tlBodies));
check('top-layer 载体子浮层恢复 pointer-events:auto',
    /dialog\.nvui-tl\s*>\s*\.nvui-overlay/.test(componentsClean)
    && /dialog\.nvui-tl\s*>\s*\.nvui-floating/.test(componentsClean)
    && /pointer-events:\s*auto/.test(componentsClean));
check('top-layer 载体未 show() 时 display:none',
    /dialog\.nvui-tl:not\(\[open\]\)[^{]*\{\s*display:\s*none/.test(componentsClean));
// 回归：非模态 dialog.show() 不进浏览器 top layer，载体必须自带 z-index，
// 否则 position:fixed 的层叠上下文会把浮层压在宿主高 z-index 区域之下。
check('top-layer 载体显式声明 z-index（防宿主内容压住浮层）',
    /z-index:\s*var\(--nvui-z-layer\)/.test(tlBodies),
    tlBodies.replace(/\s+/g, ' ').slice(0, 200));
check('吐司载体层级高于面板载体（nvui-tl-toast）',
    /dialog\.nvui-tl\.nvui-tl-toast/.test(componentsClean)
    && /nvui-tl-toast[^{]*\{[^}]*z-index:\s*var\(--nvui-z-tooltip\)/.test(componentsClean));

// ---- v2.3.0 新增：载体层级档位（非模态 dialog 无 top layer 提升，实机冒烟回归） ----
// 实测真相：非模态 show() 不进浏览器 top layer（只有 showModal() 进，但其 inert 会废掉宿主
// 交互，故 kit 禁用模态）；载体与普通 fixed div 层级平等，会被宿主正 z-index 表面整块盖住
// （酒馆 #sheld = position:absolute; z-index:30）。沙盒无宿主层级竞争，必须用静态断言守护。
check('载体声明 z-index: var(--nvui-z-layer)（非模态无 top layer 提升，档位即生命线）',
    /z-index:\s*var\(--nvui-z-layer\)/.test(tlBodies));
const zLayerVal = Number(darkMap['--nvui-z-layer']);
const zFloatingVal = Number(darkMap['--nvui-z-floating']);
check('--nvui-z-layer 档位高于宿主竞争上限（>= 30000）且严格低于 floating 档',
    Number.isFinite(zLayerVal) && zLayerVal >= 30000 && zLayerVal < zFloatingVal,
    `layer=${zLayerVal} / floating=${zFloatingVal}`);
check('--nvui-z-layer 已在 README 层级表登记（含档位理由）',
    /--nvui-z-layer/.test(readme) && /1000000/.test(readme));
// 文档里允许「引述并纠正」这些旧论断，但不允许把它们当作事实陈述保留。
// 判定方式：每处出现所在的行必须带有纠正语境标记（想当然 / 错误 / 此前 / 不进 / 修正 …）。
const CORRECTION_CTX = /想当然|错误|误判|此前|原来|原本|不进|不进入|修正|纠正|已统一|不代表|不是|非模态|禁用|只会/;
function badClaimLines(text, re) {
    return text.split(/\r?\n/).filter((line) => re.test(line) && !CORRECTION_CTX.test(line));
}
const badClaims = [
    ...badClaimLines(componentsClean, /由 dialog 提升渲染层级/),
    ...badClaimLines(readme, /由浏览器 top layer 决定/),
    ...badClaimLines(readme, /由 dialog 提升渲染层级/),
    ...badClaimLines(readme, /实际层级由 top layer 决定/),
];
check('文档不再保留「由 dialog 提升渲染层级 / top layer 决定层级」错误论断（引述纠正语境除外）',
    badClaims.length === 0,
    badClaims.slice(0, 3).join(' | '));

// ---- 4.2 玻璃表面（backdrop-filter / 受光边 / 内高光） ----
const GLASS_SURFACES = ['.nvui-overlay', '.nvui-modal', '.nvui-floating', '.nvui-tooltip', '.nvui-toast', '.nvui-glass'];
const missingBackdrop = GLASS_SURFACES.filter((sel) => !hasRule(sel, /backdrop-filter\s*:/));
check('玻璃表面（遮罩/弹窗/悬浮/提示/吐司/.nvui-glass）均声明 backdrop-filter',
    missingBackdrop.length === 0, `缺少: ${missingBackdrop.join(', ')}`);
const stdBackdropCount = (componentsClean.match(/(?<![\w-])backdrop-filter\s*:/g) || []).length;
const webkitBackdropCount = (componentsClean.match(/-webkit-backdrop-filter\s*:/g) || []).length;
check('每个 backdrop-filter 声明都同步 -webkit- 前缀（Safari）',
    stdBackdropCount >= 6 && webkitBackdropCount >= stdBackdropCount,
    `标准 ${stdBackdropCount} 处 / -webkit- ${webkitBackdropCount} 处`);
check('backdrop-filter 使用玻璃模糊与饱和 token（blur / blur-sm / saturate）',
    hasRule('.nvui-glass', /backdrop-filter\s*:[^;]*var\(--nvui-glass-blur\)/)
    && hasRule('.nvui-glass', /backdrop-filter\s*:[^;]*var\(--nvui-glass-saturate\)/)
    && /var\(--nvui-glass-blur-sm\)/.test(componentsClean));
check('弹窗级玻璃底用 --nvui-glass-bg（背后有遮罩压暗）',
    hasRule('.nvui-modal', /background(?:-color)?\s*:[^;]*var\(--nvui-glass-bg\)/));
const missingStrongBg = ['.nvui-floating', '.nvui-tooltip', '.nvui-glass']
    .filter((sel) => !hasRule(sel, /background(?:-color)?\s*:[^;]*var\(--nvui-glass-bg-strong\)/));
check('popover 级玻璃底用 --nvui-glass-bg-strong（直接叠宿主仍 AA）',
    missingStrongBg.length === 0, `缺少: ${missingStrongBg.join(', ')}`);
check('.nvui-glass 默认 strong、叠加 .is-subtle 用 glass-bg + blur-sm',
    hasRule('.nvui-glass.is-subtle', /background(?:-color)?\s*:[^;]*var\(--nvui-glass-bg\)/)
    && hasRule('.nvui-glass.is-subtle', /var\(--nvui-glass-blur-sm\)/));
const glassSurfaceBodies = GLASS_SURFACES
    .map((sel) => joinedBodies(rulesFor(sel)))
    .join('\n');
// v2.2.0：圆角玻璃外框去 1px 描边（改用柔光/投影成形，避免圆角处亚像素锯齿）
// 只看顶层基础规则；@media (forced-colors: active) 内的 1px CanvasText 是系统高对比降级所需，不算外框描边
const ROUNDED_GLASS_SURFACES = ['.nvui-modal', '.nvui-panel', '.nvui-floating', '.nvui-tooltip', '.nvui-toast', '.nvui-glass'];
const borderedGlassSurfaces = ROUNDED_GLASS_SURFACES.filter((sel) =>
    componentRules.some((r) => r.selector.split(',').some((s) => s.trim() === sel)
        && r.context.length === 0
        && /(?:^|[;{\s])border\s*:/.test(r.body)));
check('圆角玻璃外框无 1px 描边：6 个玻璃组件基础规则均无 border 声明（柔光/投影成形）',
    borderedGlassSurfaces.length === 0, `仍有 border: ${borderedGlassSurfaces.join(', ')}`);
// --nvui-glass-line 改为「玻璃表面内直线分隔」：modal/panel header+footer、tabs 底边（共 7 处）
const GLASS_LINE_USES = componentRules.flatMap((r) =>
    [...r.body.matchAll(/var\(--nvui-glass-line\)/g)].map(() => r.selector.replace(/\s+/g, ' ')));
const GLASS_LINE_SEPARATORS = ['.nvui-modal-header', '.nvui-modal-footer', '.nvui-panel-header',
    '.nvui-panel-footer', '.nvui-tabs'];
const missingGlassLineSeparators = GLASS_LINE_SEPARATORS.filter((sel) =>
    !rulesFor(sel).some((r) => /var\(--nvui-glass-line\)/.test(r.body)));
check('--nvui-glass-line 用于直线分隔（modal/panel header+footer、tabs 底边，共 7 处）',
    GLASS_LINE_USES.length === 7 && missingGlassLineSeparators.length === 0,
    `使用 ${GLASS_LINE_USES.length} 处${missingGlassLineSeparators.length ? '，缺少: ' + missingGlassLineSeparators.join(', ') : ''}`);
check('玻璃阴影通过 shadow token 引入内高光（modal / pop）',
    /var\(--nvui-shadow-(?:modal|pop)\)/.test(glassSurfaceBodies))
check('遮罩底使用 --nvui-overlay-bg',
    hasRule('.nvui-overlay', /background(?:-color)?\s*:[^;]*var\(--nvui-overlay-bg\)/));

// ---- 4.3 能力检测与降级 ----
const supportsCtx = [...new Set(contextRules(/@supports/).flatMap((r) => r.context))].join('\n');
check('@supports not 回退块存在且含 backdrop-filter 能力检测',
    /@supports\s+not/.test(supportsCtx)
    && /backdrop-filter:\s*blur\(1px\)/.test(supportsCtx)
    && /-webkit-backdrop-filter:\s*blur\(1px\)/.test(supportsCtx)
    && /\bor\b/.test(supportsCtx));
const supportsFallbackRules = contextRules(/@supports\s+not/);
const supportsFallbackBodies = joinedBodies(supportsFallbackRules);
const fbModalRules = supportsFallbackRules.filter((r) => /\.nvui-modal/.test(r.selector));
const fbPopoverRules = supportsFallbackRules.filter((r) => /\.nvui-(?:floating|tooltip|toast|glass)/.test(r.selector));
check('@supports 回退：弹窗改不透明表面 --nvui-bg 且关闭模糊',
    fbModalRules.some((r) => /background(?:-color)?\s*:[^;]*var\(--nvui-bg\)/.test(r.body))
    && /backdrop-filter\s*:\s*none/.test(supportsFallbackBodies));
const fbPanelRules = supportsFallbackRules.filter((r) => /\.nvui-panel/.test(r.selector));
check('@supports 回退：面板同样改不透明表面 --nvui-bg',
    fbPanelRules.some((r) => /background(?:-color)?\s*:[^;]*var\(--nvui-bg\)/.test(r.body)));
check('@supports 回退：popover 级改不透明表面 --nvui-bg-2',
    fbPopoverRules.some((r) => /background(?:-color)?\s*:[^;]*var\(--nvui-bg-2\)/.test(r.body)));
const solidRules = rulesFor('.nvui-solid');
const solidBodies = joinedBodies(solidRules);
check('.nvui-solid 实心模式：玻璃表面 backdrop-filter: none',
    solidRules.length > 0 && /backdrop-filter\s*:\s*none/.test(solidBodies));
check('.nvui-solid 实心模式：玻璃表面回退不透明 --nvui-bg / --nvui-bg-2',
    /background(?:-color)?\s*:[^;]*var\(--nvui-bg\)/.test(solidBodies)
    && /background(?:-color)?\s*:[^;]*var\(--nvui-bg-2\)/.test(solidBodies));
check('.nvui-solid 实心模式：面板同样回退不透明并关闭模糊',
    solidRules.some((r) => /\.nvui-panel/.test(r.selector)
        && /background(?:-color)?\s*:[^;]*var\(--nvui-bg(?:-2)?\)/.test(r.body)
        && /backdrop-filter\s*:\s*none/.test(r.body)));
/* 回归（ISSUES.md #15/#16/#17）：宿主用 `body.no-blur * { backdrop-filter: unset !important }`
 * 全局关模糊时，浏览器仍「支持」backdrop-filter → @supports 探测不到。
 * v2.7.2 起：三态探测 + 半透明回退（.nvui-glass-fallback，不再整块 .nvui-solid）；
 * 探测前临时摘掉降级类避免自锁，CSS 未就绪时 unknown 不落回退并重探。 */
check('玻璃能力探测：读实际计算值 backdropFilter（不靠 @supports），三态 + 可逆',
    /detectGlassSupport/.test(apiSrc)
    && /getComputedStyle/.test(apiSrc)
    && /backdropFilter/.test(apiSrc)
    && /syncGlassFallback/.test(apiSrc)
    && /function probeGlassState/.test(apiSrc)
    && /unknown/.test(apiSrc)
    && /clearGlassFallback/.test(apiSrc)
    && /glassRecheckAttempts/.test(apiSrc));
check('玻璃自动回退改为半透明类 .nvui-glass-fallback（不再把 .nvui-solid 作为自动回退）',
    /nvui-glass-fallback/.test(apiSrc)
    && /function syncGlassFallback[\s\S]{0,900}applyGlassFallback/.test(apiSrc)
    && !/function syncGlassFallback[\s\S]{0,900}classList\.add\(['"]nvui-solid['"]\)/.test(apiSrc));
const glassFallbackBodies = (componentsClean.match(/\.nvui-glass-fallback[^{]*\{[^}]*\}/g) || []).join('\n');
check('CSS 半透明回退使用 token 派生 97% 档（color-mix，AA 安全）且位于 .nvui-solid 之前（用户实心优先）',
    /var\(--nvui-glass-bg-strong\)/.test(glassFallbackBodies)
    && /color-mix\(in srgb,\s*var\(--nvui-bg-2\)\s*97%,\s*transparent\)/.test(glassFallbackBodies)
    && /backdrop-filter\s*:\s*none/.test(glassFallbackBodies)
    && componentsClean.indexOf('.nvui-glass-fallback .nvui-overlay') >= 0
    && componentsClean.indexOf('.nvui-glass-fallback .nvui-overlay') < componentsClean.indexOf('.nvui-solid .nvui-overlay'));
check('createPanel / showToast / openLayer 内置玻璃回退调用',
    /function createPanel[\s\S]{0,400}syncGlassFallback\(\)/.test(apiSrc)
    && /function showToast[\s\S]{0,200}syncGlassFallback\(\)/.test(apiSrc)
    && /function openLayer[\s\S]{0,900}syncGlassFallback\(\)/.test(apiSrc));
const rtRules = contextRules(/prefers-reduced-transparency:\s*reduce/);
const rtBodies = joinedBodies(rtRules);
check('prefers-reduced-transparency: reduce 降级块（玻璃回退不透明 + 关闭模糊）',
    rtRules.length > 0
    && /backdrop-filter\s*:\s*none/.test(rtBodies)
    && /var\(--nvui-bg\)/.test(rtBodies)
    && /var\(--nvui-bg-2\)/.test(rtBodies));
check('prefers-reduced-transparency：面板同样回退不透明 + 关闭模糊',
    rtRules.some((r) => /\.nvui-panel/.test(r.selector)
        && /background(?:-color)?\s*:[^;]*var\(--nvui-bg\)/.test(r.body)
        && /backdrop-filter\s*:\s*none/.test(r.body)));
const fcRules = contextRules(/forced-colors:\s*active/);
check('forced-colors: active 高对比模式：玻璃加系统色 1px 边框',
    fcRules.length > 0
    && fcRules.some((r) => /border\s*:\s*1px\s+solid\s+CanvasText/.test(r.body)));
check('forced-colors: active：面板同样获得 CanvasText 边界',
    fcRules.some((r) => /\.nvui-panel/.test(r.selector) && /border\s*:\s*1px\s+solid\s+CanvasText/.test(r.body)));
// 面板基础规则在文件后部，降级块必须「晚绑定」覆盖，否则同 specificity 会被基础规则反超
const basePanelIdx = componentsClean.indexOf('\n.nvui-panel {');
const latePanelRules = componentRules.filter((r) => /\.nvui-overlay\.is-panel\s*>\s*\.nvui-panel/.test(r.selector));
const latePanelIdx = componentsClean.indexOf('.nvui-overlay.is-panel > .nvui-panel');
check('面板降级采用晚绑定覆盖（3 个降级块，位于基础规则之后）',
    latePanelRules.length >= 3 && latePanelIdx > basePanelIdx && basePanelIdx > 0);
const narrowPanelRule = componentRules.filter((r) => r.context.some((c) => /max-width:\s*600px/.test(c))
    && r.selector.split(',').some((sel) => sel.trim() === '.nvui-panel'));
check('窄屏面板保持玻璃态：backdrop-filter 降档为 --nvui-glass-blur-sm',
    narrowPanelRule.some((r) => /backdrop-filter\s*:[^;]*var\(--nvui-glass-blur-sm\)/.test(r.body)));
check('面板降级晚绑定：均关闭 backdrop-filter，且不透明回退与 CanvasText 边界齐全',
    latePanelRules.every((r) => /-webkit-backdrop-filter\s*:\s*none/.test(r.body) && /backdrop-filter\s*:\s*none/.test(r.body))
    && latePanelRules.some((r) => /background(?:-color)?\s*:[^;]*var\(--nvui-bg\)/.test(r.body))
    && latePanelRules.some((r) => /border\s*:\s*1px\s+solid\s+CanvasText/.test(r.body)));
const narrowRules = contextRules(/max-width:\s*600px/);
check('窄屏（<=600px）：弹窗玻璃改用 --nvui-glass-blur-sm',
    narrowRules.some((r) => /\.nvui-(?:modal|overlay)/.test(r.selector)
        && /var\(--nvui-glass-blur-sm\)/.test(r.body)));

// ---- 4.4 动效降级与 focus ring 统一 ----
const rmRules = contextRules(/prefers-reduced-motion:\s*reduce/);
const rmBodies = joinedBodies(rmRules);
check('尊重 prefers-reduced-motion 降级',
    rmRules.length > 0
    && /animation-duration:\s*0\.01ms !important/.test(rmBodies)
    && /transition-duration:\s*0\.01ms !important/.test(rmBodies));
check('reduced-motion 覆盖 animation-delay（延迟一并归零）',
    /animation-delay:\s*0\.01ms !important/.test(rmBodies));
check('reduced-motion 覆盖 animation-iteration-count 与 scroll-behavior',
    /animation-iteration-count:\s*1 !important/.test(rmBodies)
    && /scroll-behavior:\s*auto !important/.test(rmBodies));

/* 回归（ISSUES.md #13）：reduced-motion 门禁不得只依赖 .nvui-scope 通配。
 * 宿主把 kit 组件挂进自己的容器却没加 .nvui-scope 时，组件动画也必须降级；
 * 因此所有「自身带 animation/transition 的 kit 类」都必须在降级块里被逐个点名。 */
const rmSelectorText = rmRules.map((r) => r.selector).join('\n');
/** 从组件规则里抽出「自身带 animation/transition」的 kit 基类（去掉状态类与伪类） */
const animatedKitClasses = new Set();
for (const r of componentRules) {
    if (!/\banimation(?:-name)?\s*:|\btransition\s*:/.test(r.body)) continue;
    for (const sel of r.selector.split(',')) {
        const m = sel.trim().match(/\.((?:nvui)-[a-z0-9-]+)/i);
        if (m) animatedKitClasses.add(m[1]);
    }
}
const missingInRm = [...animatedKitClasses].filter((c) => !rmSelectorText.includes(`.${c}`));
check('reduced-motion 降级逐个点名所有带动效的 kit 类（不依赖 .nvui-scope）',
    missingInRm.length === 0,
    `未点名: ${missingInRm.join(', ')}｜已点名 ${animatedKitClasses.size} 类`);
check('reduced-motion 保留 .nvui-scope 与 dialog.nvui-tl 两层作用域通配',
    /\.nvui-scope \*/.test(rmSelectorText)
    && /dialog\.nvui-tl \*/.test(rmSelectorText));
const focusRingCount = (componentsClean.match(/outline:\s*var\(--nvui-focus-ring-w\)\s+solid\s+var\(--nvui-focus-ring-color\)/g) || []).length;
check('focus ring 统一走 token（>= 6 处）', focusRingCount >= 6, `实际 ${focusRingCount} 处`);
check('不再硬编码 outline 像素值 / 旧 accent 硬编码写法',
    !/outline\s*:\s*\d+(?:\.\d+)?px/.test(componentsClean)
    && !/outline:\s*2px\s+solid\s+var\(--nvui-accent\)/.test(componentsClean));
const focusOffsetCount = (componentsClean.match(/outline-offset:\s*var\(--nvui-focus-ring-offset\)/g) || []).length;
check('outline-offset 统一走 --nvui-focus-ring-offset（>= 4 处）',
    focusOffsetCount >= 4, `实际 ${focusOffsetCount} 处`);
check('组件内 focus-visible 焦点环数量充足（>= 6 处）',
    (componentsClean.match(/:focus-visible/g) || []).length >= 6,
    `实际 ${(componentsClean.match(/:focus-visible/g) || []).length}`);

// ---- 4.5 折叠面板（grid-template-rows 高度动画 + nvui-acc-inner） ----
check('折叠面板：.nvui-acc-body 为 grid 高度动画容器（display:grid + 0fr + grid-template-rows 过渡）',
    hasRule('.nvui-acc-body', /display:\s*grid/)
    && hasRule('.nvui-acc-body', /grid-template-rows:\s*0fr/)
    && hasRule('.nvui-acc-body', /transition\s*:[^;}]*grid-template-rows/));
const accOpenRules = componentRules.filter((r) => /\.nvui-acc\.is-open/.test(r.selector) && /\.nvui-acc-body/.test(r.selector));
check('折叠面板：展开态 grid-template-rows: 1fr（0fr <-> 1fr 过渡）',
    accOpenRules.some((r) => /grid-template-rows:\s*1fr/.test(r.body)));
check('折叠面板：新增 .nvui-acc-inner 内容层（min-height:0 + overflow:hidden）',
    hasRule('.nvui-acc-inner', /min-height:\s*0/)
    && hasRule('.nvui-acc-inner', /overflow:\s*hidden/));
check('折叠箭头为纯 CSS 且展开旋转 225 度',
    hasRule('.nvui-acc-chev', /transform:\s*rotate\(45deg\)/)
    && rulesFor('.nvui-acc-chev').some((r) => /\.nvui-acc\.is-open/.test(r.selector) && /rotate\(225deg\)/.test(r.body)));

// ---- 4.6 弹窗 / 遮罩进出场动画 ----
check('.nvui-overlay 自身播放入场动画 nvui-overlay-in',
    hasRule('.nvui-overlay', /animation(?:-name)?\s*:[^;}]*nvui-overlay-in/));
check('弹窗入场：.nvui-overlay:not([hidden]) .nvui-modal 引用 nvui-modal-in',
    hasRule('.nvui-overlay:not([hidden]) .nvui-modal', /animation(?:-name)?\s*:[^;}]*nvui-modal-in/));
check('遮罩关闭：.nvui-overlay.is-closing 引用 nvui-overlay-out',
    hasRule('.nvui-overlay.is-closing', /animation(?:-name)?\s*:[^;}]*nvui-overlay-out/));
check('弹窗关闭：.nvui-overlay.is-closing .nvui-modal 引用 nvui-modal-out',
    hasRule('.nvui-overlay.is-closing .nvui-modal', /animation(?:-name)?\s*:[^;}]*nvui-modal-out/));
const modalInKf = componentKeyframes.find((k) => k.name === 'nvui-modal-in');
check('@keyframes nvui-modal-in 表现上移 14px + 0.97 缩放',
    !!modalInKf && /translateY\(14px\)/.test(modalInKf.body) && /scale\(0\.97\)/.test(modalInKf.body));

// ---- 4.7 v2 新组件基础规则 ----
check('.nvui-toast 基础规则（玻璃 + radius-lg + shadow-pop + nvui-toast-in 入场）',
    hasRule('.nvui-toast', /background(?:-color)?\s*:[^;]*var\(--nvui-glass-bg/)
    && hasRule('.nvui-toast', /border-radius:\s*var\(--nvui-radius-lg\)/)
    && hasRule('.nvui-toast', /var\(--nvui-shadow-pop\)/)
    && hasRule('.nvui-toast', /animation(?:-name)?\s*:[^;}]*nvui-toast-in/)
    && hasRule('.nvui-toast', /pointer-events:\s*auto/));
check('.nvui-toast.is-closing 引用 nvui-toast-out 退场动画',
    hasRule('.nvui-toast.is-closing', /animation(?:-name)?\s*:[^;}]*nvui-toast-out/));
const stackBodies = joinedBodies(rulesFor('.nvui-toast-stack'));
check('.nvui-toast-stack 固定右下堆栈 + tooltip 层级 + 穿透 + 安全区',
    /position:\s*fixed/.test(stackBodies)
    && /z-index:\s*var\(--nvui-z-tooltip\)/.test(stackBodies)
    && /pointer-events:\s*none/.test(stackBodies)
    && /bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)/.test(stackBodies));
const progressBodies = joinedBodies(rulesFor('.nvui-progress'));
check('.nvui-progress 线性轨道（4px / pill / overflow / block-bg 底）',
    /height:\s*4px/.test(progressBodies)
    && /border-radius:\s*var\(--nvui-radius-pill\)/.test(progressBodies)
    && /overflow:\s*hidden/.test(progressBodies)
    && /background(?:-color)?\s*:[^;]*var\(--nvui-block-bg\)/.test(progressBodies));
const progressBarBodies = joinedBodies(rulesFor('.nvui-progress-bar'));
check('.nvui-progress-bar 进度条本体（height:100% / width:0 / accent / width 过渡）',
    /display:\s*block/.test(progressBarBodies)
    && /height:\s*100%/.test(progressBarBodies)
    && /width:\s*0/.test(progressBarBodies)
    && /background(?:-color)?\s*:[^;]*var\(--nvui-accent\)/.test(progressBarBodies)
    && /transition\s*:[^;}]*width/.test(progressBarBodies));
check('.nvui-progress.is-indeterminate 循环动画 nvui-progress-indeterminate',
    componentRules.some((r) => /\.nvui-progress/.test(r.selector) && /\.is-indeterminate/.test(r.selector)
        && /animation(?:-name)?\s*:[^;}]*nvui-progress-indeterminate/.test(r.body)));
const missingProgressVariants = [['is-ok', '--nvui-ok'], ['is-warn', '--nvui-warn'], ['is-danger', '--nvui-danger']]
    .filter(([cls, token]) => !componentRules.some((r) => /\.nvui-progress/.test(r.selector)
        && r.selector.includes('.' + cls) && r.body.includes(token)));
check('.nvui-progress 语义变体 is-ok / is-warn / is-danger 改条色',
    missingProgressVariants.length === 0,
    `缺少: ${missingProgressVariants.map(([cls]) => cls).join(', ')}`);
const skeletonAfter = componentRules.filter((r) => /\.nvui-skeleton::after/.test(r.selector));
check('.nvui-skeleton 骨架屏底 + ::after 渐变扫光（skeleton-shine + nvui-shimmer）',
    hasRule('.nvui-skeleton', /background(?:-color)?\s*:[^;]*var\(--nvui-skeleton-bg\)/)
    && skeletonAfter.some((r) => /var\(--nvui-skeleton-shine\)/.test(r.body))
    && skeletonAfter.some((r) => /animation(?:-name)?\s*:[^;}]*nvui-shimmer/.test(r.body)));
check('.nvui-skeleton 变体 is-text / is-circle / is-block / is-title',
    ['is-text', 'is-circle', 'is-block', 'is-title'].every((v) =>
        componentRules.some((r) => /\.nvui-skeleton/.test(r.selector) && r.selector.includes('.' + v))));
const dotBodies = joinedBodies(rulesFor('.nvui-status-dot'));
check('.nvui-status-dot 状态点为 7px 圆点',
    /width:\s*7px/.test(dotBodies) && /height:\s*7px/.test(dotBodies)
    && /border-radius:\s*(?:50%|var\(--nvui-radius-pill\))/.test(dotBodies));
const missingDotVariants = [['is-ok', '--nvui-ok'], ['is-warn', '--nvui-warn'], ['is-danger', '--nvui-danger'], ['is-info', '--nvui-info']]
    .filter(([cls, token]) => !componentRules.some((r) => /\.nvui-status-dot/.test(r.selector)
        && r.selector.includes('.' + cls) && r.body.includes(token)));
check('.nvui-status-dot 语义变体 is-ok / is-warn / is-danger / is-info',
    missingDotVariants.length === 0,
    `缺少: ${missingDotVariants.map(([cls]) => cls).join(', ')}`);
check('.nvui-status-dot.is-live 播放 nvui-pulse 呼吸',
    hasRule('.nvui-status-dot.is-live', /animation(?:-name)?\s*:[^;}]*nvui-pulse/));

// ---- 4.8 动效工具类与关键帧体系 ----
const MOTION_UTILS = [
    ['.nvui-fade-in', 'nvui-fade-in'],
    ['.nvui-slide-up', 'nvui-slide-up'],
    ['.nvui-pop-in', 'nvui-pop-in'],
    ['.nvui-pulse', 'nvui-pulse'],
];
const missingMotionUtils = MOTION_UTILS.filter(([cls, kf]) =>
    !hasRule(cls, new RegExp('animation(?:-name)?\\s*:[^;}]*' + escapeRe(kf))));
check('动效工具类 .nvui-fade-in / .nvui-slide-up / .nvui-pop-in / .nvui-pulse 引用对应关键帧',
    missingMotionUtils.length === 0, `缺少: ${missingMotionUtils.map(([cls]) => cls).join(', ')}`);
const staggerBase = componentRules.some((r) => /\.nvui-stagger\s*>\s*\*/.test(r.selector)
    && /animation(?:-name)?\s*:[^;}]*nvui-slide-up/.test(r.body));
const staggerChildNumbers = new Set();
for (const r of componentRules) {
    if (!/\.nvui-stagger/.test(r.selector)) continue;
    for (const m of r.selector.matchAll(/:nth-child\((\d+)\)/g)) staggerChildNumbers.add(parseInt(m[1], 10));
}
check('.nvui-stagger 子项播放 nvui-slide-up 且 nth-child 1~10 递增 animation-delay',
    staggerBase
    && [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((n) => staggerChildNumbers.has(n))
    && componentRules.some((r) => /\.nvui-stagger/.test(r.selector)
        && /animation-delay\s*:[^;]*var\(--nvui-stagger-step\)/.test(r.body)));

const definedKeyframes = componentKeyframes.map((k) => k.name);
const missingKeyframes = EXPECTED_KEYFRAMES.filter((n) => !definedKeyframes.includes(n));
check('@keyframes v2.0.1 的 16 个动画全部定义', missingKeyframes.length === 0,
    `缺少: ${missingKeyframes.join(', ')}`);
const badKfPrefix = definedKeyframes.filter((n) => !/^nvui-/.test(n));
check('所有 @keyframes 均使用 nvui- 前缀（不污染宿主命名空间）',
    badKfPrefix.length === 0, `违规: ${badKfPrefix.join(', ')}`);
const unreferencedKf = definedKeyframes.filter((name) =>
    !new RegExp('animation(?:-name)?\\s*:[^;}]*\\b' + escapeRe(name) + '\\b').test(componentsClean));
check('所有 @keyframes nvui-* 都被 animation 引用（无死动画）',
    unreferencedKf.length === 0, `未引用: ${unreferencedKf.join(', ')}`);
const COMPOSITE_PROPS = new Set([
    'opacity', 'transform', 'filter', 'visibility', 'scale', 'translate', 'rotate',
    'animation-timing-function', '-webkit-transform', 'backdrop-filter',
]);
const badAnimProps = [];
for (const kf of componentKeyframes) {
    for (const m of kf.body.matchAll(/([a-zA-Z-]+)\s*:/g)) {
        const prop = m[1].toLowerCase();
        if (prop.startsWith('--')) continue;
        if (!COMPOSITE_PROPS.has(prop)) badAnimProps.push(`${kf.name}:${prop}`);
    }
}
check('动画只改合成友好属性（opacity/transform/filter，不改宽高与定位）',
    badAnimProps.length === 0, badAnimProps.slice(0, 6).join(', '));

// ---- 4.9 扁平优先：静态区块不得投影/渐变/描边 ----
const FLAT_BLOCKS = ['.nvui-btn', '.nvui-badge', '.nvui-chip', '.nvui-input', '.nvui-tab', '.nvui-acc-head'];
const flatViolations = [];
for (const selector of FLAT_BLOCKS) {
    const bodies = plainRuleBodies(selector);
    if (bodies.length === 0) {
        flatViolations.push(`${selector}: 未找到基础规则`);
        continue;
    }
    const declarations = bodies.join('\n').split(';').map((s) => s.trim()).filter(Boolean);
    for (const decl of declarations) {
        // 透明描边仅用于占位、不表达层级，允许；可见 1px 描边禁止
        if (/^border(?:-(?:top|right|bottom|left|width))?\s*:/.test(decl)
            && /\b[1-9]\d*px/.test(decl) && !/\btransparent\b/.test(decl)) {
            flatViolations.push(`${selector}: 可见描边（${decl}）`);
        }
        if (/^box-shadow\s*:/.test(decl) && !/^box-shadow\s*:\s*none\b/.test(decl)) {
            flatViolations.push(`${selector}: 有投影/内描边（${decl}）`);
        }
        if (/(?:linear|radial|conic)-gradient\(/.test(decl)) {
            flatViolations.push(`${selector}: 有渐变`);
        }
    }
}
check('扁平优先：静态区块（按钮/徽标/标签块/输入/标签页/折叠头）无可见描边/投影/渐变',
    flatViolations.length === 0, flatViolations.slice(0, 6).join(' | '));

// ---- 4.10 v1 保留：宿主 checkbox 隔离 / 基础组件 ----
const switchInputBodies = joinedBodies(rulesFor('.nvui-switch-row input[type="checkbox"]'));
check('胶囊开关：appearance:none + 尺寸走 token + 手型光标',
    /appearance:\s*none/.test(switchInputBodies)
    && /width:\s*var\(--nvui-switch-w\)/.test(switchInputBodies)
    && /height:\s*var\(--nvui-switch-h\)/.test(switchInputBodies)
    && /cursor:\s*pointer/.test(switchInputBodies));
check('胶囊开关：压掉宿主 ::before 对勾（content/display 双关）',
    /\.nvui-switch-row input\[type="checkbox"\]::before[\s\S]{0,260}content:\s*none !important/.test(componentsClean)
    && /display:\s*none !important/.test(blockAfter(componentsClean, '.nvui-switch-row input[type="checkbox"]::before,') || ''));
check('胶囊开关：勾选态轨道变主色',
    /\.nvui-switch-row input\[type="checkbox"\]:checked\s*\{[\s\S]{0,160}background:\s*var\(--nvui-accent\)/.test(componentsClean));
check('胶囊开关：勾选态滑钮右移且变白',
    /:checked::after\s*\{[\s\S]{0,200}transform:\s*translateX\(var\(--nvui-switch-knob-on\)\)/.test(componentsClean)
    && /background:\s*var\(--nvui-knob\)/.test(componentsClean));
check('主按钮文字色走 --nvui-on-accent（不借用 --nvui-knob）',
    hasRule('.nvui-btn.is-primary', /color:\s*var\(--nvui-on-accent\)/));
const switchTrackRatios = [];
let switchTrackOk = true;
for (const [label, map, bgHex] of [['深色', darkMap, darkBg], ['浅色', lightMap, lightBg]]) {
    const bgRgb = hexToRgb(bgHex);
    const trackRgb = blend(bgRgb, map['--nvui-switch-off-bg']);
    const ratio = trackRgb ? contrastRgb(trackRgb, bgRgb) : 0;
    switchTrackRatios.push(`${label} ${ratio.toFixed(2)}:1`);
    if (ratio < 3) switchTrackOk = false;
}
check('开关关闭态轨道与页面背景非文本对比度 >= 3:1（WCAG 1.4.11）',
    switchTrackOk, switchTrackRatios.join(' / '), true);
const statusTimestampBodies = joinedBodies(rulesFor('.nvui-status-time'))
    + '\n' + joinedBodies(rulesFor('.nvui-status-file'));
check('状态行时间/文件用 --nvui-text-2 且不靠 opacity 弱化（AUD-06）',
    /color:\s*var\(--nvui-text-2\)/.test(statusTimestampBodies)
    && !/(?:^|[;{\s])opacity\s*:/.test(statusTimestampBodies));
check('读屏专用隐藏文本 .nvui-sr-only 使用 clip 方案（非 display:none）',
    /\.nvui-sr-only\s*\{[\s\S]{0,400}clip:\s*rect\(/.test(componentsClean));
check('遮罩支持 hidden 属性切换隐藏',
    /\.nvui-overlay\[hidden\]\s*\{\s*display:\s*none/.test(componentsClean));
check('标签页面板只切 display（不重建 DOM 的样式前提）',
    /\.nvui-tabpane\s*\{\s*display:\s*none/.test(componentsClean)
    && /\.nvui-tabpane\.is-active\s*\{\s*display:\s*block/.test(componentsClean));
check('窄屏响应式（<=600px 弹窗 92dvh 与按钮组适配）',
    /@media \(max-width: 600px\)/.test(componentsClean)
    && /max-height:\s*92dvh/.test(componentsClean)
    && /\.nvui-btn-row > \.nvui-btn[\s\S]{0,80}flex:\s*1 1 100%/.test(componentsClean));
check('纯 CSS 加载环动画 @keyframes nvui-spin 存在且被引用',
    /@keyframes nvui-spin/.test(componentsClean) && /animation:\s*nvui-spin/.test(componentsClean));

// ---- 4.11 v2.0.1 用户反馈迭代红线（数字输入框 / 动效补强） ----
check('数字输入框：隐藏 WebKit 原生步进按钮（inner/outer + -webkit-appearance:none + margin:0）',
    /\.nvui-input\[type="number"\]::-webkit-inner-spin-button/.test(componentsClean)
    && /\.nvui-input\[type="number"\]::-webkit-outer-spin-button/.test(componentsClean)
    && hasRule('.nvui-input[type="number"]::-webkit-inner-spin-button', /-webkit-appearance:\s*none/)
    && hasRule('.nvui-input[type="number"]::-webkit-inner-spin-button', /margin:\s*0/));
check('数字输入框：type=number 基础规则 appearance:textfield（键盘/滚轮仍可调）',
    hasRule('.nvui-input[type="number"]', /-webkit-appearance:\s*textfield/)
    && hasRule('.nvui-input[type="number"]', /appearance:\s*textfield/)
    && hasRule('.nvui-input[type="number"]', /-moz-appearance:\s*textfield/));
check('标签面板激活：.nvui-tabpane.is-active 引用入场动画 nvui-tabpane-in',
    hasRule('.nvui-tabpane.is-active', /animation(?:-name)?\s*:[^;}]*nvui-tabpane-in/));
check('胶囊开关勾选：:checked 引用回弹动画 nvui-switch-on',
    hasRule('.nvui-switch-row input[type="checkbox"]:checked', /animation(?:-name)?\s*:[^;}]*nvui-switch-on/));
check('胶囊开关按住：:active::after 有横向拉伸（iOS 风格），勾选态叠加位移',
    hasRule('.nvui-switch-row input[type="checkbox"]:active::after', /transform:\s*scaleX\(1\.\d+\)/)
    && hasRule('.nvui-switch-row input[type="checkbox"]:checked:active::after', /scaleX\(/));
check('进度条扫光：.nvui-progress-bar::after 引用 nvui-shimmer 且用 transform 平移',
    hasRule('.nvui-progress-bar::after', /animation(?:-name)?\s*:[^;}]*nvui-shimmer/)
    && hasRule('.nvui-progress-bar::after', /transform:\s*translateX\(/)
    && hasRule('.nvui-progress-bar::after', /background\s*:[^;]*gradient\(/));
check('不确定进度关键帧含 scaleX 呼吸（transform-only，不触发布局）',
    componentKeyframes.some((k) => k.name === 'nvui-progress-indeterminate' && /scaleX\(/.test(k.body)));
/* 回归（ISSUES.md #11）：0% / 100% 时扫光必须停下，不能常驻无限动画 */
check('进度条扫光在 idle(0%) / complete(100%) 状态停止（is-idle / is-complete）',
    hasRule('.nvui-progress.is-idle .nvui-progress-bar::after', /animation\s*:\s*none/)
    && hasRule('.nvui-progress.is-complete .nvui-progress-bar::after', /animation\s*:\s*none/));
check('NVUI.progress() 自动维护 is-idle / is-complete（0% 与 100% 停扫光）',
    /is-idle/.test(apiSrc) && /is-complete/.test(apiSrc)
    && /syncActivity/.test(apiSrc));

// ---- 4.12 v2.0.1 追加：标签页「粘连」滑动指示器 ----
const tabsBaseBodies = plainRuleBodies('.nvui-tabs').join('\n');
const tabBaseBodies = plainRuleBodies('.nvui-tab').join('\n');
const indicatorBaseBodies = plainRuleBodies('.nvui-tabs-indicator').join('\n');
check('标签页粘连指示器：tabs 建立定位上下文 + tab/indicator 层级（tabs relative / tab relative+z-index:1 / indicator z-index:0）',
    /position:\s*relative/.test(tabsBaseBodies)
    && /position:\s*relative/.test(tabBaseBodies) && /z-index:\s*1/.test(tabBaseBodies)
    && /z-index:\s*0/.test(indicatorBaseBodies));
check('粘连指示器几何：absolute + --nvui-tab-ind-x/y/w/h 驱动 + transition 含 spring 缓动',
    /position:\s*absolute/.test(indicatorBaseBodies)
    && /var\(--nvui-tab-ind-x/.test(indicatorBaseBodies)
    && /var\(--nvui-tab-ind-y/.test(indicatorBaseBodies)
    && /var\(--nvui-tab-ind-w/.test(indicatorBaseBodies)
    && /var\(--nvui-tab-ind-h/.test(indicatorBaseBodies)
    && /transition\s*:[^;]*var\(--nvui-ease-spring\)/.test(indicatorBaseBodies));
check('is-indicator 状态：显示指示器 + 接管选中态（active 按钮透明 + animation:none，无 JS 时回退自身高亮）',
    hasRule('.nvui-tabs.is-indicator .nvui-tabs-indicator', /opacity:\s*1/)
    && hasRule('.nvui-tabs.is-indicator .nvui-tab.is-active', /background:\s*transparent/)
    && hasRule('.nvui-tabs.is-indicator .nvui-tab.is-active', /animation:\s*none/));

// ---- 4.13 v2.1.0 新增：SillyTavern 插件面板布局标准（桌面居中 / 手机底部抽屉） ----
const panelBaseBodies = plainRuleBodies('.nvui-panel').join('\n');
/* v2.7.2：只检查「顶层基础规则」——降级块里的 .nvui-panel 仍应保留 backdrop-filter:none */
const panelTopLevelBodies = joinedBodies(componentRules.filter((r) => r.context.length === 0
    && r.selector.split(',').some((sel) => sel.trim() === '.nvui-panel')));
const panelStructureMissing = [];
/* 面板玻璃底色可由 --nvui-glass-bg 或 token 派生的 color-mix(--nvui-bg) 提供 */
if (!/var\(--nvui-glass-bg\)|color-mix\(in srgb,\s*var\(--nvui-bg\)/.test(panelBaseBodies)) panelStructureMissing.push('玻璃底（--nvui-glass-bg 或 color-mix --nvui-bg）');
/* v2.7.2：玻璃态必须由面板自身的 backdrop-filter 提供（透明面板 + 背后模糊） */
if (!/backdrop-filter\s*:/.test(panelTopLevelBodies)) panelStructureMissing.push('面板自身 backdrop-filter（背后模糊）');
if (!/display:\s*flex/.test(panelBaseBodies)) panelStructureMissing.push('display:flex');
if (!/flex-direction:\s*column/.test(panelBaseBodies)) panelStructureMissing.push('flex-direction:column');
if (!/width:\s*var\(--nvui-panel-w,\s*min\(var\(--nvui-panel-width\),\s*100%\)\)/.test(panelBaseBodies)) panelStructureMissing.push('width:var(--nvui-panel-w, min(--nvui-panel-width,100%))');
if (!/max-height:\s*var\(--nvui-panel-max-h\)/.test(panelBaseBodies)) panelStructureMissing.push('max-height:--nvui-panel-max-h');
check('.nvui-panel 面板容器：玻璃底 + 面板自身 backdrop-filter（背后模糊）+ flex 列 + 固定宽高',
    panelStructureMissing.length === 0, `缺少/违规: ${panelStructureMissing.join(', ')}`);

/* v3.0.0 / C2：按钮组三件套的排版声明必须只有一处来源。
   v2 是四段几乎相同的 flex + gap，改一处要同步四处、行为差异也没人记得住。
   这条断言把「不许再分叉」写进 CI：命中 display:flex + gap 且同时覆盖
   .nvui-actions 与 .nvui-btn-row 的规则必须恰好一条，且两个 footer 也在其中。 */
const btnGroupRules = componentRules.filter((r) => /\.nvui-actions\b/.test(r.selector)
    && /\.nvui-btn-row\b/.test(r.selector)
    && /display:\s*flex/.test(r.body));
check('按钮组排版声明单一来源（.nvui-actions / .nvui-btn-row / 两个 footer 共用一条规则）',
    btnGroupRules.length === 1
    && /\.nvui-panel-footer\b/.test(btnGroupRules[0].selector)
    && /\.nvui-modal-footer\b/.test(btnGroupRules[0].selector)
    && /gap:\s*var\(--nvui-space-2\)/.test(btnGroupRules[0].body),
    `命中 ${btnGroupRules.length} 条`);
check('.nvui-actions 仍是右对齐操作区（零 specificity，下游可覆盖）',
    componentRules.some((r) => /\.nvui-actions\b/.test(r.selector) && /justify-content:\s*flex-end/.test(r.body)));
/* v2.7.2：面板玻璃规则必须提升到 dialog.nvui-tl 作用域，才能在真实 ST 中压过其它扩展内嵌的旧版 kit CSS */
const carrierGlassRule = componentRules.find((r) => /dialog\.nvui-tl\s+\.nvui-panel/.test(r.selector)
    && /color-mix\(in srgb,\s*var\(--nvui-bg\)/.test(r.body)
    && /backdrop-filter\s*:[^;]*blur\(calc\(var\(--nvui-glass-blur\)/.test(r.body));
check('面板玻璃作用域提升（dialog.nvui-tl .nvui-panel：透明底 + 强背后模糊，压过旧扩展副本）',
    !!carrierGlassRule, carrierGlassRule ? '' : '未找到载体作用域的面板玻璃规则');

const PANEL_PARTS = ['.nvui-panel-header', '.nvui-panel-title', '.nvui-panel-actions',
    '.nvui-panel-body', '.nvui-panel-footer', '.nvui-panel-heading'];
const missingPanelParts = PANEL_PARTS.filter((sel) => plainRuleBodies(sel).length === 0);
check('面板分区基础规则：header / title / actions / body / footer / heading 全部存在',
    missingPanelParts.length === 0, `缺少: ${missingPanelParts.join(', ')}`);

check('桌面默认隐藏手机专属元素：.nvui-sheet-handle 与 .nvui-bottom-nav 均 display:none',
    /display:\s*none/.test(plainRuleBodies('.nvui-sheet-handle').join('\n'))
    && /display:\s*none/.test(plainRuleBodies('.nvui-bottom-nav').join('\n')));

const narrowOverlayPanelBodies = joinedBodies(rulesFor('.nvui-overlay.is-panel')
    .filter((r) => r.context.some((c) => /max-width:\s*600px/.test(c))));
const narrowPanelBodies = joinedBodies(rulesFor('.nvui-panel')
    .filter((r) => r.context.some((c) => /max-width:\s*600px/.test(c))));
const mobileDrawerMissing = [];
if (!/align-items:\s*flex-end/.test(narrowOverlayPanelBodies)) mobileDrawerMissing.push('overlay.is-panel 底部对齐 align-items:flex-end');
if (!/padding:\s*0(?:;|\s*$|\s*\n)/.test(narrowOverlayPanelBodies)) mobileDrawerMissing.push('overlay.is-panel padding:0');
if (!/width:\s*100%/.test(narrowPanelBodies)) mobileDrawerMissing.push('panel width:100%');
if (!/max-height:\s*92dvh/.test(narrowPanelBodies)) mobileDrawerMissing.push('panel max-height:92dvh');
if (!/border-radius:\s*var\(--nvui-radius-xl\)\s+var\(--nvui-radius-xl\)\s+0\s+0/.test(narrowPanelBodies)) mobileDrawerMissing.push('panel 仅上圆角');
if (!narrowRules.some((r) => /\.nvui-panel\s*>\s*\.nvui-tabs/.test(r.selector) && /display:\s*none/.test(r.body))) {
    mobileDrawerMissing.push('<=600px 隐藏 panel 顶部 tabs');
}
check('≤600px 手机底部抽屉：overlay.is-panel 底部对齐 + padding:0、panel 100%/92dvh/仅上圆角、隐藏顶部 tabs',
    mobileDrawerMissing.length === 0, `缺少: ${mobileDrawerMissing.join(', ')}`);

const narrowBottomNavBodies = joinedBodies(rulesFor('.nvui-bottom-nav')
    .filter((r) => r.context.some((c) => /max-width:\s*600px/.test(c))));
const bottomNavMissing = [];
if (!/display:\s*flex/.test(narrowBottomNavBodies)) bottomNavMissing.push('bottom-nav display:flex');
if (!/env\(safe-area-inset-bottom\)/.test(narrowBottomNavBodies)) bottomNavMissing.push('safe-area-inset-bottom');
if (!componentRules.some((r) => /\.nvui-bottom-nav-item/.test(r.selector) && /\.is-active/.test(r.selector)
    && /--nvui-accent/.test(r.body))) bottomNavMissing.push('item.is-active 主色');
if (!componentRules.some((r) => /\.nvui-bottom-nav-item/.test(r.selector) && /:focus-visible/.test(r.selector)
    && /outline:\s*var\(--nvui-focus-ring-w\)/.test(r.body))) bottomNavMissing.push('item focus-visible 焦点环 token');
check('≤600px 底部导航：display:flex + safe-area + item 激活态主色 + 焦点环 token',
    bottomNavMissing.length === 0, `缺少: ${bottomNavMissing.join(', ')}`);

const featureRowBodies = joinedBodies(rulesFor('.nvui-switch-row.is-feature'));
const featureRowMissing = [];
if (!/border-left:\s*2px\s+solid\s+var\(--nvui-accent\)/.test(featureRowBodies)) featureRowMissing.push('主色左边条');
if (!/background(?:-color)?\s*:[^;]*var\(--nvui-block-bg\)/.test(featureRowBodies)) featureRowMissing.push('淡底 --nvui-block-bg');
if (!/border-bottom:\s*none/.test(featureRowBodies)) featureRowMissing.push('border-bottom:none');
check('功能行 .nvui-switch-row.is-feature：主色左边条 + 淡底 + 去底边',
    featureRowMissing.length === 0, `缺少: ${featureRowMissing.join(', ')}`);

// ---- 4.14 v2.1.1 打磨：单圈焦点环 / 面板固定尺寸 / 隐藏滚动条 ----
check('.nvui-panel 固定高度：height 走 --nvui-panel-h 变量、回落 --nvui-panel-max-h（折叠展开不改变外框）',
    /(?<![\w-])height:\s*var\(--nvui-panel-h,\s*var\(--nvui-panel-max-h\)\)/.test(plainRuleBodies('.nvui-panel').join('\n')));
const narrowPanelHeightRules = rulesFor('.nvui-panel')
    .filter((r) => r.context.some((c) => /max-width:\s*600px/.test(c)));
check('≤600px 手机抽屉固定高度：height:92dvh 且保留 max-height',
    narrowPanelHeightRules.some((r) => /(?<![\w-])height:\s*92dvh/.test(r.body) && /max-height:\s*92dvh/.test(r.body)));
const inputFocusBodies = joinedBodies(rulesFor('.nvui-input:focus-visible'));
check('输入框聚焦单圈：outline 走 focus-ring token 且规则内无 box-shadow（双描边已删）',
    /outline:\s*var\(--nvui-focus-ring-w\)\s+solid\s+var\(--nvui-focus-ring-color\)/.test(inputFocusBodies)
    && !/box-shadow\s*:/.test(inputFocusBodies));
const panelBodyScrollbarBodies = plainRuleBodies('.nvui-panel-body').join('\n');
const panelBodyScrollbarPseudo = plainRuleBodies('.nvui-panel-body::-webkit-scrollbar').join('\n');
check('.nvui-panel-body 隐藏滚动条但保留滚动：scrollbar-width:none + ::-webkit-scrollbar display:none + overflow-y:auto',
    /scrollbar-width:\s*none/.test(panelBodyScrollbarBodies)
    && /display:\s*none/.test(panelBodyScrollbarPseudo)
    && /overflow-y:\s*auto/.test(panelBodyScrollbarBodies));
const modalBodyScrollbarBodies = plainRuleBodies('.nvui-modal-body').join('\n');
const modalBodyScrollbarPseudo = plainRuleBodies('.nvui-modal-body::-webkit-scrollbar').join('\n');
check('.nvui-modal-body 隐藏滚动条但保留滚动：scrollbar-width:none + ::-webkit-scrollbar display:none + overflow-y:auto',
    /scrollbar-width:\s*none/.test(modalBodyScrollbarBodies)
    && /display:\s*none/.test(modalBodyScrollbarPseudo)
    && /overflow-y:\s*auto/.test(modalBodyScrollbarBodies));

// ---- 4.15 v2.2.0 描边修整：ghost 按钮 / 标签指示器 / 空态去圆角描边 ----
const ghostBodies = joinedBodies(rulesFor('.nvui-btn.is-ghost'));
check('.nvui-btn.is-ghost 无 1px 描边 + 淡底（--nvui-block-bg）',
    !/(?:^|[;{\s])border\s*:/.test(ghostBodies)
    && /background(?:-color)?\s*:[^;]*var\(--nvui-block-bg\)/.test(ghostBodies));
const indicatorV22Bodies = plainRuleBodies('.nvui-tabs-indicator').join('\n');
check('.nvui-tabs-indicator 用 inset 0 -2px 0 accent-line 底部直线强调，且无 1px 内环',
    /box-shadow\s*:[^;]*inset 0 -2px 0 var\(--nvui-accent-line\)/.test(indicatorV22Bodies)
    && !/inset 0 0 0 1px/.test(indicatorV22Bodies)
    && !/(?:^|[;{\s])border\s*:/.test(indicatorV22Bodies));
const emptyBodies = joinedBodies(rulesFor('.nvui-empty'));
check('.nvui-empty 无 dashed 圆角描边（改为淡底 + 居中提示）',
    !/dashed/.test(emptyBodies) && !/(?:^|[;{\s])border\s*:/.test(emptyBodies));

// ==================== 5. 作用域与工程红线 ====================
console.log('\n=== 5. 作用域与工程约定 ===');
const compSelectors = collectSelectors(componentsClean);
const bareSelectors = compSelectors.filter(({ selector }) => {
    if (!selector) return false;
    return !/^(?:\.nvui-|dialog\.nvui-tl|:where\()/.test(selector);
});
check('components.css 无裸元素选择器（.nvui-* / dialog.nvui-tl / :where(...) 作用域）',
    bareSelectors.length === 0, bareSelectors.slice(0, 5).map((s) => s.selector).join(' | '));

const classTokens = new Set();
for (const { selector } of compSelectors) {
    for (const m of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) classTokens.add(m[1]);
}
const badClassTokens = [...classTokens].filter((c) => !c.startsWith('nvui-') && !c.startsWith('is-'));
check('组件选择器中的类名只允许 nvui-* 与 is-* 状态类', badClassTokens.length === 0,
    badClassTokens.join(', '));

/* 触控尺寸下限（2026-11-16，GH-#21）：移动端底部导航项不得低于 40px。
 * 26px 满足 WCAG 2.5.8 AA 的 24px，但低于 iOS 44pt / Material 48dp 的拇指建议；
 * 本项目折中取 40px。改动必须同步本条与 test/host/smoke-panel.js 的实机断言。 */
const navItemRule = (() => {
    const i = componentsClean.indexOf('.nvui-bottom-nav-item {');
    if (i === -1) return '';
    return componentsClean.slice(i, componentsClean.indexOf('}', i) + 1);
})();
check('移动端底部导航项 min-height ≥ 40px（触控尺寸下限，GH-#21）',
    /min-height:\s*40px/.test(navItemRule), navItemRule.slice(0, 90).replace(/\s+/g, ' '));

/* v2.8.0：!important 预算 14 → 18，新增第 ④ 类「force 玻璃」4 条。
 * 18 = ① checkbox 宿主 ::before 压制 2
 *      + ② reduced-motion 降级 5
 *      + ③ 宿主表单控件隔离 7
 *      + ④ v2.8.0 force 玻璃 4（panel/overlay 各 background + backdrop-filter）
 * 只放行下面这张清单里的「属性: 值」，不接受任意 background/color/margin，
 * 防止预算被当成通用放行证而后门式增长。 */
const IMPORTANT_BUDGET = 18;
const impCount = (componentsClean.match(/!important/g) || []).length;
check(`!important 预算 = ${IMPORTANT_BUDGET}（四类有界规则）`, impCount === IMPORTANT_BUDGET,
    `实际 ${impCount}`);

const impDeclsOf = (body) => body
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.includes('!important'))
    .map((s) => s.replace(/\s*!important$/, '').trim());
const impRules = componentRules.filter((r) => /!important/.test(r.body));
const impDeclTotal = impRules.reduce((n, r) => n + impDeclsOf(r.body).length, 0);

const impRmRules = impRules.filter((r) => r.context.some((c) => /prefers-reduced-motion/.test(c)));
/* 先摘出 reduced-motion（它的选择器也含 ::before/::after），再在剩余规则里分 ::before 与表单隔离 */
const impNonRmRules = impRules.filter((r) => !impRmRules.includes(r));
const impBeforeRules = impNonRmRules.filter((r) => /::before/.test(r.selector));
const impForceRules = impNonRmRules.filter((r) => /data-nvui-glass=["']force["']/.test(r.selector));
const impFormRules = impNonRmRules.filter((r) => !impBeforeRules.includes(r) && !impForceRules.includes(r));

const impBeforeDecls = impBeforeRules.flatMap((r) => impDeclsOf(r.body));
const impRmDecls = impRmRules.flatMap((r) => impDeclsOf(r.body));
const impFormDecls = impFormRules.flatMap((r) => impDeclsOf(r.body));
const impForceDecls = impForceRules.flatMap((r) => impDeclsOf(r.body));

check('!important 声明总数与规则解析一致，且四类之外没有遗漏规则',
    impDeclTotal === impCount
    && impBeforeRules.length + impRmRules.length + impFormRules.length + impForceRules.length === impRules.length,
    `decl=${impDeclTotal} / rules=${impRules.length}`);

check('checkbox 宿主隔离只复用既有 ::before 压制（2 条，独立复选框不新增 !important）',
    impBeforeDecls.length === 2
    && impBeforeDecls.every((d) => ['content: none', 'display: none'].includes(d))
    && impBeforeRules.every((r) => /\.nvui-checkbox/.test(r.selector) && /\.nvui-switch-row/.test(r.selector)),
    impBeforeDecls.join(' | '));

check('reduced-motion 降级块保持 5 条 !important',
    impRmDecls.length === 5
    && ['animation-duration: 0.01ms', 'animation-iteration-count: 1', 'animation-delay: 0.01ms',
        'transition-duration: 0.01ms', 'scroll-behavior: auto'].every((d) => impRmDecls.includes(d)),
    impRmDecls.join(' | '));

const FORM_IMPORTANT_ALLOW = {
    'background: var(--nvui-input-bg)': 1,
    'color: var(--nvui-text)': 2,
    'border: none': 1,
    'margin: 0': 1,
    'background: var(--nvui-block-bg)': 1,
    'background: var(--nvui-bg-2)': 1,
};
const impFormDeclCounts = impFormDecls.reduce((acc, d) => { acc[d] = (acc[d] || 0) + 1; return acc; }, {});
check('宿主表单隔离的 7 条 !important 只允许清单内的 token / 明确 reset 值',
    impFormDecls.length === 7
    && Object.keys(impFormDeclCounts).length === Object.keys(FORM_IMPORTANT_ALLOW).length
    && Object.keys(FORM_IMPORTANT_ALLOW).every((k) => impFormDeclCounts[k] === FORM_IMPORTANT_ALLOW[k]),
    JSON.stringify(impFormDeclCounts));

check('v2.8.0 force 玻璃仅 4 条 !important（panel/overlay 各 background + backdrop-filter）',
    impForceRules.length === 2
    && impForceDecls.length === 4
    && impForceDecls.filter((d) => /^background:/.test(d)).length === 2
    && impForceDecls.filter((d) => /^backdrop-filter:/.test(d)).length === 2
    && impForceRules.every((r) => /dialog\.nvui-tl\[data-nvui-glass=["']force["']\]/.test(r.selector)),
    impForceRules.map((r) => r.selector).join(' | '));
check('宿主表单隔离仍以 dialog.nvui-tl + .nvui-panel 为基线选择器（v2.7.0 追加显式 .nvui-form-scope）',
    impFormRules.length > 0
    && impFormRules.every((r) => /dialog\.nvui-tl/.test(r.selector) && /\.nvui-panel/.test(r.selector)),
    impFormRules.map((r) => r.selector.replace(/\s+/g, ' ')).join(' | '));

/* v2.7.0：opt-in .nvui-form-scope 只复用上面 7 条声明。
 * 断言：4 条规则都含 scope；共 8 个 scope 选择器（7 个唯一串，select 基础态在
 * 基础块与 margin 块各出现一次）；每个串必须精确等于允许清单；除这 4 条规则外，
 * components.css 不得再出现任何 .nvui-form-scope 规则（防定位/遮罩/模态副作用）。 */
const scopeFormSelectors = impFormRules
    .flatMap((r) => r.selector.split(',').map((s) => s.trim()))
    .filter((s) => /\.nvui-form-scope\b/.test(s));
const FORM_SCOPE_ALLOWED = [
    '.nvui-form-scope input.nvui-input',
    '.nvui-form-scope select.nvui-input',
    '.nvui-form-scope textarea.nvui-input',
    '.nvui-form-scope input.nvui-input:hover',
    '.nvui-form-scope select.nvui-input:hover',
    '.nvui-form-scope textarea.nvui-input:hover',
    '.nvui-form-scope select.nvui-input option',
];
check('v2.7.0 .nvui-form-scope 只复用 7 条有界隔离声明（8 个精确选择器，无独立规则/副作用）',
    impFormRules.every((r) => /\.nvui-form-scope\b/.test(r.selector))
    && scopeFormSelectors.length === 8
    && [...new Set(scopeFormSelectors)].length === 7
    && scopeFormSelectors.every((s) => FORM_SCOPE_ALLOWED.includes(s))
    && componentRules.every((r) => !/\.nvui-form-scope\b/.test(r.selector) || impFormRules.includes(r)),
    `scope selector=${scopeFormSelectors.length} / ${[...new Set(scopeFormSelectors)].join(' | ')}`);

check('kit CSS/预览页不残留旧 --nv- / novel- 命名（仅 README 迁移表允许）',
    !/--nv-(?!ui)/.test(tokensClean + componentsClean + previewClean)
    && !/novel-/.test(tokensClean + componentsClean + previewClean));

// ==================== 6. 预览页离线可用 ====================
console.log('\n=== 6. 预览页 ===');
check('preview.html 以相对路径引入 tokens.css / components.css',
    /href="\.\/tokens\.css"/.test(preview) && /href="\.\/components\.css"/.test(preview));
const previewExternalRefs = [...preview.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => /^(?:https?:)?\/\//i.test(v));
const previewScriptSrcs = [...preview.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
check('preview.html 离线可用（无 http(s) 外链；允许相对本地脚本 ./nvui-api.js）',
    previewExternalRefs.length === 0
    && previewScriptSrcs.every((src) => /^\.\/[^:]+$/.test(src)));
check('preview.html 根节点带 nvui-scope，且提供深浅主题切换',
    /<body[^>]*class="[^"]*nvui-scope/.test(preview) && preview.includes('nvui-theme-light'));
check('preview.html 演示了弹窗 top-layer 载体 dialog.nvui-tl',
    /<dialog class="nvui-tl"/.test(preview) && /class="nvui-overlay"/.test(preview));
check('preview 含 v2 设计语言关键词（Flat Glass / 扁平玻璃 + 玻璃拟态 + AA）',
    /Flat Glass|扁平玻璃/.test(preview) && /玻璃拟态/.test(preview) && /AA/.test(preview));
check('preview 支持 ?theme=light / ?solid=1 URL 参数（供无头截图）',
    /URLSearchParams|location\.search/.test(preview)
    && /get\(\s*['"]theme['"]\s*\)/.test(preview)
    && /get\(\s*['"]solid['"]\s*\)/.test(preview));
check('preview 顶部提供浅色/实心/重播/弹窗演示控件',
    ['浅色', '实心', '重播', '弹窗'].every((k) => preview.includes(k)));
const previewDialogBlocks = [...preview.matchAll(/<dialog[^>]*class="[^"]*nvui-tl[^"]*"[^>]*>([\s\S]*?)<\/dialog>/g)]
    .map((m) => m[0]);
check('preview 把吐司堆栈放入 dialog.nvui-tl 顶层载体（宿主 transform 红线）',
    previewDialogBlocks.some((block) => block.includes('nvui-toast-stack')));

// ---- v2.0.1 追加：标签页粘连指示器 + 强制播放动效演示 ----
const previewIndicatorMissing = [];
if (!/class="nvui-tabs-indicator"/.test(preview)) previewIndicatorMissing.push('class="nvui-tabs-indicator" 元素');
if (!/--nvui-tab-ind-x/.test(preview)) previewIndicatorMissing.push('--nvui-tab-ind-x');
if (!/is-indicator/.test(preview)) previewIndicatorMissing.push('is-indicator');
if (!/requestAnimationFrame/.test(preview)) previewIndicatorMissing.push('requestAnimationFrame');
if (!/(?:offsetLeft|offsetWidth)/.test(preview)) previewIndicatorMissing.push('offsetLeft/offsetWidth');
if (!/addEventListener\(\s*['"]resize['"]/.test(preview)) previewIndicatorMissing.push('resize 重算');
check('preview 标签页使用粘连指示器结构，并用 JS 同步 --nvui-tab-ind-x / is-indicator（含 resize 重算）',
    previewIndicatorMissing.length === 0, `缺少: ${previewIndicatorMissing.join(', ')}`);

const previewForceMotionMissing = [];
if (!/pv-force-motion/.test(preview)) previewForceMotionMissing.push('pv-force-motion 开关类');
if (!/get\(\s*['"]motion['"]\s*\)/.test(preview)) previewForceMotionMissing.push('?motion=1 URL 参数');
if (!/强制播放/.test(preview)) previewForceMotionMissing.push('「强制播放动效」文案');
check('preview 提供「强制播放动效」演示开关（pv-force-motion）与 ?motion=1 URL 参数',
    previewForceMotionMissing.length === 0, `缺少: ${previewForceMotionMissing.join(', ')}`);

const previewReduceMissing = [];
if (!/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/.test(preview)) previewReduceMissing.push('reduce media query');
if (!/body\.pv-force-motion/.test(preview)) previewReduceMissing.push('body.pv-force-motion 覆盖');
for (const prop of ['animation-duration', 'animation-delay', 'animation-iteration-count', 'transition-duration']) {
    if (!preview.includes(prop)) previewReduceMissing.push(prop);
}
if (!/infinite/.test(preview)) previewReduceMissing.push('循环动画 infinite 恢复');
if (!/(?:减少动态|减少动效|被降级|强制播放)/.test(preview)) previewReduceMissing.push('reduce 提示文案');
check('preview 在系统 reduce 下显示提示，并可用 body.pv-force-motion 覆盖动画/过渡时长（含循环动画恢复）',
    previewReduceMissing.length === 0, `缺少: ${previewReduceMissing.join(', ')}`);

/* 回归（ISSUES.md #14）：preview 的动效重播不得逐节点强制回流；滚动重定位必须按帧合并 */
const replayFn = (preview.match(/function replayMotion\(\)\s*\{[\s\S]*?\n {4}\}/) || [''])[0];
check('preview 动效重播：批量摘类后只做一次全局强制回流（不逐节点读 offsetWidth）',
    replayFn.length > 0
    && /pending\.push/.test(replayFn)
    && /void document\.body\.offsetWidth/.test(replayFn)
    && !/void node\.offsetWidth/.test(replayFn),
    replayFn.slice(0, 160));
const scrollHandler = (preview.match(/function repositionTip\(\)\s*\{[\s\S]*?\n {4}\}/) || [''])[0];
check('preview 滚动重定位用 requestAnimationFrame 合并（每帧至多一次）',
    /requestAnimationFrame/.test(scrollHandler)
    && /repositionRaf/.test(scrollHandler),
    scrollHandler.slice(0, 160));

// ---- v2.1.0 新增：第 18 节插件面板布局标准 demo ----
const previewPanelMissing = [];
if (!/is-panel/.test(preview)) previewPanelMissing.push('overlay.is-panel');
for (const cls of ['nvui-panel-header', 'nvui-panel-title', 'nvui-panel-actions', 'nvui-panel-body',
    'nvui-sheet-handle', 'nvui-bottom-nav', 'nvui-bottom-nav-item']) {
    if (!preview.includes(cls)) previewPanelMissing.push(cls);
}
if (!/get\(\s*['"]panel['"]\s*\)/.test(preview)) previewPanelMissing.push('?panel=1 URL 参数');
check('preview 新增第 18 节插件面板布局 demo（overlay.is-panel / panel 分区 / 底部导航 + ?panel=1 参数）',
    previewPanelMissing.length === 0, `缺少: ${previewPanelMissing.join(', ')}`);

const previewPanelSyncMissing = [];
if (!/setAttribute\(\s*['"]aria-current['"]/.test(preview)) previewPanelSyncMissing.push("setAttribute('aria-current')");
if (!/(?:nvui-bottom-nav-item)/.test(preview)) previewPanelSyncMissing.push('nvui-bottom-nav-item');
if (!/(?:tabpane|aria-selected)/.test(preview)) previewPanelSyncMissing.push('tabpane/aria-selected 同步');
if (!/(?:电脑|桌面)/.test(preview) || !/(?:手机|移动端|底部导航)/.test(preview)) previewPanelSyncMissing.push('电脑/手机排列说明');
check('preview 底部导航与顶部 tabs 用同一份 JS 同步（aria-current + tabpane），并说明电脑/手机排列差异',
    previewPanelSyncMissing.length === 0, `缺少: ${previewPanelSyncMissing.join(', ')}`);

// ---- v2.2.0 新增：第 19 节设计调用 API 演示 ----
const previewApiMissing = [];
if (!/<script[^>]+src="\.\/nvui-api\.js"/.test(preview)) previewApiMissing.push('本地 ./nvui-api.js 脚本');
if (!/NVUI\.createPanel/.test(preview)) previewApiMissing.push('NVUI.createPanel');
if (!/NVUI\.showToast/.test(preview)) previewApiMissing.push('NVUI.showToast');
if (!/get\(\s*['"]api['"]\s*\)/.test(preview)) previewApiMissing.push('?api=1 URL 参数');
if (!/(?:第 ?19|JS API 与 AI)/.test(preview)) previewApiMissing.push('第 19 节 API 说明');
check('preview 第 19 节 API 演示：引入 ./nvui-api.js 并演示 NVUI.createPanel / showToast（?api=1）',
    previewApiMissing.length === 0, `缺少: ${previewApiMissing.join(', ')}`);

// ==================== 7. 文档契约 ====================
console.log('\n=== 7. 规范文档契约 ===');
const REQUIRED_SECTIONS = [
    '## 1. 它是什么 / 不是什么', '## 2. 快速开始', '## 3. 设计原则', '## 4. 配色规范',
    '## 5. 文字与排版', '## 6. 尺寸、间距、圆角、阴影、动效、层级', '## 7. 组件规范',
    '## 8. SillyTavern 宿主兼容红线', '## 9. 命名与工程约定',
    '## 10. 从 novel-stream 迁移对照表', '## 11. 版本管理',
    '## 12. SillyTavern 插件面板布局标准（桌面 / 手机）',
    '## 13. JS API 与 AI 协作指南', '## 14. 许可',
];
const missingSections = REQUIRED_SECTIONS.filter((s) => !readme.includes(s));
check('README 章节完整（1-14 节，新增第 13 章 JS API 与 AI 协作指南 / 许可顺延 14）',
    missingSections.length === 0, missingSections.join(' | '));
const HOST_KEYWORDS = ['dialog', 'inert', 'appearance', '::before', 'safe-area', '100dvh',
    'prefers-reduced-motion', 'pointer-events'];
const missingHostKeywords = HOST_KEYWORDS.filter((k) => !readme.toLowerCase().includes(k.toLowerCase()));
check('README 覆盖 SillyTavern 宿主兼容要点（top-layer/inert/checkbox/safe-area 等）',
    missingHostKeywords.length === 0, missingHostKeywords.join(', '));
const A11Y_KEYWORDS = ['role="dialog"', 'role="tablist"', 'aria-expanded', 'aria-label', 'aria-selected'];
const missingA11y = A11Y_KEYWORDS.filter((k) => !readme.includes(k));
check('README 覆盖可访问性契约（role/aria 语义）', missingA11y.length === 0, missingA11y.join(', '));
check('README 明确「组件禁止硬编码颜色」与「WCAG/对比度」要求',
    readme.includes('禁止硬编码颜色') && /WCAG/.test(readme) && readme.includes('对比度'));
check('README 提供旧实现迁移对照（token 与类名两张映射表）',
    /### 10\.1 Token 映射/.test(readme) && /### 10\.2 组件类名映射/.test(readme));
check('README 声明本目录是独立项目、可整目录移动/复用',
    readme.includes('独立项目') && /(?:整目录|整体)/.test(readme) && /(?:移动|复制)/.test(readme));
check('README 记录独立项目文件结构（package.json / LICENSE / CHANGELOG / test/）',
    ['package.json', 'LICENSE', 'CHANGELOG.md', 'test/test-ui-kit.js'].every((f) => readme.includes(f)));
check('项目内文档不依赖父目录相对链接（可整体移动）',
    !/\]\(\.\.\//.test(readme) && !/href="\.\.\//.test(preview) && !/url\('\.\.\//.test(tokensCss + componentsCss));
const parentJoinRefs = testSrc.split(/\r?\n/).filter((line) =>
    /path\.join\([^)]*'\.\.[^']*'/.test(line) && !/parentJoinRefs|const KIT\b/.test(line));
check('守护测试不读取项目外文件（除项目根外无父目录路径引用）',
    parentJoinRefs.length === 0, parentJoinRefs.join(' | '));

// ---- v2.0.0 文档新增契约 ----
check('README 体现 v2.0.0 设计语言（Flat Glass / 玻璃拟态 / AA 安全玻璃）',
    /Flat Glass|扁平玻璃/.test(readme) && readme.includes('玻璃拟态') && readme.includes('AA 安全'));
check('README 记录玻璃与能力降级（backdrop-filter / prefers-reduced-transparency / forced-colors / nvui-solid）',
    ['backdrop-filter', 'prefers-reduced-transparency', 'forced-colors', 'nvui-solid']
        .every((k) => readme.includes(k)));
check('README 保留并新增 v1.1.0 -> v2.0.0 迁移对照（### 10.3）',
    /### 10\.3 v1\.1\.0\s*(?:→|->)\s*v2\.0\.0 迁移/.test(readme));
check('README 玻璃关键取值与 tokens.css v2.2.0 一致（防文档漂移）',
    readme.includes('rgba(22, 26, 36, 0.64)') && readme.includes('rgba(255, 255, 255, 0.78)'));
check('README 记录 16 个 @keyframes 动效清单',
    EXPECTED_KEYFRAMES.every((n) => readme.includes(n)),
    `缺少: ${EXPECTED_KEYFRAMES.filter((n) => !readme.includes(n)).join(', ')}`);
check('README 新增 ### 10.4 v2.0.0 -> v2.0.1 修订说明',
    /### 10\.4 v2\.0\.0\s*(?:→|->)\s*v2\.0\.1/.test(readme));

// ---- v2.0.1 追加：粘连指示器配方 + 强制播放动效说明 ----
const readmeIndicatorMissing = [];
if (!readme.includes('nvui-tabs-indicator')) readmeIndicatorMissing.push('nvui-tabs-indicator');
if (!readme.includes('--nvui-tab-ind-x')) readmeIndicatorMissing.push('--nvui-tab-ind-x');
if (!readme.includes('is-indicator')) readmeIndicatorMissing.push('is-indicator');
const stretchSettle = (/stretch/i.test(readme) && /settle/i.test(readme))
    || (/拉长/.test(readme) && /(?:收缩|回弹)/.test(readme));
if (!stretchSettle) readmeIndicatorMissing.push('stretch-then-settle 描述');
if (!/(?:无 ?JS|回退)/.test(readme)) readmeIndicatorMissing.push('无 JS 回退说明');
check('README 记录 .nvui-tabs-indicator DOM + JS 配方（stretch-then-settle / --nvui-tab-ind-x / is-indicator / 无 JS 回退）',
    readmeIndicatorMissing.length === 0, `缺少: ${readmeIndicatorMissing.join(', ')}`);
check('README 说明「强制播放动效」演示开关（仅演示；系统 reduce 下默认降级、生产尊重偏好）',
    /强制播放/.test(readme)
    && /prefers-reduced-motion/.test(readme)
    && /(?:降级|减少动态|减少动效)/.test(readme)
    && /(?:演示|demo)/i.test(readme));

// ---- v2.1.0 新增：插件面板布局标准章节 ----
const readmePanelMissing = [];
for (const k of ['600px', '92dvh', 'aria-current', 'safe-area', 'aria-modal', 'aria-labelledby']) {
    if (!readme.includes(k)) readmePanelMissing.push(k);
}
if (!/(?:上圆角|底部抽屉|抽屉)/.test(readme)) readmePanelMissing.push('抽屉/上圆角描述');
if (!/(?:底部导航|bottom-nav)/.test(readme)) readmePanelMissing.push('底部导航说明');
check('README 第 12 章面板布局标准：响应式规则 + 底部导航/抽屉 + a11y 关键词',
    readmePanelMissing.length === 0, `缺少: ${readmePanelMissing.join(', ')}`);

const readmeCountMissing = [];
if (!/(?:110\s*个令牌|令牌[^\n]{0,16}110|110 令牌)/.test(readme)) readmeCountMissing.push('110 令牌计数');
if (!/(?:78\s*个类名|78\s*个组件类|组件类[^\n]{0,16}78|78 类)/.test(readme)) readmeCountMissing.push('78 类计数');
if (!/### 10\.5 v2\.0\.1\s*(?:→|->)\s*v2\.1\.0/.test(readme)) readmeCountMissing.push('### 10.5 v2.0.1 -> v2.1.0');
check('README 更新 110 令牌 / 78 类计数并新增 ### 10.5 v2.0.1 -> v2.1.0 面板布局说明',
    readmeCountMissing.length === 0, `缺少: ${readmeCountMissing.join(', ')}`);
check('README 记录 v2.1.1 打磨（### 10.6 迁移 + 1.5px 单圈焦点环 + 面板固定尺寸/滚动条说明）',
    /### 10\.6 v2\.1\.0\s*(?:→|->)\s*v2\.1\.1/.test(readme)
    && readme.includes('1.5px')
    && /(?:固定尺寸|固定高度|不跳变)/.test(readme)
    && /滚动条/.test(readme));

// ---- v2.2.0 新增：设计调用 API / tokens.json / AI-GUIDE 文档 ----
check('README 记录设计调用 API 与 AI 协作（nvui-api.js / tokens.json / AI-GUIDE.md / NVUI.createPanel）',
    ['nvui-api.js', 'tokens.json', 'AI-GUIDE.md'].every((f) => readme.includes(f))
    && /NVUI\.(?:createPanel|showToast)/.test(readme));
check('README 新增 ### 10.7 v2.1.1 -> v2.2.0 说明',
    /### 10\.7 v2\.1\.1\s*(?:→|->)\s*v2\.2\.0/.test(readme));
check('README 新增 ### 10.8 v2.2.0 -> v2.3.0 载体层级修复说明（含 --nvui-z-layer 与实测真相）',
    /### 10\.8 v2\.2\.0\s*(?:→|->)\s*v2\.3\.0/.test(readme)
    && readme.includes('--nvui-z-layer')
    && readme.includes('#sheld'));
check('AI-GUIDE 硬约束 3 修正为「非模态不进 top layer + 载体自身 z-index 档位」',
    /非模态.*top layer|载体自身/.test(aiGuide) && aiGuide.includes('--nvui-z-layer'));
// 防漂移：载体档位一旦定档，文档/CSS/AI-GUIDE 三处不得再把载体写成 --nvui-z-overlay。
// （v2.3.0 合并时曾出现这类漂移，故加断言守护。）
const carrierTokenDocs = [readme, aiGuide, componentsClean];
check('载体档位在三处文档中一致为 --nvui-z-layer（不得回退成 --nvui-z-overlay）',
    carrierTokenDocs.every((t) => !/载体[^\n]{0,80}--nvui-z-overlay/.test(t))
    && carrierTokenDocs.every((t) => t.includes('--nvui-z-layer')));
check('README 层级表把 --nvui-z-overlay 描述为子浮层档位（不再兼任载体档）',
    /--nvui-z-overlay[^\n]*1000020[^\n]*子浮层/.test(readme));
check('README 新增 13.6 性能实测结论章节（含帧间隔判定与「累计布局耗时 ≠ 卡顿」方法论）',
    /### 13\.6 性能实测结论/.test(readme)
    && readme.includes('帧间隔')
    && readme.includes('累计布局耗时')
    && readme.includes('st-perf-probe.js')
    && readme.includes('st-modal-layer-check.js'));
check('README 新增 13.7 载体与宿主模态章节（说明 inert 根因与主动让位策略）',
    /### 13\.7 载体与宿主模态/.test(readme)
    && readme.includes('inert')
    && readme.includes('is-host-modal')
    && readme.includes('st-carrier-host-modal-check.js'));
check('CSS 提供宿主模态降级态 .is-host-modal（不可点 + 压暗 + 子浮层让位）',
    /dialog\.nvui-tl\.is-host-modal\s*\{[^}]*pointer-events:\s*none/.test(componentsClean)
    && /dialog\.nvui-tl\.is-host-modal\s*\{[^}]*opacity:\s*0?\.35/.test(componentsClean)
    && /\.is-host-modal\s*>\s*\.nvui-overlay[\s\S]*?pointer-events:\s*none/.test(componentsClean));
check('nvui-api 导出三个宿主模态 API（countHostModals / syncHostModalState / getCarrierState）',
    ['countHostModals', 'syncHostModalState', 'getCarrierState']
        .every((k) => new RegExp(`\\b${k}:\\s*${k}\\b`).test(apiSrc)));
check('nvui-api 在 createPanel / showToast / openLayer 中同步宿主模态降级态',
    (apiSrc.match(/syncHostModalState\(\)/g) || []).length >= 3
    && /function installHostModalWatcher/.test(apiSrc));
check('宿主模态降级态不依赖 :modal 之外的选择器，且排除 kit 自身载体（不自我降级）',
    /dialog:modal/.test(apiSrc)
    && /classList\.contains\('nvui-tl'\)\)\s*continue/.test(apiSrc));
check(`版本号全量对齐 v${KIT_VERSION}（package.json / tokens.json / tokens.css / components.css）`,
    pkg.version === KIT_VERSION
    && tokensJson.version === KIT_VERSION
    && tokensCss.includes(`ui-kit v${KIT_VERSION}`)
    && componentsCss.includes(`ui-kit v${KIT_VERSION}`));
// ---- 防模板漂移：st-extension-template/ui-kit/ 下每个资产文件都必须与根目录**逐文件**一致 ----
// 历史教训：早期只校验了 nvui-api.js / components.css / tokens.css 三个文件，
// 漏掉 tokens.json（机器可读镜像），导致副本版本号落后两版、且缺失 --nvui-z-layer
// 这类「只写在 JSON 镜像里、CSS 侧不受影响」的漂移长期无人发现。
// 因此这里改为：逐文件用 crypto 计算 md5 并与根目录比对，失败时给出具体差异提示。
const TPL_KIT = path.join(KIT, 'st-extension-template', 'ui-kit');
const TPL_ASSET_FILES = ['nvui-api.js', 'components.css', 'tokens.css', 'tokens.json'];
const md5Of = (p) => crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
for (const f of TPL_ASSET_FILES) {
    const rootFile = path.join(KIT, f);
    const tplFile = path.join(TPL_KIT, f);
    let detail = '';
    let same = false;
    if (!fs.existsSync(tplFile)) {
        detail = `副本缺失：${tplFile}`;
    } else if (!fs.existsSync(rootFile)) {
        detail = `根目录文件缺失：${rootFile}`;
    } else {
        const rootHash = md5Of(rootFile);
        const tplHash = md5Of(tplFile);
        same = rootHash === tplHash;
        if (!same) {
            detail = `md5 不一致 根=${rootHash} 副本=${tplHash}；`
                + `请用 cp ${f} st-extension-template/ui-kit/${f} 重新对齐`;
        }
    }
    check(`st-extension-template 副本与根目录一致（防模板漂移）：${f}`, same, detail);
}
// 副本 tokens.json 自身的语义自检：版本号必须跟根目录一致，且必须带载体档令牌 --nvui-z-layer
// （该令牌只在 JSON 镜像里丢失时 CSS 侧不会报错，因此需要单独守护）。
{
    const tplJsonPath = path.join(TPL_KIT, 'tokens.json');
    let detail = '';
    let ok = false;
    try {
        const tplJson = JSON.parse(readText(tplJsonPath));
        const versionOk = tplJson.version === KIT_VERSION;
        const layerOk = !!(tplJson.dark && tplJson.dark['--nvui-z-layer']);
        ok = versionOk && layerOk;
        if (!ok) {
            detail = `version=${tplJson.version}(期望 ${KIT_VERSION})；`
                + `--nvui-z-layer=${layerOk ? tplJson.dark['--nvui-z-layer'] : '缺失'}`;
        }
    } catch (e) {
        detail = `解析失败：${e.message}`;
    }
    check('st-extension-template 副本 tokens.json 版本号与 --nvui-z-layer 载体档齐全', ok, detail);
}
check('新增实机脚本 probe/st-carrier-host-modal-check.js 存在',
    fs.existsSync(path.join(KIT, 'test', 'probe', 'st-carrier-host-modal-check.js')));
check('README 排版规范（标题层级不跳级 / 表格列数一致 / 代码围栏配对 / 无连续空行）',
    (() => {
        const lines = readme.split(/\r?\n/);
        const problems = [];
        let inFence = false;
        let headingLevel = 0;
        let table = [];
        const flushTable = () => {
            if (table.length) {
                const counts = new Set(table.map((r) => r[1].split('|').length));
                if (counts.size > 1) problems.push(`L${table[0][0]} 表格列数不一致`);
            }
            table = [];
        };
        lines.forEach((line, idx) => {
            const i = idx + 1;
            if (line.trim().startsWith('```')) { inFence = !inFence; flushTable(); return; }
            if (inFence) return;
            const h = /^(#{1,6}) \S/.exec(line);
            if (h) {
                const lv = h[1].length;
                if (headingLevel && lv > headingLevel + 1) problems.push(`L${i} 标题跳级 h${headingLevel}->h${lv}`);
                headingLevel = lv;
            }
            const st = line.trim();
            if (st.startsWith('|') && st.endsWith('|') && st.split('|').length >= 3) {
                table.push([i, st]);
            } else {
                flushTable();
            }
            if (idx > 0 && line === '' && lines[idx - 1] === '') problems.push(`L${i} 连续空行`);
        });
        flushTable();
        const fences = (readme.match(/^```/gm) || []).length;
        if (fences % 2 !== 0) problems.push('代码围栏未配对');
        return problems.length === 0;
    })());
check('ISSUES.md 待办区已清零（5 项均转为已确认-不修并附实机数据）',
    (() => {
        const issues = readText(path.join(KIT, 'ISSUES.md'));
        // 用「下一个二级标题」切分，不能用字符串 split('## 已确认-不修') ——
        // 待办区的状态列里就含「已确认-不修」，按字符串切会提前截断。
        const m = /## 待办([\s\S]*?)(?=\n## )/.exec(issues);
        const todoSec = m ? m[1] : '';
        const rows = todoSec.split(/\r?\n/).filter((l) => /^\|\s*\d+\s*\|/.test(l));
        return rows.length === 0
            && /已确认-不修/.test(issues)
            && issues.includes('st-perf-tabs-frames.js')
            && issues.includes('st-modal-layer-check.js');
    })());
check('AI-GUIDE.md 覆盖 AI 协作指南关键词（SillyTavern / nvui-api / tokens.json / 提示词 / 验收 / 其它软件）',
    ['SillyTavern', 'nvui-api', 'tokens.json', '提示词', '验收', '其它软件']
        .every((k) => aiGuide.includes(k)));
check('README 文件结构表补充 AUDIT.md', readme.includes('AUDIT.md'));
check('MAINTAINING.md 存在且覆盖提交 / 版本 / Issue 三套流程判据',
    (() => {
        const p = path.join(KIT, 'MAINTAINING.md');
        if (!fs.existsSync(p)) return false;
        const doc = readText(p);
        return ['## 1. 提交规范', '## 2. 版本迭代规范', '## 3. GitHub Issue 维护规范',
            '## 4. 每轮的 Definition of Done', 'fixed-pending-release']
            .every((k) => doc.includes(k));
    })());
check('AUDIT.md 存在且同时覆盖 v1.1.0 与 v2.0.0',
    auditExists && audit.includes('v1.1.0') && audit.includes('v2.0.0'),
    auditExists ? 'AUDIT.md 缺少版本号' : 'AUDIT.md 不存在');
check('CHANGELOG v2.0.0 记录破坏性变更（shadow-accent / 折叠 DOM）与新增（玻璃/动效）',
    /## v2\.0\.0/.test(changelog)
    && changelog.includes('shadow-accent')
    && changelog.includes('nvui-acc-inner')
    && /玻璃/.test(changelog)
    && /动效/.test(changelog)
    && /v1\.1\.0/.test(changelog)
    && /v1\.0\.0/.test(changelog));

const emojiRe = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|\uFE0F/;
const emojiFiles = [
    [FILES.tokens, 'tokens.css'], [FILES.components, 'components.css'],
    [FILES.readme, 'README.md'], [FILES.preview, 'preview.html'],
    [FILES.pkg, 'package.json'], [FILES.changelog, 'CHANGELOG.md'], [FILES.self, 'test/test-ui-kit.js'],
    [FILES.api, 'nvui-api.js'], [FILES.tokensJson, 'tokens.json'], [FILES.aiGuide, 'AI-GUIDE.md'],
];
if (auditExists) emojiFiles.push([FILES.audit, 'AUDIT.md']);
const emojiHits = emojiFiles.filter(([p]) => emojiRe.test(readText(p))).map(([, n]) => n);
check('项目文件不含 emoji', emojiHits.length === 0, emojiHits.join(', '));

const utf8Files = [
    [FILES.tokens, 'tokens.css'], [FILES.components, 'components.css'],
    [FILES.readme, 'README.md'], [FILES.preview, 'preview.html'],
    [FILES.pkg, 'package.json'], [FILES.changelog, 'CHANGELOG.md'], [FILES.self, 'test/test-ui-kit.js'],
    [FILES.api, 'nvui-api.js'], [FILES.tokensJson, 'tokens.json'], [FILES.aiGuide, 'AI-GUIDE.md'],
];
if (auditExists) utf8Files.push([FILES.audit, 'AUDIT.md']);
const bomFiles = utf8Files.filter(([p]) => {
    const raw = fs.readFileSync(p);
    return raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
}).map(([, n]) => `${n}: 含 BOM`);
const replacementFiles = utf8Files.filter(([p]) => readText(p).includes('\uFFFD')).map(([, n]) => `${n}: 含 U+FFFD`);
check('项目文本文件编码干净（UTF-8 无 BOM、无替换字符，防编辑器乱码回归）',
    bomFiles.length === 0 && replacementFiles.length === 0,
    bomFiles.concat(replacementFiles).join(', '));

// ==================== 8. 版本一致性 ====================
console.log('\n=== 8. 版本一致性（独立项目自洽） ===');
const versionRefs = {
    'tokens.css 文件头': tokensCss.includes(`ui-kit v${KIT_VERSION}`),
    'components.css 文件头': componentsCss.includes(`ui-kit v${KIT_VERSION}`),
    'README 标题版本': readme.includes(`版本：**v${KIT_VERSION}**`),
    'CHANGELOG 最新条目': new RegExp(`^## v${KIT_VERSION.replace(/\./g, '\\.')}`, 'm').test(changelog),
    'preview 标题': preview.includes(`UI Kit v${KIT_VERSION}`),
    'preview 页面徽标': preview.includes(`>v${KIT_VERSION}<`),
};
const versionMismatch = Object.entries(versionRefs).filter(([, v]) => !v).map(([k]) => k);
check(`kit 版本 v${KIT_VERSION} 在 6 处声明一致`, versionMismatch.length === 0, versionMismatch.join(', '));
check('测试本身位于项目内（test/test-ui-kit.js）',
    path.resolve(FILES.self) === path.join(KIT, 'test', 'test-ui-kit.js'));

// ==================== 9. 运行时契约（nvui-api.js 行为红线） ====================
/*
 * v2.2.1 起补：此前测试全部是「文本/静态」断言，测不到任何运行时行为，
 * 导致 animationend 冒泡截断退场动画这类真 bug 长期潜伏。
 * 本节用「源码断言 + 轻量 DOM 行为断言」双保险守护关键运行时契约。
 * 需要 DOM 行为的部分在无 DOM 环境自动跳过（不误报失败）。
 */
console.log('\n=== 9. 运行时契约（nvui-api.js 行为红线） ===');

/* --- 9.1 XSS 通道：el() 不得保留 innerHTML 分支 --- */
check('nvui-api: el() 已移除 html/innerHTML 通道（防 XSS）',
    !/innerHTML/.test(apiSrc),
    apiSrc.match(/innerHTML[^\n]*/)?.[0] || '');
check('nvui-api: 文本内容统一走 textContent',
    /textContent\s*=\s*String\(v\)/.test(apiSrc));

/* --- 9.1b 属性白名单（NEW-01 / NEW-20）：el() 不得再接受任意属性名 --- */
check('nvui-api: el() 走属性白名单（拒绝 on* / style / srcdoc 等注入通道）',
    /function attrAllowed\(/.test(apiSrc)
    && /ALLOWED_ATTRS/.test(apiSrc)
    && /lower\.indexOf\('on'\)\s*===\s*0/.test(apiSrc)
    && /lower\s*===\s*'style'/.test(apiSrc)
    && /lower\s*===\s*'srcdoc'/.test(apiSrc),
    apiSrc.match(/function attrAllowed\([^)]*\)[\s\S]{0,600}/)?.[0] || '');
check('nvui-api: el() 白名单外的属性被丢弃而不是透传',
    /!attrAllowed\(k\)/.test(apiSrc)
    && /warn\('el\(\): 已丢弃白名单外的属性/.test(apiSrc));

/* --- 9.1c 图标入参（NEW-14）：非字符串非 Node 不得直接当 DOM 用 --- */
check('nvui-api: iconNode 只接受字符串或真实 Node（避免 appendChild 抛 TypeError）',
    /function iconNode\(/.test(apiSrc)
    && /iconClass\s+instanceof\s+Node/.test(apiSrc)
    && !/if\s*\(typeof iconClass\s*!==\s*'string'\)\s*return iconClass;/.test(apiSrc));

/* --- 9.1d 标签 key 归一化（NEW-02）：非法 key 不得直接拼进 DOM id --- */
check('nvui-api: tabs[].key 经 sanitizeIdPart 归一化后才拼进 DOM id',
    /function sanitizeIdPart\(/.test(apiSrc)
    && /replace\(\/\[\^A-Za-z0-9_-\]\/g,\s*'_'\)/.test(apiSrc)
    && /id\s*\+\s*'-tab-'\s*\+\s*t\.domKey/.test(apiSrc)
    && /id\s*\+\s*'-pane-'\s*\+\s*t\.domKey/.test(apiSrc));
check('nvui-api: 重复 tab key 去重（首个保留，后续追加序号），不静默覆盖面板',
    /domKeySet\.set\(domKey, true\)/.test(apiSrc)
    && /keyMap\.set\(origKey, domKey\)/.test(apiSrc));
check('nvui-api: 面板 id 本身也做归一化（派生子 id 必须合法）',
    /uniqueId\(sanitizeIdPart\(opts\.id/.test(apiSrc));

/* --- 9.1e 焦点兜底（NEW-03）：选择器注入面 + 非法选择器不得抛未捕获异常 --- */
check('nvui-api: focusFallback 走受限解析（纯 #id 用 getElementById，其余 try/catch）',
    /function resolveFocusFallback\(/.test(apiSrc)
    && /getElementById\(sel\.slice\(1\)\)/.test(apiSrc)
    && /try\s*\{[\s\S]{0,200}document\.querySelector\(sel\)[\s\S]{0,120}catch/.test(apiSrc),
    apiSrc.match(/function resolveFocusFallback\([^)]*\)[\s\S]{0,900}/)?.[0] || '');
check('nvui-api: focusFallback 不再裸调 document.querySelector（无 try/catch 的注入面）',
    !/document\.querySelector\(fb\)/.test(apiSrc));

/* --- 9.1f 进度条归一化（NEW-04）：aria-valuenow 与 width 恒一致 --- */
check('nvui-api: progress 初始值与 setValue 共用 normalizeProgressValue（数值自愈）',
    /function normalizeProgressValue\(/.test(apiSrc)
    && /var initial = normalizeProgressValue\(opts\.value\)/.test(apiSrc)
    && /var n = normalizeProgressValue\(v\)/.test(apiSrc)
    && !/aria-valuenow':\s*String\(opts\.value \|\| 0\)/.test(apiSrc));
check('nvui-api: progress 越界/NaN 被钳制到 [0,100]',
    /if\s*\(!isFinite\(n\)\)\s*n\s*=\s*0\s*;/.test(apiSrc)
    && /if\s*\(n\s*<\s*0\)\s*n\s*=\s*0\s*;/.test(apiSrc)
    && /if\s*\(n\s*>\s*100\)\s*n\s*=\s*100\s*;/.test(apiSrc));

/* --- 9.1g 输入类型白名单（NEW-05） --- */
check('nvui-api: inputRow 的 type 走白名单（不在表内回退 text 并告警）',
    /var INPUT_TYPES = \[/.test(apiSrc)
    && /function normalizeInputType\(/.test(apiSrc)
    && /warn\('inputRow\(\): 不支持的 type/.test(apiSrc)
    && !/input\.type = opts\.type === 'number' \? 'number' : 'text';/.test(apiSrc));
check('nvui-api: inputRow 保留 path 伪类型（DOM 仍是 text，样式走 is-path）',
    /var KIT_INPUT_TYPES = \['path', 'textarea'\]/.test(apiSrc)
    && /type === 'path' \? 'text' : type/.test(apiSrc));
check('nvui-api: number 类型的 onChange 回传数字而非字符串',
    /type === 'number'/.test(apiSrc)
    && /opts\.onChange\(isFinite\(n\) \? n : 0\)/.test(apiSrc));
check('nvui-api: inputRow 的 min/max/step 只接受有限数值',
    /isFinite\(Number\(opts\.min\)\)/.test(apiSrc)
    && /isFinite\(Number\(opts\.max\)\)/.test(apiSrc)
    && /isFinite\(Number\(opts\.step\)\)/.test(apiSrc));

/* --- 9.1h 吐司承载层（NEW-24）：关闭后必须能重新打开 --- */
check('nvui-api: ensureToastLayer 命中已有层时会重新 show()（否则第二条起吐司全不可见）',
    /function ensureToastLayer\(\)[\s\S]{0,600}if\s*\(layer\)\s*\{[\s\S]{0,400}if\s*\(!layer\.open\)[\s\S]{0,200}layer\.show\(\)/.test(apiSrc),
    apiSrc.match(/function ensureToastLayer\(\)[\s\S]{0,700}/)?.[0] || '');
check('nvui-api: 吐司退场后不再关闭承载层（避免后续吐司落进 closed dialog）',
    !/layer\.hidden = true;[\s\S]{0,200}layer\.close\(\)/.test(apiSrc));

/* --- 9.1i 调试开关与日志（NEW-19 最小形态） --- */
check('nvui-api: 导出 NVUI.config 调试开关（debug / logger）',
    /config:\s*config/.test(apiSrc)
    && /debug:\s*false/.test(apiSrc)
    && /logger:/.test(apiSrc));
check('nvui-api: 关键路径有可观测日志（debug 级 + 始终输出的 warn/error 级）',
    /function debug\(/.test(apiSrc)
    && /function warn\(/.test(apiSrc)
    && /function error\(/.test(apiSrc)
    && /console\.|logger\./.test(apiSrc));
check('nvui-api: 异常路径必须报错而非静默（installHostModalWatcher 失败走 error 级）',
    /error\('installHostModalWatcher\(\): 观察器不可用/.test(apiSrc));

/* --- 9.1j 观察面收窄（NEW-07）与退场时长令牌化（NEW-17） --- */
check('nvui-api: 宿主模态观察面已收窄（不再全文档 subtree+attributes 观察）',
    !/observer\.observe\(document\.documentElement,\s*\{\s*subtree:\s*true,\s*attributes:\s*true/.test(apiSrc)
    && /hostModalScanObserver\.observe\(document\.documentElement,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/.test(apiSrc),
    apiSrc.match(/function installHostModalWatcher\(\)[\s\S]{0,2200}/)?.[0] || '');
check('nvui-api: 退场兜底时长从 --nvui-duration-base 令牌派生（不再硬编码 260）',
    /function animationFallbackMs\(/.test(apiSrc)
    && /getToken\('--nvui-duration-base'\)/.test(apiSrc)
    && !/setTimeout\(finish,\s*260\)/.test(apiSrc)
    && !/setTimeout\(done,\s*260\)/.test(apiSrc));

/* --- 9.1k 指示器几何（NEW-08）：经 QA 实机证伪，确认「不修」，保持原实现 --- */
check('nvui-api: syncTabsIndicator 保持原 offset* 读法（NEW-08 实机证伪：p95 帧间隔差 0.00ms，不改）',
    /var x = active\.offsetLeft;/.test(apiSrc)
    && /var w = active\.offsetWidth;/.test(apiSrc)
    && /var h = active\.offsetHeight;/.test(apiSrc)
    && !/active\.getBoundingClientRect\(\)/.test(apiSrc));

/* --- 9.1l 空标签 / 非法 active 归一化（NEW-15） --- */
check('nvui-api: active 归一化到确实存在的标签（否则回退第一个）',
    /if\s*\(!matched\)[\s\S]{0,200}matched = tabs\[0\]/.test(apiSrc));
check('nvui-api: addNode 找不到标签时回退到可见面板而非 body（NEW-15）',
    /if \(domKey && panes\.get\(domKey\)\) pane = panes\.get\(domKey\);/.test(apiSrc)
    && /else if \(activeDomNow && panes\.get\(activeDomNow\)\) pane = panes\.get\(activeDomNow\);/.test(apiSrc)
    && /else if \(tabs\.length && panes\.get\(tabs\[0\]\.domKey\)\) pane = panes\.get\(tabs\[0\]\.domKey\);/.test(apiSrc)
    && /if \(!pane\) pane = body;/.test(apiSrc)
    && !/panes\[activeDom\] \|\| body/.test(apiSrc));

/* --- 9.1m QA 实测补强（发现 A / D / E / F） --- */
check('nvui-api: 重复 tab key 去重后加序号（避免 DOM id 重复）',
    /while\s*\(domKeySet\.has\(domKey\)\)\s*\{[\s\S]{0,120}domKey = base \+ '-' \+ seq/.test(apiSrc));
check('nvui-api: 重复 tab key 时对外 key 仍映射到第一个（不静默丢面板）',
    /if\s*\(!keyMap\.has\(origKey\)\)\s*keyMap\.set\(origKey, domKey\)/.test(apiSrc));
check('nvui-api: 原生 input 类型不被塌缩为 text（file/color/date 等保持原类型）',
    /var INPUT_TYPES = \[[\s\S]{0,400}'file'/.test(apiSrc)
    && /var domType = type === 'path' \? 'text' : type/.test(apiSrc));
check('nvui-api: path 伪类型的 DOM 契约为 type="text" + .is-path（与 preview.html 手写 DOM 同构）',
    /input\.setAttribute\('data-nvui-type', type\)/.test(apiSrc)
    && /type === 'path' \? 'text' : type/.test(apiSrc)
    && !/Object\.defineProperty\(input, 'type'/.test(apiSrc)
    && !/get: function \(\) \{ return 'path'; \}/.test(apiSrc));
check('nvui-api: inputRow 的 value 赋值带 try/catch（file 类型会抛 InvalidStateError）',
    /try\s*\{\s*input\.value = opts\.value;\s*\}[\s\S]{0,200}catch/.test(apiSrc));
check('nvui-api: 焦点归还末级兜底落到宿主可见可聚焦元素（绝不掉到 BODY）',
    /function focusFirstVisible\(\)/.test(apiSrc)
    && /isFocusable\(cand\)/.test(apiSrc)
    && /focusFirstVisible\(\);/.test(apiSrc));
check('nvui-api: 面板容器兜底前先判可见性（overlay 隐藏后 focus() 必然失败）',
    /isFocusable\(panel\)/.test(apiSrc));
check('nvui-api: 发现新 dialog 时主动同步宿主模态状态（open 属性早于观察器设置）',
    /if \(sawDialog\) syncHostModalState\(\);/.test(apiSrc));

/* --- 9.1n 追加修复（NEW-09 / NEW-16 / NEW-18 + 原型链隔离） --- */
check('nvui-api: panes / keyMap / domKeySet 用 Map（无原型链 + O(1) 查表，NEW-09）',
    /var panes = new Map\(\)/.test(apiSrc)
    && /var keyMap = new Map\(\)/.test(apiSrc)
    && /var domKeySet = new Map\(\)/.test(apiSrc)
    && /panes\.get\(/ .test(apiSrc));
check('nvui-api: 切 tab 只切换旧/新两个 pane（NEW-09：不再全量遍历）',
    /var prevPane = panes\.get\(prevDom\)/.test(apiSrc)
    && /if \(prevPane && prevPane !== nextPane\) prevPane\.classList\.remove\('is-active'\)/.test(apiSrc)
    && /if \(nextPane\) nextPane\.classList\.add\('is-active'\)/.test(apiSrc)
    && !/Object\.keys\(panes\)\.forEach/.test(apiSrc));
check('nvui-api: 切 tab 前先保存上一个 domKey（否则旧 pane 无法移除 active）',
    /var prevDom = activeDom;/.test(apiSrc)
    && /activeDom = domKey;/.test(apiSrc));
check('nvui-api: destroy() 先 dialog.close() 再摘节点（NEW-16：宿主能收到 close 事件）',
    /function destroy\(\)[\s\S]{0,700}dialog\.close\(\)[\s\S]{0,300}removeChild\(dialog\)/.test(apiSrc));
check('nvui-api: destroy() 把摘除推迟到 close 事件派发之后（NEW-16 残留：document 级委托监听也能收到 close）',
    /* v2.9.0 起监听统一走 on()/off()（B2 活体计数），两种写法都算 */
    /(?:dialog\.addEventListener\('close',\s*onClose\)|on\(dialog,\s*'close',\s*onClose\))/.test(apiSrc)
    && /setTimeout\(remove,\s*0\)/.test(apiSrc)
    /* 兜底路径必须存在：close 事件未派发时也要摘干净，不能让载体节点泄漏在 DOM 里 */
    && /setTimeout\(remove,\s*50\)/.test(apiSrc)
    && /catch \(err\) \{ remove\(\); \}/.test(apiSrc)
    /* 摘除必须幂等：事件与兜底定时器都会触发它 */
    && /var removed = false;/.test(apiSrc)
    && /if \(removed\) return;/.test(apiSrc));
check('nvui-api: 挂载点无效时降级并报错（NEW-18：不再抛 TypeError）',
    /挂载点不可用/.test(apiSrc)
    && /opts\.mount 不是有效节点，已回退到 document\.body/.test(apiSrc)
    && !/\(opts\.mount \|\| document\.body\)\.appendChild\(dialog\)/.test(apiSrc));
check('nvui-api: 挂载动作本身抛错时被吸收并返回 null（NEW-18 补充：异常不得穿透到调用方）',
    /try \{\s*mountNode\.appendChild\(dialog\);\s*\} catch \(err\) \{[\s\S]{0,200}面板挂载失败/.test(apiSrc)
    && /面板挂载失败[\s\S]{0,200}return null;/.test(apiSrc));

/* --- 9.1o 第四轮（NEW-10 / NEW-11 / NEW-12 / NEW-13 / NEW-15 / NEW-20 / NEW-22） --- */
check('nvui-api: getToken 带缓存（NEW-10：不再每次都 getComputedStyle）',
    /var tokenCache = /.test(apiSrc)
    && /function getToken\(name, scope\)[\s\S]{0,700}tokenCache\[key\]/.test(apiSrc)
    && !/function getToken\(name, scope\) \{\s*if \(!isDomAvailable\(\)\) return '';\s*var host = scope \|\| document\.documentElement;\s*return getComputedStyle/.test(apiSrc));
check('nvui-api: 令牌缓存键含 name 与 scope（不同作用域不串味）',
    /var key = name \+ '\|' \+ tokenScopeId\(host\)/.test(apiSrc)
    && /function tokenScopeId\(scope\)/.test(apiSrc));
check('nvui-api: 令牌缓存带签名校验（class / 内联样式变化即重算，不读过期值）',
    /var sig = \(host\.className \|\| ''\)/.test(apiSrc)
    && /if \(hit && hit\.sig === sig\) return hit\.value;/.test(apiSrc));
/* v2.9.0：setTheme 增了 auto 分支后函数体变长（原窗口 900 字符不够），
   且 auto 路径的失效发生在 syncAutoTheme() 里 —— 两处都要断言，否则只测到显式分支。 */
check('nvui-api: setTheme 后主动失效令牌缓存（NEW-10）',
    /function setTheme\([\s\S]{0,2200}invalidateTokenCache\(\);/.test(apiSrc)
    && /function syncAutoTheme\([\s\S]{0,400}invalidateTokenCache\(\);/.test(apiSrc)
    && /function invalidateTokenCache\(\)/.test(apiSrc));
check('nvui-api: 令牌缓存可被宿主手动失效（导出 invalidateTokenCache）',
    /invalidateTokenCache:\s*invalidateTokenCache/.test(apiSrc));
check('nvui-api: NEW-20 无残余 —— 除 el() 的白名单通道外，setAttribute 的属性名全是字面量',
    (apiSrc.match(/setAttribute\(/g) || []).length
    === (apiSrc.match(/setAttribute\('[a-zA-Z-]+'/g) || []).length
        + (apiSrc.match(/setAttribute\(k, String\(v\)\)/g) || []).length,
    (apiSrc.match(/setAttribute\((?!'[a-zA-Z-]+')(?!k, String\(v\))[^)]*\)/g) || []).join(' | '));
check('nvui-api: el() 的属性白名单拒绝 on* / style / srcdoc / formaction（NEW-01 + NEW-20）',
    /function attrAllowed\(key\)/.test(apiSrc)
    && /lower\.indexOf\('on'\) === 0/.test(apiSrc)
    && /lower === 'style'/.test(apiSrc)
    && /'srcdoc'/.test(apiSrc)
    && /'formaction'/.test(apiSrc)
    && /if \(!attrAllowed\(k\)\) \{/.test(apiSrc));

/* preview.html：NEW-11（resize 节流）/ NEW-12（吐司定时器清理） */
const previewNew = readText(FILES.preview);
check('preview.html: resize 监听改 requestAnimationFrame 合并（NEW-11：每帧至多一次）',
    /function scheduleApiIndicatorSync\(\)[\s\S]{0,400}requestAnimationFrame/.test(previewNew)
    && /window\.addEventListener\('resize', scheduleApiIndicatorSync\)/.test(previewNew)
    && !/window\.addEventListener\('resize', function \(\) \{\s*if \(apiPanelCtl && typeof apiPanelCtl\.syncIndicator/.test(previewNew));
check('preview.html: 吐司定时器 id 存在 toast 上并在 dismissToast 里清除（NEW-12）',
    /toast\.__toastTimer = setTimeout\(/.test(previewNew)
    && /if \(toast\.__toastTimer\) \{[\s\S]{0,120}clearTimeout\(toast\.__toastTimer\)/.test(previewNew));

/* components.css：NEW-13（will-change 只加在两条 transform 扫光上） */
const skeletonRuleN13 = (componentsClean.match(/\.nvui-skeleton::after\s*\{[^}]*\}/) || [''])[0];
const progressBarRuleN13 = (componentsClean.match(/\.nvui-progress-bar::after\s*\{[^}]*\}/) || [''])[0];
check('components.css: 骨架屏与进度条扫光加 will-change: transform（NEW-13）',
    /will-change:\s*transform/.test(skeletonRuleN13)
    && /will-change:\s*transform/.test(progressBarRuleN13));
check('components.css: will-change 只用 transform（不滥用），且未新增 !important',
    (componentsClean.match(/will-change:\s*transform/g) || []).length === 2
    && (componentsClean.match(/will-change:/g) || []).length === 2
    && (componentsClean.match(/will-change:[^;]*!important/g) || []).length === 0);

/* st-extension-template/index.js：NEW-22（getSettings 仅本地开发环境暴露） */
const tplIndexSrc = readText(FILES.tplIndex);
check('ST 模板: getSettings 仅在 localhost / 127.0.0.1 暴露（NEW-22）',
    /isLocalDev/.test(tplIndexSrc)
    && /'localhost'/.test(tplIndexSrc)
    && /'127\.0\.0\.1'/.test(tplIndexSrc)
    && /if \(isLocalDev\) \{[\s\S]{0,160}__MY_PLUGIN__\.getSettings/.test(tplIndexSrc));
check('ST 模板: open 保持全量暴露（业务入口不因门禁而失效）',
    /window\.__MY_PLUGIN__ = \{ open: openSettings \}/.test(tplIndexSrc));
check('NEW-22 实机取证脚本存在（本地 / 非本地双场景门禁）',
    fs.existsSync(path.join(KIT, 'test', 'probe', 'st-template-new22-check.js')));
check('CHANGELOG 记录本批次（静态审查批次二 · 9 条中低危项，与 v2.4.0 同版本发布）',
    /静态审查批次二（9 条中低危项）/.test(changelog)
    && /NEW-09/.test(changelog) && /NEW-22/.test(changelog));
check('CHANGELOG 的 path 伪类型描述符合裁决口径（DOM 契约不变，意图由 data-nvui-type 承载）',
    /DOM 契约不变/.test(changelog)
    && /input\.dataset\.nvuiType/.test(changelog)
    && /input\.type` 读出的是真实的 DOM 类型/.test(changelog)
    && !/input\.type\s*变为\s*[`']?path/.test(changelog)
    && !/type\s*=\s*[`']path[`']/.test(changelog));
check('README 记录新增公开导出 invalidateTokenCache（可选，API 速查表已列）',
    /NVUI\.invalidateTokenCache\(\)/.test(readme)
    && /invalidateTokenCache:\s*invalidateTokenCache/.test(apiSrc));

/* --- 9.2 animationend 冒泡防护 --- */
check('nvui-api: closeLayer 的 animationend 校验 event.target（防子动画冒泡截断退场）',
    /function onAnimEnd\(event\)\s*\{[\s\S]{0,200}event\.target\s*!==\s*overlayEl/.test(apiSrc));
check('nvui-api: 吐司 dismiss 的 animationend 校验 event.target',
    /function onAnimEnd\(event\)[\s\S]{0,300}event\.target\s*!==\s*toast/.test(apiSrc));
check('nvui-api: 退场兜底定时器在正常结束时被 clearTimeout（不留悬挂定时器）',
    /clearTimeout\(fallback\)/.test(apiSrc));

/* --- 9.3 document 级监听器泄漏 --- */
check('nvui-api: Esc 走全局单例调度器（不为每个面板挂永久 document 监听器）',
    /escapeStack/.test(apiSrc) && /registerEscapeHandler/.test(apiSrc));
check('nvui-api: 单例调度器在最后一个面板注销后移除全局监听',
    /(?:removeEventListener\('keydown',\s*onEscapeKey\)|off\(document,\s*'keydown',\s*onEscapeKey\))/.test(apiSrc));
/* 反向断言不能用负向前瞻：`\s*` 会回溯到零空格，`(?!onEscapeKey)` 永远成立。
   改为抓出所有 document 级 keydown 的处理函数名再逐个比对。 */
const DOC_KEYDOWN_HANDLERS = (apiSrc.match(/on\(document,\s*'keydown',\s*([A-Za-z_$][\w$]*)/g) || [])
    .map((line) => line.replace(/^[\s\S]*,\s*/, ''));
check('nvui-api: createPanel 不再直接 on(document, "keydown")（document 级只允许单例挂 onEscapeKey）',
    DOC_KEYDOWN_HANDLERS.every((h) => h === 'onEscapeKey'),
    DOC_KEYDOWN_HANDLERS.join(', ') || '(none)');

/* --- 9.4 id 唯一性 --- */
check('nvui-api: 面板 id 走唯一化处理（防重复面板造成 id 冲突与 aria 指向错乱）',
    /uniqueId\(/.test(apiSrc));
check('nvui-api: 唯一化同时检查派生子 id（-layer/-overlay/-title）',
    /base\s*\+\s*'-layer'/.test(apiSrc) && /base\s*\+\s*'-overlay'/.test(apiSrc));

/* --- 9.5 destroy() 与焦点管理 --- */
check('nvui-api: 面板提供 destroy() 清理 DOM 与监听器',
    /destroy:\s*destroy/.test(apiSrc) && /function destroy\(\)/.test(apiSrc));
check('nvui-api: 焦点归还支持 focusFallback 兜底（宿主菜单收起后触发元素不可聚焦）',
    /focusFallback/.test(apiSrc) && /isFocusable/.test(apiSrc));
check('nvui-api: 焦点归还前校验触发元素仍可聚焦',
    /isFocusable\(opener\)/.test(apiSrc));
check('nvui-api: 实现焦点陷阱（focus trap），使 aria-modal 声明成立',
    /FOCUSABLE/.test(apiSrc) && /event\.key\s*!==\s*'Tab'/.test(apiSrc));

/* --- 9.7 v2.5.0 布局持久化与面板头部标准化契约守卫 --- */

/* 9.7a NVUI.clearLayoutState 导出与安全清理契约 */
check('nvui-api: 导出 clearLayoutState 且空参/非法参调用幂等不抛错', (() => {
    if (typeof nvuiApi.clearLayoutState !== 'function') return false;
    try {
        nvuiApi.clearLayoutState();
        nvuiApi.clearLayoutState('');
        nvuiApi.clearLayoutState(null);
        return true;
    } catch {
        return false;
    }
})());

check('nvui-api: clearLayoutState 沙箱前缀 nvui_state_ 且支持 storage.delete 与 storage.set 回退', (() => {
    let deletedKey = null;
    let setKey = null;
    let setVal = 'init';
    nvuiApi.clearLayoutState('test-panel-1', { delete: (k) => { deletedKey = k; } });
    nvuiApi.clearLayoutState('test-panel-2', { set: (k, v) => { setKey = k; setVal = v; } });
    return deletedKey === 'nvui_state_test-panel-1'
        && setKey === 'nvui_state_test-panel-2'
        && setVal === null;
})());

check('nvui-api: clearLayoutState 遇到 storage 抛错时安全吸收不穿透', (() => {
    const orig = nvuiApi.config && nvuiApi.config.logger;
    if (nvuiApi.config) nvuiApi.config.logger = { warn: () => {}, error: () => {}, log: () => {} };
    try {
        nvuiApi.clearLayoutState('err-panel', { delete: () => { throw new Error('storage failure'); } });
        if (nvuiApi.config) nvuiApi.config.logger = orig;
        return true;
    } catch {
        if (nvuiApi.config) nvuiApi.config.logger = orig;
        return false;
    }
})());

check('nvui-api: createPanel 控制器导出 clearLayoutState 实例清理方法',
    /clearLayoutState:\s*persist\.clearLayout/.test(apiSrc));

/* --- v2.6.0：折叠条接管入口（GitHub #11） --- */
/* G-01：accordion 子系统抽出后入口变成 `acc.track`（成员表达式），
 * 这里只断言「控制器上仍导出这两个入口」，不锁定具体实现形态；
 * 行为契约由 test-issue-11-accordion.js 的 18 条 Chromium 回归覆盖。 */
check('nvui-api: createPanel 控制器导出 trackAccordion / adoptAccordions（#11 公开入口）',
    /trackAccordion:\s*[\w$][\w$.]*,/.test(apiSrc)
    && /adoptAccordions:\s*[\w$][\w$.]*,/.test(apiSrc));
check('nvui-api: 接管入口只挂在面板实例上（顶层 factory API 仍为 11 个，不扩张全局导出面）',
    API_FUNCTIONS.length === 11
    && typeof nvuiApi.trackAccordion === 'undefined'
    && typeof nvuiApi.adoptAccordions === 'undefined');
/* 行为契约（默认不绑点击 / 稳定键 / 幂等 / 跨面板边界 / destroy 解绑）由
 * test/test-issue-11-accordion.js 的真实 Chromium 回归覆盖；
 * 这里不做源码字符串镜像断言，避免阻碍内部实现重构。 */
check('#11 浏览器回归脚本存在（test/test-issue-11-accordion.js，真实 DOM 注入场景）',
    fs.existsSync(path.join(KIT, 'test', 'test-issue-11-accordion.js')));

/* 9.7b opts.width 与 720px 黄金尺寸 & Viewport Clamping & 防抖 */
check('nvui-api: 导出 clampPanelLayout 且默认采用 720px 黄金尺寸与 opts.width 自定义支持',
    typeof nvuiApi.clampPanelLayout === 'function'
    && /function clampPanelLayout\(savedSize,\s*savedPos,\s*options\)/.test(apiSrc)
    && /fallbackW\s*=\s*\(options\s*&&[^)]*options\.width/.test(apiSrc)
    && /720/.test(apiSrc));

check('nvui-api: clampPanelLayout 离线/Node 安全（无 DOM 时返回默认安全结构）', (() => {
    const res = nvuiApi.clampPanelLayout();
    return res && res.isMobile === false && res.width === null && res.styleWidth === '';
})());

/* G-01 第二步：持久化子系统已抽成模块级 createPersistence(ctx)。
 * 断言「语义仍在 + 边界已封装」，不再锁定它挂在 createPanel 内部。 */
check('nvui-api: 状态持久化由 createPersistence 封装，内置 250ms 防抖与生命周期 flush 冲刷',
    /function createPersistence\(ctx\)/.test(apiSrc)
    && /PERSIST_DEBOUNCE_MS/.test(apiSrc)
    && /function schedulePersistSave\b/.test(apiSrc)
    && /function flushPersistSave\b/.test(apiSrc)
    && /function cleanup\(\)/.test(apiSrc)
    && /persist\.bootstrap\(\)/.test(apiSrc)
    && /persist\.cleanup\(\)/.test(apiSrc));

/* 9.7c 头部操作流规范排序与 themeToggle / onThemeChange */
check('nvui-api: 头部操作流严格保证 [自定义 actions...] -> [themeToggle] -> [closeBtn] 顺序',
    /actions\.appendChild\(themeToggleBtn\)[\s\S]*actions\.appendChild\(closeBtn\)/.test(apiSrc));

check('nvui-api: 预置 themeToggle 支持日/月图标切换并联动 onThemeChange 与 themeToggle.onThemeChange 回调',
    /themeToggleBtn\s*=\s*el\('button',\s*'nvui-icon-btn nvui-theme-toggle'/.test(apiSrc)
    && /fa-solid fa-sun/.test(apiSrc)
    && /fa-solid fa-moon/.test(apiSrc)
    && /opts\.onThemeChange/.test(apiSrc)
    && /opts\.themeToggle\.onThemeChange/.test(apiSrc));

check('components.css: 包含 .nvui-theme-toggle 平滑过渡与 hover/active 态',
    /\.nvui-theme-toggle/.test(componentsClean)
    && /\.nvui-theme-toggle\s*i\s*\{[^}]*transition:/.test(componentsClean));

/* 9.7d panel.showUpdate 动态接口、XSS 防护与 WAI-ARIA */
check('nvui-api: createPanel 控制器导出 showUpdate 动态点亮接口',
    /showUpdate:\s*updateCtl\.show/.test(apiSrc)
    && /createUpdatePillController\(/.test(apiSrc)
    && /function show\(updateConfig\)/.test(apiSrc));

check('nvui-api: showUpdate 采用 textContent 防 XSS 且 url 校验 isSafeUrl',
    /updatePill\.textContent\s*=\s*labelStr/.test(apiSrc)
    && /isSafeUrl\(urlStr\)/.test(apiSrc));

check('nvui-api: showUpdate 更新胶囊符合 WAI-ARIA 无障碍规范（role="button", tabindex="0", Enter/Space 键盘响应）',
    /role:\s*'button'/.test(apiSrc)
    && /tabindex:\s*'0'/.test(apiSrc)
    && /e\.key\s*===\s*'Enter'/.test(apiSrc));

check('components.css: 包含 .nvui-update-pill 扁平无描边与 --nvui-focus-ring 焦点环样式',
    /\.nvui-update-pill\s*\{/.test(componentsClean)
    && /\.nvui-update-pill:focus-visible\s*\{[^}]*--nvui-focus-ring/.test(componentsClean));

/* --- 9.6 行为级断言（需要 DOM；无 DOM 时跳过） --- */
const hasDom = typeof globalThis.document !== 'undefined' && typeof globalThis.document.createElement === 'function';
if (!hasDom) {
    console.log('[SKIP] 运行时行为断言需要 DOM（当前为 Node 环境，未执行）');
} else {
    // 说明：真正的 DOM 行为验证由 test/st-live-check.js 在真实 SillyTavern 宿主中执行。
    console.log('[SKIP] DOM 行为断言交由 test/st-live-check.js（真实 ST 宿主）执行');
}

/* --- 9.7 复杂度冻结（G-01）：createPanel 不得继续膨胀 --- */
/*
 * 图谱实测：createPanel() 度 67，是全项目唯一枢纽。2026-11-16 P1-1 分七步拆：
 *   第一步：accordion 子系统（15 个函数、283 行）→ createAccordionRegistry(ctx)，
 *           函数体 1433 → 1162 行，嵌套函数 36 → 20 个；
 *   第二步：持久化 / 视口钳制（7 个函数、332 行）→ createPersistence(ctx)，
 *           函数体 1162 → 825 行，嵌套函数 20 → 14 个；
 *   第三步：焦点链（4 个函数、88 行）→ createFocusChain(ctx)，
 *           函数体 825 → 737 行，嵌套函数 14 → 10 个；
 *   第四步：标签切换（2 个函数、54 行）→ createTabController(ctx)，并让该 factory
 *           独占 activeDom，函数体 737 → 688 行，嵌套函数 10 → 8 个；
 *   第五步：更新胶囊（1 个函数 + 3 份状态、95 行）→ createUpdatePillController(ctx)，
 *           函数体 688 → 601 行，嵌套函数 8 → 7 个；
 *   第六步：节点写入（2 个函数、62 行）→ createPaneWriter(ctx)，
 *           函数体 601 → 569 行，嵌套函数 7 → 5 个；
 *   第七步：玻璃模式（1 个函数 + 4 份状态、40 行）→ createGlassController(ctx)，
 *           函数体 569 → 531 行，嵌套函数 5 → 4 个。
 * 剩余 3 个嵌套函数（openPanel / closePanel / destroy）是面板对外的生命周期契约，
 * 抽取需要 15 项能力的 ctx，耦合会重于收益，故**到此为止**（见 ISSUES.md G-01）。
 * 阈值随重构下调，**只允许降不允许升**：需要新逻辑时先抽 factory，而不是放宽本条。
 * 27 个导出成员已由 test/test-api-surface.js 的 EXPECTED_EXPORTS 冻结，此处不重复断言。
 */
const CREATE_PANEL_MAX_LINES = 531;
const apiLines = apiSrc.split('\n');
const cpStart = apiLines.findIndex((l) => /^\s*function createPanel\(/.test(l));
const cpEnd = cpStart < 0 ? -1
    : apiLines.findIndex((l, i) => i > cpStart && l.startsWith('    /*') && l.includes('吐司'));
const cpLineCount = cpEnd > cpStart ? cpEnd - cpStart : -1;
check('nvui-api: createPanel() 函数体不超过复杂度冻结上限（防单函数继续膨胀）',
    cpStart >= 0 && cpEnd > cpStart && cpLineCount <= CREATE_PANEL_MAX_LINES,
    `实测 ${cpLineCount} 行 / 上限 ${CREATE_PANEL_MAX_LINES} 行（L${cpStart + 1}–L${cpEnd}）`,
    true);

// ==================== 10. ST 扩展模板自洽 ====================
console.log('\n=== 10. ST 扩展模板自洽 ===');
const TPL = path.join(KIT, 'st-extension-template');
const tplFiles = {
    manifest: path.join(TPL, 'manifest.json'),
    index: path.join(TPL, 'index.js'),
    style: path.join(TPL, 'style.css'),
    api: path.join(TPL, 'ui-kit', 'nvui-api.js'),
    tokens: path.join(TPL, 'ui-kit', 'tokens.css'),
    components: path.join(TPL, 'ui-kit', 'components.css'),
};
const tplMissing = Object.entries(tplFiles).filter(([, p]) => !fs.existsSync(p)).map(([, n]) => n);
check('ST 模板目录完整（manifest.json / index.js / style.css / ui-kit/ 运行时）',
    tplMissing.length === 0, tplMissing.join(', '));

if (tplMissing.length === 0) {
    const tplManifest = JSON.parse(fs.readFileSync(tplFiles.manifest, 'utf8'));
    const tplIndex = readText(tplFiles.index);
    const tplStyle = readText(tplFiles.style);

    check('ST 模板 manifest 含 ST 必需字段（display_name/js/css/version/author/hooks）',
        !!(tplManifest.display_name && tplManifest.js && tplManifest.css
            && tplManifest.version && tplManifest.author && tplManifest.hooks));
    check('ST 模板 manifest 声明 loading_order 与 hooks.activate',
        typeof tplManifest.loading_order === 'number' && typeof tplManifest.hooks?.activate === 'string');
    check('ST 模板 index.js 以 ES Module 导入宿主上下文',
        /from '\.\.\/\.\.\/\.\.\/extensions\.js'/.test(tplIndex));
    check('ST 模板 index.js 导入 NVUI 运行时（相对路径 ./ui-kit/nvui-api.js）',
        /import '\.\/ui-kit\/nvui-api\.js'/.test(tplIndex));
    check('ST 模板 index.js 使用 extension_settings 模块导出（非 window 全局）',
        /extension_settings as extensionSettings/.test(tplIndex)
        && !/ctx\.extension_settings\s*\?\?\s*window\.extension_settings/.test(tplIndex));
    check('ST 模板 index.js 导出 manifest hooks 声明的 init',
        /export function init\(\)/.test(tplIndex));
    check('ST 模板 index.js 设置落盘走 saveSettingsDebounced',
        /saveSettingsDebounced/.test(tplIndex));
    check('ST 模板 index.js 声明焦点归还兜底 focusFallback',
        /focusFallback/.test(tplIndex));
    check('ST 模板 style.css 顶部 @import 引入 kit 令牌与组件（且在所有规则之前）',
        /@import url\('\.\/ui-kit\/tokens\.css'\);/.test(tplStyle)
        && /@import url\('\.\/ui-kit\/components\.css'\);/.test(tplStyle)
        && tplStyle.indexOf('@import') < tplStyle.search(/[^\s@][^\n]*\{/));
    check('ST 模板 style.css 不硬编码颜色字面量',
        !/#[0-9a-fA-F]{3,8}\b/.test(tplStyle.replace(/\/\*[\s\S]*?\*\//g, '')));
    check('ST 模板内嵌的 nvui-api.js 与仓库根版本一致（防模板漂移）',
        readText(tplFiles.api) === apiSrc);
    check('README 记录 ST 扩展模板目录与 focusFallback / destroy 新增能力',
        readme.includes('st-extension-template')
        && readme.includes('focusFallback')
        && readme.includes('destroy()'));
    check('AI-GUIDE 记录 ST 扩展模板与焦点归还兜底',
        readText(FILES.aiGuide).includes('st-extension-template')
        && readText(FILES.aiGuide).includes('focusFallback'));
}

// ==================== 汇总 ====================
console.log(`\n=== UI Kit 规范测试结果: 通过 ${pass}, 失败 ${fail} ===`);
if (fail > 0) {
    console.error('UI Kit 规范存在漂移/违规，请先修复再提交。');
    process.exit(1);
}
console.log('UI Kit 规范与实现、预览、文档三方一致，宿主兼容红线全部在位。');
