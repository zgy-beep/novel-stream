/**
 * SillyTavern 小说连载阅读扩展 (Novel Stream) · v2.2.0
 *
 * 一句话：把每一轮 AI 回复清洗、编排成规范小说章节，随时一键导出整本 TXT。
 *
 * v2.0.0 自 v1.17.6 的重构说明：
 * - 章节派生改为无状态架构：聊天记录是唯一事实源，computeChapters 从聊天记录全量派生，
 *   重 roll / 划动 / 编辑 / 删除 / 切聊天全部天然正确；v1.x 的签名去重、草稿缓冲、
 *   服务端落盘那一整套跨消息持久状态随之删除。
 * - UI 全面改用 NVUI Kit（CDN 在线优先 + vendor 于 ui-kit/ 兜底，见文件下方加载器）：
 *   NVUI.createPanel 装配「连载 / 过滤 / 文件」三分区设置面板，入口收敛为魔法棒菜单一项；
 *   悬浮药丸、楼层工具条、楼层徽标、过滤效果预览弹窗全部退役
 *   （会话标签检测器一度随 MVP 范围砍除，v2.2.0 应手机端快捷操作需求恢复，见下文）。
 * - 服务端插件（plugins/auto-save）退役：导出走纯前端 Blob 下载，不再有 404 / 413 场景。
 * - 设置键收敛为 Spec §6 的 9 键；旧键读取时忽略、不写迁移代码，老用户设置无缝继承。
 *
 * v2.1.0 变更（2026-10-20，用户裁断「Kit 由上游独立维护，改在线优先」）：
 * - Kit 资产加载改 jsDelivr CDN @2 锚点在线优先（自动跟随 2.x，破坏性变更不进入），
 *   10s 超时 / 失败回退随包 vendor 的 ./ui-kit/；style.css 不再 @import Kit CSS，
 *   改由本文件顶部的加载器在运行时注入（link/script 标签，CSS 串行保序）。
 * - 标签清洗健壮性加固：辅助标签（think/plan/cot 等）改为「字母段完整命中名单」判定，
 *   杜绝 <planets> / <airplane> / <cotton> 子串误伤；排除标签 alternation 长标签在前，
 *   避免前缀遮蔽导致配对断裂；清洗缓存按 chatLog 长度修剪残留条目。
 *
 * v2.1.1 变更（2026-10-20，实机冒烟测试发现的 Kit 上游缺陷修复随版同步）：
 * - vendor 副本整目录同步 NVUI Kit v2.3.0：非模态 dialog.show() 实测不进浏览器
 *   top layer，Kit 载体此前无 z-index 档位，会被宿主正 z-index 表面（酒馆 #sheld，
 *   z-index:30，聊天非空时）整块盖住——新增 --nvui-z-layer: 1000000 载体档位。
 *   CDN 用户待上游仓库推送后经 @2 锚点自动获得；离线用户随本版 vendor 兜底生效。
 *   面板测试新增「宿主 z-30 遮挡 + elementFromPoint + 真实鼠标点击」三重回归。
 *
 * v2.2.0 变更（2026-10-20，用户反馈「各种奇怪标签手打易错、手机端不便」恢复检测器）：
 * - 「过滤」页恢复会话标签检测器：scanChatTags 扫描当前聊天自定义标签（跳过闭标签 /
 *   注释 / DOCTYPE / HTML 结构标签），按出现次数降序渲染 chips，点「白 / 黑」一键
 *   增删名单（两侧互斥，toggleTagMembership 纯函数），再次点击取消；思维链类标签打
 *   「自动」徽标（与清洗引擎共用 isAuxiliaryTag 判定，防漂移）。
 * - 渲染签名守门：扫描结果与两份名单均未变则跳过 DOM 重建，不打断用户连点。
 * - chips 限高滚动、触屏可点目标；名单变更实时同步输入框与折叠组摘要。
 */

import { getContext, extension_settings as ext_settings_raw } from '../../../extensions.js';
import {
    eventSource as es_raw,
    event_types as et_raw,
    saveSettingsDebounced as ssd_raw,
    chat as chat_raw,
    characters as characters_raw,
    this_chid as this_chid_raw
} from '../../../../script.js';
import * as stRuntime from '../../../../script.js';
/* ---------- NVUI Kit 资产加载（CDN 在线优先，本地 vendor 兜底） ---------- */
// CDN 和离线副本使用同一发布版本，避免与其他扩展加载的 Kit 版本混用。
const NVUI_VERSION = '3.1.1';
const NVUI_CDN_BASE = `https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@v${NVUI_VERSION}`;
const NVUI_LOAD_TIMEOUT = 10000; // CDN 挂起不阻塞启动：超时即回退本地 vendor

function loadTagOnce(makeEl, src) {
    return new Promise((resolve, reject) => {
        const el = makeEl();
        const timer = setTimeout(() => { el.remove(); reject(new Error(`load timeout: ${src}`)); }, NVUI_LOAD_TIMEOUT);
        el.onload = () => { clearTimeout(timer); resolve(); };
        el.onerror = () => { clearTimeout(timer); el.remove(); reject(new Error(`load failed: ${src}`)); };
        document.head.appendChild(el);
    });
}

function loadScriptOnce(src) {
    return loadTagOnce(() => {
        const el = document.createElement('script');
        el.src = src;
        return el;
    }, src);
}

function loadCssOnce(href) {
    return loadTagOnce(() => {
        const el = document.createElement('link');
        el.rel = 'stylesheet';
        el.href = href;
        return el;
    }, href);
}

// 本地 vendor 地址必须基于本模块自身 URL 解析：页面基址是酒馆宿主，相对路径会指错
function localKitUrl(file) {
    return new URL(`ui-kit/${file}`, import.meta.url).href;
}

async function loadNvuiScript() {
    if (globalThis.NVUI?.version === NVUI_VERSION) return globalThis.NVUI;
    try {
        await loadScriptOnce(`${NVUI_CDN_BASE}/nvui-api.js`);
    } catch (err) { /* 落入下方本地兜底 */ }
    if (globalThis.NVUI?.version !== NVUI_VERSION) {
        await loadScriptOnce(localKitUrl('nvui-api.js'));
    }
    const kit = globalThis.NVUI;
    if (kit?.version !== NVUI_VERSION) throw new Error(`NVUI ${NVUI_VERSION} 未加载`);
    return kit;
}

async function loadNvuiCss(file) {
    try {
        await loadCssOnce(`${NVUI_CDN_BASE}/${file}`);
    } catch (err) {
        await loadCssOnce(localKitUrl(file));
    }
}

let nvuiAssetsPromise = null;
function ensureNvuiAssets() {
    if (!nvuiAssetsPromise) {
        nvuiAssetsPromise = (async () => {
            // CSS 串行保序（tokens 在前、components 在后），JS 与 CSS 并行
            const cssReady = (async () => {
                await loadNvuiCss('tokens.css');
                await loadNvuiCss('components.css');
            })();
            const [kit] = await Promise.all([loadNvuiScript(), cssReady]);
            return kit;
        })().catch((err) => {
            console.warn('[AutoSaveTxt] NVUI Kit 加载失败（CDN 与本地 vendor 均不可达）:', err);
            return false;
        });
    }
    return nvuiAssetsPromise;
}

// 模块加载即开始拉取（面板等用户点击才开，但令牌 CSS 影响魔法棒菜单项着色）
const nvuiAssetsReady = (typeof document !== 'undefined') ? ensureNvuiAssets() : Promise.resolve(false);

function getStContext() {
    if (typeof getContext === 'function') {
        return getContext();
    }
    if (typeof window !== 'undefined' && window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
        return window.SillyTavern.getContext();
    }
    return {};
}

const ctx = getStContext();
const eventSource = ctx.eventSource || es_raw;
const event_types = ctx.event_types || et_raw;
const saveSettingsDebounced = ctx.saveSettingsDebounced || ssd_raw;

const EXTENSION_NAME = 'autoSaveTxt';
const DEFAULT_SETTINGS = {
    version: '2.3.1',                 // 设置结构版本（仅 stamped，无迁移分支）
    enabled: true,                    // 小说连载总开关
    chapter_style: 'numbered_floor',  // 章节标题样式: numbered_floor / numbered / separator / dialogue
    naming_rule: 'char_chat',         // 文件命名规则: char_chat (角色名 - 对话名) / char_only (仅角色名)
    indent_paragraphs: true,          // 自动段落首行空两格（中文小说规范排版）
    include_user_dialogue: false,     // 是否将主角（你的互动）也以对话形式写入小说
    include_tags: '',                 // 白名单：指定正文标签（留空代表整篇保留）
    exclude_tags: 'status,memory,details,variables,analysis,ooc,note,draft,system,log', // 黑名单：需剔除的标签块内容
    acc_open: [],                     // 折叠分组开合持久化（默认全收起）
};

/* ==================== 引擎区（自 v1.x 原样保留，测试靠抽取它们锁定） ==================== */

/**
 * 语义版本比较（按数值段逐段比较，杜绝字符串比较陷阱）
 * 背景：JS 字符串比较下 '1.12.0' < '1.7.8' 为 true（逐字符比 '1' vs '7'），
 * 会让版本门控全面误判。返回：-1 = a 低于 b；0 = 相等；1 = a 高于 b
 */
function compareVersion(a, b) {
    const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return na < nb ? -1 : 1;
    }
    return 0;
}

function getSettings() {
    const extSettings = ctx.extension_settings || ext_settings_raw || window.extension_settings || {};
    if (!extSettings[EXTENSION_NAME]) {
        extSettings[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
    } else {
        extSettings[EXTENSION_NAME].version = DEFAULT_SETTINGS.version;
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
            if (extSettings[EXTENSION_NAME][key] === undefined) {
                extSettings[EXTENSION_NAME][key] = DEFAULT_SETTINGS[key];
            }
        }
    }
    return extSettings[EXTENSION_NAME];
}

