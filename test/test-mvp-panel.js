/**
 * MVP 面板装配与交互回归测试（v2.0.0 · NVUI Kit 面板）
 * 运行方式: NODE_PATH=<node_modules 目录> node test/test-mvp-panel.js
 *   （例：NODE_PATH=C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules node test/test-mvp-panel.js）
 *
 * 覆盖 Spec §9 的 AC-09 ~ AC-13、AC-15、AC-16，以及 AC-08 的面板反馈部分：
 *   AC-09 面板结构：dialog.nvui-tl > overlay.is-panel > .nvui-panel，非模态 show()，根带 nvui-scope；
 *   AC-10 标签同步：点击 / 方向键 / 底部导航切 tab，tabs、底部导航、tabpane 的
 *        is-active/aria-selected/aria-current/tabindex 同步，且不重建 DOM（节点同一性 + 输入不丢）；
 *   AC-11 焦点：打开焦点移入面板，关闭归还触发元素，Tab / Shift+Tab 在面板内循环不逃逸；
 *   AC-12 关闭四路：Esc / 遮罩 / 关闭钮 / ghost 关闭，退场后隐藏并归还焦点；含打开后 400ms 防误触守卫；
 *   AC-13 开合持久化：展开/收起后关闭再打开恢复上次状态（默认全收起）；
 *   AC-15 计数：状态行显示「第 N 章」，切聊天（含四态文案）重算；
 *   AC-16 魔法棒入口：#extensionsMenu 内项 + 副标 + 点击打开；
 *   AC-08 导出反馈：Blob 下载（BOM/文件名/章节标题）、状态行 is-success、toast、0 章时不下载只警告。
 *
 * 实现方式与 v1.x 的 test-settings-tabs.js 同模式：playwright-core + 本机 Edge，
 * 页内加载 vendor 三件套（tokens.css/components.css/nvui-api.js 经 style.css/script 引入），
 * 从 index.js 抽取真实面板函数执行（非手抄副本），断言全部走真实计算样式与真实事件派发。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.js'), 'utf8');

let playwright = null;
try {
    playwright = require('playwright-core');
} catch (e) {
    try { playwright = require('playwright'); } catch (e2) { playwright = null; }
}
if (!playwright) {
    console.log('[SKIP] 未安装 playwright-core / playwright，跳过 MVP 面板测试');
    console.log('       本地要跑：NODE_PATH=<node_modules 目录> node test/test-mvp-panel.js');
    process.exit(0);
}

const BROWSERS = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];
const executablePath = BROWSERS.find((p) => fs.existsSync(p));
if (!executablePath) {
    console.log('[SKIP] 未找到 Edge / Chrome，跳过 MVP 面板测试');
    process.exit(0);
}

let faCssPath = null;
try { faCssPath = require.resolve('@fortawesome/fontawesome-free/css/all.min.css'); } catch (e) { faCssPath = null; }
const faLink = faCssPath ? `<link rel="stylesheet" href="file:///${faCssPath.replace(/\\/g, '/')}">` : '';
const faFallback = faCssPath ? '' : `
.fa-solid, .fa-regular, .fa-brands { display:inline-block; width:1em; height:1em; background:currentColor; opacity:.8; border-radius:2px; vertical-align:middle; }
`;

/* ---------- 从 index.js 抽取真实实现（函数 + 常量对象） ---------- */
function extractFn(name) {
    const m = src.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
    return m ? m[0] : `/* ${name}: 缺失 */`;
}
function extractConstObj(name) {
    const m = src.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`));
    return m ? m[0] : `const ${name} = {};`;
}

const FNS = [
    'parseTagList', 'cleanNovelText', 'getCleanMessageSig', 'getCleanedMessage',
    'chatHasUserMessage', 'computeChapters', 'computeChapterMap',
    'sanitizeFilename', 'getAccountPrefix', 'getBookTitle', 'getBookFileName',
    'buildNovelText', 'composeNovelExport', 'getCurrentChatLog',
    'faIcon', 'createPanelHeading', 'createStatusLineRow', 'createSegmented', 'createTagField',
    'bindPanelFocusTrap', 'bindPanelArrowKeys', 'guardOverlayClick', 'buildNovelPanel',
    'formatExportTime', 'updateExportStatusLine', 'exportNovelText', 'applyNovelUIRefresh',
    'injectWandEntry', 'syncWandEntryState'
].map(extractFn).join('\n\n');

const PAGE_SRC = [
    extractConstObj('DEFAULT_SETTINGS'),
    'const cleanTextCache = { sig: \'\', map: new Map() };',
    'const INLINE_TAGS = new Set([\'b\', \'i\', \'u\', \'s\', \'em\', \'strong\', \'span\', \'sub\', \'sup\', \'small\', \'del\', \'mark\']);',
    FNS
].join('\n\n');

/* ---------- 页内装配脚本（桩 = 酒馆模块边界，其余全是真源码） ---------- */
const BOOTSTRAP = `
const __settings = { ...DEFAULT_SETTINGS };
let __savedCount = 0, __refreshCount = 0, __exportCount = 0;
const __downloads = [], __blobParts = [];
// Chromium 的 Blob.text() 按 WHATWG UTF-8 decode 会剥离 BOM（EF BB BF），
// 故在 Blob 构造层捕获 parts[0] 字符串验证 BOM 与正文（字节层 BOM 仍随下载落盘）
const __OrigBlob = window.Blob;
window.Blob = function Blob(parts, opts) {
    if (parts && typeof parts[0] === 'string') __blobParts.push(parts[0]);
    return new __OrigBlob(parts, opts);
};
window.Blob.prototype = __OrigBlob.prototype;
URL.createObjectURL = function () { return 'blob:novel-test'; };
URL.revokeObjectURL = function () {};
HTMLAnchorElement.prototype.click = function () { __downloads.push({ name: this.download, href: this.href }); };

// 酒馆模块导入在页内以桩注入（ESM 活绑定语义由 index.js 自身保证，这里只提供取值）
const chat_raw = null;
const characters_raw = [];
const this_chid_raw = undefined;
const ctx = { chat: __chatLog(), characters: [{ name: '艾莉丝' }], this_chid: 0, chatMetadata: { title: '远征探索' } };
function __chatLog() {
    return [
        { is_user: true, name: '你', mes: '我们该出发了。' },
        { is_user: false, name: '艾莉丝', mes: '<status>HP: 100</status>清晨的微风穿过树林，艾莉丝背上行囊。' },
        { is_user: false, name: '艾莉丝', mes: '远处的钟声敲了七下。' }
    ];
}

// 模块级状态（与 index.js 同名同形）
let novelPanel = null;
let uiRefs = {};
let lastExport = { fileName: '', chapterCount: 0, time: null };
let lastChatLogRef = null;
function getSettings() { return __settings; }
function saveSettingsDebounced() { __savedCount++; }

const built = buildNovelPanel({
    settings: __settings,
    defaultExcludeTags: DEFAULT_SETTINGS.exclude_tags,
    save: function () { __savedCount++; },
    refreshStatus: function () { __refreshCount++; },
    onExport: function () { __exportCount++; }
});
novelPanel = built.panel;
uiRefs = built.refs;

function focusList() {
    return Array.prototype.slice.call(novelPanel.panel.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return el.offsetParent !== null; });
}
function keyId(el) { return el.id.replace(/^novel_stream_panel-(layer|overlay|tab|pane|title)-?/, ''); }

