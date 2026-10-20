/**
 * 章节派生与楼层「已入书」映射测试（v2.0.0 无状态架构 · 抽真源码模式）
 * 运行方式: node test/test-chapter-map.js
 *
 * v1.x 本文件使用 cleanNovelText 简化桩副本；v2.0.0 重写为抽取模式：
 * 从 index.js 抽取 computeChapters / computeChapterMap / getCleanedMessage /
 * cleanNovelText / parseTagList / INLINE_TAGS / DEFAULT_SETTINGS / cleanTextCache
 * 的真实定义执行。Spec §5.2 契约全覆盖：
 *   - 延迟入书：无任何 is_user 消息 → 0 章（问候语不占章）；
 *   - 连续编号：有用户消息后从 index 0 起连续编号，问候语即第 1 章；
 *   - 空清洗跳号：清洗后为空的楼层跳过且不消耗章节号；
 *   - include_user_dialogue：用户楼层可入书可跳过；
 *   - 清洗缓存：设置签名变化 / 消息对象被替换 / mes 被原地改写均自动重洗。
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
    extract('DEFAULT_SETTINGS', /const DEFAULT_SETTINGS = \{[\s\S]*?\n\};/),
    extract('parseTagList', /function parseTagList\(str\) \{[\s\S]*?\n\}/),
    extract('cleanNovelText', /function cleanNovelText\(rawText, settings = \{\}\) \{[\s\S]*?\n\}/),
    extract('cleanTextCache', /const cleanTextCache = \{ sig: '', map: new Map\(\) \};/),
    extract('getCleanMessageSig', /function getCleanMessageSig\(settings\) \{[\s\S]*?\n\}/),
    extract('getCleanedMessage', /function getCleanedMessage\(msg, index, settings\) \{[\s\S]*?\n\}/),
    extract('chatHasUserMessage', /function chatHasUserMessage\(chatLog\) \{[\s\S]*?\n\}/),
    extract('computeChapters', /function computeChapters\(settings, chatLog\) \{[\s\S]*?\n\}/),
    extract('computeChapterMap', /function computeChapterMap\(settings, chatLog\) \{[\s\S]*?\n\}/)
].join('\n\n');

const { computeChapters, computeChapterMap } = new Function(
    ENGINE + '\nreturn { computeChapters, computeChapterMap };'
)();

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`[PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${testName}`);
        failCount++;
    }
}

function assertDeepEqual(actual, expected, testName) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) {
        console.log(`[PASS] ${testName}`);
        passCount++;
    } else {
        console.error(`[FAIL] ${testName}`);
        console.error('Expected: ' + JSON.stringify(expected));
        console.error('Got:      ' + JSON.stringify(actual));
        failCount++;
    }
}

const baseSettings = { include_user_dialogue: false, indent_paragraphs: true };

/* ---------- 1. 延迟入书（Spec §5.2 / AC-02） ---------- */
assertDeepEqual(computeChapters(baseSettings, [{ is_user: false, mes: '角色问候语，你好呀。' }]), [],
    '测试 1.1: 无任何用户消息 → 0 章（问候语不占章）');
assertDeepEqual(computeChapterMap(baseSettings, [{ is_user: false, mes: '角色问候语，你好呀。' }]), {},
    '测试 1.2: 延迟入书时楼层映射为空');
assertDeepEqual(computeChapters(baseSettings, []), [], '测试 1.3: 空聊天 → 0 章');

/* ---------- 2. 连续编号（有用户消息后从 0 起，问候语即第 1 章） ---------- */
{
    const chatLog = [
        { is_user: false, name: '艾莉丝', mes: '你好呀，旅行者。' },
        { is_user: true, name: '你', mes: '我们出发吧。' },
        { is_user: false, name: '艾莉丝', mes: '清晨的微风穿过树林。' }
    ];
    const chapters = computeChapters(baseSettings, chatLog);
    assert(chapters.length === 2, '测试 2.1: 用户楼层跳过，共 2 章');
    assert(chapters[0].no === 1 && chapters[0].index === 0 && chapters[0].speaker === '艾莉丝',
        '测试 2.2: 问候语为第 1 章（index 0 / no 1 / speaker=艾莉丝）');
    assert(chapters[1].no === 2 && chapters[1].index === 2, '测试 2.3: 后续 AI 楼层连续编号第 2 章');
    assert(chapters[0].text === '　　你好呀，旅行者。', '测试 2.4: 章节正文 = 清洗后文本（默认缩进）');
    assertDeepEqual(computeChapterMap(baseSettings, chatLog), { 0: 1, 2: 2 },
        '测试 2.5: 楼层映射 {0:1, 2:2}');
}

