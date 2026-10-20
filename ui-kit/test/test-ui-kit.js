/**
 * SillyTavern UI Kit v2.2.0「Flat Glass」· 规范守护测试（独立项目）
 * 运行方式（在本目录下）: node test/test-ui-kit.js（或 npm test）
 *
 * 本文件只读取本项目内的文件，不依赖任何外部仓库/父目录，因此
 * 整个 ui-kit 目录可以被任意移动后直接运行。
 *
 * 覆盖：
 *  0) 项目文件结构、package.json 版本/元数据（2.2.0 + Flat Glass）；
 *  1) token 完整性：CORE_TOKENS 显式登记 tokens.css 全部令牌（防漏登记/防幽灵/防僵尸），
 *     深色 109 / 浅色覆盖 47，命名合法，README 全覆盖；
 *  2) 配色规范：组件禁用硬编码颜色、颜色声明走 token、深/浅主题 WCAG AA、
 *     核心 token 金标准逐值锁定，以及 v2 新增的「玻璃 AA 合成对比度」验算
 *     （sRGB 逐通道 blend：宿主最坏情况 -> overlay-bg -> glass-bg / glass-bg-strong）；
 *  3) 组件清单：components.css / preview.html / README.md 三方覆盖（78 个类名）；
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
 *  5) 作用域红线：无裸元素选择器、类名前缀、!important 数量与白名单；
 *  6) 预览页离线可用、深浅/实心/动效/API 演示、URL 参数（?theme=light / ?solid=1 / ?panel=1 / ?api=1）；
 *  7) 文档契约：14 章节、宿主/可访问性要点、v2 设计语言、10.3-10.7 迁移、面板布局标准、JS API/AI 指南、AUDIT.md、取值防漂移；
 *  8) 版本与包信息自洽（六处一致，可独立发布/移动）。
 */

const fs = require('fs');
const path = require('path');

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
check('package.json 版本为合法 semver（2.2.0）',
    /^2\.2\.0$/.test(String(KIT_VERSION)), String(KIT_VERSION));
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
    'progress', 'openLayer', 'closeLayer', 'getToken', 'setTheme'];
const missingApiFunctions = API_FUNCTIONS.filter((fn) => !nvuiApi || typeof nvuiApi[fn] !== 'function');
check('nvui-api.js 导出设计调用 API 齐全（10 个函数）且 version 与 kit 一致',
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
 * CORE_TOKENS：tokens.css v2.2.0 全部 109 个令牌的「显式固化清单」。
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
    '--nvui-panel-width', '--nvui-panel-max-h', '--nvui-z-floating',
    '--nvui-z-overlay', '--nvui-z-tooltip',
];
const CORE_SET = new Set(CORE_TOKENS);

