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
/* ---------- NVUI Kit 资产加载（CDN 在线优先，本地 vendor 兜底） ---------- */
// Kit 由上游独立维护且持续迭代（github.com/zgy-beep/ui-kit，语义化版本承诺：破坏性变更升大版本），
// @2 锚点经 jsDelivr 自动跟随 2.x 最新，升级无需重新 vendor；CDN 不可达（离线 / 内网 / 挂起超时）
// 时回退到随包 vendor 的 ./ui-kit/（锁定 v2.3.0），保证离线可用。
// Kit 缺陷不修本地副本，一律提上游 issue（docs/decisions/OPEN-DECISIONS.md）。
const NVUI_CDN_BASE = 'https://cdn.jsdelivr.net/gh/zgy-beep/ui-kit@2';
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
    if (globalThis.NVUI) return;
    try {
        await loadScriptOnce(`${NVUI_CDN_BASE}/nvui-api.js`);
    } catch (err) { /* 落入下方本地兜底 */ }
    if (!globalThis.NVUI) {
        await loadScriptOnce(localKitUrl('nvui-api.js'));
    }
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
            await loadNvuiScript();
            await cssReady;
            return !!globalThis.NVUI;
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
    version: '2.2.0',                 // 设置结构版本（仅 stamped，无迁移分支）
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

/**
 * 健壮的文件名清洗（防 Windows 非法字符与截断）
 */
function sanitizeFilename(rawName) {
    if (!rawName || typeof rawName !== 'string') {
        return '我的小说连载';
    }
    let safeName = rawName
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\.{2,}/g, '_')
        .trim();
    safeName = safeName.slice(0, 150).replace(/[. ]+$/, '');

    // 防御 Windows 经典保留设备名 (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(safeName)) {
        safeName = `${safeName}_novel`;
    }

    return safeName || '我的小说连载';
}

/**
 * 获取当前连载小说书名
 * 支持根据【文件命名规则】自动区分同一角色卡的不同对话（平行世界、重开等）
 * 支持自动识别多角色群聊 (Group Chat) 并自动聚合为同一部群小说
 */
