/**
 * SillyTavern NVUI Kit · 可选运行时 API（零依赖）
 * ------------------------------------------------------------------
 * 版本：ui-kit v3.1.1（与 package.json / tokens.css / components.css 版本号保持一致）
 * 用途：给插件/其它软件一个「可调用的设计接口」——用函数创建符合本 Kit 规范的面板、
 *       标签页、折叠分组、开关行、输入行、进度条、吐司，自动带上布局标准、无障碍属性、
 *       动效降级与焦点管理，避免每个插件各写一套 DOM。
 *
 * 设计约束（本文件由 test/test-ui-kit.js 守护）：
 *   1. 零依赖、无网络请求、无 emoji；不 import 任何框架。
 *   2. 加载时不访问 DOM（在 Node 里 require 只拿到 API 对象），所有 DOM 操作都在函数调用时发生。
 *   3. 只使用 nvui- 前缀类名与 CSS 变量 token，绝不硬编码颜色。
 *   4. 生成的 DOM 必须与 README 的「面板布局标准」「无障碍契约」一致：
 *      dialog.nvui-tl > .nvui-overlay.is-panel > .nvui-panel（role=dialog / aria-modal / aria-labelledby），
 *      顶部 tabs 与手机底部导航共享状态，Esc / 点遮罩关闭，关闭后焦点归还触发元素。
 *   5. 默认尊重 prefers-reduced-motion / prefers-reduced-transparency（交给 CSS 门禁）；
 *      本 API 只负责切换类名与属性。
 *
 * 用法（浏览器，插件内）：
 *   <script src="./ui-kit/nvui-api.js"></script>
 *   const panel = NVUI.createPanel({
 *       id: 'my_plugin_panel',
 *       title: '我的插件设置',
 *       version: 'v1.0.0',
 *       tabs: [
 *           { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
 *           { key: 'advanced', label: '高级', icon: 'fa-solid fa-wrench' }
 *       ],
 *       actions: [{ icon: 'fa-solid fa-wand-magic-sparkles', label: '更多', onClick: function () {} }],
 *       footer: [{ label: '取消', variant: 'ghost', onClick: function () { panel.close(); } }]
 *   });
 *   panel.addSwitch('basic', { label: '启用功能', value: true, onChange: function (v) {} });
 *   panel.addAccordion('basic', {
 *       title: '基本设置', summary: '默认值',
 *       content: [panel.addInput('basic', { label: '上限 (MB)', type: 'number', value: 80 })]
 *   });
 *   panel.open();
 *
 * 用法（Node 侧做规范测试/静态生成时）：
 *   const NVUI = require('./nvui-api.js');
 *   NVUI.version; NVUI.PANEL_CLASS; NVUI.createPanel; // 只检查导出，不触发 DOM
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.NVUI = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
    'use strict';

    var VERSION = '3.1.1';
    var PANEL_CLASS = 'nvui-panel';
    var TOAST_LAYER_ID = 'nvui-api-toast-layer';

    /* ---------------------- 调试开关与日志 ---------------------- */
    /*
     * v2.4.0 起提供可观测性（NEW-19）：
     *   NVUI.config.debug = true  → 打开关键路径的详细日志（面板创建、宿主模态同步、玻璃探测等）
     *   NVUI.config.logger        → 可替换为宿主自己的日志总线（默认 console）
     * 分级约定：
     *   debug 级 —— 只在 debug 打开时输出（正常路径的细节）
     *   warn  级 —— 异常但已降级处理，**始终输出**（不得静默吞掉）
     *   error 级 —— 运行失败，**始终输出**
     */
    var config = {
        debug: false,
        logger: (typeof console !== 'undefined' && console) ? console : null,
    };

    function logAt(level, message, detail) {
        var logger = (config && config.logger)
            || (typeof console !== 'undefined' ? console : null);
        if (!logger) return;
        var fn = null;
        if (level === 'error') fn = logger.error;
        else if (level === 'warn') fn = logger.warn;
        else fn = logger.log;
        if (typeof fn !== 'function') return;
        /* debug 级只在开关打开时输出；warn / error 始终输出 */
        if (level === 'debug' && !(config && config.debug)) return;
        try {
            fn.call(logger, '[NVUI] ' + message, detail === undefined ? '' : detail);
        } catch (err) {
            /* 日志自身失败不得影响主流程 */
        }
    }

    function debug(message, detail) {
        logAt('debug', message, detail);
    }

    function warn(message, detail) {
        logAt('warn', message, detail);
    }

    /* v2.8.0：默认值缺失类告警只提示一次，避免每次创建组件都刷屏。 */
    var onceWarnings = Object.create(null);
    function warnOnce(key, message, detail) {
        if (onceWarnings[key]) return;
        onceWarnings[key] = true;
        warn(message, detail);
    }

    function error(message, detail) {
        logAt('error', message, detail);
    }

    /* ----------------------------- 工具 ----------------------------- */

    function isDomAvailable() {
        return typeof document !== 'undefined' && !!document.createElement;
    }

    /* 属性白名单：只允许「语义 / 无障碍 / 表单」类属性透传。
     * 任何 on* 事件属性、style、srcdoc 等可执行 / 可注入通道一律丢弃，
     * 避免调用方（或被污染的宿主数据）借属性通道塞入事件处理器。
     * href / src 不在白名单内：它们能承载 javascript: 伪协议，属注入面。 */
    var ALLOWED_ATTRS = [
        'id', 'title', 'role', 'type', 'hidden', 'tabindex', 'for', 'value',
        'name', 'placeholder', 'disabled', 'checked', 'readonly', 'required',
        'multiple', 'min', 'max', 'step', 'rows', 'cols', 'span',
        'alt', 'width', 'height', 'lang', 'dir', 'closing',
    ];

    function attrAllowed(key) {
        if (typeof key !== 'string' || !key) return false;
        var lower = key.toLowerCase();
        /* 事件属性（onclick / onerror / onload …）一律拒绝 */
        if (lower.indexOf('on') === 0) return false;
        /* style / srcdoc 等可直接注入脚本或样式的通道一律拒绝 */
        if (lower === 'style' || lower === 'srcdoc' || lower === 'formaction') return false;
        /* NEW-38：aria-* 与 data-* 严格匹配合法命名正则，拒绝空格等非法字符引发 InvalidCharacterError */
        if (lower.indexOf('aria-') === 0) return /^aria-[a-z0-9_-]+$/.test(lower);
        if (lower.indexOf('data-') === 0) return /^data-[a-z0-9_-]+$/.test(lower);
        return ALLOWED_ATTRS.indexOf(lower) !== -1;
    }

    var FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'meta', 'link', 'base'];

    function el(tag, className, attrs) {
        var safeTag = tag;
        /* NEW-45：危险标签名隔离（如 script/iframe） */
        if (!safeTag || typeof safeTag !== 'string' || FORBIDDEN_TAGS.indexOf(safeTag.toLowerCase()) !== -1) {
            warn('el(): 拒绝创建非法或危险标签 "' + tag + '"');
            safeTag = 'div';
        }
        var node = document.createElement(safeTag);
        if (className) node.className = (typeof className === 'symbol') ? '' : String(className);
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v === null || v === undefined) return;
                /* 只允许 textContent 通道：绝不接受原始 HTML 片段，防范 XSS */
                if (k === 'text') {
                    if (typeof v === 'symbol') v = '';
                    node.textContent = String(v);
                    return;
                }
                /* 白名单之外的属性静默丢弃并记一条 warn */
                if (!attrAllowed(k)) {
                    warn('el(): 已丢弃白名单外的属性 "' + k + '"');
                    return;
                }
                if (typeof v === 'symbol') v = '';
                try {
                    node.setAttribute(k, String(v));
                } catch (err) {
                    warn('el(): setAttribute 失败，已忽略属性 "' + k + '"');
                }
            });
        }
        return node;
    }

    /** 生成一个在文档内唯一的元素 id（仅在冲突时加后缀，保持 base 可预测）
     *  面板会用 base 派生出 -layer / -overlay / -title / -tab-* / -pane-* 等多个 id，
     *  所以冲突检测必须按「派生子 id」判断，而不是只看裸 base。 */
    var idSeq = 0;
    function idTaken(base) {
        if (typeof document === 'undefined') return false;
        return !!(document.getElementById(base)
            || document.getElementById(base + '-layer')
            || document.getElementById(base + '-overlay')
            || document.getElementById(base + '-title'));
    }
    function uniqueId(base) {
        if (!idTaken(base)) return base;
        idSeq += 1;
        var candidate = base + '-' + idSeq.toString(36);
        while (idTaken(candidate)) {
            idSeq += 1;
            candidate = base + '-' + idSeq.toString(36);
        }
        return candidate;
    }

    function append(parent, children) {
        if (!parent || typeof parent.appendChild !== 'function') return parent;
        (Array.isArray(children) ? children : [children]).forEach(function (c) {
            if (!c && c !== 0) return;
            /* NEW-45：非 Node 参数安全归一化，防范原生 appendChild 抛未捕获 TypeError */
            if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
                parent.appendChild(document.createTextNode(String(c)));
            } else if (typeof Node !== 'undefined' && c instanceof Node) {
                parent.appendChild(c);
            } else if (c && typeof c.nodeType === 'number') {
                parent.appendChild(c);
            } else {
                warn('append(): 子元素不是有效 DOM 节点，已忽略');
            }
        });
        return parent;
    }

    function iconNode(iconClass) {
        if (!iconClass) return null;
        if (typeof iconClass === 'string') return el('i', iconClass, { 'aria-hidden': 'true' });
        /* 允许调用方直接传入一个已构造好的 DOM 节点（例如自定义 SVG 图标），
           但必须是真正的 Node；否则 appendChild 会抛 TypeError 并让整块面板创建失败。 */
        if (typeof Node !== 'undefined' && iconClass instanceof Node) return iconClass;
        if (iconClass && typeof iconClass.nodeType === 'number' && typeof iconClass.appendChild === 'function') {
            return iconClass;
        }
        warn('iconNode(): 图标既不是类名字符串也不是 DOM 节点，已忽略');
        return null;
    }

    /* 活体监听计数（v2.9.0 / GH-#18 B2）。
       只统计挂在**长寿命目标**（window / document / documentElement / body /
       MediaQueryList）上的监听 —— 元素级监听随节点一起被回收，把它们也算进来
       只会让计数只增不减，反而掩盖真泄漏（实测：面板按钮的 click 会让计数永远涨）。
       kit 侧所有挂载 / 摘除都走 on() / off()，计数才是可信的。 */
    var listenerCounts = Object.create(null);

    function isGlobalListenerTarget(target) {
        if (!target) return false;
        if (typeof window !== 'undefined' && target === window) return true;
        if (typeof document !== 'undefined'
            && (target === document || target === document.documentElement || target === document.body)) {
            return true;
        }
        if (typeof window !== 'undefined' && typeof window.MediaQueryList === 'function'
            && target instanceof window.MediaQueryList) {
            return true;
        }
        return false;
    }

    function on(target, type, handler, options) {
        if (!target || typeof target.addEventListener !== 'function') return handler;
        target.addEventListener(type, handler, options || false);
        if (isGlobalListenerTarget(target)) listenerCounts[type] = (listenerCounts[type] || 0) + 1;
        return handler;
    }

    function off(target, type, handler, options) {
        if (!target || typeof target.removeEventListener !== 'function') return;
        target.removeEventListener(type, handler, options || false);
        if (isGlobalListenerTarget(target) && listenerCounts[type] > 0) listenerCounts[type] -= 1;
    }

    /**
     * 把任意字符串折算成「可安全拼进 DOM id」的片段。
     * 只保留 [A-Za-z0-9_-]，其余字符（含空格 / 引号 / < >）一律替换为下划线；
     * 空串回退到 fallback。这样拼出来的 id 一定满足 HTML5 的 id 语法，
     * 也不会让 ARIA 的 IDREF（aria-controls / aria-labelledby）断链。
     */
    function sanitizeIdPart(raw, fallback) {
        var s = (raw === null || raw === undefined) ? '' : String(raw);
        var safe = s.replace(/[^A-Za-z0-9_-]/g, '_');
        if (!safe) safe = fallback || 'x';
        /* id 不能以数字开头（CSS 选择器与部分工具链不接受） */
        if (/^[0-9]/.test(safe)) safe = '_' + safe;
        return safe;
    }

    /** URL 安全协议校验（拒绝 javascript: / data: / vbscript: 伪协议注入通道） */
    function isSafeUrl(rawUrl) {
        if (typeof rawUrl !== 'string' || !rawUrl) return false;
        var normalized = rawUrl.replace(/[\u0000-\u0020\u007f-\u009f\s]+/g, '').toLowerCase();
        if (!normalized) return false;
        if (normalized.indexOf('javascript:') === 0 ||
            normalized.indexOf('data:') === 0 ||
            normalized.indexOf('vbscript:') === 0) {
            return false;
        }
        return true;
    }

    /**
     * 焦点兜底选择器解析（NEW-03）：
     *   - README 公开契约是「CSS 选择器 或元素」，所以这里**不**把选择器收窄成只认 #id
     *     （那会破坏既有调用方），而是：
     *       1) 纯 #id 走 getElementById —— 完全不经 CSS 解析，零注入面；
     *       2) 其余选择器先做字符白名单校验（拒绝 < > ; { } \ 等可逃逸字符），再走 querySelector；
     *       3) querySelector 包 try/catch —— 非法选择器会抛 SyntaxError，
     *          若不吞掉会打断「焦点归还链」，让键盘用户彻底失去焦点位置。
     *     校验不通过时静默降级为 null，调用方继续走「面板容器」这级兜底。
     */
    var FOCUS_SELECTOR_FORBIDDEN = /[<>;{}\\]/;

    function resolveFocusFallback(selector) {
        var sel = String(selector).trim();
        if (!sel) return null;
        /* 纯 #id 走 getElementById：不经选择器解析，零注入面 */
        if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(sel)) {
            return document.getElementById(sel.slice(1));
        }
        if (FOCUS_SELECTOR_FORBIDDEN.test(sel)) {
            warn('focusFallback: 选择器 "' + sel + '" 含不允许的字符，已忽略');
            return null;
        }
        try {
            return document.querySelector(sel);
        } catch (err) {
            /* 非法选择器会让 querySelector 抛 SyntaxError —— 必须吞掉，
               否则焦点归还链被打断，焦点彻底丢失。 */
            warn('focusFallback: 选择器 "' + sel + '" 解析失败，已忽略');
            return null;
        }
    }

    function q(sel, scope) {
        return (scope || document).querySelector(sel);
    }

    /** 元素当前是否可聚焦（可见 + 未 disabled + 在文档中） */
    function isFocusable(node) {
        if (!node || !node.isConnected) return false;
        if (node.disabled) return false;
        /* NEW-43：优先使用原生 checkVisibility 判定可见性（硬件加速且同时检查 display 与 visibility:hidden） */
        if (typeof node.checkVisibility === 'function') {
            try {
                return node.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
            } catch (err) { /* 回退下述检测 */ }
        }
        var cs = window.getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (node.offsetWidth === 0 && node.offsetHeight === 0) return false;
        return true;
    }

    /**
     * 节点是否位于「当前收起的折叠体」内部（Issue #13）。
     * `.nvui-acc-body` 收起时是 visibility:hidden + 0fr（宽度仍在），
     * 因此不能只靠 offsetWidth 判断。折叠体的 visibility 会被显式设为
     * visible，若只用继承可见性判断，嵌套在收起折叠体里的展开折叠体仍会
     * 被误判为可见 —— 这里沿 .nvui-acc-body 祖先链逐层检查。
     */
    function isInsideCollapsedAccordion(node) {
        if (!node || typeof node.closest !== 'function') return false;
        var body = node.closest('.nvui-acc-body');
        while (body) {
            var acc = body.parentElement;
            if (acc && acc.classList && acc.classList.contains('nvui-acc')
                && !acc.classList.contains('is-open')) {
                return true;
            }
            body = (acc && typeof acc.closest === 'function') ? acc.closest('.nvui-acc-body') : null;
        }
        return false;
    }

    /**
     * 焦点陷阱专用可聚焦判定（Issue #13）：在 isFocusable 的基础上再排除
     * inert 子树和收起折叠体里的控件，保证 Tab 边界只由真正可见的控件组成。
     */
    function isTrapFocusable(node) {
        if (!isFocusable(node)) return false;
        if (isInsideCollapsedAccordion(node)) return false;
        if (typeof node.closest === 'function' && node.closest('[inert]')) return false;
        return true;
    }

    /** 收起折叠体时，若焦点在即将隐藏的正文里，把焦点交还折叠触发器（Issue #13）。 */
    function restoreFocusFromCollapsedAccordion(accNode) {
        if (!accNode || typeof accNode.contains !== 'function') return;
        var active = document.activeElement;
        if (!active || active === accNode || !accNode.contains(active)) return;
        var head = accNode.head || (accNode.querySelector ? accNode.querySelector('.nvui-acc-head') : null);
        if (!head || active === head || typeof head.focus !== 'function') return;
        head.focus();
    }

    /**
     * Tab / Shift+Tab 的焦点循环（focus trap，2026-11-16 实机冒烟后抽出）。
     * 只把真正处在原生 Tab 序列里的节点算作首尾：tab 用 roving tabindex
     * （未激活 tab 为 -1），若把它们也算进来，真正的最后一站会被误判成
     * 「后面还有下一站」而放行默认 Tab —— 原生序列此时已走完，焦点直接落到宿主页面
     * （复现：纯文本面板从激活 tab 按一次 Tab 即逃出面板）。
     */
    /* 面板内可 Tab 的元素（focus trap 与初始焦点共用一份，避免两处选择器漂移） */
    var PANEL_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function trapTabFocus(event, panel, focusableSelector) {
        var items = Array.prototype.filter.call(
            panel.querySelectorAll(focusableSelector),
            function (node) { return isTrapFocusable(node) && node.tabIndex >= 0; }
        );
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        var current = document.activeElement;

        if (!panel.contains(current)) {
            event.preventDefault();
            (event.shiftKey ? last : first).focus();
            return;
        }
        if (items.indexOf(current) === -1) {
            /* 焦点在面板容器自身或 tabindex=-1 的节点（如被点中的非激活 tab）上：
               该方向在 DOM 里还有下一站就交回浏览器原生移动，没有才回卷，
               否则会把「可去内容区」误拦成「回到首项」。 */
            var hasNext = false;
            var hasPrev = false;
            for (var i = 0; i < items.length; i++) {
                var rel = current.compareDocumentPosition(items[i]);
                if (rel & Node.DOCUMENT_POSITION_FOLLOWING) hasNext = true;
                else if (rel & Node.DOCUMENT_POSITION_PRECEDING) hasPrev = true;
            }
            if (!event.shiftKey && !hasNext) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && !hasPrev) {
                event.preventDefault();
                last.focus();
            }
            return;
        }
        if (event.shiftKey && current === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && current === last) {
            event.preventDefault();
            first.focus();
        }
    }

    /* ---------------------- 设计令牌读取（含缓存） ---------------------- */
    /*
     * v2.4.0（NEW-10）：getToken() 原本每次调用都执行
     * getComputedStyle(host).getPropertyValue(name) —— 没有任何缓存。
     * getCarrierState() 每次都会调它，业务侧若在渲染循环里取值，
     * 会持续触发样式解析（style recalc），拖慢整页。
     *
     * 缓存策略（刻意做得保守，避免读到过期值）：
     *   - 键 = name + '|' + scopeId（scope 为元素时给元素分配一个稳定 id）；
     *   - 缓存项同时记下当时的 host.className 与 style 属性；
     *     再次读取时若两者变了（主题类切换 / 内联样式改动）→ 直接重算。
     *     这样「切主题」「加 .nvui-solid」这类靠 class 的变更不会读到旧值；
     *   - setTheme() 主动清空缓存（它会切 .nvui-theme-light / .nvui-solid）；
     *   - 另导出 invalidateTokenCache()，供宿主在外部改了样式表后手动失效。
     */
    var tokenCache = Object.create(null);
    var tokenScopeSeq = 0;

    function tokenScopeId(scope) {
        if (!scope) return 'root';
        if (!scope.__nvuiTokenScopeId) {
            tokenScopeSeq += 1;
            try { scope.__nvuiTokenScopeId = tokenScopeSeq; } catch (err) { return 'root'; }
        }
        return 's' + scope.__nvuiTokenScopeId;
    }

    /** 读取当前作用域里的设计令牌（CSS 自定义属性，带缓存） */
    function getToken(name, scope) {
        if (!isDomAvailable()) return '';
        var host = scope || document.documentElement;
        var key = name + '|' + tokenScopeId(host);
        /* 签名：class + 内联样式。两者任一变化都说明令牌可能已改 → 重算 */
        var sig = (host.className || '') + '' + (host.getAttribute ? (host.getAttribute('style') || '') : '');
        var hit = tokenCache[key];
        if (hit && hit.sig === sig) return hit.value;
        var value = getComputedStyle(host).getPropertyValue(name).trim();
        tokenCache[key] = { value: value, sig: sig };
        return value;
    }

    /** 让令牌缓存失效（外部改了样式表 / 需要强制重读时调用） */
    function invalidateTokenCache() {
        tokenCache = Object.create(null);
    }

    /* ---------------------- 自动主题（v2.9.0 / GH-#18 B6） ---------------------- */
    /*
     * 下游普遍在写同一套胶水：监听 prefers-color-scheme、判断宿主是否浅色、
     * 再自己 toggle `.nvui-theme-light`。setTheme('auto') 把它收进来。
     *
     * 双信号取**并集**：系统偏好浅色，**或**宿主自己套了 `.nvui-theme-light`
     * （例如 ST 的浅色皮肤）→ 浅色。任一成立都不该继续给深色面板。
     *
     * 两个刻意的取舍：
     * 1. 宿主信号在「切到 auto 的那一刻」采样，不做 MutationObserver ——
     *    我们写的就是同一个类名，观察它只会把自己的写入当成宿主意图（实测会出现
     *    「宿主套了浅色 → auto 保住 → 自己触发 observer → 立刻改回深色」的抖振）；
     * 2. 采样时排除「本模块自己写的那个类」，否则 setTheme('light') 之后切 auto
     *    会把上次的显式选择误判成宿主皮肤，系统深色下也回不到深色。
     */
    var themeAuto = {
        host: null,
        mq: null,
        onMq: null,
        active: false,
        /* 宿主在 auto 生效前的浅色声明（采样一次） */
        hostLightSignal: false,
        /* 当前 body 上的 .nvui-theme-light 是不是本模块写的 */
        selfAppliedLight: false,
    };

    function teardownAutoTheme() {
        if (themeAuto.mq && themeAuto.onMq) off(themeAuto.mq, 'change', themeAuto.onMq);
        themeAuto.mq = null;
        themeAuto.onMq = null;
        themeAuto.active = false;
    }

    function syncAutoTheme() {
        if (!themeAuto.active || !themeAuto.host) return;
        var systemLight = !!(themeAuto.mq && themeAuto.mq.matches);
        var light = systemLight || themeAuto.hostLightSignal;
        themeAuto.host.classList.toggle('nvui-theme-light', light);
        themeAuto.selfAppliedLight = light;
        /* 类名变了就必须让令牌缓存失效，否则 getToken() 还拿旧皮肤的值 */
        invalidateTokenCache();
    }

    function applySolidOption(host, options) {
        if (!options || typeof options.solid !== 'boolean') return;
        if (options.solid) host.classList.add('nvui-solid');
        else host.classList.remove('nvui-solid');
    }

    /** 主题/实心切换：仅切类名，不写死任何颜色。
     *  v2.7.2：不再无条件清除 `.nvui-solid`（那是用户主动的实心偏好，不能被切主题抹掉）；
     *  只有显式传 `options.solid` 时才切换实心类。
     *  v2.9.0：新增 `'auto'` —— 跟随系统深浅 + 宿主浅色声明，matchMedia 变更即时生效。 */
    function setTheme(theme, options) {
        var host = (options && options.host) || (isDomAvailable() ? document.body : null);
        if (!host || !host.classList) { warn('setTheme(): 无效 host'); return; }

        if (theme === 'auto') {
            if (!isDomAvailable() || typeof window.matchMedia !== 'function') {
                warn("setTheme('auto'): 当前环境没有 matchMedia，已回退到 dark");
                theme = 'dark';
            } else {
                teardownAutoTheme();
                themeAuto.host = host;
                themeAuto.active = true;
                /* 采样宿主信号时要排除自己写过的那个类（见上方注释 2） */
                themeAuto.hostLightSignal = host.classList.contains('nvui-theme-light')
                    && !themeAuto.selfAppliedLight;
                themeAuto.mq = window.matchMedia('(prefers-color-scheme: light)');
                themeAuto.onMq = function () { syncAutoTheme(); };
                on(themeAuto.mq, 'change', themeAuto.onMq);
                syncAutoTheme();
                applySolidOption(host, options);
                return;
            }
        }

        /* 显式 light / dark：摘掉 auto 的监听，主权交回调用方 */
        teardownAutoTheme();
        host.classList.remove('nvui-theme-light');
        if (theme === 'light') {
            host.classList.add('nvui-theme-light');
            themeAuto.selfAppliedLight = true;
        } else if (theme === 'dark') {
            themeAuto.selfAppliedLight = false;
        } else if (theme) {
            warn('setTheme(): 未知主题');
        }
        applySolidOption(host, options);
        invalidateTokenCache();
    }

    /* ---------------------- 玻璃能力探测 ---------------------- */
    /*
     * v2.2.0（ISSUES.md #15）：部分宿主（如 SillyTavern 的 Fast UI）会用
     * `body.no-blur * { backdrop-filter: unset !important }` 全局关掉模糊。
     * 浏览器仍然「支持」backdrop-filter，所以 @supports 探测不到，必须读渲染后的实际计算值。
     *
     * v2.7.2（ISSUES.md #16/#17）修正三件事：
     *   1. 回退不再整块不透明：宿主禁用模糊时给根节点加 `.nvui-glass-fallback`，
     *      CSS 用 `--nvui-glass-bg-strong`（0.80）做半透明回退，保留玻璃观感且 AA 安全；
     *      `.nvui-solid` 只保留给「用户主动要全不透明」。
     *   2. 三态探测：`supported` / `unsupported` / `unknown`。unknown 表示 kit CSS 尚未就绪，
     *      此时不写缓存、不落回退，并安排有限次重探（load / fonts / 定时器）。
     *   3. 可逆与「不自杀」：探测前临时摘掉 `.nvui-solid` 与 `.nvui-glass-fallback`，避免探针被 kit
     *      自己的降级规则压成 none 而永久误判；恢复支持时移除自动回退。
     */
    var GLASS_FALLBACK_CLASS = 'nvui-glass-fallback';
    var glassState = { state: null, reason: '', key: '' };
    var glassRecheckTimer = null;
    var glassRecheckAttempts = 0;

    function kitCssReady() {
        if (!isDomAvailable()) return true;
        try {
            return !!getComputedStyle(document.documentElement).getPropertyValue('--nvui-glass-blur').trim();
        } catch (err) {
            return false;
        }
    }

    function hasUserSolid() {
        if (!isDomAvailable()) return false;
        var de = document.documentElement;
        var body = document.body;
        return !!((de && de.classList && de.classList.contains('nvui-solid'))
            || (body && body.classList && body.classList.contains('nvui-solid')));
    }

    function glassSignature() {
        if (!isDomAvailable()) return 'node';
        var reduce = '0';
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches) reduce = '1';
        } catch (err) { /* matchMedia 不可用时忽略 */ }
        var rootClass = (document.documentElement.className || '').replace(/\bnvui-glass-fallback\b/, '').replace(/\s+/g, ' ').trim();
        return [
            rootClass,
            (document.body && document.body.className) || '',
            reduce,
            kitCssReady() ? 'css' : 'nocss',
            hasUserSolid() ? 'solid' : 'nosolid',
        ].join('|');
    }

    function applyGlassFallback(root) {
        if (root && root.classList) root.classList.add(GLASS_FALLBACK_CLASS);
    }

    function clearGlassFallback(root) {
        if (root && root.classList && root.classList.contains(GLASS_FALLBACK_CLASS)) {
            root.classList.remove(GLASS_FALLBACK_CLASS);
        }
    }

    /** 探测一次玻璃能力；探测前后恢复用户的 `.nvui-solid` / 自动回退属性（避免自锁）。 */
    function probeGlassState() {
        if (!isDomAvailable() || !document.body) return { state: 'supported', reason: 'no-dom' };
        if (!kitCssReady()) return { state: 'unknown', reason: 'kit-css-not-ready' };
        var de = document.documentElement;
        var body = document.body;
        var restoreSolid = [];
        var restoreFallback = false;
        if (de && de.classList && de.classList.contains(GLASS_FALLBACK_CLASS)) {
            de.classList.remove(GLASS_FALLBACK_CLASS);
            restoreFallback = true;
        }
        if (de && de.classList && de.classList.contains('nvui-solid')) { de.classList.remove('nvui-solid'); restoreSolid.push(de); }
        if (body && body.classList && body.classList.contains('nvui-solid')) { body.classList.remove('nvui-solid'); restoreSolid.push(body); }
        var probe = document.createElement('div');
        probe.className = 'nvui-glass';
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0;';
        document.body.appendChild(probe);
        var state = 'supported';
        var reason = '';
        try {
            var cs = window.getComputedStyle(probe);
            var bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
            if (bf === 'none' || bf === 'unset') { state = 'unsupported'; reason = 'backdrop-filter-disabled'; }
            else if (bf === '') { state = 'unknown'; reason = 'no-computed-backdrop-filter'; }
        } catch (err) {
            state = 'unknown';
            reason = 'probe-failed';
        }
        try { probe.parentNode.removeChild(probe); } catch (err) { /* 忽略移除失败 */ }
        for (var i = 0; i < restoreSolid.length; i++) restoreSolid[i].classList.add('nvui-solid');
        if (de && restoreFallback) de.classList.add(GLASS_FALLBACK_CLASS);
        return { state: state, reason: reason };
    }

    /** 有限次重探：覆盖「脚本先于 kit CSS 执行」的加载顺序竞争（CDN / 模块顶层调用）。 */
    function scheduleGlassRecheck() {
        if (!isDomAvailable() || glassRecheckTimer || glassRecheckAttempts >= 5) return;
        glassRecheckTimer = setTimeout(function () {
            glassRecheckTimer = null;
            glassRecheckAttempts += 1;
            glassState = { state: null, reason: '', key: '' };
            syncGlassFallback();
        }, 120);
        if (glassRecheckAttempts === 0) {
            if (window.addEventListener && document.readyState !== 'complete') {
                on(window, 'load', function onLoad() {
                    off(window, 'load', onLoad);
                    syncGlassFallback({ force: true });
                }, { once: true });
            }
            if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
                document.fonts.ready.then(function () { syncGlassFallback({ force: true }); });
            }
        }
    }

    /**
     * 玻璃能力探测（公开 API，返回值保持布尔以兼容 v2.7.1）：
     * true = 模糊可用或暂未确定（unknown 不落回退）；false = 确定被宿主/浏览器禁用。
     * 结果按「根/body class + 减少透明度偏好 + CSS 就绪 + 用户实心偏好」签名缓存。
     */
    function detectGlassSupport(options) {
        if (!isDomAvailable() || !document.body) return true;
        var force = !!(options && options.force);
        var key = glassSignature();
        if (!force && glassState.state !== null && glassState.key === key) return glassState.state !== 'unsupported';
        var result = probeGlassState();
        glassState = { state: result.state, reason: result.reason, key: key };
        glassRecheckAttempts = 0;
        if (result.state === 'unknown') scheduleGlassRecheck();
        return result.state !== 'unsupported';
    }

    /**
     * 探测玻璃能力并同步自动回退：
     * - unsupported（宿主禁用模糊，如 SillyTavern Fast UI 默认 body.no-blur）：
     *   给根节点加 `.nvui-glass-fallback`，CSS 用半透明 strong 档回退；用户 `.nvui-solid` 优先。
     * - supported：移除自动回退（可逆）。
     * - unknown：保持现状，等待重探。
     * 返回 true 表示模糊可用（与 v2.7.1 兼容）。
     */
    function syncGlassFallback(options) {
        var supported = detectGlassSupport(options);
        if (!isDomAvailable()) return supported;
        var root = (options && options.host) || document.documentElement;
        if (!root) return supported;
        var state = glassState.state;
        if (state === 'unsupported' && !hasUserSolid()) applyGlassFallback(root);
        else if (state === 'supported') clearGlassFallback(root);
        return supported;
    }

    /* ---------------------- v2.8.0 玻璃模式（面板级） ---------------------- */

    var GLASS_MODES = ['auto', 'force', 'solid'];

    function normalizeGlassMode(value) {
        if (value === undefined || value === null || value === '') return 'auto';
        var mode = String(value).toLowerCase();
        if (GLASS_MODES.indexOf(mode) === -1) {
            warn('glass 模式 "' + value + '" 无效，已回退 auto（可选 auto/force/solid）');
            return 'auto';
        }
        return mode;
    }

    function browserSupportsBackdrop() {
        if (typeof window === 'undefined' || !window.CSS || typeof window.CSS.supports !== 'function') {
            return true;
        }
        try {
            return !!(window.CSS.supports('backdrop-filter', 'blur(1px)')
                || window.CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
        } catch (err) {
            return true;
        }
    }

    function glassPreferenceBlocksForce() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
        try {
            return !!(window.matchMedia('(prefers-reduced-transparency: reduce)').matches
                || window.matchMedia('(forced-colors: active)').matches);
        } catch (err) {
            return false;
        }
    }

    function resolveEffectiveGlassMode(mode) {
        if (mode === 'solid') return 'solid';
        if (mode === 'force') {
            if (!browserSupportsBackdrop() || glassPreferenceBlocksForce()) return 'auto';
            return 'force';
        }
        return 'auto';
    }

    function applyPanelGlassMode(dialogEl, mode) {
        if (!dialogEl || !dialogEl.setAttribute) return 'auto';
        var effective = resolveEffectiveGlassMode(mode);
        /* data-nvui-glass 是「实际生效」模式，供 CSS 使用；请求模式另存，便于 getGlassState 解释。 */
        dialogEl.setAttribute('data-nvui-glass-mode', mode);
        dialogEl.setAttribute('data-nvui-glass', effective);
        if (effective === 'solid') dialogEl.classList.add('nvui-solid');
        else dialogEl.classList.remove('nvui-solid');
        if (effective === 'auto') {
            /* 回到 auto 时重新同步宿主回退；force 时保留全局回退，让其它 auto 面板继续生效 */
            if (typeof syncGlassFallback === 'function') syncGlassFallback();
        }
        return effective;
    }

    function versionTag() {
        return String(VERSION);
    }

    function stampVersion(root) {
        if (!isDomAvailable()) return;
        try {
            if (document.documentElement) document.documentElement.setAttribute('data-nvui-version', versionTag());
            if (root && root.setAttribute) root.setAttribute('data-nvui-version', versionTag());
        } catch (err) { /* 属性写入失败不影响主流程 */ }
    }

    /* ---------------------- 浮层开合（top-layer 载体） ---------------------- */

    /**
     * 打开浮层：非模态 dialog.show()（避免 inert，遵守酒馆 transform 红线），
     * overlay.hidden=false 触发 CSS 进出场。
     */
    function openLayer(dialogEl, overlayEl) {
        if (!dialogEl || !overlayEl) return;
        cancelLayerClose(overlayEl);
        overlayEl.classList.remove('is-closing');
        /* 打开瞬间同步一次宿主模态降级态与玻璃能力（v2.7.2：宿主可能在面板创建后才切换 Fast UI） */
        syncHostModalState();
        syncGlassFallback();
        if (dialogEl.open) {
            overlayEl.hidden = false;
            return;
        }
        try {
            dialogEl.show();
        } catch (err) {
            dialogEl.setAttribute('open', '');
        }
        overlayEl.hidden = false;
    }

    /**
     * 退场动画兜底时长：优先从设计令牌 --nvui-duration-base 派生，
     * 保证与 CSS 里的退场动画时长保持一致（额外加 60ms 余量等待 animationend 到达）。
     * 令牌读不到时退回默认 260ms（= 200ms base + 60ms 余量）。
     */
    function animationFallbackMs(extraMs) {
        var raw = getToken('--nvui-duration-base');
        var base = 200;
        if (raw) {
            var parsed = parseFloat(raw);
            if (!isNaN(parsed) && parsed > 0) base = parsed;
        }
        return Math.round(base + (typeof extraMs === 'number' ? extraMs : 60));
    }

    /**
     * 关闭浮层：先加 .is-closing 播放退场动画，animationend（或令牌派生的兜底时长）后 hidden + close。
     */
    function cancelLayerClose(overlayEl) {
        if (overlayEl.__nvuiCancelClose) overlayEl.__nvuiCancelClose();
    }

    function closeLayer(dialogEl, overlayEl, done) {
        if (!dialogEl || !overlayEl) return;
        if (overlayEl.hidden || overlayEl.classList.contains('is-closing')) return;
        overlayEl.classList.add('is-closing');
        var timer;
        function cancel() {
            clearTimeout(timer);
            off(overlayEl, 'animationend', onAnimEnd);
            overlayEl.__nvuiCancelClose = null;
        }
        function finish() {
            cancel();
            if (!overlayEl.classList.contains('is-closing')) return;
            overlayEl.hidden = true;
            overlayEl.classList.remove('is-closing');
            if (dialogEl.open) {
                try { dialogEl.close(); } catch (err) { dialogEl.removeAttribute('open'); }
            }
            if (typeof done === 'function') done();
        }
        function onAnimEnd(event) {
            /* animationend 冒泡：只认 overlay 自身动画 */
            if (event && event.target !== overlayEl) return;
            finish();
        }
        on(overlayEl, 'animationend', onAnimEnd);
        overlayEl.__nvuiCancelClose = cancel;
        timer = setTimeout(finish, animationFallbackMs(60));
    }

    /* ---------------------- 标签指示器（粘连滑动） ---------------------- */

    /**
     * 标签指示器几何同步。
     *   NOTE：这里保持「读 offset* → 写 CSS 变量」的原实现，不再改成 getBoundingClientRect。
     *   实机取证（QA，帧间隔判据 README §13.6）显示切 tab 的 p95 帧间隔与静止基线差 0.00ms，
     *   超预算帧 0 —— 强制同步布局在此场景不可感知，改写反而引入行为差异（滚动补偿语义），故保持原样。
     */
    function syncTabsIndicator(tabs, animate) {
        var indicator = q('.nvui-tabs-indicator', tabs);
        var active = q('.nvui-tab.is-active', tabs);
        if (!indicator || !active) return;
        var x = active.offsetLeft;
        var y = active.offsetTop;
        var w = active.offsetWidth;
        var h = active.offsetHeight;
        var had = tabs.classList.contains('is-indicator');
        var prevX = parseFloat(indicator.style.getPropertyValue('--nvui-tab-ind-x')) || 0;
        var prevW = parseFloat(indicator.style.getPropertyValue('--nvui-tab-ind-w')) || 0;
        function set(nx, ny, nw, nh) {
            indicator.style.setProperty('--nvui-tab-ind-x', nx + 'px');
            indicator.style.setProperty('--nvui-tab-ind-y', ny + 'px');
            indicator.style.setProperty('--nvui-tab-ind-w', nw + 'px');
            indicator.style.setProperty('--nvui-tab-ind-h', nh + 'px');
        }
        if (!had || !animate) {
            set(x, y, w, h);
            tabs.classList.add('is-indicator');
            return;
        }
        var left = Math.min(prevX, x);
        var right = Math.max(prevX + prevW, x + w);
        if (left === right && prevX === x) return;
        set(left, y, right - left, h);
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { set(x, y, w, h); });
        });
    }

    /* ---------------------- 基础行组件 ---------------------- */

    /** 胶囊开关行：<label class="nvui-switch-row"><input type="checkbox"><span>…</span></label> */
    function switchRow(options) {
        var opts = options || {};
        if (!opts.label) warnOnce('switchRow-label', 'switchRow(): 缺少 label，将渲染空标签行');
        var row = el('label', 'nvui-switch-row' + (opts.feature ? ' is-feature' : ''));
        var input = el('input', null, { type: 'checkbox' });
        input.checked = !!opts.value;
        if (opts.disabled) input.disabled = true;
        var text = el('span', null, { text: opts.label || '' });
        row.appendChild(input);
        row.appendChild(text);
        if (typeof opts.onChange === 'function') {
            on(input, 'change', function () { opts.onChange(input.checked); });
        }
        return row;
    }

    /* 输入类型白名单：
       - 原生 input 支持的类型直接放行；
       - 'path' 是 kit 的伪类型（路径框：DOM 上仍是 text，只是加 .is-path 样式），
         它在 README / preview 里是公开用法，必须保留；
       - 白名单外的类型（如 'pathway'、'richtext'）静默回退为 text 并记一条 warn。 */
    var INPUT_TYPES = [
        'text', 'number', 'password', 'email', 'url', 'tel', 'search',
        'date', 'time', 'datetime-local', 'month', 'week', 'color', 'range', 'file',
    ];
    /* kit 伪类型：DOM 用别的元素或别的 type 承载，意图走 data-nvui-type。
       v2.9.0（GH-#18 B5）新增 'textarea' —— 14 种原生 input 类型里没有多行文本。 */
    var KIT_INPUT_TYPES = ['path', 'textarea'];
    /* 消息节点 id 序号：同一批次创建多个输入行时 uniqueId() 还看不到未入文档的节点 */
    var inputMsgSeq = 0;

    function normalizeInputType(type) {
        if (typeof type !== 'string' || !type) return 'text';
        var t = type.toLowerCase();
        if (INPUT_TYPES.indexOf(t) !== -1) return t;
        if (KIT_INPUT_TYPES.indexOf(t) !== -1) return t;
        warn('inputRow(): 不支持的 type "' + type + '"，已回退为 text');
        return 'text';
    }

    /** 输入行：<label class="nvui-input-row"><input class="nvui-input"><span>…</span></label>
     *
     *  v2.4.0（NEW-05，QA 实测修正）：修复前 `input.type = opts.type === 'number' ? 'number' : 'text'`
     *  会把 10 种请求类型里的 8 种静默改写成 text —— 其中 file / color / date 是**用户可感知的功能消失**
     *  （文件选择器 / 取色器 / 日期选择器直接没了）。现在：
     *    - 原生 input 支持的类型（email / url / tel / search / date / time / color / file / number …）
     *      原样落到 DOM type 属性上；
     *    - 'path' 是 kit 的伪类型：浏览器不支持 type="path"，写进属性会被规范化为 text
     *      （规范：type IDL 属性只反映「已知值」，未知值一律回退 text），
     *      所以 DOM 上就是 type="text" + .is-path —— 这与 preview.html 里手写的路径框
     *      （<input class="nvui-input is-path" type="text">）以及 README §7.6（输入行）完全一致，
     *      **DOM 契约不变**；
     *      调用方若需要知道自己请求的是伪类型，读 input.dataset.nvuiType（= 'path'）——
     *      这与 kit 其它地方用 data-* 承载扩展信息的做法一致，且完全无侵入；
     *    - 白名单外的类型（'pathway'、'richtext' …）静默回退 text 并记一条 warn。 */
    function inputRow(options) {
        var opts = options || {};
        if (!opts.label) warnOnce('inputRow-label', 'inputRow(): 缺少 label，将渲染空标签行');
        var row = el('label', 'nvui-input-row');
        var type = normalizeInputType(opts.type);
        var isTextarea = type === 'textarea';
        /* 伪类型 path / textarea：DOM 类型仍是 text / textarea，只靠 is-* 类表现 */
        var domType = type === 'path' ? 'text' : type;
        var input;
        if (isTextarea) {
            input = el('textarea', 'nvui-input is-textarea');
            input.rows = (typeof opts.rows === 'number' && opts.rows > 0) ? Math.round(opts.rows) : 3;
        } else {
            input = el('input', 'nvui-input' + (type === 'number' ? ' is-number' : (type === 'path' ? ' is-path' : '')));
            input.type = domType;
        }
        if (type === 'path' || isTextarea) {
            /* 伪类型的意图用 data-* 承载：
               不覆盖 input.type 的 IDL 访问器 —— 覆盖会造成「DOM 属性是 text、JS 读出 path」
               的双真值，序列化 / cloneNode / 表单提交看到的是 text，而业务代码读到 path；
               且 setter 语义会错乱（写 number 后 getter 仍返回 path，读写永久不一致）。
               现在 DOM 与手写的 .is-path 路径框完全同构，意图由 dataset.nvuiType 暴露。 */
            input.setAttribute('data-nvui-type', type);
        }
        if (opts.value !== undefined && opts.value !== null) {
            try {
                input.value = opts.value;
            } catch (err) {
                /* file 类型不允许程序赋非空值，赋值会抛 InvalidStateError —— 忽略即可 */
                warn('inputRow(): type="' + type + '" 不接受程序赋值，已忽略 value');
            }
        }
        if (opts.placeholder) input.placeholder = opts.placeholder;
        if (opts.min !== undefined && typeof opts.min !== 'symbol' && isFinite(Number(opts.min))) input.min = opts.min;
        if (opts.max !== undefined && typeof opts.max !== 'symbol' && isFinite(Number(opts.max))) input.max = opts.max;
        if (opts.step !== undefined && typeof opts.step !== 'symbol' && isFinite(Number(opts.step))) input.step = opts.step;
        if (opts.disabled) input.disabled = true;
        var text = el('span', null, { text: opts.label || '' });
        row.appendChild(input);
        row.appendChild(text);
        if (typeof opts.onChange === 'function') {
            on(input, 'change', function () {
                /* number 类型回传数字（与 input.value 的字符串语义区分开）；
                   其余类型仍回传字符串，保持既有契约。 */
                if (type === 'number') {
                    var n = Number(input.value);
                    opts.onChange(isFinite(n) ? n : 0);
                    return;
                }
                opts.onChange(input.value);
            });
        }
        /* v2.9.0（GH-#18 B5）：hint / error 各生成独立 id 的消息节点，
           input 的 aria-describedby 指向它们（两个都传时按「提示在前、错误在后」并列）。
           刻意不复用一个 id：读屏会把合并后的两段读成一串，调试时也分不清谁是谁。 */
        var describedBy = [];
        var appendMsg = function (text, kind) {
            inputMsgSeq += 1;
            var msgId = uniqueId('nvui-input-msg-' + inputMsgSeq);
            var msg = el('span', 'nvui-input-msg is-' + kind, { id: msgId, text: text });
            describedBy.push(msgId);
            row.appendChild(msg);
            if (kind === 'error') {
                input.setAttribute('aria-invalid', 'true');
                row.classList.add('is-error');
            }
            row.classList.add('is-msg');
        };
        if (opts.hint) appendMsg(opts.hint, 'hint');
        if (opts.error) appendMsg(opts.error, 'error');
        if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));

        row.input = input;
        return row;
    }

    /** 折叠分组：button.nvui-acc-head + .nvui-acc-body > .nvui-acc-inner */
    function accordion(options) {
        var opts = options || {};
        if (!opts.title) warnOnce('accordion-title', 'accordion(): 缺少 title，将渲染空标题折叠组');
        var root = el('div', 'nvui-acc' + (opts.open ? ' is-open' : ''));
        var head = el('button', 'nvui-acc-head nvui-acc-header', { type: 'button', 'aria-expanded': opts.open ? 'true' : 'false' });
        var title = el('span', 'nvui-acc-title', { text: opts.title || '' });
        var summary = el('span', 'nvui-acc-summary', { text: opts.summary || '' });
        var chev = el('i', 'nvui-acc-chev', { 'aria-hidden': 'true' });
        append(head, [title, summary, chev]);
        var body = el('div', 'nvui-acc-body');
        var inner = el('div', 'nvui-acc-inner');
        append(inner, opts.content || []);
        body.appendChild(inner);
        append(root, [head, body]);
        on(head, 'click', function () {
            var open = root.classList.toggle('is-open');
            head.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        root.head = head;
        root.inner = inner;
        root.setOpen = function (v) {
            root.classList.toggle('is-open', !!v);
            head.setAttribute('aria-expanded', v ? 'true' : 'false');
            /* Issue #13：收起时焦点若在正文里会随 visibility:hidden 一起失踪，
               先把焦点还给仍然可见的折叠触发器。 */
            if (!v) restoreFocusFromCollapsedAccordion(root);
        };
        root.setSummary = function (text) { summary.textContent = text || ''; };
        return root;
    }

    /**
     * 进度值归一化：把任意输入（字符串 / NaN / 越界 / null）折算成 [0,100] 的有限数。
     * 初始渲染与 setValue 共用同一份归一化结果，
     * 保证 aria-valuenow 与 .nvui-progress-bar 的 width 永远一致（自愈）。
     */
    function normalizeProgressValue(value) {
        /* NEW-45：防范 Symbol 转换抛错 */
        if (typeof value === 'symbol' || value === null || value === undefined) return 0;
        var n = Number(value);
        if (!isFinite(n)) n = 0;
        if (n < 0) n = 0;
        if (n > 100) n = 100;
        return n;
    }

    /** 线性进度条：role=progressbar + .nvui-progress-bar（宽度由 API 设置） */
    function progress(options) {
        var opts = options || {};
        if (opts.indeterminate && !opts.label) warnOnce('progress-label', 'progress({indeterminate:true}): 缺少 label/aria-label，屏幕阅读器无法获知进度含义');
        var initial = normalizeProgressValue(opts.value);
        var trackAttrs = {
            role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100',
            'aria-valuenow': opts.indeterminate ? null : String(initial),
        };
        /* NEW-42：只要调用方提供了 label，不论确定与不确定进度均赋予 aria-label（符合 WAI-ARIA 规范） */
        if (opts.label) trackAttrs['aria-label'] = (typeof opts.label === 'symbol') ? '' : String(opts.label);
        var track = el('div', 'nvui-progress', trackAttrs);
        /* NEW-34：variant 类名过滤校验，防带空格字符引发未捕获 DOMException */
        if (opts.variant) {
            var safeVariant = sanitizeIdPart(opts.variant, '');
            if (safeVariant) {
                track.classList.add('is-' + safeVariant);
            } else {
                warn('progress(): variant 含有非法字符，已忽略');
            }
        }
        if (opts.indeterminate) track.classList.add('is-indeterminate');
        var bar = el('span', 'nvui-progress-bar');

        /* v2.2.0 修订补丁（ISSUES.md #11）：0% 与 100% 时停掉扫光动画。
         * 扫光是「进行中」的装饰，0%/100% 继续跑无限循环纯属浪费合成层资源。
         * 不确定进度永远保持扫光（它本身就表示进行中）。 */
        function syncActivity(n) {
            if (track.classList.contains('is-indeterminate')) {
                track.classList.remove('is-idle', 'is-complete');
                return;
            }
            if (n <= 0) {
                track.classList.add('is-idle');
                track.classList.remove('is-complete');
            } else if (n >= 100) {
                track.classList.add('is-complete');
                track.classList.remove('is-idle');
            } else {
                track.classList.remove('is-idle', 'is-complete');
            }
        }

        /* 初始渲染与 setValue 必须共用同一份归一化值：
           否则 aria-valuenow（字符串 '80' → 80）与 bar 宽度（仍是 0）会长期不一致。 */
        if (!opts.indeterminate) {
            bar.style.width = initial + '%';
            syncActivity(initial);
        } else {
            /* 不确定进度：宽度由 CSS 的 40% + 扫光动画接管，不写内联 width */
            syncActivity(initial);
        }
        track.appendChild(bar);
        var valueNode = null;
        track.setValue = function (v) {
            var n = normalizeProgressValue(v);
            bar.style.width = n + '%';
            track.setAttribute('aria-valuenow', String(n));
            if (valueNode) valueNode.textContent = n + '%';
            syncActivity(n);
        };
        /* v2.9.0（GH-#21 第 2 条）：可选可视标题 / 数值，默认关闭。
           关闭时返回值仍是 .nvui-progress 轨道，既有调用零变化；
           开启时返回 .nvui-progress-field 容器（内含轨道），容器同样带 setValue()。
           可视文本一律 aria-hidden —— 语义仍由轨道的 role=progressbar + aria-valuenow
           承担，否则读屏会把同一进度播报两遍。 */
        if (opts.showLabel || opts.showValue) {
            var field = el('div', 'nvui-progress-field');
            if (opts.showLabel) {
                field.appendChild(el('span', null, {
                    'data-nvui-part': 'label',
                    text: (typeof opts.label === 'symbol' || !opts.label) ? '' : String(opts.label),
                    'aria-hidden': 'true',
                }));
            }
            /* 不确定进度没有确切数值：aria-valuenow 为 null，可视数值也不应编一个 */
            if (opts.showValue && !opts.indeterminate) {
                valueNode = el('span', null, { 'data-nvui-part': 'value', text: initial + '%', 'aria-hidden': 'true' });
                field.appendChild(valueNode);
            }
            field.appendChild(track);
            field.track = track;
            field.setValue = function (v) { track.setValue(v); };
            return field;
        }
        return track;
    }

    /* ---------------------- Esc 全局单例调度 ---------------------- */
    /*
     * 面板数量不定，若每个面板各自 addEventListener('keydown', …, {document})，
     * 监听器会随面板创建无限累积（且多面板时任一 Esc 会关闭全部）。
     * 这里改为：全局只挂一个 document 级监听器，维护一个「打开顺序栈」，
     * Esc 只交给栈顶（最上层）的面板；面板 destroy() 时把自己从栈里摘掉。
     */

    var escapeStack = [];
    var escapeBound = false;

    function onEscapeKey(event) {
        if (event.key !== 'Escape') return;
        /* Issue #14：宿主用 dialog.showModal() 打开原生模态时，宿主处于 top layer，
           Esc 属于最上层宿主。Kit 只做视觉/指针让位（.is-host-modal）不够，
           键盘调度也必须暂停；这里不调用 preventDefault，宿主 cancel 的默认行为
           保持原样。已被别处处理（defaultPrevented）的 Esc 同样让行。 */
        if (event.defaultPrevented) return;
        if (countHostModals() > 0) return;
        for (var i = escapeStack.length - 1; i >= 0; i--) {
            var entry = escapeStack[i];
            if (!entry) continue;
            /* NEW-37：若关联宿主已脱离文档树，自动驱逐孤儿 entry，防止劫持合法可见面板 */
            if (entry.isConnected && !entry.isConnected()) {
                escapeStack.splice(i, 1);
                continue;
            }
            if (entry.isVisible && entry.isVisible()) {
                entry.handler(event);
                return;
            }
        }
    }

    function registerEscapeHandler(handler, isVisible, isConnected) {
        if (!escapeBound) {
            on(document, 'keydown', onEscapeKey);
            escapeBound = true;
        }
        /* NEW-29：支持 promote 动态将 entry 提升到栈顶；NEW-37：支持 isConnected 自动清理孤儿 */
        var entry = {
            handler: handler,
            isVisible: isVisible || function () { return true; },
            isConnected: isConnected || function () { return true; },
            promote: function () {
                var idx = escapeStack.indexOf(entry);
                if (idx !== -1 && idx !== escapeStack.length - 1) {
                    escapeStack.splice(idx, 1);
                    escapeStack.push(entry);
                }
            }
        };
        escapeStack.push(entry);
        return entry;
    }

    function unregisterEscapeHandler(handler) {
        for (var i = escapeStack.length - 1; i >= 0; i--) {
            if (escapeStack[i] && escapeStack[i].handler === handler) {
                escapeStack.splice(i, 1);
                break;
            }
        }
        if (escapeStack.length === 0 && escapeBound) {
            off(document, 'keydown', onEscapeKey);
            escapeBound = false;
        }
    }

    /* ---------------------- 浮层载体与宿主模态 ---------------------- */

    /** 当前文档里处于模态状态的原生 dialog 数量。
     *  浏览器支持 `:modal` 伪类时用它判定（Chrome 105+ / Edge 105+ / Safari 17.4+）；
     *  不支持时退化为「存在 open 的 dialog 且非 kit 自身载体」。 */
    /* NEW-27：静态平台能力一次性检测缓存，避免频繁运行时重复执行 CSS.supports 解析 */
    var isModalSelectorSupported = (function () {
        try {
            return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
                && CSS.supports('selector(:modal)');
        } catch (err) {
            return false;
        }
    })();

    /** 当前文档里处于模态状态的原生 dialog 数量。
     *  浏览器支持 `:modal` 伪类时用它判定（Chrome 105+ / Edge 105+ / Safari 17.4+）；
     *  不支持时退化为「存在 open 的 dialog 且非 kit 自身载体」。 */
    function countHostModals() {
        if (!isDomAvailable()) return 0;
        if (isModalSelectorSupported) {
            var modals = document.querySelectorAll('dialog:modal');
            var n = 0;
            for (var i = 0; i < modals.length; i++) {
                /* 排除 kit 自己的载体（kit 载体是非模态 show()，理论上不会是 :modal，
                   但若宿主误用 showModal 打开 kit 载体，这里也排除以免自我降级） */
                if (modals[i].classList.contains('nvui-tl')) continue;
                n += 1;
            }
            return n;
        }
        /* 回退：kit 载体永远用非模态 show()，所以任何 :modal 的 dialog 都视为宿主模态 */
        var all = document.querySelectorAll('dialog[open]');
        var count = 0;
        for (var j = 0; j < all.length; j++) {
            if (all[j].classList.contains('nvui-tl')) continue;
            count += 1;
        }
        return count;
    }

    /** 同步「宿主模态」降级态到所有 kit 载体。
     *  宿主用 showModal() 打开弹窗时，会给整个文档加 inert —— kit 浮层**无法**
     *  压过它（不是 z-index 问题，popover=manual 也一样，见 README §13.7）。
     *  正确做法是主动让位：给 kit 载体加 `.is-host-modal`（不可点 + 压暗）。
     *  返回当前宿主模态数量。 */
    function syncHostModalState() {
        if (!isDomAvailable()) return 0;
        installHostModalWatcher();
        var modalCount = countHostModals();
        var degraded = modalCount > 0;
        debug('syncHostModalState(): 宿主模态数量=' + modalCount + '，kit 载体降级=' + degraded);
        var carriers = document.querySelectorAll('dialog.nvui-tl');
        for (var i = 0; i < carriers.length; i++) {
            if (degraded) carriers[i].classList.add('is-host-modal');
            else carriers[i].classList.remove('is-host-modal');
        }
        return modalCount;
    }

    /** 自动监听宿主模态的开关（幂等，只装一次）。
     *  两条触发源：
     *   1. MutationObserver 监听 <dialog> 的 open 属性变化（showModal() / show() / close()）；
     *   2. document 捕获阶段的 'close' 事件（dialog 关闭不冒泡，需捕获）。
     *  命中后调用 syncHostModalState()，使 kit 载体在宿主模态期间自动降级。
     *
     *  v2.4.0（NEW-07）：观察面从「documentElement 全文档 subtree+attributes」
     *  收窄为「逐个 dialog 元素 + 仅 childList 的轻量发现器」——
     *  全文档属性观察会让宿主每一次 DOM 属性变化都进入观察器队列，开销与宿主规模成正比。 */
    var hostModalWatcherInstalled = false;
    var hostModalOpenObserver = null;
    var hostModalScanObserver = null;

    function observeDialogOpen(dialog) {
        if (!dialog || !hostModalOpenObserver) return;
        /* NEW-25：去除全局强引用数组 observedDialogs，改用私有标记，
           节点脱离 DOM 销毁时可被 GC 正常回收，彻底消除 Detached DOM 内存泄漏 */
        if (dialog.__nvuiObserved) return;
        dialog.__nvuiObserved = true;
        try {
            hostModalOpenObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
        } catch (err) {
            /* 单个 dialog 观察失败不影响其它 */
        }
    }

    /** 递归扫描子树中的 dialog（NEW-30：返回是否发现 dialog；NEW-28：跳过纯文本内联叶子节点） */
    function scanForDialogs(root) {
        if (!root || typeof root.querySelectorAll !== 'function') return false;
        var list = root.querySelectorAll('dialog');
        if (!list || !list.length) return false;
        for (var i = 0; i < list.length; i++) observeDialogOpen(list[i]);
        return true;
    }

    function installHostModalWatcher() {
        if (hostModalWatcherInstalled || !isDomAvailable()) return;
        hostModalWatcherInstalled = true;
        try {
            /* 观察器 A：只观察「具体某个 dialog」的 open 属性 —— 观察面最小 */
            hostModalOpenObserver = new MutationObserver(function (records) {
                for (var i = 0; i < records.length; i++) {
                    if (records[i].type === 'attributes' && records[i].attributeName === 'open') {
                        syncHostModalState();
                        return;
                    }
                }
            });
            /* 观察器 B：只做 childList，发现宿主新建或移除的 dialog */
            hostModalScanObserver = new MutationObserver(function (records) {
                var sawDialog = false;
                for (var i = 0; i < records.length; i++) {
                    if (records[i].type !== 'childList') continue;
                    var added = records[i].addedNodes;
                    for (var j = 0; j < added.length; j++) {
                        var node = added[j];
                        if (!node || node.nodeType !== 1) continue;
                        if (node.tagName === 'DIALOG') {
                            observeDialogOpen(node);
                            sawDialog = true;
                        } else if (node.children && node.children.length > 0) {
                            /* NEW-28：快速跳过不可能包含 dialog 的纯文本内联标签 */
                            var tn = node.tagName;
                            if (tn !== 'SPAN' && tn !== 'P' && tn !== 'CODE' && tn !== 'EM' && tn !== 'STRONG' && tn !== 'I' && tn !== 'B') {
                                /* NEW-30：子树中若存在 dialog，向上标记 sawDialog = true */
                                if (scanForDialogs(node)) sawDialog = true;
                            }
                        }
                    }
                    /* NEW-35：宿主模态直接从 DOM 移除时同步让位状态，防 kit 载体永久锁死 */
                    var removed = records[i].removedNodes;
                    for (var k = 0; k < removed.length; k++) {
                        var rNode = removed[k];
                        if (!rNode || rNode.nodeType !== 1) continue;
                        if (rNode.tagName === 'DIALOG' || (rNode.querySelector && rNode.querySelector('dialog'))) {
                            sawDialog = true;
                        }
                    }
                }
                if (sawDialog) syncHostModalState();
            });
            /* 已有 dialog：逐个挂上 open 属性观察 */
            scanForDialogs(document);
            hostModalScanObserver.observe(document.documentElement, { childList: true, subtree: true });
            on(document, 'close', function () { syncHostModalState(); }, true);
        } catch (err) {
            /* 观察器不可用时降级为「仅手动调用 syncHostModalState()」，不影响功能 */
            hostModalWatcherInstalled = false;
            hostModalOpenObserver = null;
            hostModalScanObserver = null;
            error('installHostModalWatcher(): 观察器不可用，已降级为手动同步', err);
        }
    }

    /** 查询浮层载体与宿主模态的层级关系快照（诊断 / 宿主集成用）。
     *  返回 { carrierZ, hostModalCount, degraded, carriers: [{ id, className, zIndex, degraded }] } */
    function getCarrierState() {
        if (!isDomAvailable()) {
            return { carrierZ: '', hostModalCount: 0, degraded: false, carriers: [] };
        }
        var modalCount = countHostModals();
        var carriers = [];
        var list = document.querySelectorAll('dialog.nvui-tl');
        for (var i = 0; i < list.length; i++) {
            var cs = window.getComputedStyle(list[i]);
            carriers.push({
                id: list[i].id || '',
                className: list[i].className,
                zIndex: cs.zIndex,
                degraded: list[i].classList.contains('is-host-modal'),
                open: list[i].hasAttribute('open'),
            });
        }
        return {
            carrierZ: getToken('--nvui-z-layer'),
            hostModalCount: modalCount,
            degraded: modalCount > 0,
            carriers: carriers,
        };
    }

    /* ---------------------- 表现层布局状态持久化 (Issue #5) ---------------------- */

    var PERSIST_DEBOUNCE_MS = 250;

    /**
     * 默认存储适配器：基于 window.localStorage，
     * 键名带沙箱前缀 nvui_state_${id}。
     * 所有读写均受 try/catch 保护，吸纳 QuotaExceededError 与 SecurityError 并记录 warn。
     */
    var defaultStorageAdapter = {
        get: function (key) {
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    var raw = window.localStorage.getItem(key);
                    return raw ? JSON.parse(raw) : null;
                }
            } catch (err) {
                warn('defaultStorageAdapter.get(): 无法读取 localStorage', err);
            }
            return null;
        },
        set: function (key, val) {
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    if (val === null || val === undefined) {
                        window.localStorage.removeItem(key);
                    } else {
                        window.localStorage.setItem(key, JSON.stringify(val));
                    }
                }
            } catch (err) {
                warn('defaultStorageAdapter.set(): 无法写入 localStorage', err);
            }
        },
        delete: function (key) {
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.removeItem(key);
                }
            } catch (err) {
                warn('defaultStorageAdapter.delete(): 无法清除 localStorage', err);
            }
        }
    };

    var storageQueues = new WeakMap();

    function queuedLayoutMutation(storage, key) {
        var queue = storageQueues.get(storage);
        return queue && queue.get(key);
    }

    /* Synchronous adapters keep their immediate behavior. Promise adapters serialize
       mutations for the same store and key, even across panel instances. */
    function mutateStoredLayout(storage, key, mutate, onError) {
        var pending = queuedLayoutMutation(storage, key);
        try {
            var result = pending ? pending.then(mutate) : mutate();
            if (!result || typeof result.then !== 'function') return;
            var queue = storageQueues.get(storage);
            if (!queue) {
                queue = new Map();
                storageQueues.set(storage, queue);
            }
            var operation = Promise.resolve(result).catch(onError);
            queue.set(key, operation);
            operation.then(function () {
                if (queue.get(key) === operation) queue.delete(key);
            });
        } catch (err) {
            onError(err);
        }
    }

    function layoutStorageKeys(id) {
        var raw = String(id);
        var normalized = sanitizeIdPart(raw, 'nvui-panel');
        var legacy = 'nvui_state_' + normalized;
        if (raw === normalized) return { key: legacy, legacy: null, owner: raw };
        /* The colon separates encoded IDs from every legacy key. Encode by code
           unit so even an unpaired surrogate has a stable key. */
        var encoded = raw.replace(/[^A-Za-z0-9_-]/g, function (c) {
            return '%' + ('000' + c.charCodeAt(0).toString(16)).slice(-4);
        });
        return { key: 'nvui_state_:' + encoded, legacy: legacy, owner: raw };
    }

    /** 清除指定面板的布局记忆。旧键可能属于另一个面板，不能一并删除。 */
    function clearLayoutState(id, storageAdapter) {
        if (!id) return;
        var keys = layoutStorageKeys(id);
        var storage = storageAdapter || defaultStorageAdapter;
        mutateStoredLayout(storage, keys.key, function () {
            if (keys.legacy && typeof storage.set === 'function') {
                /* An empty record prevents an ambiguous legacy value from
                   restoring a layout after the encoded ID was cleared. */
                return storage.set(keys.key, {
                    version: 2, size: null, tab: null, accordion: null, storageOwner: keys.owner,
                });
            }
            if (typeof storage.delete === 'function') return storage.delete(keys.key);
            if (typeof storage.set === 'function') return storage.set(keys.key, null);
        }, function (err) { warn('clearLayoutState(): 清理存储状态失败', err); });
    }

    /** 读取当前视口尺寸，优先以 window.innerWidth/innerHeight 为准以适配移动端模拟与缩放 */
    function getViewport() {
        var vw = (typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0)
            ? window.innerWidth
            : ((typeof document !== 'undefined' && document.documentElement && document.documentElement.clientWidth) || 0);
        var vh = (typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0)
            ? window.innerHeight
            : ((typeof document !== 'undefined' && document.documentElement && document.documentElement.clientHeight) || 0);
        return { vw: vw, vh: vh, isMobile: vw <= 600 };
    }

    /** 辅助比较两个持久化状态是否实质一致（避免冗余写入） */
    function isStateEqual(a, b) {
        if (!a || !b) return false;
        if (a.tab !== b.tab) return false;
        var aSize = a.size;
        var bSize = b.size;
        if (!aSize !== !bSize) return false;
        if (aSize && bSize) {
            if (aSize.w !== bSize.w) return false;
            if (aSize.h !== bSize.h) return false;
            if (aSize.mode !== bSize.mode) return false;
        }
        var aAcc = a.accordion;
        var bAcc = b.accordion;
        if (!aAcc !== !bAcc) return false;
        if (aAcc && bAcc) {
            var aKeys = Object.keys(aAcc);
            var bKeys = Object.keys(bAcc);
            if (aKeys.length !== bKeys.length) return false;
            for (var i = 0; i < aKeys.length; i++) {
                var k = aKeys[i];
                if (aAcc[k] !== bAcc[k]) return false;
            }
        }
        return true;
    }

    /**
     * 布局状态的深拷贝与规范化（v2.9.0 / GH-#18 B1）。
     *
     * 两个用途：
     * 1. `getLayoutState()` 必须返回游离副本 —— 否则下游一改返回值就污染了内部
     *    `loadedState`，下一次 flush 会把这坨脏数据写进存储；
     * 2. `setLayoutState()` 必须先规范化再落内存 —— 外部传入的对象可能带任意键、
     *    把 `accordion` 传成数组、或 `width` 传成字符串。
     *
     * `timestamp` 是可选的存储元数据：有就保留，没有就不补（导出的布局态不该带时刻）。
     */
    /* v1 存档（`{ width, height, isMaximized }`）→ v2（`{ w, h, mode }`）。
       v2 把「最大化」并进 mode：最大化本质是二维状态，留一个独立布尔字段会让
       「w/h 还有没有意义」取决于另一个字段，读的人必须同时看两处。合并后语义单向：
       mode 决定 w/h 是否生效（`normal` 全生效 / `maximized` 全不生效 /
       `width-only` 只有 w 生效 / `off` 都不生效）。幂等 —— 已是 v2 原样返回。
       导出给下游：把布局存进自己的 `extension_settings` 时同样需要迁移。 */
    function migrateStateV1toV2(state) {
        if (!state || typeof state !== 'object') return null;
        if (state.version === 2) return state;
        var out = {
            version: 2,
            timestamp: typeof state.timestamp === 'number' ? state.timestamp : Date.now(),
            tab: (state.tab === undefined || state.tab === null) ? null : String(state.tab),
            accordion: (state.accordion && typeof state.accordion === 'object') ? state.accordion : null,
            size: null,
        };
        var size = state.size;
        if (size && typeof size === 'object') {
            out.size = {
                w: (typeof size.w === 'number') ? size.w : ((typeof size.width === 'number') ? size.width : null),
                h: (typeof size.h === 'number') ? size.h : ((typeof size.height === 'number') ? size.height : null),
                mode: size.isMaximized ? 'maximized' : ((typeof size.mode === 'string' && size.mode) ? size.mode : 'normal'),
            };
        }
        return out;
    }

    function cloneLayoutState(state) {
        if (!state || typeof state !== 'object') return null;
        var out = { version: 2 };
        if (typeof state.timestamp === 'number') out.timestamp = state.timestamp;
        if (state.size && typeof state.size === 'object') {
            out.size = {
                w: (typeof state.size.w === 'number' && !isNaN(state.size.w)) ? state.size.w : null,
                h: (typeof state.size.h === 'number' && !isNaN(state.size.h)) ? state.size.h : null,
                mode: (typeof state.size.mode === 'string' && state.size.mode) ? state.size.mode : 'normal',
            };
        } else {
            out.size = null;
        }
        out.tab = (state.tab === undefined || state.tab === null) ? null : String(state.tab);
        if (state.accordion && typeof state.accordion === 'object') {
            /* 无原型承接：键可能是 "__proto__" / "constructor"（同 flushPersistSave） */
            var acc = Object.create(null);
            var keys = Object.keys(state.accordion);
            for (var i = 0; i < keys.length; i++) acc[keys[i]] = !!state.accordion[keys[i]];
            out.accordion = acc;
        } else {
            out.accordion = null;
        }
        return out;
    }

    /**
     * 多分辨率跨屏视口越界钳制防护数学模型 (Viewport Clamping)。
     * - 手机端（<=600px）强制清空内联固定像素，交由 CSS 100% 抽屉规范接管；
     * - 桌面端钳制宽在 [min(320, vw-32), vw-32]，高在 [min(240, vh-32), vh-32]；
     * - 默认 targetW 采用 720px 黄金尺寸（支持 opts.width 自定义）；
     * - 坐标自愈钳制在安全可视边距 (margin >= 16px) 范围内，确保标题栏与关闭按钮绝对可达。
     */
    function clampPanelLayout(savedSize, savedPos, options) {
        if (!isDomAvailable()) {
            return { isMobile: false, width: null, height: null, styleWidth: '', styleHeight: '' };
        }

        var vp = getViewport();
        var vw = vp.vw;
        var vh = vp.vh;
        var isMobile = vp.isMobile;

        // 移动端安全降级：必须遵守手机端底部抽屉标准规范
        if (isMobile) {
            return {
                isMobile: true,
                width: null,
                height: null,
                styleWidth: '',
                styleHeight: '',
            };
        }

        var margin = 16;
        var minW = Math.min(320, Math.max(0, vw - margin * 2));
        var minH = Math.min(240, Math.max(0, vh - margin * 2));
        var maxW = Math.max(minW, Math.max(0, vw - margin * 2));
        var maxH = Math.max(minH, Math.max(0, vh - margin * 2));

        var fallbackW = (options && typeof options.width === 'number' && !isNaN(options.width)) ? options.width : 720;
        var targetW = (savedSize && typeof savedSize.width === 'number' && !isNaN(savedSize.width)) ? savedSize.width : fallbackW;
        var targetH = (savedSize && typeof savedSize.height === 'number' && !isNaN(savedSize.height)) ? savedSize.height : null;

        var clampedW = Math.max(minW, Math.min(targetW, maxW));
        var clampedH = targetH ? Math.max(minH, Math.min(targetH, maxH)) : null;

        var res = {
            isMobile: false,
            width: clampedW,
            height: clampedH,
            styleWidth: clampedW + 'px',
            styleHeight: clampedH ? (clampedH + 'px') : '',
        };

        if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number' && !isNaN(savedPos.x) && !isNaN(savedPos.y)) {
            var clampedX = Math.max(margin, Math.min(savedPos.x, vw - clampedW - margin));
            var clampedY = Math.max(margin, Math.min(savedPos.y, vh - (clampedH || 400) - margin));
            res.x = clampedX;
            res.y = clampedY;
        }
        return res;
    }

    /* ---------------------- 面板尺寸载体（v3.0.0 / C1） ---------------------- */

    /* 尺寸从「内联 px」改为「CSS 变量」。原因不是洁癖：内联 width/height 是作者级
       声明，下游写 `height: 94vh` / `height: var(--nvui-panel-max-h)` 永远抢不过它，
       #16 只是这个冲突的一个症状。变量同样在元素上，但只要不给 `!important`，
       下游一条普通规则就能接管，kit 默认值与下游覆盖也自然分层。

       v3.0.0 曾提供 `data-nvui-legacy-size` 过渡开关（命中时仍写内联 px），v3.1 已移除。
       现在没有第二条写入路径：尺寸只走这两个变量，不要为「读 style.width 的下游」
       再加回内联分支 —— 那会让下游 CSS 重新失去接管能力，等于退回 v2.x 的根本冲突。 */
    var SIZE_VAR_W = '--nvui-panel-w';
    var SIZE_VAR_H = '--nvui-panel-h';

    /* w / h 接受 number（写 px）、字符串（calc(...) 等）、null（清空该维度）。
       清空时连内联一起摘：下游脚本历史上可能直接写过 panel.style.width，
       不清就会出现「变量没了、内联还在」的假回落。 */
    function writePanelSize(panel, w, h) {
        if (!panel || !panel.style) return;
        var applyOne = function (prop, cssVar, value) {
            var css = null;
            if (typeof value === 'number' && isFinite(value)) css = Math.round(value) + 'px';
            else if (typeof value === 'string' && value) css = value;
            panel.style[prop] = '';
            if (css === null) {
                panel.style.removeProperty(cssVar);
                return;
            }
            panel.style.setProperty(cssVar, css);
        };
        applyOne('width', SIZE_VAR_W, w);
        applyOne('height', SIZE_VAR_H, h);
    }

    /* 读回「当前目标尺寸」。变量优先，其次兼容 v2.x 遗留的内联 px
       （下游脚本可能仍在直接写 panel.style.width）。只认 px，calc 之类交给 CSS。 */
    function readPanelSize(panel, axis) {
        if (!panel || !panel.style) return null;
        var raw = panel.style.getPropertyValue(axis === 'height' ? SIZE_VAR_H : SIZE_VAR_W);
        if (!raw) raw = axis === 'height' ? panel.style.height : panel.style.width;
        raw = String(raw || '').trim();
        if (!raw || raw.indexOf('px') === -1) return null;
        var n = parseInt(raw, 10);
        return isNaN(n) ? null : n;
    }

    /* 把尺寸主权整个交回 CSS（移动端抽屉、销毁复位）。变量与内联都清。 */
    function clearPanelSize(panel) {
        if (!panel || !panel.style) return;
        panel.style.width = '';
        panel.style.height = '';
        panel.style.removeProperty(SIZE_VAR_W);
        panel.style.removeProperty(SIZE_VAR_H);
    }

    /* ---------------------- 面板（布局标准） ---------------------- */

    /**
     * createPanel(options) 生成完整面板并返回控制器。
     * options:
     *   id            根 id 前缀（默认 nvui-panel-<n>）
     *   title         标题（aria-labelledby 指向它）
     *   version       右上角版本徽标文字（可选）
     *   tabs          [{ key, label, icon }]；为空时无导航（单页面板）
     *   active        初始 tab key（默认第一个）
     *   actions       标题栏右侧额外图标按钮 [{ icon, label, onClick }]
     *   footer        底部按钮 [{ label, variant, onClick, close }]
     *   mount         挂载节点（默认 document.body）
     *   onClose       关闭后回调
     *   destroy       面板销毁后回调（destroy() 被调用时触发）
     */
    function restoreForeignNodes(d) {
        try {
            if (d && d.childNodes && document.body) {
                var list = Array.from(d.childNodes);
                for (var i = 0; i < list.length; i++) {
                    var n = list[i];
                    if (n && n.id === 'toast-container') document.body.appendChild(n);
                }
            }
        } catch (e) {}
    }
    /* ------------------------------------------------------------------
     * Accordion 注册表（G-01 从 createPanel 抽出的第一个子系统）
     * 只依赖 ctx 显式声明的 8 个能力，不再直接捕获 createPanel 的闭包变量：
     * panel / persistConfig() / loadedState() / isRestoring() / isDisposed() /
     * schedulePersistSave / restoreFocus / sanitizeIdPart / warn。
     * ------------------------------------------------------------------ */
    function createAccordionRegistry(ctx) {
        var panel = ctx.panel;
        var accList = [];
        var accBindings = [];
        var autoKeyWarned = false;

        function accordionHeadOf(accNode) {
            if (accNode.head) return accNode.head;
            return (accNode.querySelector ? accNode.querySelector('.nvui-acc-head') : null);
        }

        function bindAccordionEvent(target, type, handler, owner) {
            if (!target || typeof target.addEventListener !== 'function') return null;
            on(target, type, handler, false);
            var binding = { target: target, type: type, handler: handler };
            if (owner) {
                if (!owner.bindings) owner.bindings = [];
                owner.bindings.push(binding);
            } else {
                accBindings.push(binding);
            }
            return binding;
        }

        function unbindAccordionBinding(binding) {
            if (!binding) return;
            try { off(binding.target, binding.type, binding.handler, false); } catch (e) {}
        }

        function unbindAccordionItem(item) {
            if (!item) return;
            if (item.bindings) {
                for (var i = 0; i < item.bindings.length; i++) {
                    unbindAccordionBinding(item.bindings[i]);
                }
                item.bindings = [];
            }
            var node = item.node;
            if (node && item.wrappedSetOpen && node.setOpen === item.wrappedSetOpen) {
                try {
                    if (item.hadSetOpenProp) node.setOpen = item.origSetOpen;
                    else delete node.setOpen;
                } catch (e) {}
            }
        }

        function unbindAccordionEvents() {
            for (var i = 0; i < accBindings.length; i++) {
                unbindAccordionBinding(accBindings[i]);
            }
            accBindings = [];
            for (var j = 0; j < accList.length; j++) {
                unbindAccordionItem(accList[j]);
            }
            accList = [];
        }

        /* 纯 DOM 折叠条的行为补齐：只切 .is-open 与 aria-expanded，不重建 DOM。
         * 注意：setOpen 一定要补（恢复 / clearLayoutState 要调用它），但**点击**只在
         * 调用方显式要求（bind: true）时才接管 —— 否则极易与插件自己的委托监听叠加成
         * 双重 toggle。节点已有 setOpen 时一律不接管点击，只包保存钩子。 */
        function ensureAccordionBehavior(accNode, bindClick, owner) {
            if (typeof accNode.setOpen === 'function') return false;
            accNode.setOpen = function (v) {
                var open = !!v;
                accNode.classList.toggle('is-open', open);
                var h = accordionHeadOf(accNode);
                if (h && typeof h.setAttribute === 'function') {
                    h.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
                if (!open) ctx.restoreFocus(accNode);
            };
            if (bindClick === true) {
                bindAccordionEvent(accordionHeadOf(accNode), 'click', function () {
                    accNode.setOpen(!accNode.classList.contains('is-open'));
                }, owner);
            }
            return true;
        }

        function findAccordionItem(accNode) {
            for (var i = 0; i < accList.length; i++) {
                if (accList[i].node === accNode) return accList[i];
            }
            return null;
        }

        function findAccordionItemById(accId) {
            for (var i = 0; i < accList.length; i++) {
                if (accList[i].id === accId) return accList[i];
            }
            return null;
        }

        function accordionIdTaken(candidate) {
            return !!findAccordionItemById(candidate);
        }

        function isAccordionItemLive(item) {
            return !!(item && item.node && panel.contains && panel.contains(item.node));
        }

        /** 稳定键推导：显式 id > DOM id > data-nvui-acc-key；都没有返回 null。
         *  持久化键只是普通对象键，不需要满足 DOM id 语法；这里保留原始键，
         *  否则不同中文/非 ASCII 键会被 ctx.sanitizeIdPart 折叠成同一个键。 */
        function deriveAccordionId(accNode, explicitId) {
            if (explicitId !== undefined && explicitId !== null && String(explicitId) !== '') {
                return String(explicitId);
            }
            if (accNode.id) return String(accNode.id);
            if (typeof accNode.getAttribute === 'function') {
                var dataKey = accNode.getAttribute('data-nvui-acc-key');
                if (dataKey) return String(dataKey);
            }
            return null;
        }

        /** 兜底键：面板内 .nvui-acc 的 DOM 顺序，比 accList.length+1 更可复现 */
        function autoAccordionId(accNode) {
            var all = panel.querySelectorAll ? panel.querySelectorAll('.nvui-acc') : null;
            var idx = all ? Array.prototype.indexOf.call(all, accNode) : -1;
            if (idx < 0) idx = accList.length;
            return 'acc_auto_' + (idx + 1);
        }

        /** 生成键的唯一化：已被活动节点占用时追加序号；只被脱离节点占用时
         *  返回原键，由 panelTrackAccordion 走「替换旧条目」路径。 */
        function uniqueAccordionId(base) {
            var rootId = String(base || 'acc');
            var candidate = rootId;
            var suffix = 2;
            while (true) {
                var item = findAccordionItemById(candidate);
                if (!item || !isAccordionItemLive(item)) return candidate;
                candidate = rootId + '-' + suffix;
                suffix += 1;
            }
        }

        /** 工厂标题兜底键：ASCII 标题保留 v2.5 的 sanitize 结果（避免无谓迁移），
         *  含非 ASCII 的标题保留原始标题（中文标题不再全部折叠成 "__"）。 */
        function titleAccordionId(title, fallback) {
            var raw = (title === null || title === undefined) ? '' : String(title);
            if (!raw) return uniqueAccordionId(fallback);
            if (/[^\x00-\x7F]/.test(raw)) return uniqueAccordionId(raw);
            return uniqueAccordionId(ctx.sanitizeIdPart(raw, fallback));
        }

        function removeAccordionItem(item) {
            var idx = accList.indexOf(item);
            if (idx >= 0) accList.splice(idx, 1);
            unbindAccordionItem(item);
        }

        function registerAccordionItem(item) {
            var accNode = item.node;
            accList.push(item);
            if (ctx.persistConfig() && ctx.persistConfig().accordion && ctx.loadedState() && ctx.loadedState().accordion
                && Object.prototype.hasOwnProperty.call(ctx.loadedState().accordion, item.id)
                && typeof ctx.loadedState().accordion[item.id] === 'boolean') {
                accNode.setOpen(ctx.loadedState().accordion[item.id]);
            }
            var head = accordionHeadOf(accNode);
            if (head) {
                /* 只负责「点击后落盘」；开合行为由工厂或 ensureAccordionBehavior 提供 */
                bindAccordionEvent(head, 'click', function () {
                    if (ctx.persistConfig() && ctx.persistConfig().accordion && !ctx.isRestoring() && !ctx.isDisposed()) {
                        ctx.schedulePersistSave();
                    }
                }, item);
            }
            var baseSetOpen = accNode.setOpen;
            var wrappedSetOpen = function (v) {
                baseSetOpen.call(accNode, v);
                /* 调用方自带的 setOpen 未必处理焦点回收，这里统一兜底（Issue #13）。 */
                if (!v) ctx.restoreFocus(accNode);
                if (ctx.persistConfig() && ctx.persistConfig().accordion && !ctx.isRestoring() && !ctx.isDisposed()) {
                    ctx.schedulePersistSave();
                }
            };
            accNode.setOpen = wrappedSetOpen;
            item.wrappedSetOpen = wrappedSetOpen;
        }

        function panelTrackAccordion(accNode, explicitId, options) {
            if (!accNode || accNode.nodeType !== 1 || !accNode.classList || !accNode.classList.contains('nvui-acc')) {
                ctx.warn('trackAccordion(): 传入节点不是 .nvui-acc 元素，已忽略');
                return null;
            }
            /* 已挂在别的 kit 面板里的折叠条不越界接管（尚未插入 DOM 的节点不受影响） */
            if (typeof accNode.closest === 'function') {
                var ownerPanel = accNode.closest('.nvui-panel');
                if (ownerPanel && ownerPanel !== panel) {
                    ctx.warn('trackAccordion(): 该折叠条属于另一个面板，已忽略（每个面板只接管自己的内容）');
                    return null;
                }
            }
            /* 已连接却不在本面板：外部容器 / 其它文档，拒绝；
               detached 节点保持既有契约（允许插入前预注册）。 */
            if (accNode.isConnected && !panel.contains(accNode)) {
                ctx.warn('trackAccordion(): 该折叠条不在本面板内，已忽略（每个面板只接管自己的内容）');
                return null;
            }
            /* 已销毁的面板不再接受新接管，也不再挂任何监听 */
            if (ctx.isDisposed()) return null;
            /* 允许省略 id：trackAccordion(node, { bind: false }) */
            if (explicitId && typeof explicitId === 'object') {
                options = options || explicitId;
                explicitId = undefined;
            }
            var existing = findAccordionItem(accNode);
            if (existing) {
                var wanted = deriveAccordionId(accNode, explicitId);
                if (wanted && wanted !== existing.id) {
                    ctx.warn('trackAccordion(): 节点已注册为 "' + existing.id + '"，忽略新 id "' + wanted + '"（首次注册优先）');
                }
                return existing.id;
            }
            var opt = (options && typeof options === 'object') ? options : {};
            /* 行为补齐与持久化分离：即使不持久化，注入的折叠条也应该点得动 */
            if (!ctx.persistConfig() || !ctx.persistConfig().accordion) {
                ensureAccordionBehavior(accNode, opt.bind, null);
                return null;
            }

            var accId = deriveAccordionId(accNode, explicitId);
            if (!accId) {
                accId = uniqueAccordionId(autoAccordionId(accNode));
                if (!autoKeyWarned) {
                    autoKeyWarned = true;
                    ctx.warn('trackAccordion(): 折叠条缺少稳定键（id / data-nvui-acc-key），已按面板内顺序生成 "' + accId + '"；DOM 顺序变化会导致状态错位，建议注入时给出 id');
                }
            }
            var idItem = findAccordionItemById(accId);
            if (idItem) {
                if (isAccordionItemLive(idItem)) {
                    ctx.warn('trackAccordion(): id "' + accId + '" 已被另一折叠条占用，本条不注册（避免状态互相覆盖）');
                    return null;
                }
                /* 同稳定键的新节点替换已经脱离本面板的旧条目：
                   先解绑旧节点的 kit 监听并恢复它的 setOpen，再登记新节点。 */
                removeAccordionItem(idItem);
            }

            var item = {
                id: accId,
                node: accNode,
                bindings: [],
                hadSetOpenProp: Object.prototype.hasOwnProperty.call(accNode, 'setOpen'),
                origSetOpen: accNode.setOpen,
                wrappedSetOpen: null,
            };
            ensureAccordionBehavior(accNode, opt.bind, item);
            registerAccordionItem(item);
            return accId;
        }

        function panelAdoptAccordions(root, options) {
            if (!root || typeof root.querySelectorAll !== 'function') {
                ctx.warn('adoptAccordions(): 需要传入元素 / DocumentFragment 容器，已忽略');
                return 0;
            }
            var doc = panel.ownerDocument;
            if (root === doc || (doc && (root === doc.documentElement || root === doc.body))) {
                ctx.warn('adoptAccordions(): 拒绝扫描 document / body，请传入本面板的容器（如 panel.body）');
                return 0;
            }
            /* 已连接的外部容器拒绝；detached 元素 / DocumentFragment 允许预注册。 */
            if (root.isConnected && root !== panel && !panel.contains(root)) {
                ctx.warn('adoptAccordions(): 容器不在本面板内，已忽略（每个面板只接管自己的内容）');
                return 0;
            }
            var count = 0;
            function adoptNode(node) {
                var known = !!findAccordionItem(node);
                var id = panelTrackAccordion(node, undefined, options);
                if (id && !known) count += 1;
            }
            /* root 自身就是折叠条时也要接管（不能只扫后代） */
            if (root.nodeType === 1 && root.classList && root.classList.contains('nvui-acc')) {
                adoptNode(root);
            }
            var nodes = root.querySelectorAll('.nvui-acc');
            for (var i = 0; i < nodes.length; i++) {
                adoptNode(nodes[i]);
            }
            return count;
        }

        return {
            list: accList,
            headOf: accordionHeadOf,
            ensureBehavior: ensureAccordionBehavior,
            findItem: findAccordionItem,
            findById: findAccordionItemById,
            isLive: isAccordionItemLive,
            uniqueId: uniqueAccordionId,
            titleId: titleAccordionId,
            remove: removeAccordionItem,
            track: panelTrackAccordion,
            adopt: panelAdoptAccordions,
            unbindAll: unbindAccordionEvents,
        };
    }



    /* ---------------------- 面板持久化子系统（G-01 第二步） ---------------------- */
    /*
     * 从 createPanel() 抽出的持久化与视口钳制子系统。
     * ctx 只暴露能力，不捕获 createPanel 的局部变量：
     *   panel / overlay       DOM 宿主
     *   opts / id             createPanel 原始配置与已解析的 DOM id（storageKey 兜底）
     *   isDisposed()          面板是否已 destroy —— flush 的关门条件
     *   accordion()           accordion 注册表；**必须延迟取**，本 factory 创建在它之前
     *   tabs() / activeDom()  标签状态；同上，运行时才读
     *   keyMap()              原始 key -> domKey（**必须 getter**：创建时还未 new Map）
     *   setTab / setTabByDom  恢复标签的两条入口（函数声明已提升，可直接传值）
     *   tabsNav()             顶部标签容器（可能为 null）
     *   syncTabsIndicator()   指示条同步
     *   isSuppressed()        版本更新提示期间暂停尺寸落盘
     *   warn                  日志
     *
     * 生命周期：bootstrap()（读存储 + 装 ResizeObserver）→ onOpen()/onClose()
     * 每次开合绑定/解绑 resize，销毁时 cleanup() 冲刷布局并断开观察器。
     * 顺序不能反：先关门会让最后一次状态被 isDisposed 拦掉。
     */
    function createPersistence(ctx) {
        var panel = ctx.panel;
        var overlay = ctx.overlay;
        var opts = ctx.opts || {};
        var id = ctx.id;

        /* 持久化配置解析 (Issue #5) */
        var persistConfig = null;
        if (opts.persist === true) {
            persistConfig = { size: true, tab: true, accordion: true, storage: defaultStorageAdapter };
        } else if (opts.persist && typeof opts.persist === 'object') {
            /* v2.9.0（GH-#18 B3）：size 三态 —— true 全量 / false 关闭 / 'width-only' 只记宽。
               非法字符串按「全开」处理并告警，避免下游手滑写成 'widthOnly' 就静默丢尺寸。 */
            var sizeOpt = opts.persist.size;
            if (typeof sizeOpt === 'string' && sizeOpt !== 'width-only') {
                ctx.warn('createPanel(): persist.size 只接受 true / false / "width-only"，已按 true 处理');
                sizeOpt = true;
            }
            persistConfig = {
                size: (sizeOpt === 'width-only') ? 'width-only' : (sizeOpt !== false),
                tab: opts.persist.tab !== false,
                accordion: opts.persist.accordion !== false,
                storage: (opts.persist.storage && typeof opts.persist.storage.get === 'function' && typeof opts.persist.storage.set === 'function')
                    ? opts.persist.storage
                    : defaultStorageAdapter,
            };
        } else if (opts.persist) {
            ctx.warn('createPanel(): 无效 persist 配置，已忽略');
        }
        var storageId = opts.id || id;
        var keys = layoutStorageKeys(storageId);
        var storageKey = keys.key;
        var storage = persistConfig ? persistConfig.storage : null;
        var loadedState = null;
        var isRestoring = false;
        var isInitialized = false;
        var lastSavedState = null;
        var readGeneration = 0;
        /* An import can finish writing before it takes effect on the next open. */
        var viewPending = null;
        /* Avoid writing the DOM snapshot produced by an import or a reset until it changes. */
        var transientBaseline = null;
        var useCssHeight = false;
        var persistTimer = null;
        var resizeRaf = null;
        var resizeBound = false;
        var resizeObserver = null;
        /* setLayoutState() 导入的状态：下一次 flush 按它原样写，不用 DOM 反解覆盖 */
        var pendingState = null;

        /* 尺寸持久化的「维度门禁」（v2.9.0 / B3）：width-only 时高度一律不读不写 */
        function sizeMode() {
            if (!persistConfig || !persistConfig.size) return 'off';
            return persistConfig.size === 'width-only' ? 'width-only' : 'full';
        }

        function anyPersistEnabled() {
            return !!(persistConfig && (persistConfig.size || persistConfig.tab || persistConfig.accordion));
        }

        function schedulePersistSave(automatic) {
            if (!persistConfig || isRestoring || ctx.isDisposed() || !anyPersistEnabled()) return;
            if (!automatic) transientBaseline = null;
            readGeneration += 1;
            isInitialized = true;
            if (persistTimer) clearTimeout(persistTimer);
            persistTimer = setTimeout(function () {
                persistTimer = null;
                flushPersistSave();
            }, PERSIST_DEBOUNCE_MS);
        }

        /* 从 DOM 反解当前布局快照。collectState() 同时服务 flush 与 getLayoutState()：
           导出布局不该先把东西写进存储。persistConfig 为空（未开持久化）时按「全维度」采集，
           只读快照仍然有意义 —— 下游可据此迁到自己的存储。 */
        function collectState() {
            var sizeOn = !persistConfig || !!persistConfig.size;
            var tabOn = !persistConfig || !!persistConfig.tab;
            var accOn = !persistConfig || !!persistConfig.accordion;
            var defaultW = (opts && typeof opts.width === 'number' && !isNaN(opts.width)) ? opts.width : 720;
                var currentW = defaultW;
                var currentH = null;
                var isMax = panel.classList.contains('is-maximized');
                var vp = getViewport();
                var isMobile = vp.isMobile;

                if (isMobile && loadedState && loadedState.size) {
                    currentW = loadedState.size.w;
                    currentH = loadedState.size.h;
                    isMax = loadedState.size.mode === 'maximized';
                } else {
                    /* v3.0.0：目标尺寸先读 CSS 变量，其次才是兼容 v2.x 的内联 px */
                    var vw = readPanelSize(panel, 'width');
                    if (vw !== null) {
                        currentW = vw;
                    } else if (panel.offsetWidth > 0) {
                        currentW = panel.offsetWidth;
                    } else if (loadedState && loadedState.size && typeof loadedState.size.w === 'number') {
                        currentW = loadedState.size.w;
                    }

                    var vh = readPanelSize(panel, 'height');
                    if (vh !== null) {
                        currentH = vh;
                    } else if (!useCssHeight && panel.offsetHeight > 0 && !isMobile) {
                        currentH = panel.offsetHeight;
                    } else if (!useCssHeight && loadedState && loadedState.size && typeof loadedState.size.h === 'number') {
                        currentH = loadedState.size.h;
                    }
                }

                var currentTabKey = null;
                var tabList = ctx.tabs();
                var currentDom = ctx.activeDom();
                if (tabList.length) {
                    for (var i = 0; i < tabList.length; i++) {
                        if (tabList[i].domKey === currentDom) {
                            currentTabKey = tabList[i].key;
                            break;
                        }
                    }
                }

                /* 原始键可能是 "__proto__" / "constructor" 等，必须用无原型对象承接，
                   否则普通对象赋值会走原型 setter 而不是写入持久键。 */
                var registry = ctx.accordion();
                var currentAccState = Object.create(null);
                for (var a = 0; a < registry.list.length; a++) {
                    var item = registry.list[a];
                    /* 已脱离本面板的旧节点不参与保存；否则重渲染后旧状态会反写新节点。 */
                    if (!registry.isLive(item)) continue;
                    currentAccState[item.id] = item.node.classList.contains('is-open');
                }
                if (loadedState && loadedState.accordion) {
                    var savedAccKeys = Object.keys(loadedState.accordion);
                    for (var ki = 0; ki < savedAccKeys.length; ki++) {
                        var k = savedAccKeys[ki];
                        if (currentAccState[k] === undefined && Object.prototype.hasOwnProperty.call(loadedState.accordion, k)) {
                            currentAccState[k] = loadedState.accordion[k];
                        }
                    }
                }

                var widthOnly = sizeMode() === 'width-only';
                var sizeModeOut = widthOnly ? 'width-only' : (isMax ? 'maximized' : 'normal');
                return {
                    version: 2,
                    timestamp: Date.now(),
                    /* Issue #16：persist.size:false 时不得把历史 size 原样回存，
                       否则旧像素高度永远清不掉，每次打开都会被 applyClamping() 写回。
                       B3：width-only 同理 —— h 恒为 null，最大化本质是二维状态，不记。 */
                    size: sizeOn ? {
                        w: currentW,
                        h: widthOnly ? null : currentH,
                        mode: sizeModeOut,
                    } : (loadedState ? loadedState.size : null),
                    tab: tabOn ? currentTabKey : (loadedState ? loadedState.tab : null),
                    accordion: accOn ? currentAccState : (loadedState ? loadedState.accordion : null),
                };
        }

        function flushPersistSave(force, disposing) {
            if (!persistConfig || (ctx.isDisposed() && !disposing) || !anyPersistEnabled()) {
                return;
            }
            var hadTimer = !!persistTimer;
            if (persistTimer) {
                clearTimeout(persistTimer);
                persistTimer = null;
            }
            if (!pendingState && (!isInitialized || viewPending)) return;
            var wasImported = !!pendingState;
            var toSave = pendingState || collectState();
            pendingState = null;
            if (!wasImported && isStateEqual(toSave, transientBaseline)) return;
            if (!wasImported) transientBaseline = null;
            if (!hadTimer && !force && isStateEqual(toSave, lastSavedState)) return;

            if (!wasImported) loadedState = toSave;
            lastSavedState = toSave;
            var record = Object.assign({}, toSave, { storageOwner: keys.owner });
            mutateStoredLayout(storage, storageKey, function () {
                return storage.set(storageKey, record);
            }, function (err) {
                if (lastSavedState === toSave) {
                    lastSavedState = null;
                    if (wasImported && !pendingState) pendingState = toSave;
                }
                ctx.warn('flushPersistSave(): 保存布局状态失败', err);
            });
        }

        function applyLoadedState(saved, resetMissing) {
            if (!saved || typeof saved !== 'object') {
                isInitialized = true;
                return;
            }
            /* v3.0.0：存档可能是 v1（v2.9.0 及更早写下的）。统一迁移到 v2 再读，
               写回时自然落成 v2 —— 下游不需要为迁移做任何事。 */
            saved = migrateStateV1toV2(saved) || saved;
            loadedState = saved;
            isRestoring = true;
            try {
                /* Issue #16：persist.size:false 时，「不恢复尺寸」还不够 ——
                   旧存档里的 size 会被 applyClamping() 读到并写回内联 px。这里在恢复前
                   先把 size 摘成 null，让本面板的 loadedState 从此刻起就是「无尺寸」语义；
                   下一次 flushPersistSave() 会顺带把历史遗留值真正清掉。 */
                if (persistConfig && persistConfig.size === false && saved.size) {
                    var clearedState = {};
                    var stateKeys = Object.keys(saved);
                    for (var sk = 0; sk < stateKeys.length; sk++) {
                        if (stateKeys[sk] !== 'size') clearedState[stateKeys[sk]] = saved[stateKeys[sk]];
                    }
                    clearedState.size = null;
                    loadedState = clearedState;
                    saved = clearedState;
                    debug('applyLoadedState(): persist.size:false，已忽略并清除历史 size 存档');
                }

                // 1. 恢复尺寸（width-only 只回写宽，高度留给下游 CSS）
                if (persistConfig && persistConfig.size && saved.size) {
                    var widthOnly = persistConfig.size === 'width-only';
                    var maximized = !widthOnly && saved.size.mode === 'maximized';
                    panel.classList.toggle('is-maximized', maximized);
                    useCssHeight = saved.size.h === null && !maximized;
                    var clamped = clampPanelLayout({ width: saved.size.w, height: saved.size.h }, saved.position, opts);
                    if (clamped.isMobile) {
                        clearPanelSize(panel);
                    } else if (maximized) {
                        writePanelSize(panel, 'calc(100vw - 32px)', 'calc(100vh - 32px)');
                    } else {
                        writePanelSize(panel, clamped.styleWidth || null,
                            (!widthOnly && clamped.styleHeight) ? clamped.styleHeight : null);
                    }
                } else if (resetMissing && persistConfig.size) {
                    panel.classList.remove('is-maximized');
                    useCssHeight = true;
                    clearPanelSize(panel);
                }

                // 2. 恢复 Tab（支持数值 0 及失效/删除 key 优雅回退）
                if (persistConfig && persistConfig.tab && saved.tab !== undefined && saved.tab !== null) {
                    var rawSavedKey = String(saved.tab);
                    var tabList = ctx.tabs();
                    var hasTabKey = ctx.keyMap().has(rawSavedKey);
                    if (!hasTabKey) {
                        for (var tIdx = 0; tIdx < tabList.length; tIdx++) {
                            if (tabList[tIdx].domKey === rawSavedKey) {
                                hasTabKey = true;
                                break;
                            }
                        }
                    }
                    if (hasTabKey) {
                        ctx.setTab(saved.tab);
                    } else if (tabList.length) {
                        ctx.warn('applyLoadedState(): 存储中的标签 key "' + rawSavedKey + '" 不存在或已失效，已回退到首个可用标签');
                        ctx.setTabByDom(tabList[0].domKey);
                    }
                } else if (resetMissing && persistConfig.tab && ctx.tabs().length) {
                    ctx.setTabByDom(ctx.tabs()[0].domKey);
                }

                // 3. 恢复 Accordion
                if (persistConfig.accordion && (saved.accordion || resetMissing)) {
                    var registry = ctx.accordion();
                    for (var a = 0; a < registry.list.length; a++) {
                        var item = registry.list[a];
                        if (!registry.isLive(item)) continue;
                        if (saved.accordion && Object.prototype.hasOwnProperty.call(saved.accordion, item.id)
                            && typeof saved.accordion[item.id] === 'boolean') {
                            item.node.setOpen(saved.accordion[item.id]);
                        } else if (resetMissing) {
                            item.node.setOpen(false);
                        }
                    }
                }
            } finally {
                isRestoring = false;
                isInitialized = true;
            }
        }

        function applyClamping() {
            if (!isDomAvailable()) return;
            var vp = getViewport();
            if (vp.isMobile) {
                clearPanelSize(panel);
                return;
            }
            if (panel.classList.contains('is-maximized')) {
                writePanelSize(panel, 'calc(100vw - 32px)', 'calc(100vh - 32px)');
                return;
            }

            /* Issue #16：persist.size:false 表示本面板**完全不参与**尺寸持久化。
               此时存档里的 size 一律不可读 —— 否则历史 px 高度会被钳回，覆盖下游 CSS
               （如 `height: var(--nvui-panel-max-h)` / 94vh）。
               注意只拦「存档尺寸」：面板自身的目标尺寸（用户拖拽 / opts.width / 最大化）
               仍然照常参与钳制，clamp 的视口安全语义不变。 */
            /* B3：宽/高分别判定 —— 'width-only' 只读存档宽度，高度一律交给下游 CSS。 */
            var mode = sizeMode();
            var useSavedW = mode !== 'off';
            var useSavedH = mode === 'full' && !useCssHeight;

            var targetW = readPanelSize(panel, 'width');
            if (targetW === null) {
                if (useSavedW && loadedState && loadedState.size && typeof loadedState.size.w === 'number') {
                    targetW = loadedState.size.w;
                } else if (typeof opts.width === 'number' && !isNaN(opts.width)) {
                    targetW = opts.width;
                }
            }

            var targetH = readPanelSize(panel, 'height');
            if (targetH === null && useSavedH && loadedState && loadedState.size && typeof loadedState.size.h === 'number') {
                targetH = loadedState.size.h;
            }

            if (targetW !== null || targetH !== null) {
                var clamped = clampPanelLayout({ width: targetW, height: targetH }, null, opts);
                writePanelSize(panel, clamped.styleWidth || null, clamped.styleHeight || null);
                return;
            }
            /* 目标两个维度都读不到 px，但身上还挂着 calc（多半是「最大化 → 还原」）：
               留着这条 calc 会让面板一直保持最大化宽度。清掉，把主权交回 CSS 默认值。 */
            if (panel.style.getPropertyValue(SIZE_VAR_W) || panel.style.getPropertyValue(SIZE_VAR_H)
                || panel.style.width || panel.style.height) {
                clearPanelSize(panel);
            }
        }

        function setPanelSize(w, h) {
            useCssHeight = h === null;
            writePanelSize(panel, w, h);
            applyClamping();
        }

        var onWindowResize = function () {
            if (overlay.hidden || overlay.classList.contains('is-closing')) return;
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(function () {
                resizeRaf = null;
                applyClamping();
                var nav = ctx.tabsNav();
                if (nav) ctx.syncTabsIndicator(nav, false);
            });
        };

        function bindWindowResize(opening) {
            if (!persistConfig) return;
            var layout = opening ? viewPending : null;
            if (layout) {
                viewPending = null;
                applyLoadedState(layout, true);
            }
            applyClamping();
            if (opening && (layout || transientBaseline)) transientBaseline = collectState();
            if (!resizeBound) {
                on(window, 'resize', onWindowResize);
                resizeBound = true;
            }
        }

        function unbindWindowResize() {
            if (resizeBound) {
                off(window, 'resize', onWindowResize);
                resizeBound = false;
            }
            if (resizeRaf) { cancelAnimationFrame(resizeRaf); resizeRaf = null; }
        }

        function cleanup() {
            if (persistConfig) {
                unbindWindowResize();
                flushPersistSave(false, true);
                if (resizeObserver) {
                    try { resizeObserver.disconnect(); } catch (e) {}
                    resizeObserver = null;
                }
            }
        }

        /* 导出当前布局（v2.9.0 / GH-#18 B1）。刻意不带 timestamp：
           布局态是「宽高 + 标签 + 折叠」，时间戳属于存储记录，带上就破坏了
           `get → set → get` 的深相等。 */
        function getLayoutState() {
            var snapshot = cloneLayoutState(viewPending || collectState());
            /* 时间戳是存储记录元数据，不属于布局本身：留着会让两次 get 天然不等 */
            if (snapshot) delete snapshot.timestamp;
            return snapshot;
        }

        /* 导入布局（v2.9.0 / GH-#18 B1）。
         * 只写内存 + 调度一次落盘，**不**调用 applyLoadedState —— 导入是数据操作，
         * 不该让面板当场跳尺寸、换标签。真正生效时机是下一次 open()。
         * 关掉的维度一律写 null：否则 `persist: { size: false }` 的面板一旦被导入，
         * #16 的「尺寸隔离」就被绕过了。 */
        function setLayoutState(state, options) {
            var silent = !!(options && options.silent);
            if (ctx.isDisposed()) return null;
            if (!persistConfig || !anyPersistEnabled()) {
                ctx.warn('setLayoutState(): 本面板未启用持久化，已忽略');
                return null;
            }
            if (!state || typeof state !== 'object') {
                ctx.warn('setLayoutState(): 需要对象参数，已忽略');
                return null;
            }
            var base = collectState();
            var has = function (k) { return Object.prototype.hasOwnProperty.call(state, k); };
            /* v3.0.0：接受 v1 与 v2 两种形态 —— 下游可能把 v2.9 时代导出的东西再导回来 */
            var incoming = migrateStateV1toV2(state) || state;
            var next = {
                version: 2,
                timestamp: Date.now(),
                /* 未提供的键落回当前 DOM 事实；显式传 null 视为「清空该项」 */
                size: has('size') ? incoming.size : base.size,
                tab: has('tab') ? incoming.tab : base.tab,
                accordion: has('accordion') ? incoming.accordion : base.accordion,
            };
            var normalized = cloneLayoutState(next);
            if (!persistConfig.size) {
                normalized.size = null;
            } else if (persistConfig.size === 'width-only' && normalized.size) {
                normalized.size.h = null;
                normalized.size.mode = 'width-only';
            }
            if (!persistConfig.tab) normalized.tab = loadedState ? loadedState.tab : null;
            if (!persistConfig.accordion) normalized.accordion = loadedState ? loadedState.accordion : null;

            viewPending = normalized;
            readGeneration += 1;
            isInitialized = true;
            if (!silent) {
                pendingState = normalized;
                schedulePersistSave();
            }
            return cloneLayoutState(normalized);
        }

        function panelClearLayoutState() {
            if (ctx.isDisposed()) return;
            if (persistTimer) {
                clearTimeout(persistTimer);
                persistTimer = null;
            }
            viewPending = null;
            pendingState = null;
            readGeneration += 1;
            isInitialized = true;
            clearLayoutState(storageId, storage);
            loadedState = null;
            lastSavedState = null;
            clearPanelSize(panel);
            useCssHeight = false;
            panel.classList.remove('is-maximized');
            isRestoring = true;
            try {
                var tabList = ctx.tabs();
                if (tabList.length) ctx.setTabByDom(tabList[0].domKey);
                var registry = ctx.accordion();
                for (var a = 0; a < registry.list.length; a++) {
                    if (registry.isLive(registry.list[a])) registry.list[a].node.setOpen(false);
                }
                var nav = ctx.tabsNav();
                if (nav) ctx.syncTabsIndicator(nav, false);
            } finally {
                isRestoring = false;
            }
            transientBaseline = collectState();
        }

        /* 读存储 + 装 ResizeObserver：createPanel 构建完 DOM 后调用一次 */
        function bootstrap() {
            if (!persistConfig) return;
            var generation = readGeneration;
            function current() {
                return !ctx.isDisposed() && generation === readGeneration;
            }
            function read(key) {
                if (!current()) return null;
                var pending = queuedLayoutMutation(storage, key);
                return pending ? pending.then(function () { return current() ? storage.get(key) : null; })
                    : storage.get(key);
            }
            function accept(state) {
                if (current()) applyLoadedState(state);
            }
            function resolvePrimary(state) {
                if (!current()) return;
                if (state != null || !keys.legacy) {
                    accept(state);
                    return;
                }
                var legacy = read(keys.legacy);
                function acceptLegacy(value) {
                    /* New records identify their owner. An old unmarked key
                       is ambiguous and may be imported as a legacy fallback. */
                    accept(value && (!value.storageOwner || value.storageOwner === keys.owner) ? value : null);
                }
                if (legacy && typeof legacy.then === 'function') return Promise.resolve(legacy).then(acceptLegacy);
                acceptLegacy(legacy);
            }
            function readFailed(err) {
                if (!current()) return;
                ctx.warn('createPanel(): 读取存储失败', err);
                isInitialized = true;
            }
            try {
                var raw = read(storageKey);
                var loading = raw && typeof raw.then === 'function'
                    ? Promise.resolve(raw).then(resolvePrimary)
                    : resolvePrimary(raw);
                if (loading) loading.catch(readFailed);
            } catch (err) {
                readFailed(err);
            }

            var lastObservedW = null;
            var lastObservedH = null;

            if (persistConfig.size && typeof ResizeObserver !== 'undefined' && isDomAvailable()) {
                try {
                    resizeObserver = new ResizeObserver(function () {
                        if (isRestoring || !isInitialized) return;
                        if (overlay.hidden || overlay.classList.contains('is-closing')) return;
                        var vp = getViewport();
                        if (vp.isMobile) return;
                        var curW = Math.round(panel.offsetWidth);
                        var curH = Math.round(panel.offsetHeight);
                        if (lastObservedW === null) {
                            lastObservedW = curW;
                            lastObservedH = curH;
                            return;
                        }
                        if (ctx.isSuppressed()) {
                            lastObservedW = curW;
                            lastObservedH = curH;
                            return;
                        }
                        if (curW === lastObservedW && curH === lastObservedH) return;
                        lastObservedW = curW;
                        lastObservedH = curH;
                        schedulePersistSave(true);
                    });
                    resizeObserver.observe(panel);
                } catch (e) {
                    ctx.warn('createPanel(): ResizeObserver 注册失败', e);
                }
            }
        }

        return {
            /* accordion 子系统读的是配置对象本身，保持原契约 */
            config: function () { return persistConfig; },
            sizeEnabled: function () { return !!(persistConfig && persistConfig.size); },
            sizeMode: sizeMode,
            tabEnabled: function () { return !!(persistConfig && persistConfig.tab); },
            accordionEnabled: function () { return !!(persistConfig && persistConfig.accordion); },
            loaded: function () { return loadedState; },
            isRestoring: function () { return isRestoring; },
            schedule: schedulePersistSave,
            scheduleIfSize: function () {
                if (persistConfig && persistConfig.size) schedulePersistSave();
            },
            flush: function (force) { flushPersistSave(force); },
            applyClamping: applyClamping,
            setSize: setPanelSize,
            bootstrap: bootstrap,
            onOpen: bindWindowResize,
            onClose: function () {
                unbindWindowResize();
                flushPersistSave();
            },
            cleanup: cleanup,
            clearLayout: panelClearLayoutState,
            getLayout: getLayoutState,
            setLayout: setLayoutState,
        };
    }

    /* ---------------------- 焦点链（G-01 第三步） ---------------------- */
    /*
     * 从 createPanel() 抽出的四条焦点路径：初始焦点 / 关闭后归还 / 末级兜底 /
     * 面板内首个可聚焦节点。它们共同构成 aria-modal 的行为契约 ——
     * 任何一条断了，键盘焦点就会掉到 BODY，读屏却仍按模态处理。
     *
     * ctx 全部是 getter：factory 在 closeBtn / panes 初始化之前创建，
     * 且 activeDom 会随切 tab 变化，传值必然拿到旧值或 undefined。
     */
    function createFocusChain(ctx) {
        var panel = ctx.panel;
        var id = ctx.id;

        function firstTrapFocusable(scope) {
            if (!scope || typeof scope.querySelectorAll !== 'function') return null;
            var list = scope.querySelectorAll(PANEL_FOCUSABLE);
            for (var i = 0; i < list.length; i++) {
                if (isTrapFocusable(list[i])) return list[i];
            }
            return null;
        }

        /**
         * 打开面板后的初始焦点（Issue #13）。
         * 只在**当前激活 pane** 里选目标：持久化恢复到非首 tab 时，
         * 不能在整块 panel 里找 .is-primary —— 那会命中隐藏 pane，
         * focus() 静默失败后焦点停在 Kit 载体上。
         * 回退链：当前 pane 的 primary → 当前 pane 首个可见控件 →
         * 当前 tab 按钮 → panel 内其它 primary → 关闭按钮 → 面板容器。
         */
        function focusBody() {
            requestAnimationFrame(function () {
                var activeDom = ctx.activeDom();
                var pane = activeDom ? ctx.panes().get(activeDom) : null;
                var target = null;
                if (pane) {
                    var primary = q('.nvui-btn.is-primary', pane);
                    if (primary && isTrapFocusable(primary)) target = primary;
                    if (!target) target = firstTrapFocusable(pane);
                }
                if (!target && activeDom) {
                    var tabBtn = document.getElementById(id + '-tab-' + activeDom);
                    if (tabBtn && isTrapFocusable(tabBtn)) target = tabBtn;
                }
                if (!target) {
                    var anyPrimary = q('.nvui-btn.is-primary', panel);
                    if (anyPrimary && isTrapFocusable(anyPrimary)) target = anyPrimary;
                }
                var closeBtn = ctx.closeBtn();
                if (!target && closeBtn && isTrapFocusable(closeBtn)) target = closeBtn;
                if (target && typeof target.focus === 'function') {
                    target.focus();
                    if (document.activeElement === target) return;
                }
                /* 末级兜底：面板容器本身，确保焦点不留在 Kit 载体 / BODY */
                if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
                if (typeof panel.focus === 'function' && isFocusable(panel)) panel.focus();
            });
        }

        /**
         * 焦点归还：优先还给触发元素。
         * 但触发元素可能已经不可聚焦了 —— 典型场景是 SillyTavern 的 wand 扩展菜单：
         * 点击菜单项后菜单会自动收起，触发按钮变成不可见，focus() 静默失败，
         * 焦点就掉到了 body，键盘用户彻底失去位置。
         * 所以这里做三级兜底：触发元素 -> 备用元素(focusFallback) -> 面板容器。
         */
        function restoreFocus() {
            var opener = ctx.opener();
            if (opener && typeof opener.focus === 'function' && isFocusable(opener)) {
                opener.focus();
                if (document.activeElement === opener) return;
            }
            var fb = ctx.focusFallback();
            var target = null;
            if (typeof fb === 'string') {
                target = resolveFocusFallback(fb);
            } else if (fb && typeof fb.focus === 'function') {
                target = fb;
            }
            if (target && isFocusable(target)) {
                target.focus();
                if (document.activeElement === target) return;
            }
            /* 第三级：面板容器。
               注意此时 overlay 已被 hidden / dialog 已 close，
               面板容器不在渲染树里，focus() 会静默失败 —— 焦点就会掉到 BODY。
               所以这里先做可见性判定，失败则继续降级。 */
            if (typeof panel.focus === 'function' && isFocusable(panel)) {
                if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
                panel.focus();
                if (document.activeElement === panel) return;
            }
            /* 第四级（NEW-03 补强）：焦点归还链全部落空时，
               绝不能让焦点掉到 BODY —— 键盘用户会彻底失去位置。
               这里退到宿主文档里第一个「可见且可聚焦」的元素上。 */
            focusFirstVisible();
        }

        /**
         * 把焦点交给宿主页面里第一个可见可聚焦的元素（末级兜底）。
         * 若宿主页面一个都没有，则保持现状（焦点留在 BODY）并告警。
         */
        function focusFirstVisible() {
            var list = document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
            for (var i = 0; i < list.length; i++) {
                var cand = list[i];
                if (!cand || !isFocusable(cand)) continue;
                try { cand.focus(); } catch (err) { continue; }
                if (document.activeElement === cand) return;
            }
            warn('restoreFocus(): 所有焦点归还兜底均不可用，焦点可能停留在 body');
        }

        return {
            focusBody: focusBody,
            restoreFocus: restoreFocus,
        };
    }


    /**
     * 标签切换子系统（G-01 第四步）。
     *
     * 从 createPanel 抽出 setTabByDom / setTab，并让这里成为 activeDom 的
     * **唯一持有者**：面板侧读 getActiveDom()，切换只走 switchTo()，避免
     * 「一份状态、两处可写」的老问题。
     *
     * ctx 里 tabsNav / bottomNav / tabs / keyMap / panes 全部是 getter：
     * factory 创建时 DOM 与集合尚未构建（var 提升后是 undefined），传值会
     * 永久拿到 undefined —— 与 createPersistence 同一个坑。
     */
    function createTabController(ctx) {
        var id = ctx.id;
        var persist = ctx.persist;
        var warn = ctx.warn;
        var syncIndicator = ctx.syncIndicator;
        var activeDom = null;

        var getTabs = ctx.tabs;
        var getPanes = ctx.panes;

        /* active 归一化：只接受确实存在于 tabs 的 key，否则回退到第一个（NEW-15） */
        function resolveInitial(wantActive) {
            var tabs = getTabs() || [];
            if (!tabs.length) return null;
            var want = (wantActive === null || wantActive === undefined) ? '' : String(wantActive);
            var matched = null;
            for (var i = 0; i < tabs.length; i++) {
                if (tabs[i].key === want || tabs[i].domKey === want) { matched = tabs[i]; break; }
            }
            if (!matched) {
                if (want) warn('createPanel(): active "' + want + '" 不存在，已回退到第一个标签');
                matched = tabs[0];
            }
            return matched.domKey;
        }

        function switchTo(domKey) {
            var panes = getPanes();
            if (!panes.get(domKey)) return;
            var tabs = getTabs() || [];
            var prevDom = activeDom;
            activeDom = domKey;

            var tabsNav = ctx.tabsNav();
            if (tabsNav) {
                Array.prototype.forEach.call(tabsNav.querySelectorAll('.nvui-tab'), function (tab) {
                    var on_ = tab.id === id + '-tab-' + domKey;
                    tab.classList.toggle('is-active', on_);
                    tab.setAttribute('aria-selected', on_ ? 'true' : 'false');
                    tab.setAttribute('tabindex', on_ ? '0' : '-1');
                });
                if (syncIndicator) syncIndicator(tabsNav, true);
            }

            var bottomNav = ctx.bottomNav();
            if (bottomNav) {
                Array.prototype.forEach.call(bottomNav.querySelectorAll('.nvui-bottom-nav-item'), function (item, index) {
                    var on_ = tabs[index] && tabs[index].domKey === domKey;
                    item.classList.toggle('is-active', on_);
                    if (on_) item.setAttribute('aria-current', 'page');
                    else item.removeAttribute('aria-current');
                });
            }

            /* 只切换「旧 pane → 新 pane」两个元素（NEW-09）：
               原实现每次全量遍历所有 pane 并逐个 classList.toggle，
               tabs 数量 N 时切换成本 O(N) 且每个 pane 都触发样式失效。 */
            var prevPane = panes.get(prevDom);
            var nextPane = panes.get(domKey);
            if (prevPane && prevPane !== nextPane) prevPane.classList.remove('is-active');
            if (nextPane) nextPane.classList.add('is-active');

            if (persist.tabEnabled() && !persist.isRestoring()) persist.schedule();
        }

        /**
         * 按调用方给的原始 key 切换标签（对外契约不变）。
         * 重复 key 取第一个（与 keyMap 一致），非法 key 静默忽略。
         */
        function setByKey(key) {
            if (key === null || key === undefined) return;
            var raw = String(key);
            var tabs = getTabs() || [];
            var domKey = ctx.keyMap().get(raw);
            if (!domKey) {
                /* 也允许直接传内部 domKey */
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].domKey === raw) { domKey = raw; break; }
                }
            }
            if (!domKey) {
                warn('setTab(): 未知标签 key "' + raw + '"，已忽略');
                return;
            }
            switchTo(domKey);
        }

        return {
            init: function (wantActive) { activeDom = resolveInitial(wantActive); return activeDom; },
            getActiveDom: function () { return activeDom; },
            switchTo: switchTo,
            setByKey: setByKey,
        };
    }


    /**
     * 版本更新提示胶囊（Issue #6，G-01 第五步）。
     *
     * 从 createPanel 抽出 showUpdate 及它的三份状态：updatePill /
     * currentUpdateConfig / isSuppressed。suppressed 标志的用途是告诉持久化
     * 「这次 DOM 变动不是用户操作，别写盘」，所以必须与胶囊同生共死，
     * 由本 factory 独占并对外暴露 isSuppressed()。
     */
    function createUpdatePillController(ctx) {
        var title = ctx.title;
        var warn = ctx.warn;
        var updatePill = null;
        var currentUpdateConfig = null;
        var isSuppressed = false;

        function clear() {
            if (updatePill && updatePill.parentNode) updatePill.parentNode.removeChild(updatePill);
            updatePill = null;
            currentUpdateConfig = null;
        }

        function show(updateConfig) {
            isSuppressed = true;
            try {
                if (!updateConfig || updateConfig.hidden === true) {
                    clear();
                    return null;
                }

                if (typeof updateConfig !== 'object') {
                    warn('showUpdate(): 无效 update 配置，已忽略');
                    return null;
                }

                currentUpdateConfig = updateConfig;
                var verStr = (updateConfig.version === null || updateConfig.version === undefined) ? '' : String(updateConfig.version);
                var labelStr = (updateConfig.label !== null && updateConfig.label !== undefined)
                    ? String(updateConfig.label)
                    : (verStr ? ('v' + verStr + ' 可用') : '新版本可用');

                if (!updatePill) {
                    updatePill = el('span', 'nvui-badge is-accent nvui-update-pill', {
                        role: 'button',
                        tabindex: '0',
                        'aria-label': updateConfig.ariaLabel || (verStr ? ('发现新版本: ' + verStr) : '版本更新可用'),
                    });

                    var handleUpdateTrigger = function (e) {
                        if (!currentUpdateConfig) return;
                        var handled = false;
                        if (typeof currentUpdateConfig.onClick === 'function') {
                            handled = true;
                            try {
                                currentUpdateConfig.onClick(e);
                            } catch (err) {
                                warn('showUpdate onClick error', err);
                            }
                        }
                        if (!handled && currentUpdateConfig.url) {
                            var urlStr = String(currentUpdateConfig.url).trim();
                            if (!isSafeUrl(urlStr)) {
                                warn('showUpdate(): 已拒绝非法的 URL 协议: ' + urlStr);
                                return;
                            }
                            try {
                                if (typeof window !== 'undefined' && window.open) {
                                    window.open(urlStr, '_blank', 'noopener,noreferrer');
                                }
                            } catch (err) {
                                warn('showUpdate(): 打开更新链接失败', err);
                            }
                        }
                    };

                    on(updatePill, 'click', handleUpdateTrigger);
                    on(updatePill, 'keydown', function (e) {
                        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                            e.preventDefault();
                            handleUpdateTrigger(e);
                        }
                    });

                    title.appendChild(updatePill);
                } else {
                    updatePill.setAttribute('aria-label', updateConfig.ariaLabel || (verStr ? ('发现新版本: ' + verStr) : '版本更新可用'));
                }

                // 严格采用 textContent 写入文本，杜绝 XSS 注入通道
                updatePill.textContent = labelStr;
                return updatePill;
            } finally {
                setTimeout(function () {
                    isSuppressed = false;
                }, 100);
            }
        }

        return {
            show: show,
            clear: clear,
            isSuppressed: function () { return isSuppressed; },
        };
    }

    /**
     * 节点写入器（G-01 第六步）：appendToPane / addNode。
     *
     * 回退链（NEW-15）与 accordion 自动接管都依赖运行时状态，故 tabs / keyMap /
     * panes / activeDom / acc / isDisposed 全部以 getter 注入：factory 创建时
     * panes 还是空 Map，acc 也可能尚未挂完。
     */
    /* ---------------------- 滚动边缘渐隐（v2.9.0，GH-#21 第 3 条） ---------------------- */
    /*
     * 面板 body 按 v2.1.1 的取舍隐藏了滚动条（scrollbar-width: none），内容超高时
     * 界面上没有任何「还能往下滚」的提示。这里只做一件事：按滚动位置给 body 打
     * data-nvui-fade="top|bottom|both"，渐隐本身全部交给 CSS（mask-image）。
     *
     * 刻意不做的事：不写内联样式（下游可用 --nvui-scroll-fade: 0px 关掉）、
     * 不改 DOM 结构、不监听 window resize（body 尺寸变化由 ResizeObserver 覆盖）。
     */
    function createScrollFade(body) {
        var raf = null;
        var observer = null;
        var disposed = false;

        function compute() {
            if (disposed) return;
            var top = body.scrollTop > 1;
            var bottom = body.scrollTop + body.clientHeight < body.scrollHeight - 1;
            var mode = (top && bottom) ? 'both' : top ? 'top' : bottom ? 'bottom' : '';
            if (mode) body.setAttribute('data-nvui-fade', mode);
            else body.removeAttribute('data-nvui-fade');
        }

        function schedule() {
            if (disposed || raf) return;
            raf = requestAnimationFrame(function () { raf = null; compute(); });
        }

        if (!body || !isDomAvailable()) {
            return { sync: function () {}, dispose: function () {} };
        }

        on(body, 'scroll', schedule, { passive: true });
        /* 面板打开（display 变化）、切 tab（隐藏/显示 pane）、追加内容都会改变
           body 或 pane 的尺寸；只 observe body 抓不到「pane 变高但 body 不变」。 */
        if (typeof ResizeObserver !== 'undefined') {
            try {
                observer = new ResizeObserver(schedule);
                observer.observe(body);
                for (var i = 0; i < body.children.length; i++) observer.observe(body.children[i]);
            } catch (e) {
                observer = null;
            }
        }
        compute();

        return {
            sync: schedule,
            dispose: function () {
                disposed = true;
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                try { off(body, 'scroll', schedule); } catch (e) {}
                if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
            },
        };
    }

    function createPaneWriter(ctx) {
        var body = ctx.body;
        var persist = ctx.persist;
        var warn = ctx.warn;
        var appendNode = ctx.appendNode;

        function appendToPane(key, node) {
            var panes = ctx.panes();
            var tabs = ctx.tabs() || [];
            var domKey = null;
            if (key !== null && key !== undefined) {
                var raw = String(key);
                domKey = ctx.keyMap().get(raw) || null;
                if (!domKey) {
                    for (var i = 0; i < tabs.length; i++) {
                        if (tabs[i].domKey === raw) { domKey = raw; break; }
                    }
                }
                if (!domKey) {
                    warn('addNode(): 未知标签 key "' + raw + '"，已回退到可见面板');
                }
            }
            /* 回退链（NEW-15）：有效 key → 当前激活 pane → 第一个 pane → body。
               报告原文建议「回退第一个 pane」，但首个 pane 往往处于未激活（不可见）状态，
               内容落进去等于「看不见」；当前激活 pane 一定可见，
               且同样满足报告的真正诉求 —— 绝不落到 body（body 不属于任何 tabpane，
               内容会既不在导航语义下、也不在任何标签的可见区域内）。 */
            var pane = null;
            var activeDomNow = ctx.activeDom();
            if (domKey && panes.get(domKey)) pane = panes.get(domKey);
            else if (activeDomNow && panes.get(activeDomNow)) pane = panes.get(activeDomNow);
            else if (tabs.length && panes.get(tabs[0].domKey)) pane = panes.get(tabs[0].domKey);
            if (!pane) pane = body;
            appendNode(pane, node);
            return node;
        }

        function addNode(key, node) {
            appendToPane(key, node);
            var acc = ctx.acc();
            if (!ctx.isDisposed() && persist.accordionEnabled()
                && node && node.classList && node.classList.contains('nvui-acc')
                && typeof node.setOpen === 'function' && !acc.findItem(node)) {
                var accId = node.id ? String(node.id) : acc.uniqueId('acc-' + (acc.list.length + 1));
                acc.track(node, accId, { bind: false });
            }
            return node;
        }

        return {
            appendToPane: appendToPane,
            addNode: addNode,
        };
    }

    /**
     * 玻璃模式控制器（G-01 第七步）。
     *
     * 收进四份状态（请求模式 / 生效模式 / 系统偏好 MQ / 清理句柄）与三个出口
     * （setMode / getState / dispose），面板侧不再直接读写 effectiveGlassMode。
     * 创建时机必须紧贴 dialog：applyPanelGlassMode() 要在挂载前先跑一次，
     * 否则首帧会闪一帧实体背景再切到玻璃。
     */
    function createGlassController(ctx) {
        var dialog = ctx.dialog;
        var mode = normalizeGlassMode(ctx.mode);
        var effective = applyPanelGlassMode(dialog, mode);
        var mediaCleanup = null;

        /* force 模式需要跟随系统「减少透明度 / 强制颜色」动态让位；auto/solid 也同步一次。 */
        function refresh() {
            effective = applyPanelGlassMode(dialog, mode);
            return effective;
        }

        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            var glassMqs = [
                window.matchMedia('(prefers-reduced-transparency: reduce)'),
                window.matchMedia('(forced-colors: active)'),
            ];
            var onGlassPrefChange = function () { refresh(); };
            glassMqs.forEach(function (mq) {
                if (mq && typeof mq.addEventListener === 'function') on(mq, 'change', onGlassPrefChange);
            });
            mediaCleanup = function () {
                glassMqs.forEach(function (mq) {
                    if (mq && typeof mq.removeEventListener === 'function') off(mq, 'change', onGlassPrefChange);
                });
            };
        }

        return {
            setMode: function (next) {
                mode = normalizeGlassMode(next);
                return refresh();
            },
            getState: function () {
                var reason = '';
                if (mode === 'force' && effective !== 'force') {
                    reason = !browserSupportsBackdrop() ? 'backdrop-unsupported' : 'preference-blocked';
                } else if (effective === 'auto' && isDomAvailable() && document.body
                    && document.body.classList.contains('no-blur')) {
                    reason = 'host-no-blur';
                }
                return {
                    mode: mode,
                    effective: effective,
                    fastUI: !!(isDomAvailable() && document.body && document.body.classList.contains('no-blur')),
                    browserSupports: browserSupportsBackdrop(),
                    preferenceBlocked: glassPreferenceBlocksForce(),
                    reason: reason,
                };
            },
            dispose: function () {
                if (mediaCleanup) { mediaCleanup(); mediaCleanup = null; }
            },
        };
    }

    /* ---------------------- 调尺寸手柄（v2.9.0 / GH-#18 B4） ---------------------- */
    /*
     * 尺寸此前只有 setSize() / setMaximized() 两个程序入口：鼠标拖不了，键盘更够不着，
     * 「记忆尺寸」对键盘用户等于不存在。opt-in 的 `resizable: true` 补一个右下角手柄：
     *   - 指针：Pointer Events + setPointerCapture，鼠标 / 触屏 / 触控笔同一条路径；
     *   - 键盘：方向键 ±8px、Shift ±32px、Home 复位（默认宽 + 高度自适应）；
     *   - 语义：role="separator" + aria-orientation + aria-valuenow / aria-valuemin /
     *     aria-valuemax / aria-valuetext；焦点环走 --nvui-focus-ring-*，不自写像素。
     *
     * 所有写入都是「先落内联 px，再交回 persist.applyClamping()」：
     * 因此视口钳制、移动端清空内联尺寸、尺寸持久化（含 width-only）全部沿用原语义，
     * 手柄自己不做任何边界计算，也不直接写存储。
     */
    function createResizeGrip(ctx) {
        var panel = ctx.panel;
        var persist = ctx.persist;
        var isDisposed = ctx.isDisposed || function () { return false; };
        var minW = 320;
        var minH = 240;
        var drag = null;

        var defaultOpts = ctx.opts || {};
        var grip = el('div', 'nvui-resize', {
            'data-nvui-part': 'resize',
            role: 'separator',
            'aria-orientation': 'horizontal',
            'aria-label': '调整面板尺寸（方向键调整，Shift 加速，Home 复位）',
            tabindex: '0',
            'aria-valuemin': String(minW),
            title: '拖拽或方向键调整尺寸',
        });
        panel.classList.add('is-resizable');
        panel.appendChild(grip);
        function defaultWidth() {
            return (typeof defaultOpts.width === 'number' && !isNaN(defaultOpts.width)) ? defaultOpts.width : 720;
        }

        function syncValue() {
            if (isDisposed()) return;
            var vp = getViewport();
            var w = Math.round(panel.offsetWidth);
            var h = Math.round(panel.offsetHeight);
            /* 面板还没显示时 offsetWidth 为 0：与其写「0 × 0 像素」这种假信息，不如留空 */
            if (!w) return;
            grip.setAttribute('aria-valuemax', String(Math.max(minW, vp.vw - 32)));
            if (w > 0) grip.setAttribute('aria-valuenow', String(w));
            grip.setAttribute('aria-valuetext', w + ' × ' + h + ' 像素');
        }

        function write(w, h) {
            if (isDisposed()) return;
            /* 手柄不自己算边界，也不自己选载体：一律「落目标尺寸 → applyClamping()」，
               钳制 / 移动端 / 持久化 / legacy 开关的语义才和 setSize() 完全一致。 */
            persist.setSize(
                (typeof w === 'number' && isFinite(w)) ? w : null,
                (typeof h === 'number' && isFinite(h)) ? h : null);
            persist.scheduleIfSize();
            syncValue();
        }

        function onKeyDown(event) {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            var step = event.shiftKey ? 32 : 8;
            var w = panel.offsetWidth;
            var h = panel.offsetHeight;
            var handled = true;
            if (event.key === 'ArrowLeft') write(w - step, h);
            else if (event.key === 'ArrowRight') write(w + step, h);
            else if (event.key === 'ArrowUp') write(w, h - step);
            else if (event.key === 'ArrowDown') write(w, h + step);
            else if (event.key === 'Home') {
                panel.classList.remove('is-maximized');
                write(defaultWidth(), null);
            }
            else handled = false;
            if (!handled) return;
            /* 阻止滚动 / 宿主快捷键，并让 Esc 之外的方向键留在手柄上 */
            event.preventDefault();
            event.stopPropagation();
        }

        function onPointerDown(event) {
            if (isDisposed()) return;
            if (typeof event.button === 'number' && event.button !== 0) return;
            drag = { x: event.clientX, y: event.clientY, w: panel.offsetWidth, h: panel.offsetHeight };
            try { grip.setPointerCapture(event.pointerId); } catch (e) {}
            grip.classList.add('is-dragging');
            event.preventDefault();
        }

        function onPointerMove(event) {
            if (!drag) return;
            write(drag.w + (event.clientX - drag.x), drag.h + (event.clientY - drag.y));
        }

        function endDrag(event) {
            if (!drag) return;
            drag = null;
            try { grip.releasePointerCapture(event.pointerId); } catch (e) {}
            grip.classList.remove('is-dragging');
        }

        on(grip, 'keydown', onKeyDown);
        on(grip, 'pointerdown', onPointerDown);
        on(grip, 'pointermove', onPointerMove);
        on(grip, 'pointerup', endDrag);
        on(grip, 'pointercancel', endDrag);
        /* 面板创建时还在 dialog 里没显示，offsetWidth 是 0 —— 此刻算不出 aria 数值。
           不挂 ResizeObserver（对刚创建、尚未进文档的节点不可靠，且常驻观察一个隐藏
           面板是纯浪费）：改为「焦点到手 / 每次写入」两个时机同步。读屏软件也正是在
           焦点落到手柄时才读 aria-valuenow，时机是对的。 */
        on(grip, 'focus', syncValue);
        on(grip, 'pointerdown', syncValue);

        return {
            el: grip,
            sync: syncValue,
            dispose: function () {
                drag = null;
                off(grip, 'keydown', onKeyDown);
                off(grip, 'pointerdown', onPointerDown);
                off(grip, 'pointermove', onPointerMove);
                off(grip, 'pointerup', endDrag);
                off(grip, 'pointercancel', endDrag);
                off(grip, 'focus', syncValue);
                off(grip, 'pointerdown', syncValue);
            },
        };
    }

    function createPanel(options) {
        var opts = options || {};
        /* 面板 id 会被派生出 -layer / -overlay / -title / -tab-* / -pane-* 等多个 DOM id，
           所以它本身也必须是合法 id（不能含空格 / 引号 / < >）。 */
        var id = uniqueId(sanitizeIdPart(opts.id || 'nvui-panel', 'nvui-panel'));
        var opener = null;

        /* 宿主若全局禁用了 backdrop-filter，先做实心回退，避免玻璃只剩半透明底色 */
        syncGlassFallback();
        /* 宿主若正处于模态弹窗（showModal），kit 载体应主动让位而非硬压 */
        syncHostModalState();
        /* 装一次监听：宿主模态动态开关时自动降级/还原 */
        installHostModalWatcher();

        /* 生命周期标志：持久化子系统与 accordion 注册表都要读它 */
        var disposed = false, acc = null;
        /* 持久化子系统（G-01 第二步）在 DOM 骨架建好后创建，见下 */
        var persist = null;
        /* 标签控制器（G-01 第四步）：activeDom 由它独占，本函数只读 getActiveDom() */
        var tabCtl = null;
        /* 更新胶囊控制器（G-01 第五步）：胶囊状态与 suppressed 标志同生共死 */
        var updateCtl = null;

        /* NEW-36：显式设置 closing="" 与 role="presentation"，杜绝 SillyTavern fixToastrForDialogs 劫持注入 */
        var dialogTitleStr = (typeof opts.title === 'symbol') ? '面板' : (opts.title || '面板');
        var dialog = el('dialog', 'nvui-tl', {
            id: id + '-layer',
            closing: '',
            role: 'presentation',
            'aria-label': dialogTitleStr + ' 浮层',
            'data-nvui-version': VERSION,
            'data-nvui-glass-mode': normalizeGlassMode(opts.glass),
        });
        stampVersion(dialog);
        var overlay = el('div', 'nvui-overlay is-panel', { id: id + '-overlay', hidden: '' });
        var panel = el('div', 'nvui-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-title' });
        /* 持久化子系统（G-01 第二步）：7 个函数已抽到模块级 createPersistence。
           依赖全部以 getter 形式注入 —— 此刻 tabs / keyMap / acc 尚未初始化，
           直接传值会得到 undefined（这是本类重构最容易踩的坑）。 */
        persist = createPersistence({
            panel: panel,
            overlay: overlay,
            opts: opts,
            id: id,
            isDisposed: function () { return disposed; },
            accordion: function () { return acc; },
            tabs: function () { return tabs; },
            /* tabCtl 在本行之后才创建，故走惰性闭包；bootstrap 时已就绪 */
            activeDom: function () { return tabCtl ? tabCtl.getActiveDom() : null; },
            keyMap: function () { return keyMap; },
            setTab: function (key) { if (tabCtl) tabCtl.setByKey(key); },
            setTabByDom: function (domKey) { if (tabCtl) tabCtl.switchTo(domKey); },
            tabsNav: function () { return tabsNav; },
            syncTabsIndicator: syncTabsIndicator,
            isSuppressed: function () { return updateCtl ? updateCtl.isSuppressed() : false; },
            warn: warn,
        });

        /* G-01：accordion 子系统以 ctx 注入，持久化能力由 createPersistence 提供 */
        acc = createAccordionRegistry({
            panel: panel,
            persistConfig: persist.config,
            loadedState: persist.loaded,
            isRestoring: persist.isRestoring,
            isDisposed: function () { return disposed; },
            schedulePersistSave: persist.schedule,
            restoreFocus: restoreFocusFromCollapsedAccordion,
            sanitizeIdPart: sanitizeIdPart,
            warn: warn,
        });
        /* 玻璃模式控制器（G-01 第七步）：模式状态、系统偏好监听与生效值计算都在 factory 内，
           面板侧只保留 setMode / getState 两个出口（destroy 时 dispose）。 */
        var glassCtl = createGlassController({ dialog: dialog, mode: opts.glass });
        var resizeGrip = opts.resizable ? createResizeGrip({ panel: panel, persist: persist, opts: opts, isDisposed: function () { return disposed; } }) : null;
        /* 初始自定义宽度（opts.width，默认交由 CSS / token 720px） */
        if (typeof opts.width === 'number' && !isNaN(opts.width)) {
            var initClamp = clampPanelLayout({ width: opts.width }, null, opts);
            if (!initClamp.isMobile && initClamp.styleWidth) {
                writePanelSize(panel, initClamp.styleWidth, null);
            }
        }

        /* 手机拖拽把手（纯视觉） */
        panel.appendChild(el('div', 'nvui-sheet-handle', { 'aria-hidden': 'true' }));

        /* 标题栏 */
        var header = el('div', 'nvui-panel-header');
        var title = el('b', 'nvui-panel-title', { id: id + '-title', text: opts.title || '面板' });
        if (opts.version) title.appendChild(el('span', 'nvui-badge', { text: opts.version }));

        /* 版本更新提示胶囊（G-01 第五步）：状态与生命周期由 factory 独占 */
        updateCtl = createUpdatePillController({ title: title, warn: warn });
        if (opts.update) updateCtl.show(opts.update);

        /* 头部操作流区：严格保证 [自定义 actions...] -> [主题切换 themeToggle] -> [关闭 closeBtn] */
        var actions = el('span', 'nvui-panel-actions');
        (opts.actions || []).forEach(function (a) {
            var btn = el('button', 'nvui-icon-btn', { type: 'button', 'aria-label': a.label || '操作' });
            var ic = iconNode(a.icon);
            if (ic) btn.appendChild(ic);
            if (typeof a.onClick === 'function') on(btn, 'click', a.onClick);
            actions.appendChild(btn);
        });

        /* 预置主题切换按钮 (Issue #6) */
        var themeToggleBtn = null;
        var hasThemeToggle = (opts.themeToggle === true) || (opts.themeToggle && typeof opts.themeToggle === 'object');
        var isCurrentLight = function () {
            return isDomAvailable() && document.body && document.body.classList.contains('nvui-theme-light');
        };
        var updateThemeToggleUi = null;

        if (hasThemeToggle) {
            if (opts.themeToggle && typeof opts.themeToggle === 'object' && (opts.themeToggle.initial === 'dark' || opts.themeToggle.initial === 'light')) {
                setTheme(opts.themeToggle.initial);
            }
            var curLight = isCurrentLight();
            themeToggleBtn = el('button', 'nvui-icon-btn nvui-theme-toggle', {
                type: 'button',
                title: '切换主题',
                'aria-label': curLight ? '切换为深色主题' : '切换为浅色主题',
            });
            var themeIcon = el('i', curLight ? 'fa-solid fa-moon' : 'fa-solid fa-sun', { 'aria-hidden': 'true' });
            themeToggleBtn.appendChild(themeIcon);

            updateThemeToggleUi = function (light) {
                if (!themeToggleBtn) return;
                themeToggleBtn.setAttribute('aria-label', light ? '切换为深色主题' : '切换为浅色主题');
                if (themeIcon) {
                    themeIcon.className = light ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
                }
            };

            on(themeToggleBtn, 'click', function () {
                var nextTheme = isCurrentLight() ? 'dark' : 'light';
                setTheme(nextTheme);
                updateThemeToggleUi(nextTheme === 'light');
                if (typeof opts.onThemeChange === 'function') {
                    try { opts.onThemeChange(nextTheme); } catch (e) { warn('onThemeChange error', e); }
                }
                if (opts.themeToggle && typeof opts.themeToggle.onThemeChange === 'function') {
                    try { opts.themeToggle.onThemeChange(nextTheme); } catch (e) { warn('themeToggle.onThemeChange error', e); }
                }
            });

            actions.appendChild(themeToggleBtn);
        }

        var closeBtn = el('button', 'nvui-icon-btn', { type: 'button', 'aria-label': '关闭面板' });
        closeBtn.appendChild(el('i', 'fa-solid fa-xmark', { 'aria-hidden': 'true' }));
        actions.appendChild(closeBtn);
        append(header, [title, actions]);
        panel.appendChild(header);

        /* 标签导航 + 内容面板
         *
         * v2.4.0 起对 tabs[].key 做归一化（NEW-02）：
         *   - key 会被拼进 DOM id（`<id>-tab-<key>` / `<id>-pane-<key>`），
         *     含空格 / 引号 / < > 时会产生非法 id 并让 ARIA 的 IDREF 断链；
         *   - 重复 key 会让 panes 映射互相覆盖，第一个面板静默丢失。
         * 归一化策略：对外仍然使用调用方给的原始 key（addNode/setTab 契约不变），
         * 内部另建一个「合法且唯一」的 domKey 用于 DOM id 与面板映射。 */
        var tabsNav = null;
        var bottomNav = null;
        /* pane 集合用 Map（NEW-09）：
           - O(1) 查表，且天然没有原型链 —— 普通对象上 '__proto__' / 'constructor'
             这类 key 会命中 Object.prototype，导致 keyMap 赋值失效、panes 覆盖出错；
           - Map 是语言内置数据结构，不引入任何依赖，也不改变 ES5 语法风格
             （本文件仍只用 var + 经典 function）。 */
        var panes = new Map();      /* domKey -> pane 元素 */
        var keyMap = new Map();     /* 原始 key -> domKey（重复 key 取第一个） */
        var domKeySet = new Map();  /* domKey -> true（去重用） */
        var rawTabs = Array.isArray(opts.tabs) ? opts.tabs : [];
        var tabs = [];
        rawTabs.forEach(function (t, index) {
            if (!t) return;
            var origKey = (t.key === null || t.key === undefined) ? '' : String(t.key);
            var base = sanitizeIdPart(origKey, 'tab-' + (index + 1));
            var domKey = base;
            var seq = 2;
            while (domKeySet.has(domKey)) {
                domKey = base + '-' + seq;
                seq += 1;
            }
            domKeySet.set(domKey, true);
            if (!keyMap.has(origKey)) keyMap.set(origKey, domKey);
            tabs.push({ key: origKey, domKey: domKey, label: t.label, icon: t.icon });
        });

        /* 标签控制器独占 activeDom，导航节点初始化后由 getter 读取。 */
        tabCtl = createTabController({
            id: id,
            persist: persist,
            tabs: function () { return tabs; },
            keyMap: function () { return keyMap; },
            panes: function () { return panes; },
            tabsNav: function () { return tabsNav; },
            bottomNav: function () { return bottomNav; },
            syncIndicator: syncTabsIndicator,
            warn: warn,
        });
        tabCtl.init(opts.active);
        /* 建 DOM 时用的初始值；运行期一律现读 tabCtl.getActiveDom() */
        var activeNow = tabCtl.getActiveDom();
        debug('createPanel(): id=' + id + '，标签数=' + tabs.length + '，激活=' + (activeNow || '(无)'));

        if (tabs.length) {
            tabsNav = el('nav', 'nvui-tabs', { role: 'tablist', 'aria-label': '面板分区' });
            tabsNav.appendChild(el('span', 'nvui-tabs-indicator', { 'aria-hidden': 'true' }));
            tabs.forEach(function (t) {
                var tab = el('button', 'nvui-tab' + (t.domKey === activeNow ? ' is-active' : ''), {
                    type: 'button', role: 'tab', id: id + '-tab-' + t.domKey,
                    'data-tab': t.key,
                    'data-key': t.key,
                    'aria-selected': t.domKey === activeNow ? 'true' : 'false',
                    'aria-controls': id + '-pane-' + t.domKey,
                    tabindex: t.domKey === activeNow ? '0' : '-1',
                });
                var ic = iconNode(t.icon);
                if (ic) tab.appendChild(ic);
                var tabLabelStr = (typeof t.label === 'symbol' || typeof t.key === 'symbol') ? '标签' : String(t.label || t.key);
                tab.appendChild(document.createTextNode(tabLabelStr));
                on(tab, 'click', function () { tabCtl.switchTo(t.domKey); });
                tabsNav.appendChild(tab);
            });
            /* NEW-41：符合 WAI-ARIA APG Tabs Pattern 的方向键与 Home/End 键盘导航 */
            on(tabsNav, 'keydown', function (e) {
                if (!tabs.length) return;
                var curIdx = -1;
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].domKey === tabCtl.getActiveDom()) { curIdx = i; break; }
                }
                var nextIdx = -1;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    nextIdx = (curIdx + 1) % tabs.length;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    nextIdx = (curIdx - 1 + tabs.length) % tabs.length;
                } else if (e.key === 'Home') {
                    nextIdx = 0;
                } else if (e.key === 'End') {
                    nextIdx = tabs.length - 1;
                }
                if (nextIdx !== -1 && nextIdx !== curIdx) {
                    e.preventDefault();
                    tabCtl.switchTo(tabs[nextIdx].domKey);
                    var targetTab = document.getElementById(id + '-tab-' + tabs[nextIdx].domKey);
                    if (targetTab && typeof targetTab.focus === 'function') targetTab.focus();
                }
            });
            panel.appendChild(tabsNav);
        }

        var body = el('div', 'nvui-panel-body');
        tabs.forEach(function (t) {
            var pane = el('div', 'nvui-tabpane' + (t.domKey === activeNow ? ' is-active' : ''), {
                role: 'tabpanel', id: id + '-pane-' + t.domKey, 'aria-labelledby': id + '-tab-' + t.domKey,
            });
            panes.set(t.domKey, pane);
            body.appendChild(pane);
        });
        panel.appendChild(body);
        var scrollFade = createScrollFade(body);   /* 同 body 生命周期，destroy 时 dispose */
        /* 可选底部操作区 */
        if (opts.footer && opts.footer.length) {
            var footer = el('div', 'nvui-panel-footer');
            opts.footer.forEach(function (b) {
                if (!b) return;
                var safeV = (typeof b.variant === 'symbol' || !b.variant) ? '' : String(b.variant);
                var btn = el('button', 'nvui-btn' + (safeV ? ' is-' + safeV : ''), { type: 'button', text: b.label || '' });
                on(btn, 'click', function () {
                    if (typeof b.onClick === 'function') b.onClick();
                    if (b.close) closePanel();
                });
                footer.appendChild(btn);
            });
            panel.appendChild(footer);
        }

        /* 手机底部导航（与顶部 tabs 同一份状态） */
        if (tabs.length) {
            bottomNav = el('nav', 'nvui-bottom-nav', { 'aria-label': '面板分区（手机）' });
            tabs.forEach(function (t) {
                var item = el('button', 'nvui-bottom-nav-item' + (t.domKey === activeNow ? ' is-active' : ''), {
                    type: 'button', 'aria-label': t.label || t.key,
                    'data-tab': t.key,
                    'data-key': t.key,
                });
                if (t.domKey === activeNow) item.setAttribute('aria-current', 'page');
                var ic = iconNode(t.icon);
                if (ic) item.appendChild(ic);
                item.appendChild(el('span', null, { text: t.label || t.key }));
                on(item, 'click', function () { tabCtl.switchTo(t.domKey); });
                bottomNav.appendChild(item);
            });
            panel.appendChild(bottomNav);
        }

        append(overlay, panel);
        dialog.appendChild(overlay);
        /* 挂载点兜底（NEW-18）：opts.mount 可能是无效节点，
           document.body 也可能尚未就绪（脚本在 <head> 内同步执行）。
           直接 appendChild 会抛 TypeError 且无提示 —— 这里显式降级并报错。 */
        var mountNode = opts.mount;
        if (!mountNode || typeof mountNode.appendChild !== 'function') {
            if (opts.mount) warn('createPanel(): opts.mount 不是有效节点，已回退到 document.body');
            mountNode = document.body;
        }
        if (!mountNode || typeof mountNode.appendChild !== 'function') {
            error('createPanel(): 挂载点不可用（opts.mount 与 document.body 均无效），已中止创建');
            return null;
        }
        /* 挂载动作本身也可能抛错（NEW-18 补充）：
           上面的「类型检查」只能挡住「不是节点」的情况，挡不住
           「是节点但 appendChild 会失败」—— 例如宿主把 body 换成了
           自定义元素代理、节点已在一个会被拒绝的文档（XML / 已废弃的
           HTMLCollection 场景）、或 appendChild 被宿主重写成抛错的实现。
           无论哪种情况，异常都**不得穿透到调用方**（createPanel 的契约是
           「失败时返回 null」），否则调用方的 try/catch 会被迫处理一个
           本该被 kit 内部吸收的错误。失败时显式报 error 级日志并返回 null。 */
        try {
            mountNode.appendChild(dialog);
        } catch (err) {
            error('createPanel(): 面板挂载失败（mountNode.appendChild 抛错），已中止创建', err);
            return null;
        }

        persist.bootstrap();

        function openPanel() {
            if (disposed) return;
            var opening = !dialog.open || overlay.classList.contains('is-closing');
            if (!dialog.open) opener = document.activeElement;
            openLayer(dialog, overlay);
            /* NEW-29：打开面板时提升 Esc 调度栈位置至最顶层 */
            if (escapeEntry && typeof escapeEntry.promote === 'function') {
                escapeEntry.promote();
            }
            if (hasThemeToggle && themeToggleBtn && typeof updateThemeToggleUi === 'function') {
                updateThemeToggleUi(isCurrentLight());
            }
            persist.onOpen(opening);
            focusChain.focusBody();
            if (tabsNav) {
                setTimeout(function () { syncTabsIndicator(tabsNav, false); }, 0);
            }
        }

        function closePanel() {
            if (disposed) return;
            persist.onClose();
            closeLayer(dialog, overlay, function () {
                focusChain.restoreFocus();
                opener = null;
                if (typeof opts.onClose === 'function') opts.onClose();
            });
        }

        on(closeBtn, 'click', closePanel);
        on(overlay, 'click', function (event) { if (event.target === overlay) closePanel(); });

        /* 焦点陷阱（focus trap）
           宿主红线禁止 showModal()（会给文档加 inert），所以「模态」是半手动实现的：
           面板声明了 aria-modal="true"，就必须真的把键盘焦点圈在面板内，
           否则读屏按模态处理、键盘却能跑到背景页 —— 声明与行为不符。
           Tab / Shift+Tab 的循环判定抽到模块级 trapTabFocus()，避免 createPanel 继续膨胀。 */
        /* G-01 第三步：焦点链抽到模块级 createFocusChain；closeBtn / panes 此刻已就绪，
           activeDom 会随切 tab 变化，故仍以 getter 传入。 */
        var focusChain = createFocusChain({
            panel: panel,
            id: id,
            closeBtn: function () { return closeBtn; },
            activeDom: function () { return tabCtl ? tabCtl.getActiveDom() : null; },
            panes: function () { return panes; },
            opener: function () { return opener; },
            focusFallback: function () { return opts.focusFallback; },
        });
        on(panel, 'keydown', function (event) {
            if (event.key !== 'Tab' || overlay.hidden) return;
            trapTabFocus(event, panel, PANEL_FOCUSABLE);
        });

        /* Esc 关闭：走全局单例调度器，而不是给每个面板挂一个永久的
           document 级监听器（旧实现会导致监听器与 DOM 无限累积，
           且多面板时任一 Esc 会关闭全部可见面板）。
           调度器只把 Esc 交给「最上层可见面板」。 */
        var escapeEntry = registerEscapeHandler(
            closePanel,
            function () { return overlay.isConnected && !overlay.hidden && !overlay.classList.contains('is-closing'); },
            function () { return overlay.isConnected; }
        );

        /* 节点写入器（G-01 第六步）：回退链与 accordion 自动接管都在 factory 内 */
        var writer = createPaneWriter({
            body: body,
            persist: persist,
            appendNode: append,
            warn: warn,
            tabs: function () { return tabs; },
            keyMap: function () { return keyMap; },
            panes: function () { return panes; },
            activeDom: function () { return tabCtl.getActiveDom(); },
            acc: function () { return acc; },
            isDisposed: function () { return disposed; },
        });
        /**
         * 销毁面板（NEW-16：让宿主能收到 dialog 的 close 事件）。
         *
         * 直接 removeChild 不会触发 close 事件，宿主若依赖该事件做清理就会漏收。
         * 但光调 close() 还不够：dialog.close() 派发的 close 事件是**异步 task**
         * （实测同步调用后立刻读计数为 0，稍后才变 1）。若在 close() 之后同步
         * removeChild，事件派发时节点已经脱离文档树 —— close 事件不冒泡，
         * 只有捕获阶段的祖先监听才能收到，节点一脱离，document 上的委托监听
         * （宿主最常见的姿势「document.addEventListener('close', …, true)」）
         * 就什么都收不到，等于改了个寂寞。
         *
         * 故：把「摘除节点」推迟到 close 事件真正派发之后再做：
         *   1. 先挂一次性 close 监听；
         *   2. 调用 close()；
         *   3. 事件派发后（再让出一个 task）摘除；
         *   4. 另留一个兜底定时器 —— 极端情况下 close 事件未派发时也要摘干净，
         *      绝不让节点泄漏在 DOM 里。
         * 摘除动作本身幂等（removed 标志），重复触发无害。
         */
        function destroy() {
            if (disposed) return;
            disposed = true;
            persist.cleanup();
            cancelLayerClose(overlay);
            glassCtl.dispose();
            restoreForeignNodes(dialog);
            unregisterEscapeHandler(closePanel);
            var removed = false;
            var onClose = function () {
                off(dialog, 'close', onClose);
                setTimeout(remove, 0);
            };
            if (dialog && dialog.open) {
                try { on(dialog, 'close', onClose); dialog.close(); }
                catch (err) { remove(); }
                setTimeout(remove, 50);
            } else { remove(); }
            function remove() {
                if (removed) return;
                removed = true;
                if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                updateCtl.clear();
            }
            opener = null;
            acc.unbindAll();
            scrollFade.dispose(); if (resizeGrip) resizeGrip.dispose();
            if (typeof opts.destroy === 'function') opts.destroy();
        }

        var controller = {
            id: id,
            dialog: dialog,
            overlay: overlay,
            panel: panel,
            body: body,
            tabs: tabsNav,
            bottomNav: bottomNav,
            open: openPanel,
            close: closePanel,
            destroy: destroy,
            setTab: tabCtl.setByKey,
            showUpdate: updateCtl.show,
            syncIndicator: function () { if (tabsNav) syncTabsIndicator(tabsNav, false); },
            addNode: writer.addNode,
            addSwitch: function (key, o) { return writer.addNode(key, switchRow(o)); },
            addInput: function (key, o) { return writer.addNode(key, inputRow(o)); },
            addAccordion: function (key, o) {
                /* 注意：局部变量不能叫 acc —— 那是 accordion 注册表的名字（G-01） */
                var node = accordion(o);
                writer.appendToPane(key, node);
                if (!disposed && persist.accordionEnabled()) {
                    var accId;
                    if (o && o.id) {
                        accId = String(o.id);
                    } else if (o && o.title) {
                        accId = acc.titleId(o.title, 'acc-' + (acc.list.length + 1));
                    } else {
                        accId = acc.uniqueId('acc-' + (acc.list.length + 1));
                    }
                    acc.track(node, accId, { bind: false });
                }
                return node;
            },
            trackAccordion: acc.track,
            adoptAccordions: acc.adopt,
            addProgress: function (key, o) { return writer.addNode(key, progress(o)); },
            addSectionTitle: function (key, text) { return writer.addNode(key, el('div', 'nvui-section-title', { text: text })); },
            clearLayoutState: persist.clearLayout,
            getLayoutState: persist.getLayout,
            setLayoutState: persist.setLayout,
            flushPersistSave: persist.flush,
            setSize: function (w, h) {
                if (disposed) return;
                persist.setSize(Number.isFinite(w) ? w : null, Number.isFinite(h) ? h : null);
                persist.scheduleIfSize();
            },
            setMaximized: function (v) {
                panel.classList.toggle('is-maximized', !!v);
                persist.applyClamping();
                persist.scheduleIfSize();
            },
            setGlassMode: function (mode) {
                return glassCtl.setMode(mode);
            },
            getGlassState: function () {
                return glassCtl.getState();
            },
        };

        Object.defineProperty(controller, 'activeTab', {
            get: function () {
                if (!tabs.length) return null;
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].domKey === tabCtl.getActiveDom()) {
                        return tabs[i].key;
                    }
                }
                return tabs[0].key;
            },
            enumerable: true,
            configurable: true,
        });

        return controller;
    }

    /* ---------------------- 吐司 ---------------------- */

    function ensureToastLayer() {
        /* NEW-31：防御 document.body 未就绪或异常挂载环境 */
        if (!isDomAvailable() || !document.body) {
            error('showToast(): document.body 不可用，无法创建通知层');
            return null;
        }
        var layer = document.getElementById(TOAST_LAYER_ID);
        /* NEW-39：防 DOM Cloaking 伪造普通 div 节点破坏通知层 */
        if (layer && (layer.tagName !== 'DIALOG' || !layer.classList.contains('nvui-tl'))) {
            warn('ensureToastLayer(): 发现同名非载体节点，已重命名避让');
            layer.id = TOAST_LAYER_ID + '-cloaked';
            layer = null;
        }
        if (layer) {
            if (!layer.open) {
                try { layer.show(); } catch (err) { layer.setAttribute('open', ''); }
            }
            layer.hidden = false;
            return layer;
        }
        /* NEW-36：显式增加 closing="" 与 role="presentation" */
        var dialog = el('dialog', 'nvui-tl nvui-tl-toast', { id: TOAST_LAYER_ID, closing: '', role: 'presentation', 'aria-label': '通知层' });
        var stack = el('div', 'nvui-toast-stack');
        dialog.appendChild(stack);
        try {
            document.body.appendChild(dialog);
        } catch (err) {
            error('showToast(): 通知层挂载到 document.body 失败', err);
            return null;
        }
        try { dialog.show(); } catch (err) { dialog.setAttribute('open', ''); }
        return dialog;
    }

    /**
     * showToast({ message, type, duration, icon })
     * type: 'success' | 'warn' | 'danger' | 'info' | undefined（默认中性）
     * 返回 { element, dismiss }。
     */
    function showToast(options) {
        var opts = options || {};
        if (!opts.message) warnOnce('showToast-message', 'showToast(): 缺少 message，将弹出空通知');
        syncGlassFallback();
        var layer = ensureToastLayer();
        if (!layer) return { element: null, dismiss: function () {} };
        /* 吐司层可能在宿主模态之后才创建，需在其存在后同步降级态 */
        syncHostModalState();
        installHostModalWatcher();
        var stack = q('.nvui-toast-stack', layer);
        if (!stack) return { element: null, dismiss: function () {} };
        var toast = el('div', 'nvui-toast' + (opts.type ? ' is-' + opts.type : ''), { role: 'status', 'data-nvui-version': VERSION });
        stampVersion(toast);
        var ic = iconNode(opts.icon || 'fa-solid fa-circle-info');
        if (ic) toast.appendChild(ic);
        var text = el('span', null, { text: opts.message || '' });
        toast.appendChild(text);
        if (opts.dismissible !== false) {
            var close = el('button', 'nvui-icon-btn', { type: 'button', 'aria-label': '关闭通知' });
            close.appendChild(el('i', 'fa-solid fa-xmark', { 'aria-hidden': 'true' }));
            toast.appendChild(close);
            on(close, 'click', dismiss);
        }
        stack.appendChild(toast);
        var timer = null;

        function dismiss() {
            if (!toast.parentNode || toast.classList.contains('is-closing')) return;
            if (timer) clearTimeout(timer);
            toast.classList.add('is-closing');
            var removed = false;
            var fallback = null;
            function done() {
                if (removed) return;
                removed = true;
                if (fallback) { clearTimeout(fallback); fallback = null; }
                /* 退场监听必须摘除，否则同一条吐司反复 dismiss 会叠加监听器 */
                try { off(toast, 'animationend', onAnimEnd); } catch (err) { /* 忽略 */ }
                if (toast.parentNode) toast.parentNode.removeChild(toast);
                /* 承载层保持常驻开启：一旦在这里 close()，
                   后续 showToast 会拿到一个已关闭的载体，第二条及以后的吐司全部不可见。
                   载体本身是 pointer-events:none 的空壳，常驻不产生交互副作用。 */
            }
            function onAnimEnd(event) {
                /* animationend 冒泡：只认吐司自身的退场动画 */
                if (event && event.target !== toast) return;
                if (event && event.animationName && event.animationName.indexOf('out') === -1) return;
                done();
            }
            on(toast, 'animationend', onAnimEnd);
            fallback = setTimeout(done, animationFallbackMs(60));
        }

        /* NEW-32：duration 有效数值归一化防护，非有限正数安全回退默认 3200ms */
        if (opts.duration !== 0) {
            var rawDur = Number(opts.duration);
            var dur = (isFinite(rawDur) && rawDur > 0) ? rawDur : 3200;
            timer = setTimeout(dismiss, dur);
        }
        return { element: toast, dismiss: dismiss };
    }

    /* ---------------------- v2.8.0 自检 / 默认值 ---------------------- */

    var DEFAULTS = Object.freeze({
        switchRow: Object.freeze({ label: '', value: false, disabled: false, feature: false }),
        inputRow: Object.freeze({ label: '', type: 'text', placeholder: '', value: null, disabled: false }),
        accordion: Object.freeze({ title: '', summary: '', open: false, content: Object.freeze([]) }),
        progress: Object.freeze({ value: 0, indeterminate: false, label: '', variant: null }),
        createPanel: Object.freeze({
            id: 'nvui-panel', title: '面板', version: null, tabs: Object.freeze([]), active: null,
            actions: Object.freeze([]), footer: null, mount: null, persist: false, width: null,
            themeToggle: false, update: null, glass: 'auto',
        }),
        showToast: Object.freeze({
            message: '', type: null, icon: 'fa-solid fa-circle-info', duration: 3200, dismissible: true,
        }),
        actions: Object.freeze({ className: 'nvui-actions' }),
    });

    function semverTuple(value) {
        var raw = String(value === undefined || value === null ? '' : value).replace(/^v/i, '').split('-')[0];
        var parts = raw.split('.');
        var out = [];
        for (var i = 0; i < 3; i++) {
            var n = parseInt(parts[i], 10);
            out.push(isFinite(n) ? n : 0);
        }
        return out;
    }

    function compareSemver(a, b) {
        var pa = semverTuple(a);
        var pb = semverTuple(b);
        for (var i = 0; i < 3; i++) {
            if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
        }
        return 0;
    }

    function checkCompatibility(options) {
        var opts = options || {};
        var reason = '';
        if (opts.min && compareSemver(VERSION, opts.min) < 0) reason = 'below-min';
        else if (opts.max && compareSemver(VERSION, opts.max) > 0) reason = 'above-max';
        return { compatible: !reason, actual: VERSION, reason: reason };
    }

    function selfCheck(options) {
        var opts = options || {};
        var issues = [];
        if (!isDomAvailable()) {
            return {
                ok: false, kitVersion: VERSION, expect: opts.expect || null,
                cssLoaded: false, glass: { state: 'unknown', autoFallback: false, reason: 'no-dom' },
                carrierZ: null, hostModalCount: 0, tokens: {}, issues: ['no-dom'],
            };
        }
        var cssLoaded = !!getToken('--nvui-glass-blur');
        var cssVersion = String(getToken('--nvui-kit-version') || '').trim().replace(/^["']|["']$/g, '');
        if (opts.expect && String(opts.expect) !== VERSION) issues.push('version-mismatch');
        if (!cssLoaded) issues.push('css-not-loaded');
        if (cssVersion && cssVersion !== VERSION) issues.push('css-version-mismatch');
        try { detectGlassSupport({ force: true }); } catch (err) { /* 探测失败不影响自检返回 */ }
        var fallback = false;
        try { fallback = document.documentElement.classList.contains(GLASS_FALLBACK_CLASS); } catch (err) { /* 忽略 */ }
        if (fallback) issues.push('glass-auto-fallback');
        var zRaw = getToken('--nvui-z-layer');
        var zNum = parseFloat(zRaw);
        return {
            ok: issues.length === 0,
            kitVersion: VERSION,
            expect: opts.expect || null,
            cssLoaded: cssLoaded,
            cssVersion: cssVersion,
            glass: {
                state: glassState.state || 'unknown',
                autoFallback: fallback,
                reason: glassState.reason || '',
            },
            carrierZ: isFinite(zNum) ? zNum : null,
            hostModalCount: countHostModals(),
            tokens: { accent: getToken('--nvui-accent') },
            issues: issues,
        };
    }

    /* ---------------------- 诊断快照（v2.9.0 / GH-#18 B2） ---------------------- */
    /*
     * 下游提 issue 时最贵的一步是「你装的是哪版、状态里到底有什么」。
     * 这里把散在各处的运行态收成一个可直接贴进 issue 的 JSON。
     *
     * 三条纪律：
     * 1. **无副作用**：只读，不建 DOM、不改类名、不写存储、不触发玻璃重探；
     * 2. **不抛错**：任何一段失败都退化为 null / 空值，诊断工具本身不该成为故障源；
     * 3. **无 DOM 环境**（Node / SSR）返回 status:'no-dom'，而不是空对象或抛错。
     */

    /** 在已加载的样式表里找一个选择器片段（读-only，跨域表跳过）。 */
    function hasKitStyleRule(needle) {
        try {
            var sheets = document.styleSheets || [];
            for (var i = 0; i < sheets.length; i++) {
                var rules = null;
                try { rules = sheets[i].cssRules; } catch (e) { continue; }
                if (!rules) continue;
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    if (!rule) continue;
                    if (rule.selectorText && rule.selectorText.indexOf(needle) !== -1) return true;
                    /* 支持一层 @media / @supports 包裹 */
                    var inner = rule.cssRules;
                    if (inner && inner.length) {
                        for (var k = 0; k < inner.length; k++) {
                            if (inner[k] && inner[k].selectorText && inner[k].selectorText.indexOf(needle) !== -1) return true;
                        }
                    }
                }
            }
        } catch (e) { /* 样式表不可读就当没有 */ }
        return false;
    }

    /** 默认适配器下已存在的布局存档键（自定义 StorageAdapter 不在其中）。 */
    function collectPersistKeys() {
        var keys = [];
        try {
            var ls = (typeof window !== 'undefined') ? window.localStorage : null;
            if (!ls || typeof ls.key !== 'function') return keys;
            for (var i = 0; i < ls.length; i++) {
                var k = ls.key(i);
                if (k && k.indexOf('nvui_state_') === 0) keys.push(k);
            }
        } catch (e) { /* 隐私模式 / 配额受限：拿不到就当空 */ }
        return keys.sort();
    }

    function snapshotListenerCounts() {
        var out = {};
        var types = Object.keys(listenerCounts);
        for (var i = 0; i < types.length; i++) {
            var n = listenerCounts[types[i]];
            if (n > 0) out[types[i]] = n;
        }
        return out;
    }

    function diagnostics() {
        if (!isDomAvailable() || typeof document === 'undefined') {
            return { status: 'no-dom', version: VERSION, assets: null };
        }
        var cssVersion = '';
        var cssLoaded = false;
        try {
            cssVersion = String(getToken('--nvui-kit-version') || '').trim().replace(/^["']|["']$/g, '');
            cssLoaded = !!getToken('--nvui-glass-blur');
        } catch (e) { /* 令牌读不到就按未加载处理 */ }
        var fallback = false;
        try { fallback = document.documentElement.classList.contains(GLASS_FALLBACK_CLASS); } catch (e) {}
        var hostModals = 0;
        try { hostModals = countHostModals(); } catch (e) {}
        return {
            status: 'ok',
            version: VERSION,
            /* md5 只有发布产物 manifest.json 里才有，运行时算不出来 —— 保留键位避免下游读不到时报错 */
            assets: {
                tokensCss: { loaded: cssLoaded, kitVersion: cssVersion || null, md5: null },
                componentsCss: { loaded: hasKitStyleRule('.nvui-panel'), kitVersion: null, md5: null },
                nvuiApi: { loaded: true, kitVersion: VERSION, md5: null },
            },
            glass: {
                state: (glassState && glassState.state) || 'unknown',
                reason: (glassState && glassState.reason) || '',
                autoFallback: fallback,
            },
            hostModals: hostModals,
            escapeStackDepth: escapeStack.length,
            persistKeys: collectPersistKeys(),
            listenerCounts: snapshotListenerCounts(),
        };
    }

    /* ---------------------- 导出 ---------------------- */

    return {
        version: VERSION,
        VERSION: VERSION,
        PANEL_CLASS: PANEL_CLASS,
        config: config,
        classes: {
            panel: 'nvui-panel',
            overlayPanel: 'nvui-overlay is-panel',
            tabs: 'nvui-tabs',
            tab: 'nvui-tab',
            tabpane: 'nvui-tabpane',
            bottomNav: 'nvui-bottom-nav',
            bottomNavItem: 'nvui-bottom-nav-item',
            accordion: 'nvui-acc',
            switchRow: 'nvui-switch-row',
            inputRow: 'nvui-input-row',
            toast: 'nvui-toast',
        },
        getToken: getToken,
        invalidateTokenCache: invalidateTokenCache,
        setTheme: setTheme,
        selfCheck: selfCheck,
        diagnostics: diagnostics,
        checkCompatibility: checkCompatibility,
        migrateStateV1toV2: migrateStateV1toV2,
        defaults: DEFAULTS,
        detectGlassSupport: detectGlassSupport,
        syncGlassFallback: syncGlassFallback,
        countHostModals: countHostModals,
        syncHostModalState: syncHostModalState,
        getCarrierState: getCarrierState,
        openLayer: openLayer,
        closeLayer: closeLayer,
        switchRow: switchRow,
        inputRow: inputRow,
        accordion: accordion,
        progress: progress,
        createPanel: createPanel,
        showToast: showToast,
        clearLayoutState: clearLayoutState,
        clampPanelLayout: clampPanelLayout,
        defaultStorageAdapter: defaultStorageAdapter,
    };
});
