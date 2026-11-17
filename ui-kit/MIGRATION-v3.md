# MIGRATION-v3 · v2.9 → v3.0 迁移指南

> 版本：**v3.0.0**（MAJOR）。这是自 v2.0.0 以来第一次动**契约**：尺寸载体、状态格式、
> 按钮组声明方式、`tokens.json` 结构全部有变。四类变更的杀伤力差别很大 ——
> **只换 CSS 的下游基本不用改代码**，读 `panel.style.*` 或自己解析状态的下游必须改。
>
> 判断方法：`npm run test:downstream`（`test/downstream-check.js`）会把 4 资产一致性与
> 运行时自检一并跑一遍；`NVUI.diagnostics()` 能告诉你当前装的是哪版、状态里有什么。

---

## 0. 三十秒判断要不要动手

| 你在下游做过这件事 | 要不要改 | 看哪节 |
| :--- | :--- | :--- |
| 只覆盖 4 个资产文件，用 `createPanel(opts)` | **不用改**（状态自动迁移） | §1 了解即可 |
| 读 `panel.style.width` / `panel.style.height` 做逻辑 | **必须改** | §1.2 |
| 自己 `localStorage` 存档 / 往 `setLayoutState()` 传 `{ size: { width } }` | **必须改**（或靠内置迁移器兜住） | §1.3 |
| 用 CSS `.nvui-panel { width: ... }` 覆盖面板宽度 | **现在才生效**（以前被内联 px 压住） | §1.1 |
| 用 `.nvui-btn-row` 排版按钮 | 不用改（v3.x 内是 `.nvui-actions` 的 alias） | §2 |
| 程序化读写 `tokens.json` | 要改（结构升级，值结构不变） | §3 |
| 在 CI 里声明宿主 / Node 最低版本 | 要改（新增 `engines.node` 与兼容矩阵） | §4 |

---

## 1. C1 · 尺寸载体：内联 px → CSS 变量

### 1.1 变了什么

| 项 | v2.x | v3.0 |
| :--- | :--- | :--- |
| 写尺寸 | `panel.style.width = '400px'` | `panel.style.setProperty('--nvui-panel-w', '400px')` |
| CSS | 内联声明直接压住一切 | `width: var(--nvui-panel-w, min(var(--nvui-panel-width), 100%))` |
| 读尺寸 | `panel.style.width` | `panel.style.getPropertyValue('--nvui-panel-w')`（kit 内部 `readPanelSize()`） |
| 状态格式 | `{ version: 1, size: { width, height, isMaximized } }` | `{ version: 2, size: { w, h, mode } }` |

**为什么改**：内联样式是作者级声明，下游永远抢不过它 —— 想用 CSS 把面板调窄只剩 `!important`
一条路，而 `!important` 是本 kit 明令禁止的（全库预算 18 条，全部留给宿主隔离 / 降级）。
GH-#16「`persist.size: false` 仍回写历史高度」只是这个矛盾最刺眼的一个症状。

**变量留空 = 回落默认值**，所以「没设变量」和 v2.x「没有内联宽高」在视觉上完全一致。

### 1.2 下游要做什么

**如果你只是读尺寸做逻辑**（判断「面板是不是被用户拉宽了」之类），改读取路径：

```js
/* v2.x */
const w = parseInt(panel.style.width, 10);

/* v3.0 —— 变量优先，内联兜底（下游写内联的仍然有效，kit 也读得回来） */
const raw = panel.style.getPropertyValue('--nvui-panel-w') || panel.style.width;
const w = raw.includes('px') ? parseInt(raw, 10) : null;
```

**更推荐**：别读 DOM，直接 `panel.getLayoutState().size` —— 拿到的是 `{ w, h, mode }` 的游离副本，
不受载体实现影响。

**如果你在用 CSS 覆盖面板宽度**，v3.0 起不加 `!important` 就能生效：

```css
/* 以前无效（被内联 px 压住），v3.0 起有效 */
.nvui-panel { width: 500px; }
```

注意这会把**所有**面板都改成 500px。只想改自己那个就带 id / 自定义类：
`#my_plugin_layer .nvui-panel { width: 500px }`。

### 1.3 状态格式 v2 与迁移器

v1 存档**不需要手动处理**：`applyLoadedState()` 读到旧格式会先过 `migrateStateV1toV2()`，
**落盘一律写 v2**。也就是说升级一次之后，存储里的记录自己就变成 v2 了。

映射规则：

| v1 | v2 | 说明 |
| :--- | :--- | :--- |
| `size.width` | `size.w` | 数字不变 |
| `size.height` | `size.h` | 数字不变 |
| `size.isMaximized: true` | `size.mode: 'maximized'` | 最大化本质是二维状态 |
| `size.isMaximized: false` | `size.mode: 'normal'` | |
| （无对应） | `size.mode: 'width-only'` | v2.9.0 的 `persist.size: 'width-only'` 显式化 |
| （无对应） | `size.mode: 'off'` | `persist.size: false` 时 `size` 整体为 `null` |