function getBookTitle(settings, speakerName = '') {
    // 1. 优先检测是否处于群聊 (Group Chat)
    const selectedGroup = (typeof ctx.selected_group !== 'undefined')
        ? ctx.selected_group
        : (typeof window !== 'undefined' ? window.selected_group : null);

    if (selectedGroup) {
        let groupName = '群聊纪事';
        const groupList = ctx.groups || (typeof window !== 'undefined' ? window.groups : null) || [];
        if (Array.isArray(groupList)) {
            const grp = groupList.find(g => g.id === selectedGroup);
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
    const chid = (typeof ctx.this_chid !== 'undefined') ? ctx.this_chid : (typeof this_chid_raw !== 'undefined' ? this_chid_raw : window.this_chid);
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
function getBookFileName(settings) {
    return `${sanitizeFilename(getAccountPrefix() + getBookTitle(settings))}.txt`;
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
        const text = (m && typeof m.mes === 'string') ? m.mes : '';
        if (!text) continue;
        const stripped = text
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        tagRegex.lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(stripped)) !== null) {
            const tag = match[1].toLowerCase();
            if (SCAN_IGNORE_TAGS.has(tag)) continue;
            counts.set(tag, (counts.get(tag) || 0) + 1);
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
    let text = rawText;

    // 前置清洗：彻底过滤 HTML 注释 (如 <!-- Lorebook: ... -->) 与 Markdown 多媒体图片
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/!\[.*?\]\(.*?\)/g, '');
    text = text.replace(/<img[^>]*>/gi, '');

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
                const openTagRegex = new RegExp(`<\\s*${safeTag}[^>]*>`, 'i');
                if (!openTagRegex.test(beforeClosing)) {
                    // 开篇内容中不存在对应开标签，证实这是被省略了开标签的前置内容，彻底切除
                    text = text.slice(match[0].length);
                    continue;
                }
            }
        }
        break;
    }

    // 泛化剔除思考/思维链/草稿/规划标签：标签名拆成字母段后有完整段命中名单才算辅助标签
    // （think_2 / agent-cot 等分隔变体照常识别），杜绝 <planets> / <airplane> / <cotton> 子串误伤。
    // 判定与检测器共用模块级 isAuxiliaryTag（防漂移：「自动」徽标必须与引擎实际行为一致）
    const isAuxTag = isAuxiliaryTag;
    const auxOpenRe = /<\s*([a-zA-Z][a-zA-Z0-9_\-~.:#]*)[^>]*>/gi;

    // 成对剔除：逐个找出辅助标签开标签，按真实标签名精确配对剔除
    const scannedAux = new Set();
    let auxScan;
    while ((auxScan = auxOpenRe.exec(text)) !== null) {
        const auxName = auxScan[1];
        const auxKey = auxName.toLowerCase();
        if (scannedAux.has(auxKey) || !isAuxTag(auxKey)) continue;
        scannedAux.add(auxKey);
        const safeAuxName = auxName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`<\\s*${safeAuxName}[^>]*>[\\s\\S]*?<\\/\\s*${safeAuxName}\\s*>\\s*`, 'gi'), '');
        auxOpenRe.lastIndex = 0; // 文本已变，从头重扫（同名标签已被 scannedAux 去重，不会死循环）
    }

    // 剔除残留的第一个未闭合辅助标签及其后全部内容（max_tokens 截断未输出闭合标签的情况）
    auxOpenRe.lastIndex = 0;
    while ((auxScan = auxOpenRe.exec(text)) !== null) {
        if (isAuxTag(auxScan[1])) {
            text = text.slice(0, auxScan.index);
            break;
        }
    }

    // 阶段一【白名单模式】：优先提取指定标签内的正文
    const includeTags = parseTagList(settings.include_tags);

    if (includeTags.length > 0) {
        const extractedParts = [];
        for (const tag of includeTags) {
            const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tagRegex = new RegExp(`<\\s*(${safeTag})[^>]*>([\\s\\S]*?)<\\/\\s*\\1\\s*>`, 'gi');
            let match;
            while ((match = tagRegex.exec(text)) !== null) {
                if (match[2] && match[2].trim()) {
                    extractedParts.push(match[2].trim());
                }
            }
        }
        if (extractedParts.length > 0) {
            text = extractedParts.join('\n\n');
        }
    }

    // 阶段二【黑名单模式】：深度剔除不要的标签块（支持成对、开篇无开标签、尾部未闭合等各类异常形态）
    const excludeTags = parseTagList(
        (typeof settings.exclude_tags === 'string')
            ? settings.exclude_tags
            : (DEFAULT_SETTINGS.exclude_tags || '')
    );

    if (excludeTags.length > 0) {
        // 长标签在前，避免 alternation 前缀遮蔽（短标签抢先在长标签名上命中会导致配对断裂）
        const sortedTags = excludeTags.slice().sort((a, b) => b.length - a.length);
        const alt = sortedTags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

        // 1. 成对标签块一趟剔除（合并 alternation + 反向引用，替代逐标签全文本扫描）
        text = text.replace(new RegExp(`<\\s*(${alt})[^>]*>[\\s\\S]*?<\\/\\s*\\1\\s*>\\s*`, 'gi'), '');

        // 2. 一趟扫描确定各标签残留的开 / 闭标签存在性
        const presenceRe = new RegExp(`<\\s*(\\/)?\\s*(${alt})[^>]*>`, 'gi');
        const hasOpen = new Set();
        const hasClose = new Set();
        let presenceMatch;
        while ((presenceMatch = presenceRe.exec(text)) !== null) {
            (presenceMatch[1] ? hasClose : hasOpen).add(presenceMatch[2].toLowerCase());
        }

        // 3. 仅对确有残留形态的标签定点清除：无开有闭 → 切除开篇孤立闭块；有开无闭 → 切除末尾未闭合块
        for (const tag of excludeTags) {
            const key = tag.toLowerCase();
            const safeTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!hasOpen.has(key) && hasClose.has(key)) {
                text = text.replace(new RegExp(`^[\\s\\S]*?<\\/\\s*${safeTag}\\s*>\\s*`, 'i'), '');
            }
            if (hasOpen.has(key) && !hasClose.has(key)) {
                text = text.replace(new RegExp(`<\\s*${safeTag}[^>]*>[\\s\\S]*$`, 'i'), '');
            }
        }
    }

    // 阶段三【网页与排版杂质清洗】
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/?[a-zA-Z0-9_\-~.:#]+[^>]*>/g, '');

    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // 阶段四【中文出版小说段落规范化】
    const paragraphs = text
        .split(/\r?\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    const shouldIndent = settings.indent_paragraphs !== false;
    if (shouldIndent) {
        return paragraphs.map(p => `　　${p}`).join('\n\n');
    }

    return paragraphs.join('\n\n');
}

// 清洗结果缓存：同一会话内避免每条消息被 cleanNovelText 重复全量正则清洗（O(n²) 性能优化）
const cleanTextCache = { sig: '', map: new Map() };

function getCleanMessageSig(settings) {
    return `${settings.include_tags || ''}|${settings.exclude_tags || ''}|${settings.indent_paragraphs !== false}`;
}

/**
 * 带缓存的消息清洗：设置签名变化、消息对象被替换（Regenerate/滑动分支）或 mes 被原地改写
 * （酒馆编辑消息/切换分支均直接改写 msg.mes）时自动重洗，确保缓存绝不失真
 */
function getCleanedMessage(msg, index, settings) {
    if (!msg) return '';
    const sig = getCleanMessageSig(settings);
    if (cleanTextCache.sig !== sig) {
        cleanTextCache.sig = sig;
        cleanTextCache.map.clear();
    }
    const cached = cleanTextCache.map.get(index);
    if (cached && cached.src === msg && cached.mes === msg.mes) return cached.text;
    const text = cleanNovelText(msg.mes || '', settings);
    cleanTextCache.map.set(index, { src: msg, mes: msg.mes, text });
    return text;
}

/* ==================== 章节派生区（v2.0.0 无状态架构，Spec §5.2） ==================== */

/**
 * 聊天记录中是否存在用户消息（问候语延迟入书规则的唯一判据，与 derive 共用防漂移）
 */
function chatHasUserMessage(chatLog) {
    if (!Array.isArray(chatLog)) return false;
    for (const m of chatLog) {
        if (m && m.is_user) return true;
    }
    return false;
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
    let no = 0;
    for (let i = 0; i < chatLog.length; i++) {
        const msg = chatLog[i];
        if (!msg) continue;
        if (msg.is_user && !settings.include_user_dialogue) continue;
        const text = getCleanedMessage(msg, i, settings);
        if (!text) continue;
        no++;
        const speaker = msg.name || (msg.is_user ? '你' : '旁白');
        chapters.push({ index: i, no, speaker, text });
    }
    // 修剪清洗缓存中已不存在楼层的残留条目（删除中间楼层后索引前移，旧条目永不命中）
    if (cleanTextCache.map.size > chatLog.length) {
        for (const idx of cleanTextCache.map.keys()) {
            if (idx >= chatLog.length) cleanTextCache.map.delete(idx);
        }
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
function buildNovelText(settings, chatLog) {
    const bookTitle = getBookTitle(settings);
    const parts = [`《${bookTitle}》\n\n`];
    let chapterCount = 0;

    for (const ch of computeChapters(settings, chatLog)) {
        chapterCount++;
        const floor = ch.index + 1;
        if (settings.chapter_style === 'separator') {
            parts.push(`* * *\n\n${ch.text}\n\n\n`);
        } else if (settings.chapter_style === 'dialogue') {
            parts.push(`【${ch.speaker}】\n\n${ch.text}\n\n\n`);
        } else if (settings.chapter_style === 'numbered') {
            parts.push(`第 ${ch.no} 节 · ${ch.speaker}\n\n${ch.text}\n\n\n`);
        } else {
            parts.push(`第 ${ch.no} 章 · ${ch.speaker} (原楼层: ${floor})\n\n${ch.text}\n\n\n`);
        }
    }

    return { bookTitle, novelText: parts.join(''), chapterCount };
}

/**
 * 导出载荷纯函数（可 node 测试）：文件名遵循命名规则，text 已带 UTF-8 BOM
 */
function composeNovelExport(settings, chatLog) {
    const { bookTitle, novelText, chapterCount } = buildNovelText(settings, chatLog);
    return {
        fileName: getBookFileName(settings),
        text: '\uFEFF' + novelText,
        chapterCount
    };
}

/* ==================== UI 区（NVUI Kit 面板 + 魔法棒入口） ==================== */

let novelPanel = null;                 // NVUI 面板控制器
let uiRefs = {};                       // 状态行 / 导出状态行 / 导出折叠组等 DOM 引用
let refreshTimer = 0;                  // refreshNovelUI 防抖句柄
let lastChatLogRef = null;             // 聊天记录数组引用（切换即整表失效清洗缓存）
let lastExport = { fileName: '', chapterCount: 0, time: null }; // 最近一次导出（会话内记忆，不落设置）

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
    input.addEventListener('change', () => {
        if (typeof options.onChange === 'function') options.onChange(input.value);
    });
    const hint = document.createElement('span');
    hint.className = 'nvui-hint';
    hint.textContent = options.hint || '';
    root.appendChild(label);
    root.appendChild(input);
    root.appendChild(hint);
    root.input = input;
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
    render();
    return root;
}

/** 焦点陷阱：Tab / Shift+Tab 在面板可见控件间循环（aria-modal 的必要配套，design.md §7.2） */
function bindPanelFocusTrap(panelEl) {
    panelEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.prototype.slice.call(panelEl.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!panelEl.contains(active)) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
            return;
        }
        if (e.shiftKey && (active === first || active === panelEl)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    });
}

