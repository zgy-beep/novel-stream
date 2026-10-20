/**
 * 会话标签检测器引擎测试（scanChatTags / toggleTagMembership / isAuxiliaryTag · 抽真源码模式）
 * 运行方式: node test/test-tag-detector.js
 *
 * 覆盖 v2.2.0 恢复的检测器能力（用户反馈：怪标签手打易错、手机端不便）：
 *   - 扫描计数：自定义标签计数、闭标签 / HTML 注释 / DOCTYPE / HTML 结构标签跳过、
 *     details/summary 不排除（默认黑名单含 details）、按次数降序 + 同次字母序；
 *   - auxiliary 标记：思维链类为 true，且 <planets> / <airplane> / <cotton> 子串不误伤
 *     （与清洗引擎共用 isAuxiliaryTag，v2.1.0 加固的回归）；
 *   - 名单切换：加入 / 取消、两侧互斥、大小写归一、空标签守门、', ' 连接格式。
 * 所有实现均从 index.js 真实抽取执行，杜绝副本漂移。
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.js');
const src = fs.readFileSync(INDEX_PATH, 'utf8');

function extract(name, re) {
    const m = src.match(re);
    if (!m) {
        console.error(`[FAIL] index.js 中未找到 ${name} 定义（v2.2.0 实现是否漏搬？）`);
        process.exit(1);
    }
    return m[0];
}

const ENGINE = [
    extract('INLINE_TAGS', /const INLINE_TAGS = new Set\([^;]*\);/),
    extract('SCAN_IGNORE_TAGS', /const SCAN_IGNORE_TAGS = new Set\([\s\S]*?\n\]\);/),
    extract('AUX_WORDS', /const AUX_WORDS = new Set\([^;]*\);/),
    extract('isAuxiliaryTag', /function isAuxiliaryTag\(tagName\) \{[\s\S]*?\n\}/),
    extract('parseTagList', /function parseTagList\(str\) \{[\s\S]*?\n\}/),
    extract('scanChatTags', /function scanChatTags\(chatLog\) \{[\s\S]*?\n\}/),
    extract('toggleTagMembership', /function toggleTagMembership\([^)]*\) \{[\s\S]*?\n\}/)
].join('\n\n');

const { scanChatTags, toggleTagMembership, isAuxiliaryTag } =
    new Function(ENGINE + '\nreturn { scanChatTags, toggleTagMembership, isAuxiliaryTag };')();

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        pass++;
        console.log(`[PASS] ${name}`);
    } else {
        fail++;
        console.log(`[FAIL] ${name}`);
        console.log(`       期望: ${e}`);
        console.log(`       实际: ${a}`);
    }
}

/* ---------- scanChatTags：计数与跳过规则 ---------- */
check('非数组输入返回空', scanChatTags(null), { tags: [], total: 0 });
check('空聊天返回空', scanChatTags([]), { tags: [], total: 0 });

const basic = scanChatTags([
    { mes: '<story>第一段</story><status>HP: 100</status>' },
    { mes: '<story>第二段</story>' },
    { mes: '没有标签的普通正文。' },
    { is_user: true, mes: '<story>用户也带标签</story>' }
]);
check('自定义标签计数', basic.tags, [
    { tag: 'story', count: 3, auxiliary: false },
    { tag: 'status', count: 1, auxiliary: false }
]);
check('total = 标签种数', basic.total, 2);

const skips = scanChatTags([
    { mes: '<!-- <comment> 不是标签 -->' },
    { mes: '<!DOCTYPE html><html><body><div class="x"><p>正文</p></div></body></html>' },
    { mes: '<br><hr><img src="x"><b>加粗</b><span>span</span>' },
    { mes: '<script>var a = "<fake>";</script><style>.c{color:red}</style>' },
    { mes: '<details><summary>摘要</summary>详情</details>' }
]);
check('闭标签不重复计数（story 仅 1）', scanChatTags([{ mes: '<story>a</story><story>b</story>' }]).tags, [
    { tag: 'story', count: 2, auxiliary: false }
]);
check('注释 / DOCTYPE / HTML 结构 / 行内标签全跳过（含注释与 script 内被提及的假标签）', skips.tags, [
    { tag: 'details', count: 1, auxiliary: false },
    { tag: 'summary', count: 1, auxiliary: false }
]);

const ordering = scanChatTags([
    { mes: '<zeta/><alpha/><zeta/><mid/>' }
]);
check('次数降序 + 同次数字母序（zeta 2 次居首）', ordering.tags.map((t) => t.tag), ['zeta', 'alpha', 'mid']);

const aux = scanChatTags([
    { mes: '<thinking>想</thinking><thought_2>想2</thought_2><cot>x</cot><story>文</story><planets>行星</planets><airplane>飞机</airplane><cotton>棉</cotton>' }
]);
// 全部 count=1 → 按字母序输出，auxiliary 标记与子串防误伤各自独立验证
check('auxiliary 标记与子串防误伤', aux.tags, [
    { tag: 'airplane', count: 1, auxiliary: false },
    { tag: 'cot', count: 1, auxiliary: true },
    { tag: 'cotton', count: 1, auxiliary: false },
    { tag: 'planets', count: 1, auxiliary: false },
    { tag: 'story', count: 1, auxiliary: false },
    { tag: 'thinking', count: 1, auxiliary: true },
    { tag: 'thought_2', count: 1, auxiliary: true }
]);
check('isAuxiliaryTag 直判', [isAuxiliaryTag('agent-cot'), isAuxiliaryTag('Story'), isAuxiliaryTag('plan')], [true, false, true]);

/* ---------- toggleTagMembership：增删与互斥 ---------- */
check('加入白名单', toggleTagMembership('', 'status,ooc', 'story', 'include'), { include_tags: 'story', exclude_tags: 'status, ooc' });
check('加入黑名单', toggleTagMembership('', 'status,ooc', 'note', 'exclude'), { include_tags: '', exclude_tags: 'status, ooc, note' });
check('再次点击取消（白）', toggleTagMembership('story,note', 'status', 'story', 'include'), { include_tags: 'note', exclude_tags: 'status' });
check('再次点击取消（黑）', toggleTagMembership('story', 'status,ooc', 'ooc', 'exclude'), { include_tags: 'story', exclude_tags: 'status' });
check('互斥：加白自动移出黑', toggleTagMembership('', 'status,ooc', 'status', 'include'), { include_tags: 'status', exclude_tags: 'ooc' });
check('互斥：加黑自动移出白', toggleTagMembership('story,note', 'status', 'note', 'exclude'), { include_tags: 'story', exclude_tags: 'status, note' });
check('大小写归一', toggleTagMembership('', '', 'STORY', 'include'), { include_tags: 'story', exclude_tags: '' });
check('大小写归一取消', toggleTagMembership('story', '', 'Story', 'include'), { include_tags: '', exclude_tags: '' });
check('空标签守门原样返回', toggleTagMembership('story', 'status', '   ', 'include'), { include_tags: 'story', exclude_tags: 'status' });
check('全角逗号与尖括号容错（parseTagList 共用）', toggleTagMembership('', 'status，ooc', 'note', 'exclude'), { include_tags: '', exclude_tags: 'status, ooc, note' });

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
