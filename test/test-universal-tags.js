/**
 * 通用全标签清洗引擎回归测试（v2.0.0 起改为「抽真源码」模式）
 * 运行方式: node test/test-universal-tags.js
 *
 * v1.x 本文件维护着 cleanNovelTextUniversal 手抄副本；v2.0.0 重写为抽取模式：
 * 直接抽取 index.js 中 INLINE_TAGS / DEFAULT_SETTINGS / parseTagList / cleanNovelText
 * 的真实定义执行，锁死线上引擎行为（任意自定义无头标签、思维链变体、三态黑名单）。
 */

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'index.js');
const src = fs.readFileSync(INDEX_PATH, 'utf8');

function extract(name, re) {
    const m = src.match(re);
    if (!m) {
        console.error(`[FAIL] index.js 中未找到 ${name} 定义（v2.0.0 重构是否漏搬引擎？）`);
        process.exit(1);
    }
    return m[0];
}

const ENGINE = [
    extract('INLINE_TAGS', /const INLINE_TAGS = new Set\([^;]*\);/),
    extract('DEFAULT_SETTINGS', /const DEFAULT_SETTINGS = \{[\s\S]*?\n\};/),
    extract('parseTagList', /function parseTagList\(str\) \{[\s\S]*?\n\}/),
    extract('cleanNovelText', /function cleanNovelText\(rawText, settings = \{\}\) \{[\s\S]*?\n\}/)
].join('\n\n');

const { cleanNovelText } = new Function(ENGINE + '\nreturn { cleanNovelText };')();

// 自动化测试集
const cases = [
    {
        name: '测试1: 任意自定义标签孤立闭合（如 </custom_logic~>），无需手动配置',
        input: '这是前置逻辑推导过程...\n角色心境分析...\n</custom_logic~>\n第一章 启程\n少年走在青石街道上。',
        expected: '　　第一章 启程\n\n　　少年走在青石街道上。'
    },
    {
        name: '测试2: 冒号命名的特殊标签（如 </agent:cot>）',
        input: '思考当前任务...\n</agent:cot>\n微风吹拂。',
        expected: '　　微风吹拂。'
    },
    {
        name: '测试3: 带有空格的闭合标签（如 </ think_fox~ >）',
        input: '思考中...\n</ think_fox~ >\n窗外下着小雨。',
        expected: '　　窗外下着小雨。'
    },
    {
        name: '测试4: 多层嵌套或连续无头标签（如 </scratchpad> 后跟 </plan>）',
        input: '草稿分析1...\n</scratchpad>\n剧情步骤2...\n</plan>\n他握紧了手中的剑。',
        expected: '　　他握紧了手中的剑。'
    },
    {
        name: '测试5: 黑名单标签末尾未闭合（如最后附带 <status>HP:100 但没有 </status>）',
        input: '正文内容第一段。\n正文内容第二段。\n<status>\nHP: 100\nMP: 50',
        settings: { exclude_tags: '<status>' },
        expected: '　　正文内容第一段。\n\n　　正文内容第二段。'
    },
    {
        name: '测试6: 带有属性的成对排除标签（如 <details type="memory" version="1.0">...</details>）',
        input: '<details type="memory" version="1.0">记忆碎片内容</details>\n这是真正的小说正文。',
        settings: { exclude_tags: '<details>' },
        expected: '　　这是真正的小说正文。'
    },
    {
        name: '测试7: 普通正文内含合法标签不被误伤（如 <b>加粗</b> 与 <i>斜体</i>）',
        input: '他大喊一声：<b>快走！</b>随后冲入<i>暴风雨</i>中。',
        expected: '　　他大喊一声：快走！随后冲入暴风雨中。'
    },
    {
        name: '测试8: HTML 隐藏注释过滤（如 <!-- Lorebook: 世界观提示 -->）',
        input: '<!-- [Lorebook: 艾莉丝对主角的好感度+10] -->\n艾莉丝微笑着递来一杯热茶。<!-- 隐藏心理描写 -->',
        expected: '　　艾莉丝微笑着递来一杯热茶。'
    },
    {
        name: '测试9: Markdown 表情图片与 img 标签过滤',
        input: '艾莉丝露出了笑容。![微笑表情](https://example.com/smile.png)\n<img src="avatar.jpg" alt="头像" />“今天天气真好呀。”',
        expected: '　　艾莉丝露出了笑容。\n\n　　“今天天气真好呀。”'
    },
    {
        name: '测试10: max_tokens 截断导致末尾未闭合的思考链（如 <think>正在分析...）',
        input: '艾莉丝叹了一口气。<think>正在构思下一步行动，但是突然被截断了',
        expected: '　　艾莉丝叹了一口气。'
    },
    {
        name: '测试11: 白名单命中多个标签块时按序拼接（parseTagList 真实参与）',
        input: '<story>第一段故事。</story><ooc>旁注</ooc><story>第二段故事。</story>',
        settings: { include_tags: 'story', exclude_tags: '' },
        expected: '　　第一段故事。\n\n　　第二段故事。'
    },
    {
        name: '测试12: 白名单未命中任何块时保留全文，不得静默清空（AC-05）',
        input: '没有任何指定标签的普通正文。',
        settings: { include_tags: 'story' },
        expected: '　　没有任何指定标签的普通正文。'
    }
];

let allPassed = true;
for (const tc of cases) {
    const result = cleanNovelText(tc.input, tc.settings || {});
    if (result === tc.expected) {
        console.log(`[PASS] ${tc.name}`);
    } else {
        console.error(`[FAIL] ${tc.name}`);
        console.error('Expected:\n' + JSON.stringify(tc.expected));
        console.error('Got:\n' + JSON.stringify(result));
        allPassed = false;
    }
}

if (!allPassed) {
    process.exit(1);
} else {
    console.log('\n=== 通用全标签清洗引擎自动化测试全部通过！（引擎实现抽自 index.js 真实源码） ===');
}