check('CORE_TOKENS 显式登记 tokens.css 全量令牌（109 个且无重复）',
    CORE_TOKENS.length === 109 && CORE_SET.size === 109,
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
check('tokens.json 与 tokens.css 解析结果逐值一致（dark 109 / light 47 覆盖）',
    !!tokensJson.dark && Object.keys(tokensJson.dark).length === 109
    && !!tokensJson.light && Object.keys(tokensJson.light).length === 47
    && tokensJson.version === KIT_VERSION
    && tokensJsonDrift.length === 0,
    tokensJsonDrift.slice(0, 6).join(' | '));

const usedVars = new Set([...componentsClean.matchAll(/var\(\s*(--nvui-[\w-]+)/g)].map((m) => m[1]));
/**
 * JS 运行时写入的几何变量（契约 §13.5.1：由 JS 计算标签位置后 setProperty 写入），
 * 不是设计令牌，不进 tokens.css / CORE_TOKENS，因此不参与「必须有定义」检查。
 */
const RUNTIME_VARS = new Set([
    '--nvui-tab-ind-x', '--nvui-tab-ind-y', '--nvui-tab-ind-w', '--nvui-tab-ind-h',
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
    // v2.1.0 插件面板尺寸令牌（桌面居中面板）
    '--nvui-panel-width': '880px',
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
    'nvui-scope', 'nvui-sr-only', 'nvui-overlay', 'nvui-modal', 'nvui-modal-header',
    'nvui-modal-title', 'nvui-modal-ver', 'nvui-modal-actions', 'nvui-modal-body', 'nvui-modal-footer',
    'nvui-icon-btn', 'nvui-btn', 'nvui-btn-row', 'nvui-switch-row', 'nvui-input-row', 'nvui-input',
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
    'nvui-progress', 'nvui-progress-bar', 'nvui-skeleton', 'nvui-status-dot',
    'nvui-fade-in', 'nvui-slide-up', 'nvui-pop-in', 'nvui-stagger', 'nvui-pulse',
    // v2.1.0 新增 10 个类名：SillyTavern 插件面板布局标准（契约 §14）
    'nvui-panel', 'nvui-panel-header', 'nvui-panel-title', 'nvui-panel-actions', 'nvui-panel-body',
    'nvui-panel-footer', 'nvui-panel-heading', 'nvui-sheet-handle', 'nvui-bottom-nav', 'nvui-bottom-nav-item',
];
check('COMPONENT_CLASSES 清单为 v2.2.0 的 78 个类名（53 保留 + 14 v2 新增 + 1 粘连指示器 + 10 面板布局）',
    COMPONENT_CLASSES.length === 78 && new Set(COMPONENT_CLASSES).size === 78,
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
const panelStructureMissing = [];
if (!/background(?:-color)?\s*:[^;]*var\(--nvui-glass-bg\)/.test(panelBaseBodies)) panelStructureMissing.push('玻璃底 --nvui-glass-bg');
if (!/backdrop-filter\s*:/.test(panelBaseBodies)) panelStructureMissing.push('backdrop-filter');
if (!/display:\s*flex/.test(panelBaseBodies)) panelStructureMissing.push('display:flex');
if (!/flex-direction:\s*column/.test(panelBaseBodies)) panelStructureMissing.push('flex-direction:column');
if (!/width:\s*min\(var\(--nvui-panel-width\),\s*100%\)/.test(panelBaseBodies)) panelStructureMissing.push('width:min(--nvui-panel-width,100%)');
if (!/max-height:\s*var\(--nvui-panel-max-h\)/.test(panelBaseBodies)) panelStructureMissing.push('max-height:--nvui-panel-max-h');
check('.nvui-panel 面板容器：玻璃表面 + flex 列 + width:min(--nvui-panel-width,100%) + max-height:--nvui-panel-max-h',
    panelStructureMissing.length === 0, `缺少: ${panelStructureMissing.join(', ')}`);

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
check('.nvui-panel 固定高度：height:var(--nvui-panel-max-h)（折叠展开不改变外框）',
    /(?<![\w-])height:\s*var\(--nvui-panel-max-h\)/.test(plainRuleBodies('.nvui-panel').join('\n')));
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
    return !/^(?:\.nvui-|dialog\.nvui-tl)/.test(selector);
});
check('components.css 无裸元素选择器（全部 .nvui-* / dialog.nvui-tl 作用域）',
    bareSelectors.length === 0, bareSelectors.slice(0, 5).map((s) => s.selector).join(' | '));

const classTokens = new Set();
for (const { selector } of compSelectors) {
    for (const m of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) classTokens.add(m[1]);
}
const badClassTokens = [...classTokens].filter((c) => !c.startsWith('nvui-') && !c.startsWith('is-'));
check('组件选择器中的类名只允许 nvui-* 与 is-* 状态类', badClassTokens.length === 0,
    badClassTokens.join(', '));

const importantCount = (componentsClean.match(/!important/g) || []).length;
check('!important 数量受控（<= 8，仅宿主隔离 + 动效降级）', importantCount <= 8,
    `实际 ${importantCount}`);
const importantLines = componentsClean.split(/\r?\n/).filter((l) => l.includes('!important'));
const badImportantLines = importantLines.filter((l) =>
    !/(::before|content:|display:|animation-|animation-delay|transition-|scroll-behavior)/.test(l));
check('!important 只出现在宿主 ::before 隔离与 reduced-motion 降级声明上',
    badImportantLines.length === 0, badImportantLines.slice(0, 3).join(' | '));

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
if (!/(?:109\s*个令牌|令牌[^\n]{0,16}109|109 令牌)/.test(readme)) readmeCountMissing.push('109 令牌计数');
if (!/(?:78\s*个类名|78\s*个组件类|组件类[^\n]{0,16}78|78 类)/.test(readme)) readmeCountMissing.push('78 类计数');
if (!/### 10\.5 v2\.0\.1\s*(?:→|->)\s*v2\.1\.0/.test(readme)) readmeCountMissing.push('### 10.5 v2.0.1 -> v2.1.0');
check('README 更新 109 令牌 / 78 类计数并新增 ### 10.5 v2.0.1 -> v2.1.0 面板布局说明',
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
check('AI-GUIDE.md 覆盖 AI 协作指南关键词（SillyTavern / nvui-api / tokens.json / 提示词 / 验收 / 其它软件）',
    ['SillyTavern', 'nvui-api', 'tokens.json', '提示词', '验收', '其它软件']
        .every((k) => aiGuide.includes(k)));
check('README 文件结构表补充 AUDIT.md', readme.includes('AUDIT.md'));
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

// ==================== 汇总 ====================
console.log(`\n=== UI Kit 规范测试结果: 通过 ${pass}, 失败 ${fail} ===`);
if (fail > 0) {
    console.error('UI Kit 规范存在漂移/违规，请先修复再提交。');
    process.exit(1);
}
console.log('UI Kit 规范与实现、预览、文档三方一致，宿主兼容红线全部在位。');
