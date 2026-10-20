/**
 * 思维链 / 无头标签清洗回归测试（v2.0.0 起改为「抽真源码」模式）
 * 运行方式: node test/test-think.js
 *
 * v1.x 本文件维护着一份 cleanNovelText 手抄副本，副本与线上实现有漂移风险；
 * v2.0.0 重写为与 test-version-compare.js 同款的抽取模式：正则抽取 index.js 中
 * INLINE_TAGS / DEFAULT_SETTINGS / parseTagList / cleanNovelText 的真实定义并实例化，
 * 测试锁定线上实现——引擎被改坏，这里立刻红。
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

// 测试各种情况
const testCases = [
    {
        name: '测试1: 只有 </think_fox~> 结束标签，无开始标签的思考过程',
        input: '这是前置思考分析过程...\n角色心境应该是有些犹豫的。\n</think_fox~>\n第一章 启程\n清晨的微风穿过树林。',
        expected: '　　第一章 启程\n\n　　清晨的微风穿过树林。'
    },
    {
        name: '测试2: 只有 </think> 结束标签，无开始标签',
        input: '思考中...\n</think>\n第二章 离别\n少年踏上了远方的路。',
        expected: '　　第二章 离别\n\n　　少年踏上了远方的路。'
    },
    {
        name: '测试3: 完整成对的 <think_fox~>...</think_fox~>',
        input: '<think_fox~>\n成对思考内容\n</think_fox~>\n第三章 归途\n他终于回来了。',
        expected: '　　第三章 归途\n\n　　他终于回来了。'
    },
    {
        name: '测试4: 多段思考流，带有孤立闭标签',
        input: '思考一...\n</think_fox~>\n补充思考二...\n</think_fox~>\n正文内容第一段。',
        expected: '　　正文内容第一段。'
    },
    {
        name: '测试5: 思考流 + 黑名单标签 <status> + <memory>',
        input: '无头思考...\n</think_fox~>\n第一章\n正文在此。\n<status>血量: 100</status>',
        expected: '　　第一章\n\n　　正文在此。'
    },
    {
        name: '测试6: 思考流 + 白名单模式 <story>',
        input: '无头思考...\n</think_fox~>\n<story>这是被白名单包裹的真正小说正文。</story>',
        settings: { include_tags: '<story>' },
        expected: '　　这是被白名单包裹的真正小说正文。'
    },
    {
        name: '测试7: 自定义黑名单标签缺失开标签、仅有结束标签（如 </fox_draft>）',
        input: '这是草稿分析过程...\n</fox_draft>\n真正的章节正文内容。',
        settings: { exclude_tags: '<fox_draft>, <status>' },
        expected: '　　真正的章节正文内容。'
    },
    {
        name: '测试8: 不传 settings 时黑名单回退 DEFAULT_SETTINGS.exclude_tags（v2.0.0 兜底路径）',
        input: '开篇无头思考...\n</reasoning>\n<system>系统提示块</system>正文照常。',
        expected: '　　正文照常。'
    },
    {
        name: '测试9: indent_paragraphs=false 时不加首行缩进',
        input: '第一段。\n第二段。',
        settings: { indent_paragraphs: false },
        expected: '第一段。\n\n第二段。'
    }
];

let allPassed = true;
for (const tc of testCases) {
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
    console.log('\n所有思考标签排除测试全部通过！（引擎实现抽自 index.js 真实源码）');
}
