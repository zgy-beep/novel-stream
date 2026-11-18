/**
 * 导出整本 TXT 编排测试（composeNovelExport / buildNovelText · 抽真源码模式）
 * 运行方式: node test/test-export-build.js
 *
 * 覆盖 Spec §5.3 / §9 AC-07：文件名遵循命名规则（2 种）、章节标题遵循 chapter_style（4 种）、
 * UTF-8 BOM、空聊天 0 章不炸；以及 sanitizeFilename / getBookTitle（含群聊分支）的边界。
 * 所有实现均从 index.js 真实抽取执行，杜绝副本漂移。
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.js');
const src = fs.readFileSync(INDEX_PATH, 'utf8');

function extract(name, re) {
    const m = src.match(re);
    if (!m) {
        console.error(`[FAIL] index.js 中未找到 ${name} 定义（v2.0.0 重构是否漏搬？）`);
        process.exit(1);
    }
    return m[0];
}

const ENGINE = [
    extract('INLINE_TAGS', /const INLINE_TAGS = new Set\([^;]*\);/),
    extract('AUX_WORDS', /const AUX_WORDS = new Set\([^;]*\);/),
    extract('isAuxiliaryTag', /function isAuxiliaryTag\(tagName\) \{[\s\S]*?\n\}/),
    extract('DEFAULT_SETTINGS', /const DEFAULT_SETTINGS = \{[\s\S]*?\n\};/),
    extract('parseTagList', /function parseTagList\(str\) \{[\s\S]*?\n\}/),
    extract('cleanNovelText', /function cleanNovelText\(rawText, settings = \{\}\) \{[\s\S]*?\n\}/),
    extract('cleanTextCache', /const cleanTextCache = new WeakMap\(\);/),
    extract('getCleanMessageSig', /function getCleanMessageSig\(settings\) \{[\s\S]*?\n\}/),
    extract('getCleanedMessage', /function getCleanedMessage\(msg, settings, sig\) \{[\s\S]*?\n\}/),
    extract('chatHasUserMessage', /function chatHasUserMessage\(chatLog\) \{[\s\S]*?\n\}/),
    extract('interruptedStreamPlaceholders', /const interruptedStreamPlaceholders = new WeakMap\(\);/),
    extract('isInterruptedStreamPlaceholder', /function isInterruptedStreamPlaceholder\(message\) \{[\s\S]*?\n\}/),
    extract('computeChapters', /function computeChapters\(settings, chatLog\) \{[\s\S]*?\n\}/),
    extract('sanitizeFilename', /function sanitizeFilename\([^\n]*\) \{[\s\S]*?\n\}/),
    extract('getAccountPrefix', /function getAccountPrefix\(\) \{[\s\S]*?\n\}/),
    extract('getBookTitle', /function getBookTitle\(settings, speakerName = ''\) \{[\s\S]*?\n\}/),
    extract('getBookFileName', /function getBookFileName\([^\n]*\) \{[\s\S]*?\n\}/),
    extract('buildNovelText', /function buildNovelText\([^\n]*\) \{[\s\S]*?\n\}/),
    extract('composeNovelExport', /function composeNovelExport\([^\n]*\) \{[\s\S]*?\n\}/)
].join('\n\n') + '\nfunction getStContext() { return ctx; }';

// getBookTitle 读酒馆上下文：ctx / characters_raw / this_chid_raw / window 以参数注入桩
const ctxStub = {
    characters: [{ name: '艾莉丝' }],
    this_chid: 0,
    chatMetadata: { title: '远征探索' }
};
const { composeNovelExport, buildNovelText, getBookTitle, getBookFileName, sanitizeFilename, DEFAULT_SETTINGS } =
    new Function('ctx', 'characters_raw', 'this_chid_raw', 'window',
        ENGINE + '\nreturn { composeNovelExport, buildNovelText, getBookTitle, getBookFileName, sanitizeFilename, DEFAULT_SETTINGS };'
    )(ctxStub, [], undefined, {});

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
    if (actual === expected) {
        pass++;
        console.log(`[PASS] ${name}`);
    } else {
        fail++;
        console.error(`[FAIL] ${name}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
    }
}

const mk = (over) => ({ ...DEFAULT_SETTINGS, indent_paragraphs: false, ...over });

// 含用户消息才能入书（延迟入书规则）；第 1 层带 <status> 黑名单块验证清洗参与编排
const chatLog = [
    { is_user: true, name: '你', mes: '我们该出发了。' },
    { is_user: false, name: '艾莉丝', mes: '<status>HP: 100</status>清晨的微风穿过树林。' },
    { is_user: false, name: '艾莉丝', mes: '她背上行囊，踏上远行的路。' }
];

console.log('=== ① 章节标题四种风格（AC-07）===');
check('numbered_floor：第 X 章 · 角色名 (原楼层: Y)',
    buildNovelText(mk(), chatLog).novelText,
    '《艾莉丝 - 远征探索》\n\n第 1 章 · 艾莉丝 (原楼层: 2)\n\n清晨的微风穿过树林。\n\n\n第 2 章 · 艾莉丝 (原楼层: 3)\n\n她背上行囊，踏上远行的路。\n\n\n');
check('numbered：第 X 节 · 角色名',
    buildNovelText(mk({ chapter_style: 'numbered' }), chatLog).novelText,
    '《艾莉丝 - 远征探索》\n\n第 1 节 · 艾莉丝\n\n清晨的微风穿过树林。\n\n\n第 2 节 · 艾莉丝\n\n她背上行囊，踏上远行的路。\n\n\n');
check('separator：优雅分割线 * * *',
    buildNovelText(mk({ chapter_style: 'separator' }), chatLog).novelText,
    '《艾莉丝 - 远征探索》\n\n* * *\n\n清晨的微风穿过树林。\n\n\n* * *\n\n她背上行囊，踏上远行的路。\n\n\n');
check('dialogue：纯净戏剧体【角色名】',
    buildNovelText(mk({ chapter_style: 'dialogue' }), chatLog).novelText,
    '《艾莉丝 - 远征探索》\n\n【艾莉丝】\n\n清晨的微风穿过树林。\n\n\n【艾莉丝】\n\n她背上行囊，踏上远行的路。\n\n\n');

console.log('\n=== ② 章节计数与缩进 ===');
check('chapterCount = 2', buildNovelText(mk(), chatLog).chapterCount, 2);
check('缩进开启时正文带全角空格前缀',
    buildNovelText(mk({ indent_paragraphs: true }), chatLog).novelText.indexOf('　　清晨的微风穿过树林。') >= 0, true);
check('include_user_dialogue=true 时用户楼层入书（speaker=你）',
    buildNovelText(mk({ include_user_dialogue: true }), chatLog).novelText.indexOf('第 1 章 · 你 (原楼层: 1)') >= 0, true);
check('include_user_dialogue=true 时 chapterCount = 3',
    buildNovelText(mk({ include_user_dialogue: true }), chatLog).chapterCount, 3);

console.log('\n=== ③ 命名规则两种（AC-07）===');
check('char_chat：书名 = 角色名 - 对话名', getBookTitle(mk()), '艾莉丝 - 远征探索');
check('char_only：书名 = 仅角色名', getBookTitle(mk({ naming_rule: 'char_only' })), '艾莉丝');
check('char_chat：文件名', getBookFileName(mk()), '艾莉丝 - 远征探索.txt');
check('char_only：文件名', getBookFileName(mk({ naming_rule: 'char_only' })), '艾莉丝.txt');

console.log('\n=== ④ composeNovelExport：BOM / 文件名 / 章节数 ===');
{
    const out = composeNovelExport(mk(), chatLog);
    check('text 以 UTF-8 BOM 开头', out.text.charCodeAt(0), 0xFEFF);
    check('BOM 后紧跟书名', out.text.slice(1).startsWith('《艾莉丝 - 远征探索》'), true);
    check('fileName 遵循命名规则', out.fileName, '艾莉丝 - 远征探索.txt');
    check('chapterCount 与面板计数同源', out.chapterCount, 2);
}

console.log('\n=== ⑤ 空聊天 / 延迟入书：0 章不炸 ===');
{
    const out = composeNovelExport(mk(), []);
    check('空聊天 chapterCount = 0', out.chapterCount, 0);
    check('空聊天 text = BOM + 空书稿', out.text, '\uFEFF《艾莉丝 - 远征探索》\n\n');
    const greetingOnly = composeNovelExport(mk(), [{ is_user: false, name: '艾莉丝', mes: '你好呀。' }]);
    check('仅有问候语（无用户消息）chapterCount = 0', greetingOnly.chapterCount, 0);
}

console.log('\n=== ⑥ sanitizeFilename 边界 ===');
check('Windows 非法字符全部替换为下划线', sanitizeFilename('a/b\\c?d*e|f"g<h>i'), 'a_b_c_d_e_f_g_h_i');
check('连续点点合成单个下划线', sanitizeFilename('第一章..第二章'), '第一章_第二章');
check('尾部点与空格被修剪', sanitizeFilename('我的小说. '), '我的小说');
check('保留设备名 CON 加后缀', sanitizeFilename('CON'), 'CON_novel');
check('保留设备名 com1 加后缀（大小写不敏感）', sanitizeFilename('com1'), 'com1_novel');
check('空串回退默认书名', sanitizeFilename(''), '我的小说连载');
check('null 回退默认书名', sanitizeFilename(null), '我的小说连载');
check('长 ASCII 名截断到 150 字符', sanitizeFilename('a'.repeat(300)).length, 150);
check('长中文名按 UTF-8 字节截断', Buffer.byteLength(sanitizeFilename('长'.repeat(300))), 255);
check('保留设备名带已有扩展名时仍改写', sanitizeFilename('CON.序章'), 'CON_novel.序章');
check('设备名的上标数字也被改写', sanitizeFilename('COM¹.序章'), 'COM¹_novel.序章');
check('控制字符不会进入文件名', sanitizeFilename('序\u0000章'), '序 章');

{
    const title = ctxStub.chatMetadata.title;
    ctxStub.chatMetadata.title = '长🙂'.repeat(100);
    const full = getBookFileName(mk());
    const ranged = getBookFileName(mk(), { start: 123, end: 456 });
    check('整本文件名连同扩展名不超过 255 字节', Buffer.byteLength(full) <= 255, true);
    check('范围导出为完整后缀留出空间', Buffer.byteLength(ranged) <= 255 && ranged.endsWith(' - 第 123-456 章.txt'), true);
    check('长度截断不切开表情', [...ranged].every((char) => char.length === 2 || !/[\ud800-\udfff]/.test(char)), true);
    ctxStub.chatMetadata.title = '第一部分\r\n第二部分';
    const messages = [
        { mes: '前置系统提示', is_system: true },
        { mes: '开始。', is_user: true },
        { mes: '第一段\u0000。\r第二段。', name: '艾莉丝\n旁白' },
        { mes: '工具 JSON', is_system: true }
    ];
    const out = composeNovelExport(mk({ include_user_dialogue: false }), messages);
    check('书名、章标题和正文的真实 UTF-8 字节', Buffer.from(out.text).toString('hex'),
        Buffer.from('\uFEFF《艾莉丝 - 第一部分 第二部分》\n\n第 1 章 · 艾莉丝 旁白 (原楼层: 3)\n\n第一段。\n\n第二段。\n\n\n').toString('hex'));
    check('系统与工具消息不占章', out.chapterCount, 1);
    ctxStub.chatMetadata.title = title;
}

console.log('\n=== ⑦ 群聊书名（Group Chat 聚合）===');
{
    const groupCtx = { ...ctxStub, selected_group: 'grp-1', groups: [{ id: 'grp-1', name: '冒险小队' }] };
    const api = new Function('ctx', 'characters_raw', 'this_chid_raw', 'window',
        ENGINE + '\nreturn { getBookTitle };'
    )(groupCtx, [], undefined, {});
    check('群聊 + char_chat = [群聊] 队名 - 对话名', api.getBookTitle(mk()), '[群聊] 冒险小队 - 远征探索');
    check('群聊 + char_only = [群聊] 队名', api.getBookTitle(mk({ naming_rule: 'char_only' })), '[群聊] 冒险小队');
}

console.log(`\n导出编排测试结果: 通过: ${pass}, 失败: ${fail}`);
if (fail > 0) process.exit(1);
console.log('所有导出编排测试全部通过！（实现抽自 index.js 真实源码）');