/* ---------- 3. 主角对白开关（AC-04） ---------- */
{
    const chatLog = [
        { is_user: true, name: '你', mes: '我们出发吧。' },
        { is_user: false, name: '艾莉丝', mes: '好，那就上路。' }
    ];
    const off = computeChapters(baseSettings, chatLog);
    assert(off.length === 1 && off[0].index === 1, '测试 3.1: include_user_dialogue=false 时用户楼层不入书');
    const on = computeChapters({ ...baseSettings, include_user_dialogue: true }, chatLog);
    assert(on.length === 2 && on[0].index === 0 && on[1].index === 1,
        '测试 3.2: include_user_dialogue=true 时用户楼层入书并占号');
}

/* ---------- 4. 空清洗跳号（编号不被掏空） ---------- */
{
    const chatLog = [
        { is_user: true, name: '你', mes: '开始吧。' },
        { is_user: false, mes: '<story>第一章正文</story>' },
        { is_user: false, mes: '<status>HP: 1/1</status>' },
        { is_user: false, mes: '<memory>仅记忆块，无正文</memory>' },
        { is_user: false, mes: '第三章正文' }
    ];
    assertDeepEqual(computeChapterMap(baseSettings, chatLog), { 1: 1, 4: 2 },
        '测试 4.1: 纯黑名单块的楼层被跳过且不消耗章节号');
}

/* ---------- 5. 混合边界（null / 空 / 纯空白 / 纯剔除块） ---------- */
{
    const chatLog = [
        null,
        { is_user: true, name: '你', mes: '在吗' },
        { is_user: false, mes: '' },
        { is_user: false, mes: '   \n\n  ' },
        { is_user: false, mes: '有效正文' },
        { is_user: false, mes: '<ooc>仅旁注</ooc>' }
    ];
    assertDeepEqual(computeChapterMap(baseSettings, chatLog), { 4: 1 },
        '测试 5.1: null/空/纯空白/纯剔除块楼层全部跳过，仅有效楼层占第 1 章');
}

/* ---------- 6. speaker 兜底链 ---------- */
{
    const chatLog = [
        { is_user: true, mes: '无名的用户发言' },
        { is_user: false, mes: '无名的旁白正文' },
        { is_user: false, name: '艾莉丝', mes: '有名字的发言' }
    ];
    const chapters = computeChapters({ ...baseSettings, include_user_dialogue: true }, chatLog);
    assert(chapters[0].speaker === '你', '测试 6.1: 用户楼层无 name 时兜底「你」');
    assert(chapters[1].speaker === '旁白', '测试 6.2: AI 楼层无 name 时兜底「旁白」');
    assert(chapters[2].speaker === '艾莉丝', '测试 6.3: 有 name 时优先用 name');
}

/* ---------- 7. 非数组输入 ---------- */
assertDeepEqual(computeChapters(baseSettings, null), [], '测试 7.1: 非数组输入 → 0 章');
assertDeepEqual(computeChapterMap(baseSettings, null), {}, '测试 7.2: 非数组输入 → 空映射');

/* ---------- 8. 无状态语义：同输入永远同输出（重 roll / 划动天然正确，AC-03） ---------- */
{
    const chatLog = [
        { is_user: true, name: '你', mes: '开始' },
        { is_user: false, name: '艾莉丝', mes: '第一次生成的结尾。' }
    ];
    const first = JSON.stringify(computeChapters(baseSettings, chatLog));
    chatLog[1].mes = '重新生成后的全新结尾。';
    const second = JSON.stringify(computeChapters(baseSettings, chatLog));
    assert(first !== second, '测试 8.1: 改写 mes 后重新派生（缓存不失真）');
    assert(second.indexOf('重新生成后的全新结尾。') >= 0, '测试 8.2: 新派生结果包含最新内容');
    assert(second.indexOf('第一次生成的结尾。') < 0, '测试 8.3: 旧内容无残留');
}

console.log(`\n=== 章节派生测试结果: 通过: ${passCount}, 失败: ${failCount} ===`);
if (failCount > 0) {
    process.exit(1);
} else {
    console.log('所有章节派生与楼层映射测试全部通过！（实现抽自 index.js 真实源码）');
}