window.__api = {
    settings: function () { return JSON.parse(JSON.stringify(__settings)); },
    savedCount: function () { return __savedCount; },
    refreshCount: function () { return __refreshCount; },
    exportCount: function () { return __exportCount; },

    /* ---- AC-09 结构 ---- */
    structure: function () {
        const dialog = document.querySelector('dialog.nvui-tl');
        const overlay = dialog && dialog.querySelector('.nvui-overlay.is-panel');
        const panel = overlay && overlay.querySelector('.nvui-panel');
        const titleEl = panel && document.getElementById(panel.getAttribute('aria-labelledby'));
        return {
            hasDialog: !!dialog,
            overlayIsChild: !!overlay && overlay.parentElement === dialog,
            panelIsChild: !!panel && panel.parentElement === overlay,
            panelRole: panel && panel.getAttribute('role'),
            ariaModal: panel && panel.getAttribute('aria-modal'),
            titleText: titleEl && titleEl.textContent.trim(),
            scoped: dialog.classList.contains('nvui-scope'),
            singleOverlay: document.querySelectorAll('.nvui-overlay').length,
            footerBtns: Array.from(document.querySelectorAll('.nvui-panel-footer .nvui-btn')).map(function (b) {
                return { label: b.textContent.trim(), variant: b.className.replace('nvui-btn', '').trim() };
            }),
            actionBtnLabel: document.querySelector('.nvui-panel-actions .nvui-icon-btn').getAttribute('aria-label'),
            closeBtnLabel: document.querySelector('.nvui-panel-header .nvui-icon-btn[aria-label="关闭面板"]') ? '关闭面板' : ''
        };
    },
    openState: function () {
        const dialog = document.querySelector('dialog.nvui-tl');
        const overlay = document.querySelector('.nvui-overlay.is-panel');
        return {
            open: dialog.open,
            modal: dialog.matches(':modal'),
            hidden: overlay.hidden,
            closing: overlay.classList.contains('is-closing')
        };
    },
    open: function () { novelPanel.open(); },
    close: function () { novelPanel.close(); },

    /* ---- AC-10 标签同步 ---- */
    tabKeys: function () { return Array.from(document.querySelectorAll('.nvui-tab')).map(keyId).join(','); },
    paneKeys: function () { return Array.from(document.querySelectorAll('.nvui-tabpane')).map(keyId).join(','); },
    activeTab: function () { const t = document.querySelector('.nvui-tab.is-active'); return t && keyId(t); },
    activePane: function () { const p = document.querySelector('.nvui-tabpane.is-active'); return p && keyId(p); },
    tabAria: function () {
        return Array.from(document.querySelectorAll('.nvui-tab')).map(function (t) {
            return keyId(t) + ':' + t.getAttribute('aria-selected') + ':' + t.getAttribute('tabindex');
        }).join('|');
    },
    bottomNavAria: function () {
        return Array.from(document.querySelectorAll('.nvui-bottom-nav-item')).map(function (n) {
            return (n.classList.contains('is-active') ? '1' : '0') + ':' + (n.getAttribute('aria-current') || '-');
        }).join('|');
    },
    navDisplay: function () {
        return {
            tabs: getComputedStyle(document.querySelector('.nvui-tabs')).display,
            bottomNav: getComputedStyle(document.querySelector('.nvui-bottom-nav')).display
        };
    },
    clickTab: function (key) { document.getElementById('novel_stream_panel-tab-' + key).click(); },
    clickBottomNav: function (i) { document.querySelectorAll('.nvui-bottom-nav-item')[i].click(); },
    focusTab: function (key) { document.getElementById('novel_stream_panel-tab-' + key).focus(); },
    pressArrowOnTab: function (key, dir) {
        document.getElementById('novel_stream_panel-tab-' + key)
            .dispatchEvent(new KeyboardEvent('keydown', { key: dir, bubbles: true, cancelable: true }));
    },
    captureNode: function () { window.__nodeRef = document.getElementById('novel-include-tags'); },
    nodeIdentity: function () {
        const input = document.getElementById('novel-include-tags');
        return { same: window.__nodeRef === input, value: input.value };
    },

    /* ---- AC-11 焦点 ---- */
    activeInsidePanel: function () { return novelPanel.panel.contains(document.activeElement); },
    activeDesc: function () {
        const a = document.activeElement;
        if (!a) return 'none';
        return (a.id || '') + '/' + (a.className || '').toString().slice(0, 40);
    },
    focusOpener: function () { document.getElementById('__opener').focus(); return document.activeElement.id === '__opener'; },
    focusFirst: function () { focusList()[0].focus(); },
    focusLast: function () { const l = focusList(); l[l.length - 1].focus(); },
    pressTab: function (shift) {
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: !!shift, bubbles: true, cancelable: true }));
    },
    focusableCount: function () { return focusList().length; },

    /* ---- AC-12 关闭 ---- */
    pressEscape: function () { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); },
    clickOverlay: function () { novelPanel.overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); },
    clickCloseBtn: function () { document.querySelector('.nvui-panel-header .nvui-icon-btn[aria-label="关闭面板"]').click(); },
    clickGhostClose: function () {
        Array.from(document.querySelectorAll('.nvui-panel-footer .nvui-btn')).find(function (b) { return b.className.indexOf('is-ghost') >= 0; }).click();
    },

    /* ---- 面板内容（design.md §1.4 顺序 / 摘要 / heading） ---- */
    headings: function () {
        return Array.from(document.querySelectorAll('.nvui-panel-heading')).map(function (h) {
            return {
                title: h.querySelector('.nvui-section-title').textContent.trim(),
                badge: h.querySelector('.nvui-badge').textContent.trim(),
                icon: !!h.querySelector('.nvui-section-title > i')
            };
        });
    },
    serialChildren: function () {
        return Array.from(document.getElementById('novel_stream_panel-pane-serial').children).map(function (c) { return c.className; });
    },
    filterChildren: function () {
        return Array.from(document.getElementById('novel_stream_panel-pane-filter').children).map(function (c) { return c.className; });
    },
    fileChildren: function () {
        return Array.from(document.getElementById('novel_stream_panel-pane-file').children).map(function (c) { return c.className; });
    },
    switchRows: function () {
        return Array.from(document.querySelectorAll('.nvui-switch-row')).map(function (r) {
            return {
                feature: r.classList.contains('is-feature'),
                label: r.textContent.trim(),
                wrapsInput: !!r.querySelector('input[type="checkbox"]'),
                checked: r.querySelector('input').checked
            };
        });
    },
    clickFeatureSwitch: function () { document.querySelector('.nvui-switch-row.is-feature input').click(); },

    /* ---- 分段控件（design.md §3.1） ---- */
    segState: function (id) {
        const root = document.getElementById(id);
        const items = Array.from(root.querySelectorAll('.novel-seg-item'));
        return {
            role: root.getAttribute('role'),
            label: root.getAttribute('aria-label'),
            count: items.length,
            active: items.filter(function (i) { return i.classList.contains('is-active'); }).map(function (i) { return i.getAttribute('data-value'); })[0],
            tabindex: items.map(function (i) { return i.tabIndex; }).join(','),
            checked: items.map(function (i) { return i.getAttribute('aria-checked'); }).join(','),
            badge: !!root.querySelector('.novel-seg-item.is-active .nvui-badge')
        };
    },
    clickSegItem: function (id, v) { document.querySelector('#' + id + ' .novel-seg-item[data-value="' + v + '"]').click(); },
    pressSegArrow: function (id, dir) {
        document.getElementById(id).dispatchEvent(new KeyboardEvent('keydown', { key: dir, bubbles: true, cancelable: true }));
    },

    /* ---- 标签字段（design.md §3.2） ---- */
    fieldState: function (id) {
        const input = document.getElementById(id);
        const label = document.querySelector('label[for="' + id + '"]');
        return {
            hasLabel: !!label,
            labelText: label && label.textContent.trim(),
            fullWidth: Math.abs(input.getBoundingClientRect().width - input.parentElement.getBoundingClientRect().width) < 2
        };
    },
    setField: function (id, v) {
        const i = document.getElementById(id);
        i.value = v;
        i.dispatchEvent(new Event('change', { bubbles: true }));
    },
    resetDefaultTags: function () {
        const accs = Array.from(document.querySelectorAll('.nvui-acc'));
        const a = accs.find(function (x) { return x.querySelector('.nvui-acc-title').textContent.trim() === '排除黑名单'; });
        a.querySelector('.nvui-btn.is-sm').click();
    },

    /* ---- AC-13 开合持久化 ---- */
    accs: function () {
        return Array.from(document.querySelectorAll('.nvui-acc')).map(function (a) {
            return {
                title: a.querySelector('.nvui-acc-title').textContent.trim(),
                open: a.classList.contains('is-open'),
                aria: a.querySelector('.nvui-acc-head').getAttribute('aria-expanded'),
                summary: a.querySelector('.nvui-acc-summary').textContent.trim(),
                hasIcon: !!a.querySelector('.nvui-acc-title > i')
            };
        });
    },
    clickAcc: function (title) {
        const a = Array.from(document.querySelectorAll('.nvui-acc')).find(function (x) {
            return x.querySelector('.nvui-acc-title').textContent.trim() === title;
        });
        a.querySelector('.nvui-acc-head').click();
    },
    accOpen: function (title) {
        const a = Array.from(document.querySelectorAll('.nvui-acc')).find(function (x) {
            return x.querySelector('.nvui-acc-title').textContent.trim() === title;
        });
        return a.classList.contains('is-open');
    },
    accSummary: function (title) {
        const a = Array.from(document.querySelectorAll('.nvui-acc')).find(function (x) {
            return x.querySelector('.nvui-acc-title').textContent.trim() === title;
        });
        return a.querySelector('.nvui-acc-summary').textContent.trim();
    },
    storedAccOpen: function () { return __settings.acc_open.join(','); },

    /* ---- AC-15 状态行 ---- */
    refresh: function () { applyNovelUIRefresh(); },
    setChat: function (log) { ctx.chat = log; },
    serialStatus: function () {
        const el = document.getElementById('novel-serial-status');
        return { text: el.querySelector('span:not(.nvui-status-time):not(.nvui-status-file)').textContent.trim(), meta: el.querySelector('.nvui-status-time').textContent.trim() };
    },
    exportStatus: function () {
        const el = document.getElementById('novel-export-status');
        return {
            text: el.querySelector('span:not(.nvui-status-time):not(.nvui-status-file)').textContent.trim(),
            meta: el.querySelector('.nvui-status-time').textContent.trim(),
            file: el.querySelector('.nvui-status-file').textContent.trim(),
            success: el.classList.contains('is-success')
        };
    },

    /* ---- AC-08 导出反馈 ---- */
    runExport: function () { exportNovelText(); },
    downloads: function () { return __downloads.slice(); },
    blobTexts: function () { return Promise.resolve(__blobParts.slice()); },
    toastCount: function (type) { return document.querySelectorAll('.nvui-toast' + (type ? '.is-' + type : '')).length; },
    toastText: function () { const t = document.querySelector('.nvui-toast'); return t ? t.textContent.trim() : ''; },
    toastRole: function () { const t = document.querySelector('.nvui-toast'); return t && t.getAttribute('role'); },

    /* ---- AC-16 魔法棒入口 ---- */
    injectWand: function () { return injectWandEntry(); },
    wand: function () {
        const item = document.getElementById('novel-wand-menu-item');
        if (!item) return null;
        const state = document.getElementById('novel_wand_menu_state');
        return {
            role: item.getAttribute('role'),
            tabindex: item.getAttribute('tabindex'),
            icon: (item.querySelector('.extensionsMenuExtensionButton') || {}).className,
            label: item.querySelector('.novel-wand-item-label').textContent.trim(),
            stateText: state.textContent.trim(),
            stateOn: state.classList.contains('is-on')
        };
    },
    clickWand: function () { document.getElementById('novel-wand-menu-item').click(); },
    setEnabled: function (v) { __settings.enabled = v; syncWandEntryState(); }
};
`;

const HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, viewport-fit=cover, initial-scale=1">
<link rel="stylesheet" href="${path.posix.join(ROOT.replace(/\\/g, '/'), 'style.css')}">
${faLink}
<style>
/* ==== 酒馆宿主最小桩（面板外只有魔法棒菜单项需要）==== */
:root { --SmartThemeEmColor: #dddfe6; --SmartThemeBodyColor: #f0f2f7; }
html, body { margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; }
.list-group-item { display: flex; align-items: center; gap: 5px; padding: 8px 10px; cursor: pointer; }
.flex-container { display: flex; }
.flexGap5 { gap: 5px; }
.extensionsMenuExtensionButton { width: 16px; height: 16px; flex: 0 0 auto; }
#extensionsMenu { border: 1px solid rgba(255,255,255,.1); padding: 6px; }
${faFallback}
</style>
</head><body>
<button id="__opener" type="button">魔法棒入口（测试用触发元素）</button>
<div id="extensionsMenu"></div>
<script src="${path.posix.join(ROOT.replace(/\\/g, '/'), 'ui-kit', 'nvui-api.js')}"></script>
<script>
${PAGE_SRC.replace(/<\/script/gi, '<\\/script')}
${BOOTSTRAP.replace(/<\/script/gi, '<\\/script')}
</script>
</body></html>`;