function getNovelOverrides(context = getStContext()) {
    if ((context.getCurrentChatId?.() ?? context.chatId) == null) return null;
    const overrides = context.chatMetadata?.novelStreamFilters;
    return overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : null;
}

function getEffectiveSettings(context = getStContext()) {
    const defaults = getSettings();
    const overrides = getNovelOverrides(context);
    if (!overrides) return defaults;
    return {
        ...defaults,
        include_tags: typeof overrides.include_tags === 'string' ? overrides.include_tags : defaults.include_tags,
        exclude_tags: typeof overrides.exclude_tags === 'string' ? overrides.exclude_tags : defaults.exclude_tags,
        include_user_dialogue: typeof overrides.include_user_dialogue === 'boolean' ? overrides.include_user_dialogue : defaults.include_user_dialogue
    };
}

function persistNovelOverrides(context) {
    const chatKey = getChatKey(context);
    const onError = (error) => {
        console.warn('[AutoSaveTxt] 会话设置保存失败:', error);
        const message = getChatKey() === chatKey
            ? '会话规则保存失败。当前页面仍使用这次修改，可再次编辑规则重试。'
            : '上一会话的规则保存失败，请切回该会话检查。';
        showNovelHostNotice(message, 'error');
    };
    try {
        if (typeof context.saveMetadata === 'function') Promise.resolve(context.saveMetadata()).catch(onError);
        else context.saveMetadataDebounced?.();
    } catch (error) {
        onError(error);
    }
}

function setNovelOverrideEnabled(enabled) {
    const context = getStContext();
    const metadata = context.chatMetadata;
    if ((context.getCurrentChatId?.() ?? context.chatId) == null || !metadata) return;
    if (enabled) {
        const { include_tags, exclude_tags, include_user_dialogue } = getEffectiveSettings(context);
        metadata.novelStreamFilters = { include_tags, exclude_tags, include_user_dialogue };
    } else {
        delete metadata.novelStreamFilters;
    }
    persistNovelOverrides(context);
}

function setNovelFilterSettings(patch, commit = true) {
    const context = getStContext();
    const overrides = getNovelOverrides(context);
    const target = overrides || getSettings();
    const changed = Object.entries(patch).some(([key, value]) => target[key] !== value);
    if (changed) Object.assign(target, patch);
    if (overrides && commit) persistNovelOverrides(context);
    else if (!overrides && changed && typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
}

/**
 * 健壮的文件名清洗（防 Windows 非法字符与截断）
 */
function sanitizeFilename(rawName, byteLimit = 255) {
    if (!rawName || typeof rawName !== 'string') {
        return '我的小说连载';
    }
    let safeName = rawName
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ')
        .replace(/\.{2,}/g, '_')
        .trim();
    // Windows 同样保留带扩展名的设备名。先替换，再为完整扩展名预留字节。
    safeName = safeName.replace(/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?= *\.|$)/i, '$1_novel');
    const encoder = new TextEncoder();
    let result = '';
    let bytes = 0;
    let length = 0;
    for (const char of safeName) {
        bytes += encoder.encode(char).length;
        if (bytes > byteLimit || length === 150) break;
        result += char;
        length++;
    }
    return result.replace(/[. ]+$/, '') || '我的小说连载';
}

/**
 * 获取当前连载小说书名
 * 支持根据【文件命名规则】自动区分同一角色卡的不同对话（平行世界、重开等）
 * 支持自动识别多角色群聊 (Group Chat) 并自动聚合为同一部群小说
 */
function getBookTitle(settings, speakerName = '') {
    const ctx = getStContext();
    // 1. 优先检测是否处于群聊 (Group Chat)
    const selectedGroup = ctx.groupId ?? ((typeof ctx.selected_group !== 'undefined')
        ? ctx.selected_group
        : (typeof window !== 'undefined' ? window.selected_group : null));

    if (selectedGroup) {
        let groupName = '群聊纪事';
        const groupList = ctx.groups || (typeof window !== 'undefined' ? window.groups : null) || [];
        if (Array.isArray(groupList)) {
            const grp = groupList.find(g => String(g.id) === String(selectedGroup));
            if (grp && grp.name) {
                groupName = grp.name;
            }
        }

        const groupPrefix = `[群聊] ${groupName}`;
        if (settings && settings.naming_rule === 'char_only') {
            return groupPrefix;
        }

        let chatTitle = '';
        if (ctx.chatMetadata && typeof ctx.chatMetadata === 'object' && ctx.chatMetadata.title) {
            chatTitle = String(ctx.chatMetadata.title).trim();
        }
        if (!chatTitle) {
            const cId = ctx.chatId || (typeof window !== 'undefined' ? window.chat_id : null);
            if (cId && typeof cId === 'string') {
                chatTitle = cId.replace(/\.jsonl$/i, '').trim();
            }
        }

        if (chatTitle) {
            if (chatTitle.startsWith(groupPrefix + ' - ') || chatTitle.startsWith(groupPrefix + '_')) {
                return chatTitle;
            }
            return `${groupPrefix} - ${chatTitle}`;
        }
        return groupPrefix;
    }

    // 2. 单角色对话逻辑
    let charName = '我的小说连载';
    const charList = ctx.characters || characters_raw || window.characters || [];
    const chid = ctx.characterId ?? ctx.this_chid ?? this_chid_raw ?? window.this_chid;
    if (Array.isArray(charList) && typeof chid !== 'undefined' && charList[chid]?.name) {
        charName = charList[chid].name;
    } else if (speakerName && speakerName !== '你') {
        charName = speakerName;
    }

    if (settings && settings.naming_rule === 'char_only') {
        return charName;
    }

    // 获取当前对话标题：显示标题(chatMetadata.title)优先，其次角色卡当前聊天文件名，最后聊天文件 ID
    let chatTitle = '';
    if (ctx.chatMetadata && typeof ctx.chatMetadata === 'object' && ctx.chatMetadata.title) {
        chatTitle = String(ctx.chatMetadata.title).trim();
    }
    if (!chatTitle && Array.isArray(charList) && typeof chid !== 'undefined' && charList[chid]) {
        const charObj = charList[chid];
        if (charObj.chat && typeof charObj.chat === 'string') {
            chatTitle = charObj.chat.replace(/\.jsonl$/i, '').trim();
        }
    }
    if (!chatTitle) {
        const cId = ctx.chatId || window.chat_id;
        if (cId && typeof cId === 'string') {
            chatTitle = cId.replace(/\.jsonl$/i, '').trim();
        }
    }

    if (chatTitle) {
        // 如果酒馆默认生成的对话文件名已包含角色名前缀（如 "艾莉丝 - 2026-9-10..."）
        if (chatTitle.startsWith(charName + ' - ') || chatTitle.startsWith(charName + '_')) {
            return chatTitle;
        }
        return `${charName} - ${chatTitle}`;
    }

    return charName;
}

// 多账号前缀：仅多用户模式能检测到 currentUser 时生效（防御式多候选读取字段名）
function getAccountPrefix() {
    const acct = ctx.currentUser || (typeof window !== 'undefined' ? window.currentUser : null);
    const name = acct && (acct.name || acct.handle || acct.userName);
    if (!name) return '';
    const safe = sanitizeFilename(String(name)).trim();
    return safe ? `[${safe}] ` : '';
}

// 真实磁盘文件名：账号前缀 + 书名（导出与书卡展示共用，保证两端一致）
function getBookFileName(settings, chapterRange) {
    const suffix = chapterRange ? ` - 第 ${chapterRange.start}-${chapterRange.end} 章.txt` : '.txt';
    const stem = sanitizeFilename(getAccountPrefix() + getBookTitle(settings), 255 - new TextEncoder().encode(suffix).length);
    return stem + suffix;
}

const INLINE_TAGS = new Set(['b', 'i', 'u', 's', 'em', 'strong', 'span', 'sub', 'sup', 'small', 'del', 'mark']);

// 标签扫描时忽略的 HTML 结构标签（这些不属于"自定义标签"，不展示在检测器中）
const SCAN_IGNORE_TAGS = new Set([
    ...INLINE_TAGS,
    'html', 'head', 'body', 'div', 'p', 'br', 'hr', 'img', 'a',
    'script', 'style', 'pre', 'code', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'font', 'center', 'blockquote', 'video', 'audio', 'source', 'iframe',
]);

// 思维链/草稿类标签名单：与清洗引擎共用同一判定（字母段完整命中才算），
// 杜绝 <planets> / <airplane> / <cotton> 子串误伤；引擎与检测器漂移会致「自动」徽标说谎
const AUX_WORDS = new Set(['think', 'thinking', 'thought', 'thoughts', 'reasoning', 'cot', 'scratchpad', 'reflection', 'analysis', 'plan', 'planning']);

/**
 * 判断标签是否属于思维链/草稿类（会被清洗引擎全自动剔除，检测器据此打「自动」徽标）
 */
function isAuxiliaryTag(tagName) {
    return String(tagName).toLowerCase().split(/[^a-z]+/).some((w) => AUX_WORDS.has(w));
}

/**
 * 解析标签名单字符串为标签数组（白名单/黑名单输入框共用，防止逻辑漂移）
 */
function parseTagList(str) {
    if (typeof str !== 'string' || !str.trim()) return [];
    return str
        .split(/[,，\s]+/)
        .map(t => t.trim().replace(/^<|>$/g, ''))
        .filter(Boolean);
}

const messageTagCache = new WeakMap();

/**
 * 扫描会话中出现过的自定义标签，按出现次数降序返回（供「会话标签检测器」展示）
 * 闭标签 </tag> 与 DOCTYPE 天然不匹配；HTML 注释与 script/style 块先剥离——
 * 其中被提及的「标签」只是文本不是真实内容标签（与 cleanNovelText 阶段三同口径）；
 * details/summary 不排除（默认黑名单含 details）
 * auxiliary 标记思维链/草稿类标签（引擎自动剔除，检测器打「自动」徽标，与引擎共用判定防漂移）
 * 返回 { tags: [{ tag, count, auxiliary }], total }（全量不截断，展示层限高滚动承载）
 */