`mode` 合并 `isMaximized` 的理由：最大化时 w/h 有没有意义取决于另一个布尔字段，这种
「一个字段的语义由另一个字段决定」的结构迟早会写出 `{ width: 400, height: 800, isMaximized: true }`
这种自相矛盾的存档。

如果你想在下游**自己**存过状态（比如存到扩展设置里），务必在写入前跑一次迁移器：

```js
const normalized = NVUI.migrateStateV1toV2(savedFromSettings) || savedFromSettings;
settings.layoutState = normalized;   // 之后永远是 v2
```

`migrateStateV1toV2(state)` 契约：幂等（已是 v2 原样返回同一对象）、不改入参、`null` / 非对象返回 `null`。

### 1.4 过渡开关 `data-nvui-legacy-size`（v3.0 引入，**v3.1 已移除**）

> **状态：已移除。** 如果你读到这段文字时正在从 v2.x 或 v3.0.x 升级，请直接看下面的替代方案；
> 在 v3.1+ 里给面板或 `<html>` 加这个属性**没有任何效果** —— kit 仍只写 CSS 变量，不告警。

v3.0.0 曾提供过渡开关，给下游一版时间改代码：

```html
<!-- v3.0 的历史写法，v3.1 起无效，不要再用 -->
<div class="nvui-panel" data-nvui-legacy-size> ... </div>
<html data-nvui-legacy-size>
```

**替代方案**（v3.1+ 唯一有效的两条路）：

```js
// ① 在实例上写变量（等价于原来的 setSize）
panel.style.setProperty('--nvui-panel-w', '640px');
panel.style.setProperty('--nvui-panel-h', '520px');
```

```css
/* ② 用你自己的选择器直接接管，不需要 !important */
#my_plugin_layer .nvui-panel { width: 500px; }
```

如果下游代码在**读** `panel.style.width`：改用 `panel.getLayoutState().size`，或按
`style.getPropertyValue('--nvui-panel-w') || style.width` 的顺序读（保留对 v2 遗留内联的兼容）。

### 1.5 顺手修掉的 v2 遗留缺陷

v2.x 里「最大化 → 还原」之后，面板宽度会一直挂着 `calc(100vw - 32px)` —— `applyClamping()`
读不到 px 目标就直接 return，从不清那条 calc。v3.0 在「两个维度都读不到 px、身上却还挂着尺寸」
时显式 `clearPanelSize()`，把主权交回 CSS 默认值。回归见 `test/v300-size-vars.spec.js` V6。

---

## 2. C2 · 按钮组：四段规则归一 + 零 specificity

| 项 | v2.x | v3.0 |
| :--- | :--- | :--- |
| 规则数 | `.nvui-actions` / `.nvui-btn-row` / `.nvui-panel-footer` / `.nvui-modal-footer` 各写一遍 flex + gap | 一条 `:where(...)` 统一声明 |
| specificity | 各自 0,1,0 | **0,0,0**（`:where()` 不参与权重） |
| 覆盖方式 | 要跟 kit 的选择器比权重 | 一条普通规则即可 |

**下游要做什么**：不动就行。`.nvui-btn-row` 在 v3.x 内是 `.nvui-actions` 的 alias（同一套声明），
v4 再议移除。两个 footer 继续只做容器语义（`padding` / `border-top` / `flex-shrink: 0`）。

**行为差异（可见，但都是修 bug）**：

- `flex-wrap: wrap` 与 `align-items: center` 现在对两个 footer 一致生效 —— 窄屏按钮**换行**而不是溢出；
- `.nvui-btn-row` 不再被默认拉伸对齐。

**唯一可能踩到的点**：如果你的下游 CSS 以前靠「比 `.nvui-actions { display:flex }` 权重更高」
来取消 flex，现在一条普通规则就够了 —— 也就是说以前写的 `!important` 或三层选择器现在是冗余的，
但**不会失效**（冗余但正确）。

---

## 3. C3 · `tokens.json` schema v2

值结构**没变**：`dark` / `light` 仍是 `{ "--nvui-x": "value" }` 扁平表，**键顺序逐字节保持原样**。
新增的只有元信息：

```jsonc
{
  "schema": 2,
  "meta": {
    "--nvui-bg": { "group": "表面 / 背景", "type": "color", "description": "面板底色" }
  },
  "groupDescriptions": { "表面 / 背景": "三层表面：bg → bg-2 → bg-3，越靠内越亮" },
  "dark": { /* 111 项，与 v2 完全一致 */ },
  "light": { /* 47 项 */ }
}
```

