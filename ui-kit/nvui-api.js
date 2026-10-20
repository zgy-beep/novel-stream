/**
 * SillyTavern NVUI Kit · 可选运行时 API（零依赖）
 * ------------------------------------------------------------------
 * 版本：ui-kit v2.2.0（与 package.json / tokens.css / components.css 版本号保持一致）
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

    var VERSION = '2.3.0';
    var PANEL_CLASS = 'nvui-panel';
    var TOAST_LAYER_ID = 'nvui-api-toast-layer';

    /* ----------------------------- 工具 ----------------------------- */

    function isDomAvailable() {
        return typeof document !== 'undefined' && !!document.createElement;
    }

    function el(tag, className, attrs) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (attrs) {
            Object.keys(attrs).forEach(function (k) {
                var v = attrs[k];
                if (v === null || v === undefined) return;
                if (k === 'text') node.textContent = String(v);
                else if (k === 'html') node.innerHTML = String(v);
                else node.setAttribute(k, String(v));
            });
        }
        return node;
    }

    function append(parent, children) {
        (Array.isArray(children) ? children : [children]).forEach(function (c) {
            if (!c) return;
            parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return parent;
    }

    function iconNode(iconClass) {
        if (!iconClass) return null;
        if (typeof iconClass !== 'string') return iconClass;
        return el('i', iconClass, { 'aria-hidden': 'true' });
    }

    function on(target, type, handler, options) {
        target.addEventListener(type, handler, options || false);
        return handler;
    }

    function q(sel, scope) {
        return (scope || document).querySelector(sel);
    }

    /** 读取当前作用域里的设计令牌（CSS 自定义属性） */
    function getToken(name, scope) {
        if (!isDomAvailable()) return '';
        var host = scope || document.documentElement;
        return getComputedStyle(host).getPropertyValue(name).trim();
    }

    /** 主题/实心切换：仅切类名，不写死任何颜色 */
    function setTheme(theme, options) {
        var host = (options && options.host) || document.body;
        if (!host) return;
        host.classList.remove('nvui-theme-light');
        host.classList.remove('nvui-solid');
        if (theme === 'light') host.classList.add('nvui-theme-light');
        if (options && options.solid) host.classList.add('nvui-solid');
    }

    /* ---------------------- 浮层开合（top-layer 载体） ---------------------- */

    /**
     * 打开浮层：非模态 dialog.show()（避免 inert，遵守酒馆 transform 红线），
     * overlay.hidden=false 触发 CSS 进出场。
     */
    function openLayer(dialogEl, overlayEl) {
        if (!dialogEl || !overlayEl) return;
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
     * 关闭浮层：先加 .is-closing 播放退场动画，animationend（或 260ms 兜底）后 hidden + close。
     */
    function closeLayer(dialogEl, overlayEl, done) {
        if (!dialogEl || !overlayEl) return;
        if (overlayEl.hidden || overlayEl.classList.contains('is-closing')) return;
        overlayEl.classList.add('is-closing');
        var finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            overlayEl.hidden = true;
            overlayEl.classList.remove('is-closing');
            if (dialogEl.open) {
                try { dialogEl.close(); } catch (err) { dialogEl.removeAttribute('open'); }
            }
            if (typeof done === 'function') done();
        }
        on(overlayEl, 'animationend', finish, { once: true });
        setTimeout(finish, 260);
    }

    /* ---------------------- 标签指示器（粘连滑动） ---------------------- */

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

    /** 输入行：<label class="nvui-input-row"><input class="nvui-input"><span>…</span></label> */
    function inputRow(options) {
        var opts = options || {};
        var row = el('label', 'nvui-input-row');
        var input = el('input', 'nvui-input' + (opts.type === 'number' ? ' is-number' : (opts.type === 'path' ? ' is-path' : '')));
        input.type = opts.type === 'number' ? 'number' : 'text';
        if (opts.value !== undefined) input.value = opts.value;
        if (opts.placeholder) input.placeholder = opts.placeholder;
        if (opts.min !== undefined) input.min = opts.min;
        if (opts.max !== undefined) input.max = opts.max;
        if (opts.step !== undefined) input.step = opts.step;
        if (opts.disabled) input.disabled = true;
        var text = el('span', null, { text: opts.label || '' });
        row.appendChild(input);
        row.appendChild(text);
        if (typeof opts.onChange === 'function') {
            on(input, 'change', function () { opts.onChange(input.value); });
        }
        row.input = input;
        return row;
    }

    /** 折叠分组：button.nvui-acc-head + .nvui-acc-body > .nvui-acc-inner */
    function accordion(options) {
        var opts = options || {};
        var root = el('div', 'nvui-acc' + (opts.open ? ' is-open' : ''));
        var head = el('button', 'nvui-acc-head', { type: 'button', 'aria-expanded': opts.open ? 'true' : 'false' });
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
        };
        root.setSummary = function (text) { summary.textContent = text || ''; };
        return root;
    }

    /** 线性进度条：role=progressbar + .nvui-progress-bar（宽度由 API 设置） */
    function progress(options) {
        var opts = options || {};
        var track = el('div', 'nvui-progress', {
            role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(opts.value || 0),
        });
        if (opts.variant) track.classList.add('is-' + opts.variant);
        if (opts.indeterminate) track.classList.add('is-indeterminate');
        var bar = el('span', 'nvui-progress-bar');
        if (typeof opts.value === 'number' && !opts.indeterminate) bar.style.width = Math.max(0, Math.min(100, opts.value)) + '%';
        track.appendChild(bar);
        track.setValue = function (v) {
            var n = Math.max(0, Math.min(100, Number(v) || 0));
            bar.style.width = n + '%';
            track.setAttribute('aria-valuenow', String(n));
        };
        return track;
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
     */
    function createPanel(options) {
        var opts = options || {};
        var id = opts.id || ('nvui-panel-' + Date.now().toString(36));
        var opener = null;

        var dialog = el('dialog', 'nvui-tl', { id: id + '-layer', 'aria-label': (opts.title || '面板') + ' 浮层' });
        var overlay = el('div', 'nvui-overlay is-panel', { id: id + '-overlay', hidden: '' });
        var panel = el('div', 'nvui-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-title' });

        /* 手机拖拽把手（纯视觉） */
        panel.appendChild(el('div', 'nvui-sheet-handle', { 'aria-hidden': 'true' }));

        /* 标题栏 */
        var header = el('div', 'nvui-panel-header');
        var title = el('b', 'nvui-panel-title', { id: id + '-title', text: opts.title || '面板' });
        if (opts.version) title.appendChild(el('span', 'nvui-badge', { text: opts.version }));
        var actions = el('span', 'nvui-panel-actions');
        (opts.actions || []).forEach(function (a) {
            var btn = el('button', 'nvui-icon-btn', { type: 'button', 'aria-label': a.label || '操作' });
            var ic = iconNode(a.icon);
            if (ic) btn.appendChild(ic);
            if (typeof a.onClick === 'function') on(btn, 'click', a.onClick);
            actions.appendChild(btn);
        });
        var closeBtn = el('button', 'nvui-icon-btn', { type: 'button', 'aria-label': '关闭面板' });
        closeBtn.appendChild(el('i', 'fa-solid fa-xmark', { 'aria-hidden': 'true' }));
        actions.appendChild(closeBtn);
        append(header, [title, actions]);
        panel.appendChild(header);

        /* 标签导航 + 内容面板 */
        var tabsNav = null;
        var bottomNav = null;
        var panes = {};
        var tabs = opts.tabs || [];
        var active = opts.active || (tabs[0] && tabs[0].key);
        if (tabs.length) {
            tabsNav = el('nav', 'nvui-tabs', { role: 'tablist', 'aria-label': '面板分区' });
            tabsNav.appendChild(el('span', 'nvui-tabs-indicator', { 'aria-hidden': 'true' }));
            tabs.forEach(function (t, index) {
                var tab = el('button', 'nvui-tab' + (t.key === active ? ' is-active' : ''), {
                    type: 'button', role: 'tab', id: id + '-tab-' + t.key,
                    'aria-selected': t.key === active ? 'true' : 'false',
                    'aria-controls': id + '-pane-' + t.key,
                    tabindex: t.key === active ? '0' : '-1',
                });
                var ic = iconNode(t.icon);
                if (ic) tab.appendChild(ic);
                tab.appendChild(document.createTextNode(t.label || t.key));
                on(tab, 'click', function () { setTab(t.key); });
                tabsNav.appendChild(tab);
            });
            panel.appendChild(tabsNav);
        }

        var body = el('div', 'nvui-panel-body');
        panes = {};
        tabs.forEach(function (t) {
            var pane = el('div', 'nvui-tabpane' + (t.key === active ? ' is-active' : ''), {
                role: 'tabpanel', id: id + '-pane-' + t.key, 'aria-labelledby': id + '-tab-' + t.key,
            });
            panes[t.key] = pane;
            body.appendChild(pane);
        });
        panel.appendChild(body);

        /* 可选底部操作区 */
        if (opts.footer && opts.footer.length) {
            var footer = el('div', 'nvui-panel-footer');
            opts.footer.forEach(function (b) {
                var btn = el('button', 'nvui-btn' + (b.variant ? ' is-' + b.variant : ''), { type: 'button', text: b.label || '' });
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
                var item = el('button', 'nvui-bottom-nav-item' + (t.key === active ? ' is-active' : ''), {
                    type: 'button', 'aria-label': t.label || t.key,
                });
                if (t.key === active) item.setAttribute('aria-current', 'page');
                var ic = iconNode(t.icon);
                if (ic) item.appendChild(ic);
                item.appendChild(el('span', null, { text: t.label || t.key }));
                on(item, 'click', function () { setTab(t.key); });
                bottomNav.appendChild(item);
            });
            panel.appendChild(bottomNav);
        }

        append(overlay, panel);
        dialog.appendChild(overlay);
        (opts.mount || document.body).appendChild(dialog);

        function setTab(key) {
            if (!panes[key]) return;
            active = key;
            if (tabsNav) {
                Array.prototype.forEach.call(tabsNav.querySelectorAll('.nvui-tab'), function (tab) {
                    var on_ = tab.id === id + '-tab-' + key;
                    tab.classList.toggle('is-active', on_);
                    tab.setAttribute('aria-selected', on_ ? 'true' : 'false');
                    tab.setAttribute('tabindex', on_ ? '0' : '-1');
                });
                syncTabsIndicator(tabsNav, true);
            }
            if (bottomNav) {
                Array.prototype.forEach.call(bottomNav.querySelectorAll('.nvui-bottom-nav-item'), function (item, index) {
                    var on_ = tabs[index] && tabs[index].key === key;
                    item.classList.toggle('is-active', on_);
                    if (on_) item.setAttribute('aria-current', 'page');
                    else item.removeAttribute('aria-current');
                });
            }
            Object.keys(panes).forEach(function (k) {
                panes[k].classList.toggle('is-active', k === key);
            });
        }

        function focusBody() {
            var target = q('.nvui-btn.is-primary', panel) || closeBtn;
            if (target && typeof target.focus === 'function') {
                requestAnimationFrame(function () { target.focus(); });
            }
        }

        function openPanel() {
            opener = document.activeElement;
            overlay.classList.remove('is-closing');
            openLayer(dialog, overlay);
            focusBody();
            if (tabsNav) {
                setTimeout(function () { syncTabsIndicator(tabsNav, false); }, 0);
            }
        }

        function closePanel() {
            closeLayer(dialog, overlay, function () {
                if (opener && typeof opener.focus === 'function') opener.focus();
                opener = null;
                if (typeof opts.onClose === 'function') opts.onClose();
            });
        }

        on(closeBtn, 'click', closePanel);
        on(overlay, 'click', function (event) { if (event.target === overlay) closePanel(); });
        on(document, 'keydown', function (event) {
            if (event.key === 'Escape' && !overlay.hidden) closePanel();
        });

        function addNode(key, node) {
            var pane = panes[key] || panes[active] || body;
            append(pane, node);
            return node;
        }

        return {
            id: id,
            dialog: dialog,
            overlay: overlay,
            panel: panel,
            body: body,
            tabs: tabsNav,
            bottomNav: bottomNav,
            open: openPanel,
            close: closePanel,
            setTab: setTab,
            syncIndicator: function () { if (tabsNav) syncTabsIndicator(tabsNav, false); },
            addNode: addNode,
            addSwitch: function (key, o) { return addNode(key, switchRow(o)); },
            addInput: function (key, o) { return addNode(key, inputRow(o)); },
            addAccordion: function (key, o) { return addNode(key, accordion(o)); },
            addProgress: function (key, o) { return addNode(key, progress(o)); },
            addSectionTitle: function (key, text) { return addNode(key, el('div', 'nvui-section-title', { text: text })); },
        };
    }

    /* ---------------------- 吐司 ---------------------- */

    function ensureToastLayer() {
        var layer = document.getElementById(TOAST_LAYER_ID);
        if (layer) return layer;
        var dialog = el('dialog', 'nvui-tl', { id: TOAST_LAYER_ID, 'aria-label': '通知层' });
        var stack = el('div', 'nvui-toast-stack');
        dialog.appendChild(stack);
        document.body.appendChild(dialog);
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
        var layer = ensureToastLayer();
        var stack = q('.nvui-toast-stack', layer);
        var toast = el('div', 'nvui-toast' + (opts.type ? ' is-' + opts.type : ''), { role: 'status' });
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
            function done() {
                if (removed) return;
                removed = true;
                if (toast.parentNode) toast.parentNode.removeChild(toast);
                if (stack && !stack.querySelector('.nvui-toast')) {
                    layer.hidden = true;
                    if (layer.open) {
                        try { layer.close(); } catch (err) { layer.removeAttribute('open'); }
                    }
                }
            }
            on(toast, 'animationend', done, { once: true });
            setTimeout(done, 260);
        }

        if (opts.duration !== 0) {
            timer = setTimeout(dismiss, typeof opts.duration === 'number' ? opts.duration : 3200);
        }
        return { element: toast, dismiss: dismiss };
    }

    /* ---------------------- 导出 ---------------------- */

    return {
        version: VERSION,
        VERSION: VERSION,
        PANEL_CLASS: PANEL_CLASS,
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
        setTheme: setTheme,
        openLayer: openLayer,
        closeLayer: closeLayer,
        switchRow: switchRow,
        inputRow: inputRow,
        accordion: accordion,
        progress: progress,
        createPanel: createPanel,
        showToast: showToast,
    };
});