const harnessPath = path.join(os.tmpdir(), 'novel-mvp-panel-harness.html');
fs.writeFileSync(harnessPath, HTML, 'utf8');

let pass = 0;
let fail = 0;
const failList = [];
function check(name, actual, expected) {
    if (actual === expected) {
        pass++;
        console.log(`[PASS] ${name}`);
    } else {
        fail++;
        failList.push(name);
        console.error(`[FAIL] ${name}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
}
function checkTrue(name, cond) {
    if (cond) { pass++; console.log(`[PASS] ${name}`); }
    else { fail++; failList.push(name); console.error(`[FAIL] ${name}`); }
}

(async function () {
    const browser = await playwright.chromium.launch({ executablePath, headless: true });
    try {
        /* ================= 桌面端 1280×900 ================= */
        const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const dpage = await dctx.newPage();
        const pageErrors = [];
        dpage.on('pageerror', (e) => pageErrors.push('desktop: ' + e.message));
        await dpage.goto('file:///' + harnessPath.replace(/\\/g, '/'), { waitUntil: 'load' });
        await dpage.waitForTimeout(300);

        console.log('=== ① AC-09 面板结构（未打开时已挂载）===');
        const st = await dpage.evaluate(() => window.__api.structure());
        checkTrue('载体 = dialog.nvui-tl', st.hasDialog);
        checkTrue('overlay.is-panel 是 dialog 直接子元素', st.overlayIsChild);
        checkTrue('.nvui-panel 是 overlay 直接子元素', st.panelIsChild);
        check('panel role=dialog', st.panelRole, 'dialog');
        check('panel aria-modal=true', st.ariaModal, 'true');
        check('面板标题', st.titleText, '小说连载阅读');
        checkTrue('面板根带 nvui-scope', st.scoped);
        check('全局唯一 overlay', st.singleOverlay, 1);
        check('底部按钮 = 关闭(ghost) + 导出整本 TXT(primary)',
            JSON.stringify(st.footerBtns),
            JSON.stringify([{ label: '关闭', variant: 'is-ghost' }, { label: '导出整本 TXT', variant: 'is-primary' }]));
        check('标题栏导出图标钮 aria-label', st.actionBtnLabel, '导出整本 TXT');
        check('标题栏关闭钮 aria-label', st.closeBtnLabel, '关闭面板');

        const before = await dpage.evaluate(() => window.__api.openState());
        checkTrue('初始未打开（dialog.open=false）', before.open === false);
        checkTrue('初始遮罩隐藏', before.hidden === true);

        console.log('\n=== ② 打开：非模态 show() + 焦点移入 ===');
        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(200);
        const opened = await dpage.evaluate(() => window.__api.openState());
        checkTrue('dialog.open=true', opened.open === true);
        checkTrue('非模态（:modal 不匹配）', opened.modal === false);
        checkTrue('遮罩显示', opened.hidden === false);
        checkTrue('打开后焦点移入面板（Kit 默认聚焦底部主按钮）', await dpage.evaluate(() => window.__api.activeInsidePanel()));
        checkTrue('打开后落在导出主按钮上', /is-primary/.test(await dpage.evaluate(() => window.__api.activeDesc())));

        console.log('\n=== ③ 内容排布（design.md §1.4）===');
        const heads = await dpage.evaluate(() => window.__api.headings());
        check('三个分区 heading 标题', heads.map((h) => h.title).join('|'), '连载设置|过滤设置|文件与导出');
        check('三个分区 heading 徽标版本', heads.map((h) => h.badge).join('|'), 'v2.0.0|v2.0.0|v2.0.0');
        checkTrue('heading 均带 FA 图标', heads.every((h) => h.icon));
        check('连载 pane 子元素顺序（heading→状态行→feature开关→3 折叠组）',
            (await dpage.evaluate(() => window.__api.serialChildren())).join('|'),
            'nvui-panel-heading|nvui-status-line novel-status-line|nvui-switch-row is-feature|nvui-acc|nvui-acc|nvui-acc');
        check('过滤 pane 子元素顺序（heading→2 折叠组）',
            (await dpage.evaluate(() => window.__api.filterChildren())).join('|'),
            'nvui-panel-heading|nvui-acc|nvui-acc');
        check('文件 pane 子元素顺序（heading→2 折叠组）',
            (await dpage.evaluate(() => window.__api.fileChildren())).join('|'),
            'nvui-panel-heading|nvui-acc|nvui-acc');

        const switches = await dpage.evaluate(() => window.__api.switchRows());
        check('开关行总数（连载总开关 + 缩进 + 主角对白）', switches.length, 3);
        checkTrue('恰好 1 条 is-feature（Kit §12.8「最多 1 条」）', switches.filter((s) => s.feature).length === 1);
        checkTrue('feature 开关 label 包裹 input（整行可点）', switches.every((s) => s.wrapsInput));

        const accs = await dpage.evaluate(() => window.__api.accs());
        check('折叠组数量', accs.length, 7);
        checkTrue('每个折叠组都有 summary（收起态唯一线索）', accs.every((a) => a.summary.length > 0));
        checkTrue('每个折叠组标题都带图标', accs.every((a) => a.hasIcon));
        check('默认全部收起（acc_open 为空）', await dpage.evaluate(() => window.__api.storedAccOpen()), '');
        checkTrue('默认 aria-expanded=false', accs.every((a) => a.aria === 'false'));

        console.log('\n=== ④ 分段控件（design.md §3.1 · AC-14 即改即存）===');
        const seg = await dpage.evaluate(() => window.__api.segState('novel-chapter-style'));
        check('章节格式 radiogroup', seg.role, 'radiogroup');
        check('章节格式 4 个选项', seg.count, 4);
        check('章节格式默认选中 numbered_floor', seg.active, 'numbered_floor');
        check('roving tabindex（仅选中项为 0）', seg.tabindex, '0,-1,-1,-1');
        check('aria-checked 同步', seg.checked, 'true,false,false,false');
        checkTrue('推荐项带徽标', seg.badge);
        await dpage.evaluate(() => window.__api.clickSegItem('novel-chapter-style', 'dialogue'));
        const seg2 = await dpage.evaluate(() => window.__api.segState('novel-chapter-style'));
        check('点击后选中 dialogue', seg2.active, 'dialogue');
        check('点击后 roving tabindex 跟随', seg2.tabindex, '-1,-1,-1,0');
        check('点击后 acc 摘要同步', await dpage.evaluate(() => window.__api.accSummary('章节格式')), '纯净戏剧体 (【角色名】)');
        check('点击后即改即存（save 被调）', (await dpage.evaluate(() => window.__api.savedCount())) > 0, true);
        check('settings.chapter_style 已写入', await dpage.evaluate(() => window.__api.settings().chapter_style), 'dialogue');
        await dpage.evaluate(() => window.__api.pressSegArrow('novel-chapter-style', 'ArrowUp'));
        check('方向键 ArrowUp 回移一项', (await dpage.evaluate(() => window.__api.segState('novel-chapter-style'))).active, 'separator');

        const naming = await dpage.evaluate(() => window.__api.segState('novel-naming-rule'));
        check('文件命名 2 个选项', naming.count, 2);
        check('文件命名默认 char_chat', naming.active, 'char_chat');

        console.log('\n=== ⑤ 标签字段（design.md §3.2）===');
        const inc = await dpage.evaluate(() => window.__api.fieldState('novel-include-tags'));
        checkTrue('白名单有可见 label', inc.hasLabel);
        check('白名单 label 文案', inc.labelText, '正文白名单');
        checkTrue('白名单输入框全宽', inc.fullWidth);
        await dpage.evaluate(() => window.__api.setField('novel-include-tags', 'story'));
        check('白名单 change 后摘要同步', await dpage.evaluate(() => window.__api.accSummary('正文白名单')), 'story');
        check('白名单 settings 写入', await dpage.evaluate(() => window.__api.settings().include_tags), 'story');
        await dpage.evaluate(() => window.__api.setField('novel-exclude-tags', 'ooc'));
        check('黑名单摘要 = N 个标签', await dpage.evaluate(() => window.__api.accSummary('排除黑名单')), '1 个标签');
        await dpage.evaluate(() => window.__api.resetDefaultTags());
        check('恢复默认后黑名单回到 DEFAULT_SETTINGS',
            await dpage.evaluate(() => window.__api.settings().exclude_tags),
            'status,memory,details,variables,analysis,ooc,note,draft,system,log');
        check('恢复默认后摘要 = 10 个标签', await dpage.evaluate(() => window.__api.accSummary('排除黑名单')), '10 个标签');

        console.log('\n=== ⑥ AC-10 标签同步（点击 / 方向键 / 不重建 DOM）===');
        check('3 个 tab', await dpage.evaluate(() => window.__api.tabKeys()), 'serial,filter,file');
        check('3 个 pane', await dpage.evaluate(() => window.__api.paneKeys()), 'serial,filter,file');
        check('初始激活 serial', await dpage.evaluate(() => window.__api.activeTab()), 'serial');
        check('初始 pane serial', await dpage.evaluate(() => window.__api.activePane()), 'serial');
        await dpage.evaluate(() => window.__api.captureNode());
        await dpage.evaluate(() => window.__api.setField('novel-include-tags', 'story, response'));
        await dpage.evaluate(() => window.__api.clickTab('file'));
        await dpage.waitForTimeout(80);
        check('点击切到 file（tab）', await dpage.evaluate(() => window.__api.activeTab()), 'file');
        check('点击切到 file（pane）', await dpage.evaluate(() => window.__api.activePane()), 'file');
        check('tab aria-selected/tabindex 同步',
            await dpage.evaluate(() => window.__api.tabAria()), 'serial:false:-1|filter:false:-1|file:true:0');
        check('底部导航 is-active/aria-current 同步',
            await dpage.evaluate(() => window.__api.bottomNavAria()), '0:-|0:-|1:page');
        const ident = await dpage.evaluate(() => window.__api.nodeIdentity());
        checkTrue('切 tab 往返后仍是同一 DOM 节点（未重建）', ident.same);
        check('切 tab 往返后输入内容完好', ident.value, 'story, response');
        await dpage.evaluate(() => window.__api.clickTab('filter'));
        await dpage.evaluate(() => window.__api.focusTab('filter'));
        await dpage.evaluate(() => window.__api.pressArrowOnTab('filter', 'ArrowRight'));
        await dpage.waitForTimeout(80);
        check('tabs 方向键 ArrowRight 切到 file', await dpage.evaluate(() => window.__api.activeTab()), 'file');
        await dpage.evaluate(() => window.__api.clickBottomNav(0));
        await dpage.waitForTimeout(80);
        check('底部导航点击切到 serial', await dpage.evaluate(() => window.__api.activePane()), 'serial');

        console.log('\n=== ⑦ AC-11 焦点（陷阱 + 归还）===');
        await dpage.evaluate(() => window.__api.focusOpener());
        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(150);
        checkTrue('重新打开后焦点移入面板', await dpage.evaluate(() => window.__api.activeInsidePanel()));
        await dpage.evaluate(() => window.__api.focusLast());
        await dpage.evaluate(() => window.__api.pressTab(false));
        checkTrue('Tab 从最后一个循环回第一个（不逃逸）', await dpage.evaluate(() => window.__api.activeInsidePanel()));
        await dpage.evaluate(() => window.__api.focusFirst());
        await dpage.evaluate(() => window.__api.pressTab(true));
        checkTrue('Shift+Tab 从第一个循环回最后一个（不逃逸）', await dpage.evaluate(() => window.__api.activeInsidePanel()));
        check('面板内可见可聚焦控件数 ≥ 10', (await dpage.evaluate(() => window.__api.focusableCount())) >= 10, true);

        console.log('\n=== ⑧ AC-13 开合持久化 ===');
        await dpage.evaluate(() => window.__api.clickAcc('章节格式'));
        check('点击后展开', await dpage.evaluate(() => window.__api.accOpen('章节格式')), true);
        check('展开后 aria-expanded=true',
            (await dpage.evaluate(() => window.__api.accs())).find((a) => a.title === '章节格式').aria, 'true');
        check('开合写入 settings.acc_open', await dpage.evaluate(() => window.__api.storedAccOpen()), 'style');
        check('开合落盘（save 被调）', (await dpage.evaluate(() => window.__api.savedCount())) > 0, true);
        await dpage.evaluate(() => window.__api.close());
        await dpage.waitForTimeout(350);
        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(120);
        check('重开后恢复上次展开（章节格式）', await dpage.evaluate(() => window.__api.accOpen('章节格式')), true);
        check('未被记住的分组仍收起', await dpage.evaluate(() => window.__api.accOpen('主角对白')), false);

        console.log('\n=== ⑨ AC-12 关闭四路 + 焦点归还 + 防误触守卫 ===');
        await dpage.evaluate(() => window.__api.pressEscape());
        checkTrue('Esc 后进入退场（is-closing）', (await dpage.evaluate(() => window.__api.openState())).closing === true);
        await dpage.waitForTimeout(350);
        let os1 = await dpage.evaluate(() => window.__api.openState());
        checkTrue('Esc 退场后隐藏', os1.hidden === true && os1.open === false);
        check('关闭后焦点归还触发元素（__opener）', await dpage.evaluate(() => window.__api.activeDesc()).then((d) => d.split('/')[0]), '__opener');

        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(150);
        await dpage.evaluate(() => window.__api.clickCloseBtn());
        await dpage.waitForTimeout(350);
        checkTrue('关闭钮可关', (await dpage.evaluate(() => window.__api.openState())).hidden === true);

        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(150);
        await dpage.evaluate(() => window.__api.clickGhostClose());
        await dpage.waitForTimeout(350);
        checkTrue('ghost 关闭钮可关', (await dpage.evaluate(() => window.__api.openState())).hidden === true);

        await dpage.evaluate(() => window.__api.open());
        await dpage.waitForTimeout(500);
        await dpage.evaluate(() => window.__api.clickOverlay());
        await dpage.waitForTimeout(350);
        checkTrue('点遮罩可关', (await dpage.evaluate(() => window.__api.openState())).hidden === true);

        await dpage.evaluate(() => window.__api.open());
        await dpage.evaluate(() => window.__api.clickOverlay());
        checkTrue('打开后 400ms 内的遮罩点击被守卫忽略（移动端防误触）',
            (await dpage.evaluate(() => window.__api.openState())).hidden === false);
        await dpage.waitForTimeout(500);
        await dpage.evaluate(() => window.__api.clickOverlay());
        await dpage.waitForTimeout(350);
        checkTrue('守卫窗口过后遮罩点击生效', (await dpage.evaluate(() => window.__api.openState())).hidden === true);

        console.log('\n=== ⑩ AC-15 状态行四态 + 切聊天重算 ===');
        await dpage.evaluate(() => window.__api.setChat([
            { is_user: true, name: '你', mes: '我们该出发了。' },
            { is_user: false, name: '艾莉丝', mes: '清晨的微风穿过树林。' },
            { is_user: false, name: '艾莉丝', mes: '远处的钟声敲了七下。' }
        ]));
        await dpage.evaluate(() => window.__api.refresh());
        let ss = await dpage.evaluate(() => window.__api.serialStatus());
        check('有章节：书稿名 + 第 N 章', ss.text + ' / ' + ss.meta, '当前书稿《艾莉丝 - 远征探索》 / 第 2 章');
        await dpage.evaluate(() => window.__api.setChat([]));
        await dpage.evaluate(() => window.__api.refresh());
        ss = await dpage.evaluate(() => window.__api.serialStatus());
        check('空聊天：尚未开始', ss.text, '尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
        await dpage.evaluate(() => window.__api.setChat([{ is_user: false, name: '艾莉丝', mes: '你好呀。' }]));
        await dpage.evaluate(() => window.__api.refresh());
        ss = await dpage.evaluate(() => window.__api.serialStatus());
        check('仅有问候语（无用户消息）：尚未开始', ss.text, '尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
        await dpage.evaluate(() => window.__api.setChat([
            { is_user: true, name: '你', mes: '在吗' },
            { is_user: false, name: '艾莉丝', mes: '<status>HP: 1/1</status>' }
        ]));
        await dpage.evaluate(() => window.__api.refresh());
        ss = await dpage.evaluate(() => window.__api.serialStatus());
        check('有用户消息但 0 章：提示检查过滤', ss.text,
            '当前聊天没有可入书的有效正文：请检查「过滤」页的白 / 黑名单是否过于严格');
        await dpage.evaluate(() => window.__api.setEnabled(false));
        await dpage.evaluate(() => window.__api.refresh());
        ss = await dpage.evaluate(() => window.__api.serialStatus());
        check('关闭连载：文案切换', ss.text, '连载已关闭：AI 回复不会入书，仍可随时导出整本');
        await dpage.evaluate(() => window.__api.setEnabled(true));
        await dpage.evaluate(() => window.__api.refresh());

        console.log('\n=== ⑪ AC-08 导出反馈（Blob / 状态行 / toast / 0 章不下载）===');
        await dpage.evaluate(() => window.__api.setChat([
            { is_user: true, name: '你', mes: '我们该出发了。' },
            { is_user: false, name: '艾莉丝', mes: '清晨的微风穿过树林，艾莉丝背上行囊。' },
            { is_user: false, name: '艾莉丝', mes: '远处的钟声敲了七下。' }
        ]));
        await dpage.evaluate(() => window.__api.clickSegItem('novel-chapter-style', 'numbered_floor'));
        await dpage.evaluate(() => window.__api.runExport());
        const dls = await dpage.evaluate(() => window.__api.downloads());
        check('导出触发一次下载', dls.length, 1);
        check('下载文件名遵循命名规则', dls[0] && dls[0].name, '艾莉丝 - 远征探索.txt');
        const blobs = await dpage.evaluate(() => window.__api.blobTexts());
        checkTrue('导出内容带 UTF-8 BOM', blobs[0] && blobs[0].charCodeAt(0) === 0xFEFF);
        checkTrue('章节标题遵循 chapter_style（numbered_floor）',
            blobs[0] && blobs[0].indexOf('第 1 章 · 艾莉丝 (原楼层: 2)') >= 0);
        let es = await dpage.evaluate(() => window.__api.exportStatus());
        checkTrue('导出状态行切 is-success', es.success === true);
        checkTrue('导出状态行显示今天时间', /^今天 \d{2}:\d{2}$/.test(es.meta));
        check('导出状态行文件信息', es.file, '艾莉丝 - 远征探索.txt · 共 2 章');
        check('导出 acc 摘要同步', await dpage.evaluate(() => window.__api.accSummary('导出整本 TXT')).then((s) => /^今天 \d{2}:\d{2} · 第 2 章$/.test(s)), true);
        check('弹出 1 次性成功 toast', await dpage.evaluate(() => window.__api.toastCount('success')), 1);
        checkTrue('toast role=status', (await dpage.evaluate(() => window.__api.toastRole())) === 'status');
        checkTrue('toast 文案含书名与章节数', (await dpage.evaluate(() => window.__api.toastText())).indexOf('已导出《艾莉丝 - 远征探索》共 2 章') >= 0);

        await dpage.evaluate(() => window.__api.setChat([{ is_user: false, name: '艾莉丝', mes: '只有问候语。' }]));
        await dpage.evaluate(() => window.__api.runExport());
        const dls2 = await dpage.evaluate(() => window.__api.downloads());
        check('0 章时不产生新下载', dls2.length, 1);
        check('0 章时弹出警告 toast', await dpage.evaluate(() => window.__api.toastCount('warn')), 1);
        es = await dpage.evaluate(() => window.__api.exportStatus());
        checkTrue('0 章导出不清空状态行（保持上次成功记录）', es.success === true && es.file === '艾莉丝 - 远征探索.txt · 共 2 章');

        console.log('\n=== ⑫ AC-16 魔法棒入口 ===');
        check('菜单项注入成功', await dpage.evaluate(() => window.__api.injectWand()), true);
        const wand = await dpage.evaluate(() => window.__api.wand());
        check('菜单项 role=button', wand.role, 'button');
        check('菜单项 tabindex=0（键盘可达）', wand.tabindex, '0');
        check('菜单项图标 fa-book-bookmark', wand.icon, 'fa-solid fa-book-bookmark extensionsMenuExtensionButton');
        check('菜单项文案', wand.label, '小说连载阅读');
        check('副标：连载中', wand.stateText, '连载中');
        checkTrue('副标 is-on', wand.stateOn);
        await dpage.evaluate(() => window.__api.setEnabled(false));
        const wand2 = await dpage.evaluate(() => window.__api.wand());
        check('关闭连载后副标：已关闭', wand2.stateText, '已关闭');
        checkTrue('关闭连载后副标无 is-on', wand2.stateOn === false);
        await dpage.evaluate(() => window.__api.setEnabled(true));
        await dpage.evaluate(() => window.__api.close());
        await dpage.waitForTimeout(350);
        await dpage.evaluate(() => window.__api.clickWand());
        await dpage.waitForTimeout(200);
        checkTrue('点击魔法棒项打开面板', (await dpage.evaluate(() => window.__api.openState())).hidden === false);

        check('桌面端 tabs 常显 / 底部导航隐藏', JSON.stringify(await dpage.evaluate(() => window.__api.navDisplay())),
            JSON.stringify({ tabs: 'flex', bottomNav: 'none' }));

        check('桌面端全程无运行报错', pageErrors.length === 0 ? 'none' : pageErrors.join(' | '), 'none');
        await dctx.close();

        /* ================= 移动端 390×844 ================= */
        const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const mpage = await mctx.newPage();
        const mobileErrors = [];
        mpage.on('pageerror', (e) => mobileErrors.push('mobile: ' + e.message));
        await mpage.goto('file:///' + harnessPath.replace(/\\/g, '/'), { waitUntil: 'load' });
        await mpage.waitForTimeout(300);

        console.log('\n=== ⑬ 移动端（≤600px 底部抽屉）===');
        await mpage.evaluate(() => window.__api.open());
        await mpage.waitForTimeout(200);
        const mnav = await mpage.evaluate(() => window.__api.navDisplay());
        check('手机端 tabs 隐藏 / 底部导航常显', JSON.stringify(mnav), JSON.stringify({ tabs: 'none', bottomNav: 'flex' }));
        const mrect = await mpage.evaluate(() => {
            const p = document.querySelector('.nvui-panel').getBoundingClientRect();
            return { w: Math.round(p.width), top: Math.round(p.top) };
        });
        checkTrue('手机端面板贴底通栏（宽度≈视口宽）', mrect.w >= 375 && mrect.w <= 390);
        checkTrue('手机端面板顶部在视口内（底部抽屉）', mrect.top > 0);
        await mpage.evaluate(() => window.__api.clickBottomNav(1));
        await mpage.waitForTimeout(80);
        check('底部导航点击切到过滤 pane', await mpage.evaluate(() => window.__api.activePane()), 'filter');
        check('底部导航 aria-current 同步', await mpage.evaluate(() => window.__api.bottomNavAria()), '0:-|1:page|0:-');
        check('移动端全程无运行报错', mobileErrors.length === 0 ? 'none' : mobileErrors.join(' | '), 'none');
        await mctx.close();
    } finally {
        await browser.close();
        try { fs.unlinkSync(harnessPath); } catch (e) { /* 忽略 */ }
    }

    console.log(`\nMVP 面板测试结果: 通过: ${pass}, 失败: ${fail}`);
    if (fail > 0) {
        console.error('失败用例：' + failList.join('；'));
        process.exit(1);
    }
    console.log('面板结构、标签同步、焦点、关闭、开合持久化、状态行、导出反馈、魔法棒入口全部符合预期');
})().catch((e) => {
    console.error('[FAIL] 测试执行异常：' + (e && e.stack || e));
    process.exit(1);
});