| 字段 | 用途 |
| :--- | :--- |
| `schema` | `2`。用来判断要不要按新结构读，v1 没有这个键 |
| `meta[token].group` | 分组名（16 组），用于做令牌面板分组 |
| `meta[token].type` | `color` / `length` / `duration` / `easing` / `number` / `font` / `shadow` / `alias` / `keyword` / `other` |
| `meta[token].description` | 该 token 在 `tokens.css` 里的注释；**75 个 token 没有单独注释，值是空字符串**（不编造） |
| `groupDescriptions[group]` | 该组的散文说明（9 段） |

**下游要做什么**：

- 只读值的：**不用改**（`json.dark['--nvui-bg']` 照旧）；
- 遍历 `Object.keys(json)` 当作 token 名的：**要改** —— 现在顶层多了 `schema` / `meta` /
  `groupDescriptions` / `name` / `version` / `description` / `generatedFrom` / `schemaNote`。
  改成遍历 `json.dark` / `json.light`。

**出处仍然是 `tokens.css`**：`npm run tokens:migrate` 从 CSS 注释重新生成，
`npm run tokens:check` 只校验（CI 用）。不要手改 `tokens.json` 的元信息 —— 下次生成会覆盖。

---

## 4. C4 · 兼容矩阵：声明变成门禁

README §11.5 新增了一张表，它不是说明文字，是 `npm run test:compat` 的校验对象：

| Kit | 宿主最低（ST `minimum_client_version`） | Node 最低（`engines.node`） |
| :--- | :--- | :--- |
| v3.0.0 | 1.12.0 | >=18.0.0 |

三处必须逐字一致：README §11.5 当前大版本线那一行 ↔ `st-extension-template/manifest.json`
的 `minimum_client_version` ↔ `package.json` 的 `engines.node`。发版忘了补行 / 改了 manifest
忘了改表，CI 直接红。

**下游要做什么**：

1. 初始化时自查一次，早失败早报错：

   ```js
   const compat = NVUI.checkCompatibility({ min: '3.0.0' });
   if (!compat.compatible) console.warn('[my-plugin]', compat.reason);
   ```

2. 如果你的构建 / 测试脚本用 Node 16，`npm install` 现在会报警告（`engines.node: >=18.0.0`）。
   运行时（浏览器里）不受影响 —— 这条约束只针对仓库的开发期脚本。

---

## 5. 升级步骤（照抄即可）

```bash
# 1. 覆盖 4 个资产（不要手改，直接复制）
cp ui-kit/tokens.css ui-kit/tokens.json ui-kit/components.css ui-kit/nvui-api.js  <你的目录>/

# 2. 下游一致性验收（随 kit 一起分发的脚本）
node test/downstream-check.js

# 3. 跑你自己的界面测试；重点看三处：
#    - 面板宽度是否仍然是你期望的值（以前靠内联 px，现在靠 CSS）
#    - 有没有读 panel.style.width 的地方
#    - 有没有遍历 tokens.json 顶层键的地方
```

```js
// 4. 运行时自查（可选，但建议留着）
NVUI.selfCheck({ expect: '3.0.0' });
NVUI.diagnostics();   // 看 assets.version / persistKeys 是否符合预期
```

---

## 6. 兼容承诺（v3.x 内仍然成立）

- 不删除 / 不改名 token、组件类、`is-*` 状态类、公开 API；
- 不改 DOM 必需结构（`.nvui-tl > .nvui-overlay > .nvui-panel > .nvui-panel-body` 层级不变）；
- v1 状态格式**继续可读**（自动迁移，落盘写 v2）；
- `.nvui-btn-row` 作为 `.nvui-actions` 的 alias 保留到 v3.x 结束；
- 新增能力默认关闭或保持旧行为。

**v3.1 已移除**：`data-nvui-legacy-size` 开关（见 §1.4）。除此之外 v3.x 内不再有破坏性变更。

---

## 7. 历史升级事故提醒

- **只换 CSS、忘换 `tokens.json` / `nvui-api.js`** 是最常见的漂移；v2.4.0 曾发生模板
  `tokens.json` 落后两版。v3.0 起 `tokens.json` 与 `components.css` 的版本号不再强绑
  （一个跟 CSS 注释生成，一个跟运行时），更要靠 `downstream-check.js` 而不是肉眼。
- **`data-nvui-legacy-size` 已经彻底失效**：v3.0 用它给下游争取了一版缓冲期，v3.1 移除后
  设了属性也不会有任何效果；别再照着旧文档抄这段代码。
- **`getLayoutState()` 返回的是游离副本**：改它不会改面板，也不会改存储。要生效必须
  `setLayoutState()`（或 `open()` 重读）。