function scanChatTags(chatLog) {
    const counts = new Map();
    if (!Array.isArray(chatLog)) return { tags: [], total: 0 };
    const tagRegex = /<\s*([a-zA-Z][a-zA-Z0-9_\-~.:#]*)[^>]*>/g;
    for (const m of chatLog) {
        if (!m || typeof m !== 'object') continue;
        const text = m.mes;
        if (typeof text !== 'string' || !text) continue;
        let cached = messageTagCache.get(m);
        if (cached?.text !== text) {
            const stripped = text
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<script(?=[\s>])[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style(?=[\s>])[^>]*>[\s\S]*?<\/style>/gi, '');
            const tags = new Map();
            tagRegex.lastIndex = 0;
            let match;
            while ((match = tagRegex.exec(stripped)) !== null) {
                const tag = match[1].toLowerCase();
                if (!SCAN_IGNORE_TAGS.has(tag)) tags.set(tag, (tags.get(tag) || 0) + 1);
            }
            cached = { text, tags };
            messageTagCache.set(m, cached);
        }
        for (const [tag, count] of cached.tags) {
            counts.set(tag, (counts.get(tag) || 0) + count);
        }
    }
    const sorted = [...counts.entries()]
        .map(([tag, count]) => ({ tag, count, auxiliary: isAuxiliaryTag(tag) }))
        .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
    return { tags: sorted, total: sorted.length };
}

/**
 * 检测器 chip 点击：把标签加入 / 移出白名单或黑名单（两侧互斥）
 * 纯函数（可 node 测试）：只算名单，面板负责同步输入框 / 摘要 / 持久化，防逻辑漂移
 */
function toggleTagMembership(includeStr, excludeStr, tag, action) {
    const t = String(tag || '').trim().toLowerCase();
    if (!t) return { include_tags: includeStr || '', exclude_tags: excludeStr || '' };
    let include = parseTagList(includeStr).map((x) => x.toLowerCase());
    let exclude = parseTagList(excludeStr).map((x) => x.toLowerCase());
    if (action === 'include') {
        if (include.includes(t)) {
            include = include.filter((x) => x !== t);
        } else {
            include.push(t);
            exclude = exclude.filter((x) => x !== t);
        }
    } else {
        if (exclude.includes(t)) {
            exclude = exclude.filter((x) => x !== t);
        } else {
            exclude.push(t);
            include = include.filter((x) => x !== t);
        }
    }
    return { include_tags: include.join(', '), exclude_tags: exclude.join(', ') };
}

/**
 * 通用小说正文排版与全能标签清洗引擎
 */
function cleanNovelText(rawText, settings = {}) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText
        .replace(/\r\n?|[\u2028\u2029]/g, '\n')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    // 标签名必须完整匹配，自闭合标签不能作为包裹正文的开标签。
    const openTagSuffix = '(?=[\\s>])(?![^>]*\\/\\s*>)[^>]*>';
    const tagTokens = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9_\-~.:#]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/g;

    // 前置清洗：彻底过滤 HTML 注释 (如 <!-- Lorebook: ... -->) 与 Markdown 多媒体图片
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<\s*(script|style)(?=[\s>])(?:[^"'<>]|"[^"]*"|'[^']*')*>[\s\S]*?<\/\s*\1\s*>/gi, '');
    text = text.replace(/!\[(?:\\[^\n]|[^\]\\\n])*\]\((?:\\[^\n]|[^()"'\\\n]|"[^"\n]*"|'[^'\n]*'|\([^()\n]*\))*\)/g, '');
    text = text.replace(tagTokens, (token, _closing, name) => name.toLowerCase() === 'img' ? '' : token);
    // BBI 的图像提示词紧跟在标记后，直到行末。
    text = text.replace(/<bbi_image\s*>[^\r\n]*/gi, '');

    // 阶段零【通用前置无头标签与思维链智能清洗】：
    // 应对任何反代、Prefill、插件导致的“开篇无起始标签、仅有闭标签”问题（无论标签名叫什么，均可自动识别并切除）
    let prevLeadText = '';
    while (prevLeadText !== text) {
        prevLeadText = text;
        const match = text.match(/^([\s\S]*?)<\/\s*([a-zA-Z][a-zA-Z0-9_\-~.:#]*)\s*>\s*/i);
        if (match) {
            const beforeClosing = match[1];
            const tagName = match[2].toLowerCase();
            if (!INLINE_TAGS.has(tagName)) {
                const safeTag = match[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const openTagRegex = new RegExp(`<\\s*${safeTag}${openTagSuffix}`, 'i');
                if (!openTagRegex.test(beforeClosing)) {
                    // 开篇内容中不存在对应开标签，证实这是被省略了开标签的前置内容，彻底切除
                    text = text.slice(match[0].length);
                    continue;
                }
            }
        }
        break;
    }

    // 匹配完整标签边界，并在属性带有引号时保留其中的 >。
    function findBlocks(source, acceptsTag, includeUnclosed = false) {
        const pending = new Map();
        const blocks = [];
        for (const token of source.matchAll(tagTokens)) {
            const name = token[2].toLowerCase();
            if (!acceptsTag(name)) continue;
            if (token[1]) {
                const opening = pending.get(name)?.pop();
                if (opening) {
                    blocks.push({ ...opening, bodyEnd: token.index, end: token.index + token[0].length });
                }
            } else if (!/\/\s*>$/.test(token[0])) {
                if (!pending.has(name)) pending.set(name, []);
                pending.get(name).push({ start: token.index, bodyStart: token.index + token[0].length });
            }
        }
        if (includeUnclosed) {
            for (const entries of pending.values()) {
                for (const opening of entries) blocks.push({ ...opening, end: source.length });
            }
        }
        return blocks.sort((a, b) => a.start - b.start);
    }

    // 先剔除辅助标签与黑名单块，避免提取其内部碰巧命中的白名单标签。
    const excludes = new Set(parseTagList(
        typeof settings.exclude_tags === 'string' ? settings.exclude_tags : DEFAULT_SETTINGS.exclude_tags
    ));
    const removed = findBlocks(text, (tag) => isAuxiliaryTag(tag) || excludes.has(tag), true);
    if (removed.length) {
        const parts = [];
        let cursor = 0;
        for (const block of removed) {
            if (block.end <= cursor) continue;
            if (block.start > cursor) parts.push(text.slice(cursor, block.start));
            cursor = block.end;
            while (cursor < text.length && /\s/.test(text[cursor])) cursor++;
        }
        parts.push(text.slice(cursor));
        text = parts.join('');
    }

    const includes = new Set(parseTagList(settings.include_tags));
    if (includes.size) {
        const parts = [];
        let coveredUntil = 0;
        for (const block of findBlocks(text, (tag) => includes.has(tag))) {
            if (block.start < coveredUntil) continue;
            const body = text.slice(block.bodyStart, block.bodyEnd).trim();
            if (body) parts.push(body);
            coveredUntil = block.end;
        }
        if (parts.length) text = parts.join('\n\n');
    }

    // 网页标签转为纯文本，并保留换行和段落边界。
    text = text.replace(tagTokens, (_whole, closing, rawName) => {
        const name = rawName.toLowerCase();
        if (!closing && name === 'br') return '\n';
        if (closing && name === 'p') return '\n\n';
        return '';
    });

    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // 阶段四【中文出版小说段落规范化】
    const paragraphs = text
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    const shouldIndent = settings.indent_paragraphs !== false;
    if (shouldIndent) {
        return paragraphs.map(p => `　　${p}`).join('\n\n');
    }

    return paragraphs.join('\n\n');
}

// 按消息对象缓存。删除中间楼层后，位置前移的消息可继续复用清洗结果。
const cleanTextCache = new WeakMap();

function getCleanMessageSig(settings) {
    return JSON.stringify([settings.include_tags, settings.exclude_tags, settings.indent_paragraphs !== false]);
}

/**
 * 带缓存的消息清洗：设置签名变化、消息对象被替换（Regenerate/滑动分支）或 mes 被原地改写
 * （酒馆编辑消息/切换分支均直接改写 msg.mes）时自动重洗，确保缓存绝不失真
 */
function getCleanedMessage(msg, settings, sig) {
    const cached = cleanTextCache.get(msg);
    const mes = msg.mes;
    if (cached?.sig === sig && cached.mes === mes) return cached.text;
    const text = cleanNovelText(mes || '', settings);
    cleanTextCache.set(msg, { sig, mes, text });
    return text;
}

/* ==================== 章节派生区（v2.0.0 无状态架构，Spec §5.2） ==================== */

/**
 * 聊天记录中是否存在用户消息（问候语延迟入书规则的唯一判据，与 derive 共用防漂移）
 */
function chatHasUserMessage(chatLog) {
    if (!Array.isArray(chatLog)) return false;
    for (const m of chatLog) {
        if (m?.is_user && !m.is_system) return true;
    }
    return false;
}

const interruptedStreamPlaceholders = new WeakMap();

function isInterruptedStreamPlaceholder(message) {
    return message?.mes === '...' && interruptedStreamPlaceholders.get(message)?.has(message.swipe_id ?? null);
}

function getEmptyBookMessage(settings, chatLog) {
    if (!chatHasUserMessage(chatLog)) return '请先发出一条消息，再导出小说。';
    if (isInterruptedStreamPlaceholder(chatLog.at(-1))) {
        return '回复中断，酒馆只保留了占位符。可重新生成后再导出。';
    }
    const hasSource = chatLog.some((message) => message && !message.is_system
        && (!message.is_user || settings.include_user_dialogue)
        && typeof message.mes === 'string' && message.mes.trim());
    return hasSource
        ? '没有可导出的正文。请检查「过滤」页的当前规则。'
        : '还没有可入书的回复。可等待回复，或在「连载」页开启主角对白。';
}

/**
 * 从聊天记录全量派生章节（唯一事实源 = 聊天记录，无任何跨消息持久状态）
 * 返回 [{ index, no, speaker, text }]：
 * - 延迟入书：聊天中不存在任何 is_user 消息 → 返回 []（尚未开始，问候语不占章）；
 *   否则从 index 0 开始编号，问候语即第 1 章。
 * - 跳过 is_user && !include_user_dialogue；跳过清洗后为空的楼层（不占号）。
 */
function computeChapters(settings, chatLog) {
    if (!Array.isArray(chatLog)) return [];
    if (!chatHasUserMessage(chatLog)) return [];
    const chapters = [];
    const sig = getCleanMessageSig(settings);
    let no = 0;
    for (let i = 0; i < chatLog.length; i++) {
        const msg = chatLog[i];
        if (!msg || typeof msg !== 'object' || msg.is_system || isInterruptedStreamPlaceholder(msg)) continue;
        if (msg.is_user && !settings.include_user_dialogue) continue;
        const text = getCleanedMessage(msg, settings, sig);
        if (!text) continue;
        no++;
        const speaker = msg.name || (msg.is_user ? '你' : '旁白');
        chapters.push({ index: i, no, speaker, text });
    }
    return chapters;
}

/**
 * 楼层序号 → 章节号（保留同名函数供测试抽取，内部改调 computeChapters）
 */
function computeChapterMap(settings, chatLog) {
    const map = {};
    for (const ch of computeChapters(settings, chatLog)) {
        map[ch.index] = ch.no;
    }
    return map;
}

/**
 * 将全部聊天编排为整本小说文本（导出与面板计数共用同一派生结果）
 */
function buildNovelText(settings, chatLog, chapters = computeChapters(settings, chatLog)) {
    const heading = (value) => String(value).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim();
    const bookTitle = heading(getBookTitle(settings)) || '我的小说连载';
    const parts = [`《${bookTitle}》\n\n`];
    let chapterCount = 0;

    for (const ch of chapters) {
        chapterCount++;
        const floor = ch.index + 1;
        const speaker = heading(ch.speaker) || '旁白';
        if (settings.chapter_style === 'separator') {
            parts.push(`* * *\n\n${ch.text}\n\n\n`);
        } else if (settings.chapter_style === 'dialogue') {
            parts.push(`【${speaker}】\n\n${ch.text}\n\n\n`);
        } else if (settings.chapter_style === 'numbered') {
            parts.push(`第 ${ch.no} 节 · ${speaker}\n\n${ch.text}\n\n\n`);
        } else {
            parts.push(`第 ${ch.no} 章 · ${speaker} (原楼层: ${floor})\n\n${ch.text}\n\n\n`);
        }
    }

    return { bookTitle, novelText: parts.join(''), chapterCount };
}

/**
 * 导出载荷纯函数（可 node 测试）：文件名遵循命名规则，text 已带 UTF-8 BOM
 */
function composeNovelExport(settings, chatLog, chapters, chapterRange) {
    const { bookTitle, novelText, chapterCount } = buildNovelText(settings, chatLog, chapters);
    return {
        bookTitle,
        fileName: getBookFileName(settings, chapterRange),
        text: '\uFEFF' + novelText,
        chapterCount
    };
}

/* ==================== UI 区（NVUI Kit 面板 + 魔法棒入口） ==================== */

let novelPanel = null;                 // NVUI 面板控制器
let panelLoadFailed = false;
let uiRefs = {};                       // 状态行 / 导出状态行 / 导出折叠组等 DOM 引用
let refreshTimer = 0;                  // refreshNovelUI 防抖句柄
const recentExports = new Map();
let generation = null;
let stoppedReply = null;

/** Font Awesome 6 图标节点（纯装饰，语义由文字承担） */
function faIcon(iconClass) {
    const i = document.createElement('i');
    i.className = iconClass;
    i.setAttribute('aria-hidden', 'true');
    return i;
}

/** 分区 heading：分区标题 + 版本徽标（design.md §3.3） */
function createPanelHeading(iconClass, text, version) {
    const root = document.createElement('div');
    root.className = 'nvui-panel-heading';
    const title = document.createElement('span');
    title.className = 'nvui-section-title';
    title.appendChild(faIcon(iconClass));
    title.appendChild(document.createTextNode(text));
    const badge = document.createElement('span');
    badge.className = 'nvui-badge';
    badge.textContent = version;
    root.appendChild(title);
    root.appendChild(badge);
    return root;
}

/** 只读状态行（design.md §3.3）；withFile = 附带第二行文件信息行 */
function createStatusLineRow(id, iconClass, withFile) {
    const root = document.createElement('div');
    root.className = 'nvui-status-line';
    if (id) root.id = id;
    const text = document.createElement('span');
    const meta = document.createElement('span');
    meta.className = 'nvui-status-time';
    root.appendChild(faIcon(iconClass));
    root.appendChild(text);
    root.appendChild(meta);
    let fileEl = null;
    if (withFile) {
        fileEl = document.createElement('span');
        fileEl.className = 'nvui-status-file';
        root.appendChild(fileEl);
    }
    root.setText = (t) => { text.textContent = t || ''; };
    root.setMeta = (t) => { meta.textContent = t || ''; };
    root.setFile = (t) => { if (fileEl) fileEl.textContent = t || ''; };
    root.setSuccess = (on) => { root.classList.toggle('is-success', !!on); };
    return root;
}

/** 分段控件（radiogroup + roving tabindex + 方向键，design.md §3.1） */
function createSegmented(options) {
    const root = document.createElement('div');
    root.className = 'novel-seg';
    root.id = options.id;
    root.setAttribute('role', 'radiogroup');
    root.setAttribute('aria-label', options.label || '');
    const values = options.items.map((it) => it.value);
    let current = options.value;
    const buttons = options.items.map((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'novel-seg-item';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('data-value', it.value);
        const text = document.createElement('span');
        text.className = 'novel-seg-text';
        text.textContent = it.text;
        btn.appendChild(text);
        if (it.badge) {
            const badge = document.createElement('span');
            badge.className = 'nvui-badge is-accent';
            badge.textContent = it.badge;
            btn.appendChild(badge);
        }
        btn.addEventListener('click', () => select(it.value, false));
        root.appendChild(btn);
        return btn;
    });

    function render(v) {
        current = v;
        buttons.forEach((btn) => {
            const on = btn.getAttribute('data-value') === v;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-checked', on ? 'true' : 'false');
            btn.tabIndex = on ? 0 : -1;
        });
    }
    function select(v, focus) {
        render(v);
        if (focus) {
            const btn = buttons[values.indexOf(v)];
            if (btn) btn.focus();
        }
        if (typeof options.onChange === 'function') options.onChange(v);
    }

    render(options.value);
    root.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
        const nextV = values[(values.indexOf(current) + dir + values.length) % values.length];
        select(nextV, true);
    });
    root.setValue = (v) => render(v);
    return root;
}

/** 全宽标签字段（白 / 黑名单，design.md §3.2） */
function createTagField(options) {
    const root = document.createElement('div');
    root.className = 'novel-field';
    const label = document.createElement('label');
    label.className = 'novel-field-label';
    label.htmlFor = options.id;
    label.textContent = options.label;
    const input = document.createElement('input');
    input.className = 'nvui-input';
    input.id = options.id;
    input.type = 'text';
    input.value = options.value || '';
    if (options.placeholder) input.placeholder = options.placeholder;
    input.addEventListener('input', () => options.onChange?.(input.value, false));
    input.addEventListener('change', () => options.onChange?.(input.value, true));
    const hint = document.createElement('span');
    hint.className = 'nvui-hint';
    hint.textContent = options.hint || '';
    root.appendChild(label);
    root.appendChild(input);
    root.appendChild(hint);
    root.input = input;
    return root;
}

function createFilterPreview() {
    const root = document.createElement('div');
    root.className = 'novel-stack novel-preview';
    const select = document.createElement('select');
    select.id = 'novel-preview-floor';
    select.className = 'nvui-input';
    const label = document.createElement('label');
    label.htmlFor = select.id;
    label.textContent = '预览楼层';
    const status = document.createElement('div');
    status.className = 'nvui-hint';
    status.setAttribute('role', 'status');
    const view = document.createElement('select');
    view.className = 'nvui-input novel-preview-view';
    view.setAttribute('aria-label', '预览内容');
    view.append(new Option('原文', 'source'), new Option('入书正文', 'chapter'));
    const columns = document.createElement('div');
    columns.className = 'novel-preview-columns';
    columns.dataset.view = view.value;
    function addColumn(title, kind) {
        const section = document.createElement('section');
        section.dataset.kind = kind;
        const heading = document.createElement('strong');
        heading.textContent = title;
        const text = document.createElement('pre');
        text.tabIndex = 0;
        section.append(heading, text);
        columns.appendChild(section);
        return text;
    }
    const sourceText = addColumn('原文', 'source');
    const chapterText = addColumn('入书正文', 'chapter');
    root.append(label, select, status, view, columns);
    view.addEventListener('change', () => { columns.dataset.view = view.value; });
    let selected;
    let lastIndex = -1;
    let chatKey;
    let current;

    function render(model) {
        current = model;
        if (chatKey !== model.chatKey) {
            chatKey = model.chatKey;
            selected = undefined;
            lastIndex = -1;
        }
        const { chatLog, chapters, settings, generating } = model;
        if (generating) {
            select.disabled = true;
            status.textContent = '正在生成，完成后更新预览。';
            sourceText.textContent = '';
            chapterText.textContent = '';
            return;
        }
        const byIndex = new Map(chapters.map((chapter) => [chapter.index, chapter]));
        let index = selected ? chatLog.indexOf(selected) : -1;
        const removed = !!selected && index < 0;
        if (index < 0) {
            const nearest = chapters.find((chapter) => chapter.index >= lastIndex);
            index = (removed ? nearest?.index : undefined) ?? chapters.at(-1)?.index ?? chatLog.findLastIndex(Boolean);
        }
        selected = chatLog[index];
        lastIndex = index;
        const options = [];
        chatLog.forEach((msg, floor) => {
            if (!msg) return;
            const no = byIndex.get(floor)?.no;
            const title = `楼层 ${floor + 1} · ${msg.name || (msg.is_user ? '你' : '旁白')}${no ? ` · 第 ${no} 章` : ''}`;
            options.push([title, String(floor)]);
        });
        const signature = JSON.stringify(options);
        if (signature !== select.dataset.signature) {
            const fragment = document.createDocumentFragment();
            options.forEach(([title, value]) => fragment.appendChild(new Option(title, value)));
            select.replaceChildren(fragment);
            select.dataset.signature = signature;
        }
        select.value = index >= 0 ? String(index) : '';
        select.disabled = index < 0;
        const chapter = byIndex.get(index);
        const reason = !selected ? '当前会话没有可预览的消息。'
            : selected.is_system ? '系统消息未纳入书稿。'
            : isInterruptedStreamPlaceholder(selected) ? '回复中断，酒馆只保留了占位符。'
            : !chatHasUserMessage(chatLog) ? '尚未开始对话。'
            : selected.is_user && !settings.include_user_dialogue ? '当前设置未收录用户发言。'
            : '清洗后没有正文。';
        const result = chapter ? `第 ${chapter.no} 章 · 原楼层 ${index + 1}` : reason;
        status.textContent = removed ? `所选楼层已删除或被替换。 ${result}` : result;
        sourceText.textContent = selected?.mes || '';
        chapterText.textContent = chapter?.text || '';
    }

    select.addEventListener('change', () => {
        if (!current) return;
        selected = current.chatLog[Number(select.value)];
        render(current);
    });
    root.render = render;
    return root;
}

function getRangeChapters(chapters, chatLog, chatKey, range) {
    if (range.chatKey !== chatKey) return null;
    const selected = chapters.slice(range.start - 1, range.end);
    if (selected.length !== range.chapters.length) return null;
    const unchanged = selected.every((chapter, offset) => {
        const previous = range.chapters[offset];
        return chapter.no === previous.no && chapter.index === previous.index
            && chapter.speaker === previous.speaker && chapter.text === previous.text
            && chatLog[chapter.index] === previous.message;
    });
    return unchanged ? selected : null;
}

function createRangeExport(onExport) {
    const root = document.createElement('div');
    root.className = 'novel-stack';
    const fields = document.createElement('div');
    fields.className = 'novel-range-fields';
    const inputs = ['起始章节', '结束章节'].map((name) => {
        const label = document.createElement('label');
        label.className = 'novel-field';
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'nvui-input';
        input.min = '1';
        label.append(name, input);
        fields.appendChild(label);
        return input;
    });
    const [from, to] = inputs;
    const status = document.createElement('div');
    status.setAttribute('role', 'status');
    status.className = 'nvui-hint';
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'nvui-btn is-primary';
    download.textContent = '下载所选章节';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'nvui-btn novel-range-confirm';
    confirm.textContent = '确认更新后的范围';
    confirm.hidden = true;
    root.append(fields, status, confirm, download);
    let model;
    let range;
    let stale = false;

    function render(next) {
        if (model && model.chatKey !== next.chatKey) {
            inputs.forEach((input) => { input.value = ''; });
            range = null;
            stale = false;
        }
        model = next;
        const count = next.chapters.length;
        inputs.forEach((input) => { input.max = String(count); input.disabled = count === 0 || next.generating; });
        if (range && !next.generating && !getRangeChapters(next.chapters, next.chatLog, next.chatKey, range)) {
            range = null;
            stale = true;
        }
        download.disabled = !range || next.generating;
        confirm.hidden = !stale || next.generating || count === 0;
        confirm.disabled = !hasValidBounds(count);
        status.textContent = next.generating ? ''
            : count === 0 ? '当前没有可导出的章节。'
            : stale ? '所选章节已变化，请确认更新后的范围或修改起止章。'
            : range ? `将导出第 ${range.start} 至 ${range.end} 章，保留整书章号。`
            : `当前共 ${count} 章，请输入有效的起止章。`;
    }

    function hasValidBounds(count) {
        const start = from.valueAsNumber;
        const end = to.valueAsNumber;
        return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start && end <= count;
    }

    function select() {
        if (!model || model.generating) return;
        const start = from.valueAsNumber;
        const end = to.valueAsNumber;
        const { chatKey, chatLog, chapters } = model;
        stale = false;
        range = hasValidBounds(chapters.length)
            ? { chatKey, start, end, chapters: chapters.slice(start - 1, end).map((chapter) => ({
                ...chapter, message: chatLog[chapter.index]
            })) }
            : null;
        render(model);
    }
    inputs.forEach((input) => input.addEventListener('input', select));
    confirm.addEventListener('click', select);
    download.addEventListener('click', () => { if (range) onExport(range); });
    root.render = render;
    return root;
}

/**
 * 会话标签检测器（v2.2.0 恢复，design.md §3.4）：扫描当前聊天出现过的自定义标签，
 * chips 点「白 / 黑」一键增删名单，免去手打（手机端尤其不便；怪标签也绝不会打错）
 * options = { scanTags, getInclude, getExclude, onToggle, onSummary }
 *   scanTags() -> { tags: [{tag,count,auxiliary}], total }
 *   getInclude()/getExclude() -> 当前名单字符串（chip 激活态来源）
 *   onToggle(tag, action) -> 面板完成设置持久化后回调（组件负责重渲染）
 *   onSummary(total) -> 折叠组摘要同步（N 个标签 / 未检测到标签）
 * 渲染签名守门：扫描结果与两份名单均未变则跳过 DOM 重建，避免用户连点时 DOM 被抽走
 */
function createTagDetector(options) {
    const root = document.createElement('div');
    root.className = 'novel-detector';
    const chipsBox = document.createElement('div');
    chipsBox.className = 'novel-chips';
    chipsBox.id = 'novel_tag_chips';
    root.appendChild(chipsBox);
    let lastSig = '';

    function render() {
        const { tags, total } = options.scanTags();
        const includeSet = new Set(parseTagList(options.getInclude()).map((t) => t.toLowerCase()));
        const excludeSet = new Set(parseTagList(options.getExclude()).map((t) => t.toLowerCase()));
        const sig = JSON.stringify(tags) + '|' + [...includeSet].join(',') + '|' + [...excludeSet].join(',');
        if (typeof options.onSummary === 'function') options.onSummary(total);
        if (sig === lastSig) return;
        lastSig = sig;
        chipsBox.textContent = '';
        if (!tags.length) {
            const empty = document.createElement('div');
            empty.className = 'novel-chips-empty';
            empty.textContent = '未检测到自定义标签——AI 回复中带 <标签> 的内容会自动出现在这里';
            chipsBox.appendChild(empty);
            return;
        }
        tags.forEach(({ tag, count, auxiliary }) => {
            const chip = document.createElement('div');
            chip.className = 'novel-chip';
            chip.setAttribute('data-tag', tag);
            const name = document.createElement('code');
            name.className = 'novel-chip-name';
            name.textContent = tag;
            chip.appendChild(name);
            const countEl = document.createElement('span');
            countEl.className = 'novel-chip-count';
            countEl.textContent = `×${count}`;
            chip.appendChild(countEl);
            if (auxiliary) {
                const auto = document.createElement('span');
                auto.className = 'novel-chip-auto';
                auto.textContent = '自动';
                auto.title = '思维链 / 草稿类标签，引擎已自动剔除，无需加入黑名单';
                chip.appendChild(auto);
            }
            ['include', 'exclude'].forEach((action) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `novel-chip-btn is-${action}`;
                btn.setAttribute('data-action', action);
                btn.setAttribute('aria-label', `${action === 'include' ? '白名单' : '黑名单'}：${tag}`);
                btn.textContent = action === 'include' ? '白' : '黑';
                btn.title = action === 'include'
                    ? '加入白名单：只保留该标签内的正文（再次点击取消）'
                    : '加入黑名单：彻底剔除该标签块（再次点击取消）';
                const on = action === 'include' ? includeSet.has(tag) : excludeSet.has(tag);
                btn.classList.toggle('is-active', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
                btn.addEventListener('click', () => options.onToggle(tag, action));
                chip.appendChild(btn);
            });
            chipsBox.appendChild(chip);
        });
    }

    root.render = render;
    return root;
}

/** Kit 负责桌面标签导航，窄屏底部导航也支持左右方向键。 */
function bindBottomNavArrowKeys(panel) {
    panel.bottomNav?.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const items = Array.from(panel.bottomNav.querySelectorAll('.nvui-bottom-nav-item'));
        const idx = items.indexOf(document.activeElement);
        if (idx < 0) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = items[(idx + dir + items.length) % items.length];
        panel.setTab(next.dataset.tab);
        next.focus();
    });
}

/**
 * 打开后 400ms 内的遮罩点击守卫：移动端同一次触摸会补发 click 落到遮罩，
 * 不守卫则面板刚打开就被自己的遮罩关掉（沿用 v1.x 防误触策略）
 */
function guardOverlayClick(overlay) {
    const openedAt = Date.now();
    const guard = (e) => {
        if (e.target === overlay && Date.now() - openedAt < 400) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    document.addEventListener('click', guard, true);
    setTimeout(() => document.removeEventListener('click', guard, true), 450);
}

/**
 * 装配 NVUI 设置面板（design.md §1.5 / §3 骨架）。
 * 可测性硬约束：除 NVUI / document / 传入的 deps 外不引用任何酒馆模块导入，
 * 保证 test-mvp-panel.js 能整体抽取到 playwright 页里执行。
 *
 * deps = { settings, defaultExcludeTags, save, refreshStatus, onExport }
 */
function buildNovelPanel(deps, kit = globalThis.NVUI) {
    const settings = deps.settings;
    let effective = settings;

    const CHAPTER_STYLE_ITEMS = [
        { value: 'numbered_floor', text: '第 X 章 · 角色名 (原楼层: Y)', badge: '推荐' },
        { value: 'numbered', text: '第 X 节 · 角色名' },
        { value: 'separator', text: '优雅分割线 (* * *)' },
        { value: 'dialogue', text: '纯净戏剧体 (【角色名】)' }
    ];
    const NAMING_ITEMS = [
        { value: 'char_chat', text: '角色名 - 对话名', badge: '推荐' },
        { value: 'char_only', text: '仅角色名' }
    ];
    const styleTextOf = (v) => (CHAPTER_STYLE_ITEMS.find((x) => x.value === v) || {}).text || v;
    const namingTextOf = (v) => (NAMING_ITEMS.find((x) => x.value === v) || {}).text || v;
    const includeSummaryOf = (v) => (v || '').trim() ? v.trim() : '未设置（保留全文）';
    const excludeSummaryOf = (v) => {
        const n = parseTagList(v || '').length;
        return n > 0 ? `${n} 个标签` : '未设置';
    };
    const stack = (...nodes) => {
        const wrap = document.createElement('div');
        wrap.className = 'novel-stack';
        nodes.forEach((n) => wrap.appendChild(n));
        return wrap;
    };
    const accRegistry = new Map();

    const panel = kit.createPanel({
        id: 'novel_stream_panel',
        title: '小说连载阅读',
        tabs: [
            { key: 'serial', label: '连载', icon: 'fa-solid fa-book-bookmark' },
            { key: 'filter', label: '过滤', icon: 'fa-solid fa-filter' },
            { key: 'file', label: '文件', icon: 'fa-solid fa-file-lines' }
        ],
        actions: [{ icon: 'fa-solid fa-file-arrow-down', label: '导出整本 TXT', onClick: () => deps.onExport() }],
        footer: [
            { label: '关闭', variant: 'ghost', onClick: () => panel.close() },
            { label: '导出整本 TXT', variant: 'primary', onClick: () => deps.onExport() }
        ],
        mount: document.body,
        focusFallback: '#extensionsMenuButton',
        onClose: () => { persistAccOpen(); deps.refreshStatus(); }
    });
    panel.dialog.classList.add('nvui-scope');

    function persistAccOpen() {
        const open = [];
        accRegistry.forEach((accEl, key) => { if (accEl.classList.contains('is-open')) open.push(key); });
        settings.acc_open = open;
        deps.save();
    }
    function applyAccOpen() {
        const open = new Set(Array.isArray(settings.acc_open) ? settings.acc_open : []);
        accRegistry.forEach((accEl, key) => accEl.setOpen(open.has(key)));
    }
    function trackAccordion(accEl, key) {
        accRegistry.set(key, accEl);
        // API 的 click 监听先于本监听执行，此处读到的已是切换后的开合态
        accEl.head.addEventListener('click', () => {
            const open = accEl.classList.contains('is-open');
            const list = new Set(Array.isArray(settings.acc_open) ? settings.acc_open : []);
            if (open) list.add(key); else list.delete(key);
            settings.acc_open = Array.from(list);
            deps.save();
        });
    }
    function withAccIcon(accEl, iconClass) {
        const title = accEl.querySelector('.nvui-acc-title');
        if (title) title.insertBefore(faIcon(iconClass), title.firstChild);
    }

    /* ---------- 连载 pane（design.md §1.4 序 1-6） ---------- */
    panel.addNode('serial', createPanelHeading('fa-solid fa-book-bookmark', '连载设置', `v${DEFAULT_SETTINGS.version}`));

    const serialStatus = createStatusLineRow('novel-serial-status', 'fa-solid fa-book-open', false);
    serialStatus.classList.add('novel-status-line');
    serialStatus.setText('尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
    panel.addNode('serial', serialStatus);

    panel.addSwitch('serial', {
        label: '显示连载状态',
        value: settings.enabled !== false,
        feature: true,
        onChange: (v) => {
            settings.enabled = v;
            deps.save();
            deps.refreshStatus();
        }
    });

    let styleAcc = null;
    const styleSeg = createSegmented({
        id: 'novel-chapter-style',
        label: '章节目录风格',
        value: settings.chapter_style,
        items: CHAPTER_STYLE_ITEMS,
        onChange: (v) => {
            settings.chapter_style = v;
            deps.save();
            if (styleAcc) styleAcc.setSummary(styleTextOf(v));
            deps.refreshStatus();
        }
    });
    const indentSwitch = kit.switchRow({
        label: '段落首行缩进（空两格）',
        value: settings.indent_paragraphs !== false,
        onChange: (v) => {
            settings.indent_paragraphs = v;
            deps.save();
            deps.refreshStatus();
        }
    });
    const styleHint = document.createElement('span');
    styleHint.className = 'nvui-hint';
    styleHint.textContent = '「第 X 章 · 角色名 (原楼层: Y)」最易被主流阅读器识别为可点击目录，同时标明酒馆原始楼层，回溯查验方便。';
    styleAcc = panel.addAccordion('serial', {
        title: '章节格式',
        summary: styleTextOf(settings.chapter_style),
        content: [stack(styleSeg, indentSwitch, styleHint)]
    });

    let userAcc = null;
    const userSwitch = kit.switchRow({
        label: '将主角（你的发言）融入小说',
        value: settings.include_user_dialogue === true,
        onChange: (v) => {
            deps.setFilters({ include_user_dialogue: v });
            deps.refreshStatus();
        }
    });
    const userHint = document.createElement('span');
    userHint.className = 'nvui-hint';
    userHint.textContent = '开启后，你在酒馆里的发言也会作为章节写入；关闭则只收录 AI 回复。';
    userAcc = panel.addAccordion('serial', {
        title: '主角对白',
        summary: settings.include_user_dialogue ? '已融入' : '未融入',
        content: [stack(userSwitch, userHint)]
    });

    const mechRows = [
        ['fa-solid fa-hourglass-start', '问候语延迟入书：发出第一句消息后，角色问候语才作为第 1 章入书'],
        ['fa-solid fa-arrows-rotate', '末尾替换：重新生成 / 划动分支后，整书按最新聊天记录重新派生，不残留旧文'],
        ['fa-solid fa-list-ol', '章节计数：导出口径与面板计数同源，永远一致']
    ].map(([ic, txt]) => {
        const row = createStatusLineRow('', ic, false);
        row.setText(txt);
        return row;
    });
    const mechAcc = panel.addAccordion('serial', {
        title: '内置智能机制',
        summary: '延迟入书 · 末尾替换 · 章节计数',
        content: [stack(...mechRows)]
    });

    /* ---------- 过滤 pane（design.md §1.4 序 1-3；检测器 v2.2.0 恢复，design.md §3.4） ---------- */
    panel.addNode('filter', createPanelHeading('fa-solid fa-filter', '过滤设置', `v${DEFAULT_SETTINGS.version}`));
    const overrideSwitch = kit.switchRow({
        label: '为当前会话单独设置过滤和主角对白',
        onChange: (enabled) => {
            deps.setOverride(enabled);
            deps.refreshStatus();
        }
    });
    const overrideInput = overrideSwitch.querySelector('input');
    panel.addNode('filter', overrideSwitch);

    /* 会话标签检测器：扫描聊天自定义标签一键增删名单（免手打，手机端友好） */
    let includeAcc = null;
    let excludeAcc = null;
    let detectorAcc = null;
    const detectorHint = document.createElement('span');
    detectorHint.className = 'nvui-hint';
    detectorHint.textContent = '自动扫描当前聊天里出现过的自定义标签：点「白」只保留该标签内的正文，点「黑」彻底剔除该标签块，再次点击取消。不必手打，手机端也能一键操作。';
    const tagDetector = createTagDetector({
        scanTags: deps.scanTags,
        getInclude: () => effective.include_tags || '',
        getExclude: () => effective.exclude_tags || '',
        onToggle: (tag, action) => {
            deps.setFilters(toggleTagMembership(effective.include_tags, effective.exclude_tags, tag, action));
            deps.refreshStatus();
        },
        onSummary: (total) => {
            if (detectorAcc) detectorAcc.setSummary(total > 0 ? `${total} 个标签` : '未检测到标签');
        }
    });
    detectorAcc = panel.addAccordion('filter', {
        title: '会话标签检测器',
        summary: '未检测到标签',
        content: [stack(detectorHint, tagDetector)]
    });

    const includeField = createTagField({
        id: 'novel-include-tags',
        label: '正文白名单',
        value: settings.include_tags || '',
        placeholder: '留空 = 保留全部正文',
        hint: '填入 story 等标签名。命中时提取标签内正文，未命中时保留原文供后续清洗。',
        onChange: (v, commit) => {
            deps.setFilters({ include_tags: v }, commit);
            deps.refreshStatus();
        }
    });
    includeAcc = panel.addAccordion('filter', {
        title: '正文白名单',
        summary: includeSummaryOf(settings.include_tags || ''),
        content: [includeField]
    });

    const excludeField = createTagField({
        id: 'novel-exclude-tags',
        label: '排除黑名单',
        value: settings.exclude_tags || '',
        placeholder: '半角逗号分隔，如 status,memory,ooc',
        hint: '这类标签及其包含的全部子内容会被完整剔除；思考链（think、cot 等）由引擎自动识别，无需手动填写。',
        onChange: (v, commit) => {
            deps.setFilters({ exclude_tags: v }, commit);
            deps.refreshStatus();
        }
    });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'nvui-btn is-sm';
    resetBtn.appendChild(faIcon('fa-solid fa-rotate-left'));
    resetBtn.appendChild(document.createTextNode('恢复默认'));
    const resetBtnBox = document.createElement('div');
    resetBtnBox.appendChild(resetBtn);
    resetBtn.addEventListener('click', () => {
        const dv = deps.defaultExcludeTags || '';
        deps.setFilters({ exclude_tags: dv });
        deps.refreshStatus();
    });
    excludeAcc = panel.addAccordion('filter', {
        title: '排除黑名单',
        summary: excludeSummaryOf(settings.exclude_tags || ''),
        content: [stack(excludeField, resetBtnBox)]
    });
    const preview = createFilterPreview();
    const previewAcc = panel.addAccordion('filter', {
        title: '过滤预览',
        summary: '原文与入书正文',
        content: [preview]
    });
    previewAcc.head.addEventListener('click', () => deps.refreshStatus());

    /* ---------- 文件 pane（design.md §1.4 序 1-3） ---------- */
    panel.addNode('file', createPanelHeading('fa-solid fa-file-lines', '文件与导出', `v${DEFAULT_SETTINGS.version}`));

    let namingAcc = null;
    const namingSeg = createSegmented({
        id: 'novel-naming-rule',
        label: '文件命名规则',
        value: settings.naming_rule,
        items: NAMING_ITEMS,
        onChange: (v) => {
            settings.naming_rule = v;
            deps.save();
            if (namingAcc) namingAcc.setSummary(namingTextOf(v));
            deps.refreshStatus();
        }
    });
    const namingHint = document.createElement('span');
    namingHint.className = 'nvui-hint';
    namingHint.textContent = '示例：角色名 - 对话名 → 艾莉丝 - 远征探索.txt；仅角色名 → 艾莉丝.txt。每个聊天独立成书，平行世界不串台。';
    namingAcc = panel.addAccordion('file', {
        title: '文件命名规则',
        summary: namingTextOf(settings.naming_rule),
        content: [stack(namingSeg, namingHint)]
    });

    let exportAcc = null;
    const exportStatus = createStatusLineRow('novel-export-status', 'fa-solid fa-file-arrow-down', true);
    exportStatus.classList.add('novel-status-line');
    exportStatus.setText('尚未导出：点击下方「导出整本 TXT」即可纯前端下载整本');
    const exportHint = document.createElement('span');
    exportHint.className = 'nvui-hint';
    exportHint.textContent = '纯前端本地下载，不经过任何服务器；文件带 UTF-8 BOM，微信读书 / ReadEra 等阅读器可直接识别目录。';
    exportAcc = panel.addAccordion('file', {
        title: '导出整本 TXT',
        summary: '尚未导出',
        content: [stack(exportStatus, exportHint)]
    });
    const rangeExport = createRangeExport(deps.onExport);
    const rangeAcc = panel.addAccordion('file', {
        title: '按章节范围导出',
        summary: '选择起止章',
        content: [rangeExport]
    });

    /* ---------- acc 标题图标 + 开合跟踪 ---------- */
    withAccIcon(styleAcc, 'fa-solid fa-heading');
    withAccIcon(userAcc, 'fa-solid fa-comment-dots');
    withAccIcon(mechAcc, 'fa-solid fa-wand-magic-sparkles');
    withAccIcon(detectorAcc, 'fa-solid fa-tags');
    withAccIcon(includeAcc, 'fa-solid fa-tag');
    withAccIcon(excludeAcc, 'fa-solid fa-ban');
    withAccIcon(previewAcc, 'fa-solid fa-eye');
    withAccIcon(namingAcc, 'fa-solid fa-file-signature');
    withAccIcon(exportAcc, 'fa-solid fa-file-arrow-down');
    withAccIcon(rangeAcc, 'fa-solid fa-list-ol');
    trackAccordion(styleAcc, 'style');
    trackAccordion(userAcc, 'user');
    trackAccordion(mechAcc, 'mech');
    trackAccordion(detectorAcc, 'detector');
    trackAccordion(includeAcc, 'include');
    trackAccordion(excludeAcc, 'exclude');
    trackAccordion(previewAcc, 'preview');
    trackAccordion(namingAcc, 'naming');
    trackAccordion(exportAcc, 'export');
    trackAccordion(rangeAcc, 'range');

    bindBottomNavArrowKeys(panel);

    const rawOpen = panel.open;
    panel.open = function () {
        panel.setTab('serial');
        applyAccOpen();
        rawOpen();
        deps.refreshStatus();
        guardOverlayClick(panel.overlay);
    };
    const exportButtons = panel.panel.querySelectorAll('.nvui-panel-actions .nvui-icon-btn, .nvui-panel-footer .is-primary');
    const generationNotice = document.createElement('div');
    generationNotice.className = 'novel-generation-notice nvui-hint';
    generationNotice.setAttribute('role', 'status');
    panel.panel.querySelector('.nvui-panel-footer').before(generationNotice);

    return {
        panel,
        refs: {
            serialStatus, exportStatus, exportAcc,
            renderContent: (model) => {
                effective = model.settings;
                overrideInput.checked = model.overridden;
                overrideInput.disabled = !model.canOverride;
                if (includeField.input.value !== effective.include_tags) includeField.input.value = effective.include_tags;
                if (excludeField.input.value !== effective.exclude_tags) excludeField.input.value = effective.exclude_tags;
                userSwitch.querySelector('input').checked = effective.include_user_dialogue === true;
                userAcc.setSummary(effective.include_user_dialogue ? '已融入' : '未融入');
                includeAcc.setSummary(includeSummaryOf(effective.include_tags));
                excludeAcc.setSummary(excludeSummaryOf(effective.exclude_tags));
                exportButtons.forEach((button) => { button.disabled = model.generating; });
                const message = model.generating ? '正在生成回复，完成后可导出。' : '';
                if (generationNotice.textContent !== message) generationNotice.textContent = message;
                if (!model.generating) tagDetector.render();
                if (previewAcc.classList.contains('is-open')) preview.render(model);
                rangeExport.render(model);
            }
        }
    };
}

/** 当前聊天记录（ESM 活绑定优先，杜绝模块级快照过期） */
function getCurrentChatLog() {
    if (Array.isArray(chat_raw)) return chat_raw;
    if (ctx && Array.isArray(ctx.chat)) return ctx.chat;
    if (typeof window !== 'undefined' && Array.isArray(window.chat)) return window.chat;
    return [];
}

function getChatKey(context = getStContext()) {
    const id = context.getCurrentChatId?.() ?? context.chatId;
    if (id == null) return context.chatMetadata ?? getCurrentChatLog();
    const group = context.groupId ?? context.selected_group;
    return group == null
        ? JSON.stringify(['character', context.characterId ?? context.this_chid ?? null, id])
        : JSON.stringify(['group', group, id]);
}

function isNovelGenerating(chatKey) {
    if (generation && generation.chatKey !== chatKey) return false;
    if (typeof stRuntime.isGenerating === 'function') return stRuntime.isGenerating();
    return stRuntime.is_send_press === true || !!document.getElementById('mes_stop')?.getClientRects().length;
}

/** 合并连续的聊天事件。导出始终读取实时聊天和宿主生成状态。 */
function refreshNovelUI() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(applyNovelUIRefresh, 300);
}

/** 立即刷新：重算章节 → 面板状态行 + 魔法棒副标（导出口径与计数同源） */
function applyNovelUIRefresh() {
    syncWandEntryState();
    if (!novelPanel?.dialog.open || novelPanel.overlay.classList.contains('is-closing')) return;
    const context = getStContext();
    const settings = getEffectiveSettings(context);
    const chatLog = getCurrentChatLog();
    const chatKey = getChatKey(context);
    const generating = isNovelGenerating(chatKey);
    const chapters = generating ? [] : computeChapters(settings, chatLog);
    uiRefs.renderContent?.({
        chatKey, chatLog, chapters, settings, generating,
        overridden: !!getNovelOverrides(context),
        canOverride: (context.getCurrentChatId?.() ?? context.chatId) != null
            && !!context.chatMetadata
            && (typeof context.saveMetadata === 'function' || typeof context.saveMetadataDebounced === 'function')
    });
    if (uiRefs.serialStatus) {
        if (generating) {
            uiRefs.serialStatus.setText(`当前书稿《${getBookTitle(settings)}》`);
            uiRefs.serialStatus.setMeta('');
        } else if (settings.enabled === false) {
            uiRefs.serialStatus.setText('连载状态已关闭，仍可导出当前会话。');
            uiRefs.serialStatus.setMeta('');
        } else if (chapters.length > 0) {
            uiRefs.serialStatus.setText(`当前书稿《${getBookTitle(settings)}》`);
            uiRefs.serialStatus.setMeta(`第 ${chapters.length} 章`);
        } else if (chatHasUserMessage(chatLog)) {
            uiRefs.serialStatus.setText(getEmptyBookMessage(settings, chatLog));
            uiRefs.serialStatus.setMeta('');
        } else {
            uiRefs.serialStatus.setText('尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
            uiRefs.serialStatus.setMeta('');
        }
    }
    updateExportStatusLine(chatKey);
}

function formatExportTime(d) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return isToday ? `今天 ${hh}:${mm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 刷新「文件」页导出状态行 + 折叠组摘要 */
function updateExportStatusLine(chatKey = getChatKey()) {
    if (!uiRefs.exportStatus) return;
    const lastExport = recentExports.get(chatKey);
    if (!lastExport) {
        uiRefs.exportStatus.setText('尚未导出：点击下方「导出整本 TXT」即可纯前端下载整本');
        uiRefs.exportStatus.setMeta('');
        uiRefs.exportStatus.setFile('');
        uiRefs.exportStatus.setSuccess(false);
        if (uiRefs.exportAcc) uiRefs.exportAcc.setSummary('尚未导出');
        return;
    }
    const timeText = formatExportTime(lastExport.time);
    uiRefs.exportStatus.setText(`已发起下载《${lastExport.bookTitle}》`);
    uiRefs.exportStatus.setMeta(timeText);
    uiRefs.exportStatus.setFile(`${lastExport.fileName} · 共 ${lastExport.chapterCount} 章`);
    uiRefs.exportStatus.setSuccess(true);
    if (uiRefs.exportAcc) uiRefs.exportAcc.setSummary(`${timeText} · 第 ${lastExport.chapterCount} 章`);
}

/** 一键导出整本 TXT（纯前端 Blob 下载 + UTF-8 BOM + 一次性 toast + 状态行刷新） */
function exportNovelText(kit = globalThis.NVUI, range) {
    const chatKey = getChatKey();
    if (isNovelGenerating(chatKey)) {
        kit.showToast({ message: '正在生成回复，完成后可导出。', type: 'warn' });
        return;
    }
    const settings = getEffectiveSettings();
    const chatLog = getCurrentChatLog();
    let composed;
    let selected;
    try {
        const chapters = computeChapters(settings, chatLog);
        selected = range ? getRangeChapters(chapters, chatLog, chatKey, range) : chapters;
        if (!selected) {
            applyNovelUIRefresh();
            kit.showToast({ message: '所选章节已变化，请确认更新后的范围。', type: 'warn' });
            return;
        }
        composed = composeNovelExport(settings, chatLog, selected, range);
    } catch (err) {
        console.warn('[AutoSaveTxt] 导出编排失败:', err);
        kit.showToast({ message: '导出失败：整本编排时发生错误，请查看浏览器控制台。', type: 'danger', duration: 3200 });
        return;
    }
    if (!composed.chapterCount) {
        kit.showToast({ message: getEmptyBookMessage(settings, chatLog), type: 'warn', duration: 3200 });
        return;
    }
    const retained = stoppedReply?.chatKey === chatKey && stoppedReply.reply.mes === stoppedReply.text
        && selected.some(({ index }) => chatLog[index] === stoppedReply.reply);
    let url;
    let a;
    try {
        const blob = new Blob([composed.text], { type: 'text/plain;charset=utf-8' });
        url = URL.createObjectURL(blob);
        a = document.createElement('a');
        a.href = url;
        a.download = composed.fileName;
        document.body.appendChild(a);
        a.click();
    } catch (err) {
        console.warn('[AutoSaveTxt] 导出下载失败:', err);
        kit.showToast({ message: '导出失败：浏览器未能生成下载文件，请重试。', type: 'danger', duration: 3200 });
        return;
    } finally {
        a?.remove();
        // 给浏览器时间接收 Blob，包含下载触发失败时的回收。
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const { bookTitle, fileName, chapterCount } = composed;
    recentExports.set(chatKey, { bookTitle, fileName, chapterCount, time: new Date() });
    updateExportStatusLine(chatKey);
    const notice = retained ? '。包含生成中断时保留的回复。' : '';
    kit.showToast({ message: `已发起下载《${bookTitle}》共 ${chapterCount} 章（${fileName}）${notice}`, type: 'success', duration: 3200 });
}

/* ---------- 魔法棒菜单入口（design.md §9，宿主 DOM） ---------- */

function showNovelHostNotice(message, type) {
    const hostToast = globalThis.toastr;
    if (typeof hostToast?.[type] === 'function') hostToast[type](message);
    else window.alert(message);
}

function injectWandEntry() {
    if (typeof document === 'undefined') return false;
    if (document.getElementById('novel-wand-menu-item')) return true;

    const menu = document.getElementById('extensionsMenu');
    if (!menu) return false;

    // 标记与酒馆官方扩展菜单项一致：#extensionsMenu 的直接子元素 + list-group-item 外观
    const item = document.createElement('div');
    item.id = 'novel-wand-menu-item';
    item.className = 'list-group-item flex-container flexGap5';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.title = '小说连载阅读：打开设置面板（章节格式 / 过滤配置 / 导出整本 TXT）';
    item.innerHTML = '<div class="fa-solid fa-book-bookmark extensionsMenuExtensionButton"></div><span class="novel-wand-item-label">小说连载阅读</span><span class="novel-wand-item-state" id="novel_wand_menu_state"></span>';

    // 注意：不能 stopPropagation，酒馆靠 body/html 上的点击监听来收起这个下拉菜单
    item.addEventListener('click', () => {
        if (novelPanel) novelPanel.open();
        else if (panelLoadFailed) showNovelHostNotice('面板资源加载失败。请刷新页面；若仍失败，请检查扩展安装是否完整。', 'error');
        else showNovelHostNotice('面板正在加载，请稍后再打开。', 'info');
    });
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            item.click();
        }
    });

    menu.appendChild(item);
    syncWandEntryState();
    return true;
}

/** 魔法棒菜单项状态副标（连载中 / 已关闭），由 settings.enabled 驱动 */
function syncWandEntryState() {
    if (typeof document === 'undefined') return;
    const stateEl = document.getElementById('novel_wand_menu_state');
    if (!stateEl) return;
    const settings = getSettings();
    const on = !!settings.enabled;
    stateEl.textContent = panelLoadFailed ? '加载失败' : !novelPanel ? '正在加载' : on ? '连载中' : '已关闭';
    stateEl.classList.toggle('is-on', !!novelPanel && on);
}

/* ==================== 事件接线与启动 ==================== */

function bindNovelEvents() {
    if (!eventSource || !event_types) return;
    const on = (name, handler) => {
        if (event_types[name]) eventSource.on(event_types[name], handler);
    };
    function start(type, _options, dryRun = false) {
        if (dryRun || type === 'quiet' || type === 'impersonate') return;
        const chatKey = getChatKey();
        const before = getCurrentChatLog().at(-1);
        generation = { chatKey, before, text: before?.mes };
        stoppedReply = null;
        refreshNovelUI();
    }
    on('GENERATION_STARTED', start);
    on('GROUP_WRAPPER_STARTED', ({ type } = {}) => start(type));
    function rememberInterruptedReply() {
        if (generation?.chatKey === getChatKey()) {
            const chatLog = getCurrentChatLog();
            const stream = getStContext().streamingProcessor;
            const streamingReply = chatLog[stream?.messageId];
            const reply = streamingReply ?? chatLog.at(-1);
            if (reply && !reply.is_user && reply.mes && (reply !== generation.before || reply.mes !== generation.text)) {
                if (reply === streamingReply && stream?.firstMessageText === '...'
                    && reply.mes === stream.firstMessageText && stream.result !== reply.mes) {
                    let swipes = interruptedStreamPlaceholders.get(reply);
                    if (!swipes) {
                        swipes = new Set();
                        interruptedStreamPlaceholders.set(reply, swipes);
                    }
                    swipes.add(reply.swipe_id ?? null);
                } else {
                    stoppedReply = { chatKey: generation.chatKey, reply, text: reply.mes };
                }
            }
        }
    }
    on('GENERATION_STOPPED', () => {
        rememberInterruptedReply();
        refreshNovelUI();
    });
    function clearInterruptedPlaceholder(messageIndex) {
        const message = getCurrentChatLog()[messageIndex];
        if (message) interruptedStreamPlaceholders.get(message)?.delete(message.swipe_id ?? null);
    }
    on('GENERATION_ENDED', () => {
        const stream = getStContext().streamingProcessor;
        if (stream?.isStopped) rememberInterruptedReply();
        else if (stream?.result && generation?.chatKey === getChatKey()) clearInterruptedPlaceholder(stream.messageId);
        refreshNovelUI();
    });
    on('MESSAGE_EDITED', (index) => {
        clearInterruptedPlaceholder(index);
        refreshNovelUI();
    });
    for (const name of ['MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_SWIPED',
        'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'CHAT_DELETED', 'GROUP_CHAT_DELETED', 'GROUP_WRAPPER_FINISHED',
        'CHARACTER_PAGE_LOADED', 'GROUP_UPDATED']) {
        on(name, refreshNovelUI);
    }
    on('CHAT_CHANGED', applyNovelUIRefresh);
}

async function init() {
    // 魔法棒菜单项：立即就位 + 500ms 短轮询兜底宿主重绘（最多 20 次）
    injectWandEntry();
    let tries = 0;
    const wandTimer = setInterval(() => {
        tries++;
        injectWandEntry();
        if ((document.getElementById('novel-wand-menu-item') && tries > 3) || tries > 20) {
            clearInterval(wandTimer);
        }
    }, 500);

    bindNovelEvents();
    try {
        const kit = await nvuiAssetsReady;
        if (kit) {
            const built = buildNovelPanel({
                settings: getSettings(),
                defaultExcludeTags: DEFAULT_SETTINGS.exclude_tags,
                scanTags: () => scanChatTags(getCurrentChatLog()),
                save: () => { if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced(); },
                setFilters: setNovelFilterSettings,
                setOverride: setNovelOverrideEnabled,
                refreshStatus: applyNovelUIRefresh,
                onExport: (range) => exportNovelText(kit, range)
            }, kit);
            novelPanel = built.panel;
            uiRefs = built.refs;
        }
    } catch (error) {
        console.warn('[AutoSaveTxt] 面板初始化失败:', error);
    }
    panelLoadFailed = !novelPanel;
    injectWandEntry();

    // 视口变化后重算 tabs 粘连指示器（Kit API 未绑 resize，业务补）；rAF 节流避免连续强制回流
    if (typeof window !== 'undefined') {
        let resizeRaf = 0;
        window.addEventListener('resize', () => {
            if (resizeRaf) return;
            resizeRaf = requestAnimationFrame(() => {
                resizeRaf = 0;
                if (novelPanel) novelPanel.syncIndicator();
            });
        });
    }

    applyNovelUIRefresh();
}

if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