/** tabs / 底部导航方向键切换（API 只绑 click，业务补，design.md §7.3） */
function bindPanelArrowKeys(panel, tabKeys) {
    const bind = (nav) => {
        if (!nav) return;
        nav.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const items = Array.prototype.slice.call(nav.querySelectorAll('.nvui-tab, .nvui-bottom-nav-item'));
            const idx = items.indexOf(document.activeElement);
            if (idx < 0) return;
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = items[(idx + dir + items.length) % items.length];
            next.focus();
            panel.setTab(tabKeys[items.indexOf(next)]);
        });
    };
    bind(panel.tabs);
    bind(panel.bottomNav);
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
function buildNovelPanel(deps) {
    const settings = deps.settings;

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

    const panel = NVUI.createPanel({
        id: 'novel_stream_panel',
        title: '小说连载阅读',
        tabs: [
            { key: 'serial', label: '连载', icon: 'fa-solid fa-book-bookmark' },
            { key: 'filter', label: '过滤', icon: 'fa-solid fa-filter' },
            { key: 'file', label: '文件', icon: 'fa-solid fa-file-lines' }
        ],
        actions: [{ icon: 'fa-solid fa-file-arrow-down', label: '导出整本 TXT', onClick: deps.onExport }],
        footer: [
            { label: '关闭', variant: 'ghost', onClick: () => panel.close() },
            { label: '导出整本 TXT', variant: 'primary', onClick: deps.onExport }
        ],
        mount: document.body,
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
    panel.addNode('serial', createPanelHeading('fa-solid fa-book-bookmark', '连载设置', 'v2.2.0'));

    const serialStatus = createStatusLineRow('novel-serial-status', 'fa-solid fa-book-open', false);
    serialStatus.classList.add('novel-status-line');
    serialStatus.setText('尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
    panel.addNode('serial', serialStatus);

    panel.addSwitch('serial', {
        label: '开启小说自动连载',
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
    const indentSwitch = NVUI.switchRow({
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
    const userSwitch = NVUI.switchRow({
        label: '将主角（你的发言）融入小说',
        value: settings.include_user_dialogue === true,
        onChange: (v) => {
            settings.include_user_dialogue = v;
            deps.save();
            if (userAcc) userAcc.setSummary(v ? '已融入' : '未融入');
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
    panel.addNode('filter', createPanelHeading('fa-solid fa-filter', '过滤设置', 'v2.2.0'));

    /* 会话标签检测器：扫描聊天自定义标签一键增删名单（免手打，手机端友好） */
    let includeAcc = null;
    let excludeAcc = null;
    let detectorAcc = null;
    const detectorHint = document.createElement('span');
    detectorHint.className = 'nvui-hint';
    detectorHint.textContent = '自动扫描当前聊天里出现过的自定义标签：点「白」只保留该标签内的正文，点「黑」彻底剔除该标签块，再次点击取消。不必手打，手机端也能一键操作。';
    const tagDetector = createTagDetector({
        scanTags: deps.scanTags,
        getInclude: () => settings.include_tags || '',
        getExclude: () => settings.exclude_tags || '',
        onToggle: (tag, action) => {
            const next = toggleTagMembership(settings.include_tags, settings.exclude_tags, tag, action);
            settings.include_tags = next.include_tags;
            settings.exclude_tags = next.exclude_tags;
            includeField.input.value = next.include_tags;
            excludeField.input.value = next.exclude_tags;
            deps.save();
            if (includeAcc) includeAcc.setSummary(includeSummaryOf(next.include_tags));
            if (excludeAcc) excludeAcc.setSummary(excludeSummaryOf(next.exclude_tags));
            tagDetector.render();
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
        hint: '填入如 story 后，仅提取 <story>...</story> 内部内容，其余全部丢弃；不确定预设是否有正文标签时，请留空。',
        onChange: (v) => {
            settings.include_tags = v;
            deps.save();
            if (includeAcc) includeAcc.setSummary(includeSummaryOf(v));
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
        onChange: (v) => {
            settings.exclude_tags = v;
            deps.save();
            if (excludeAcc) excludeAcc.setSummary(excludeSummaryOf(v));
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
        excludeField.input.value = dv;
        settings.exclude_tags = dv;
        deps.save();
        if (excludeAcc) excludeAcc.setSummary(excludeSummaryOf(dv));
        deps.refreshStatus();
    });
    excludeAcc = panel.addAccordion('filter', {
        title: '排除黑名单',
        summary: excludeSummaryOf(settings.exclude_tags || ''),
        content: [stack(excludeField, resetBtnBox)]
    });

    /* ---------- 文件 pane（design.md §1.4 序 1-3） ---------- */
    panel.addNode('file', createPanelHeading('fa-solid fa-file-lines', '文件与导出', 'v2.2.0'));

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

    /* ---------- acc 标题图标 + 开合跟踪 ---------- */
    withAccIcon(styleAcc, 'fa-solid fa-heading');
    withAccIcon(userAcc, 'fa-solid fa-comment-dots');
    withAccIcon(mechAcc, 'fa-solid fa-wand-magic-sparkles');
    withAccIcon(detectorAcc, 'fa-solid fa-tags');
    withAccIcon(includeAcc, 'fa-solid fa-tag');
    withAccIcon(excludeAcc, 'fa-solid fa-ban');
    withAccIcon(namingAcc, 'fa-solid fa-file-signature');
    withAccIcon(exportAcc, 'fa-solid fa-file-arrow-down');
    trackAccordion(styleAcc, 'style');
    trackAccordion(userAcc, 'user');
    trackAccordion(mechAcc, 'mech');
    trackAccordion(detectorAcc, 'detector');
    trackAccordion(includeAcc, 'include');
    trackAccordion(excludeAcc, 'exclude');
    trackAccordion(namingAcc, 'naming');
    trackAccordion(exportAcc, 'export');

    /* ---------- 业务补齐：焦点陷阱 / 方向键 / 打开行为 ---------- */
    bindPanelFocusTrap(panel.panel);
    bindPanelArrowKeys(panel, ['serial', 'filter', 'file']);

    const rawOpen = panel.open;
    panel.open = function () {
        rawOpen();
        panel.setTab('serial');
        applyAccOpen();
        deps.refreshStatus();
        guardOverlayClick(panel.overlay);
    };

    return {
        panel,
        refs: { serialStatus, exportStatus, exportAcc, renderTagChips: () => tagDetector.render() }
    };
}

/** 当前聊天记录（ESM 活绑定优先，杜绝模块级快照过期） */
function getCurrentChatLog() {
    if (Array.isArray(chat_raw)) return chat_raw;
    if (ctx && Array.isArray(ctx.chat)) return ctx.chat;
    if (typeof window !== 'undefined' && Array.isArray(window.chat)) return window.chat;
    return [];
}

/** 事件入口：防抖 300ms（Spec §5.4） */
function refreshNovelUI() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(applyNovelUIRefresh, 300);
}

/** 立即刷新：重算章节 → 面板状态行 + 魔法棒副标（导出口径与计数同源） */
function applyNovelUIRefresh() {
    const settings = getSettings();
    const chatLog = getCurrentChatLog();
    if (chatLog !== lastChatLogRef) {
        cleanTextCache.map.clear();
        lastChatLogRef = chatLog;
    }
    const chapters = computeChapters(settings, chatLog);
    if (uiRefs.serialStatus) {
        if (settings.enabled === false) {
            uiRefs.serialStatus.setText('连载已关闭：AI 回复不会入书，仍可随时导出整本');
            uiRefs.serialStatus.setMeta('');
        } else if (chapters.length > 0) {
            uiRefs.serialStatus.setText(`当前书稿《${getBookTitle(settings)}》`);
            uiRefs.serialStatus.setMeta(`第 ${chapters.length} 章`);
        } else if (chatHasUserMessage(chatLog)) {
            uiRefs.serialStatus.setText('当前聊天没有可入书的有效正文：请检查「过滤」页的白 / 黑名单是否过于严格');
            uiRefs.serialStatus.setMeta('');
        } else {
            uiRefs.serialStatus.setText('尚未开始：发出第一句消息后，角色问候语将作为第 1 章入书');
            uiRefs.serialStatus.setMeta('');
        }
    }
    // 检测器 chips 随刷新重渲染（签名守门：无变化不重建 DOM，不会打断用户连点）
    if (uiRefs.renderTagChips) uiRefs.renderTagChips();
    syncWandEntryState();
}

function formatExportTime(d) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const now = new Date();
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return isToday ? `今天 ${hh}:${mm}` : `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

/** 刷新「文件」页导出状态行 + 折叠组摘要 */
function updateExportStatusLine() {
    if (!uiRefs.exportStatus) return;
    if (!lastExport.time) {
        uiRefs.exportStatus.setText('尚未导出：点击下方「导出整本 TXT」即可纯前端下载整本');
        uiRefs.exportStatus.setMeta('');
        uiRefs.exportStatus.setFile('');
        uiRefs.exportStatus.setSuccess(false);
        if (uiRefs.exportAcc) uiRefs.exportAcc.setSummary('尚未导出');
        return;
    }
    const timeText = formatExportTime(lastExport.time);
    uiRefs.exportStatus.setText(`已导出《${getBookTitle(getSettings())}》`);
    uiRefs.exportStatus.setMeta(timeText);
    uiRefs.exportStatus.setFile(`${lastExport.fileName} · 共 ${lastExport.chapterCount} 章`);
    uiRefs.exportStatus.setSuccess(true);
    if (uiRefs.exportAcc) uiRefs.exportAcc.setSummary(`${timeText} · 第 ${lastExport.chapterCount} 章`);
}

/** 一键导出整本 TXT（纯前端 Blob 下载 + UTF-8 BOM + 一次性 toast + 状态行刷新） */
function exportNovelText() {
    const settings = getSettings();
    let composed;
    try {
        composed = composeNovelExport(settings, getCurrentChatLog());
    } catch (err) {
        console.warn('[AutoSaveTxt] 导出编排失败:', err);
        NVUI.showToast({ message: '导出失败：整本编排时发生错误，请查看浏览器控制台。', type: 'danger', duration: 3200 });
        return;
    }
    if (!composed.chapterCount) {
        NVUI.showToast({ message: '当前没有可导出的有效章节：请先开始对话，或检查白 / 黑名单是否过滤过严。', type: 'warn', duration: 3200 });
        return;
    }
    try {
        const blob = new Blob([composed.text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = composed.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // 延迟撤销：浏览器异步开始下载，同步 revoke 在 Firefox 下会取消本次下载
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.warn('[AutoSaveTxt] 导出下载失败:', err);
        NVUI.showToast({ message: '导出失败：浏览器未能生成下载文件，请重试。', type: 'danger', duration: 3200 });
        return;
    }
    lastExport.fileName = composed.fileName;
    lastExport.chapterCount = composed.chapterCount;
    lastExport.time = new Date();
    updateExportStatusLine();
    NVUI.showToast({ message: `已导出《${getBookTitle(settings)}》共 ${composed.chapterCount} 章（${composed.fileName}）`, type: 'success', duration: 3200 });
}

/* ---------- 魔法棒菜单入口（design.md §9，宿主 DOM） ---------- */

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
    const activate = () => { if (novelPanel) novelPanel.open(); };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
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
    stateEl.textContent = on ? '连载中' : '已关闭';
    stateEl.classList.toggle('is-on', on);
}

/* ==================== 事件接线与启动 ==================== */

function bindNovelEvents() {
    if (!eventSource || !event_types) return;
    // 全部无状态：每个处理器只做 UI 刷新（禁止任何跨消息持久状态 / 签名 / 缓冲）
    eventSource.on(event_types.MESSAGE_RECEIVED, () => refreshNovelUI());
    eventSource.on(event_types.MESSAGE_SENT, () => refreshNovelUI());
    if (event_types.MESSAGE_SWIPED) eventSource.on(event_types.MESSAGE_SWIPED, () => refreshNovelUI());
    if (event_types.MESSAGE_EDITED) eventSource.on(event_types.MESSAGE_EDITED, () => refreshNovelUI());
    if (event_types.MESSAGE_DELETED) eventSource.on(event_types.MESSAGE_DELETED, () => refreshNovelUI());
    if (event_types.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, () => refreshNovelUI());
    if (event_types.CHARACTER_PAGE_LOADED) eventSource.on(event_types.CHARACTER_PAGE_LOADED, () => refreshNovelUI());
    if (event_types.GROUP_UPDATED) eventSource.on(event_types.GROUP_UPDATED, () => refreshNovelUI());
}

async function init() {
    // 等 Kit 资产就绪再建面板；CDN 与本地 vendor 双双失败时面板降级不可用，其余入口照常
    if (await nvuiAssetsReady) {
        const built = buildNovelPanel({
            settings: getSettings(),
            defaultExcludeTags: DEFAULT_SETTINGS.exclude_tags,
            scanTags: () => scanChatTags(getCurrentChatLog()),
            save: () => { if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced(); },
            refreshStatus: applyNovelUIRefresh,
            onExport: exportNovelText
        });
        novelPanel = built.panel;
        uiRefs = built.refs;
    }

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
