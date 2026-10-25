/**
 * REA for DeepSeek Harness — Client half.
 *
 * Registers one entry in the left sidebar (`sidebar.panellist`) and the panel
 * it opens (`main`). The panel reads live status from the Host route
 * `/plugins/rea/status`; it never talks to the REA server itself.
 */

window.__ModuleLoader__.load({
  id: '@axyatech/dsh-plugin-rea',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'rea.panel'
    const STATUS_PATH = '/plugins/rea/status'
    const REFRESH_MS = 30_000
    const MAX_RENDERED_TOOLS = 400

    /* --------------------------------------------------------------- copy */

    const en = {
      panel: 'REA',
      title: 'Reverse Engineer Anything',
      subtitle: 'Analyze shipped binaries, apps, packages, and pages with evidence.',
      'status.ready': 'Ready',
      'status.starting': 'Starting',
      'status.offline': 'Offline',
      'status.attention': 'Needs attention',
      'action.refresh': 'Refresh',
      'action.refreshing': 'Refreshing…',
      'action.retry': 'Retry',
      'action.copy': 'Copy',
      'action.copied': 'Copied',
      'section.server': 'MCP server',
      'section.serverSub': 'The server this plugin registers with DeepSeek Harness.',
      'section.workflow': 'Workflow skill',
      'section.workflowSub': 'Instructions the agent loads when a task calls for REA.',
      'section.engines': 'Analysis engines',
      'section.enginesSub': 'Local tools REA can use, audited by `rea doctor`.',
      'section.tools': 'Tool catalog',
      'section.toolsSub': 'Every REA tool currently visible to the agent.',
      'section.start': 'Quick start',
      'section.startSub': 'Paste a prompt into a chat to try REA.',
      'section.commands': 'Commands',
      'section.commandsSub': 'The same setup for a terminal or another agent.',
      'row.connection': 'Connection',
      'row.connected': 'Connected · {count} tools',
      'row.waiting': 'Waiting for the server',
      'row.namespace': 'Namespace',
      'row.tools': 'Registered tools',
      'row.package': 'Package',
      'row.launcher': 'Audit launcher',
      'row.skill': 'Skill',
      'row.expectedSkill': 'Expected version',
      'row.node': 'Node.js',
      'row.platform': 'Platform',
      'row.lastChecked': 'Last checked',
      'row.envSource': 'Audit environment',
      'value.notInstalled': 'Not installed',
      'value.notReported': 'Not reported',
      'value.fromBundle': 'Bundled with this plugin',
      'value.fromPackage': 'From the installed REA package',
      'value.fromEnvFile': "REA's managed environment",
      'value.fromProcess': 'Harness process environment',
      'tools.search': 'Search {count} tools',
      'tools.empty': 'No tools match this search.',
      'tools.none': 'No REA tools are registered yet. The first launch may still be downloading the server — refresh in a moment.',
      'engines.empty': 'REA did not report any readiness checks.',
      'engines.healthy': 'Ready',
      'engines.missing': 'Not configured',
      'engines.drift': 'Configuration drift',
      'engines.failed': 'Check failed',
      'engines.note': 'Analysis engines are optional. Static JavaScript, .NET, artifact, and browser analysis work without them.',
      'engine.node': 'Node.js',
      'engine.host': 'Host',
      'engine.hopper': 'Hopper',
      'engine.ghidra': 'Ghidra',
      'engine.ida': 'IDA',
      'engine.jadx': 'JADX',
      'engine.kuna': 'Kuna',
      'skill.note': 'This plugin supplies the workflow so a fresh install needs no separate skill setup. When an installed REA package ships a newer skill, that copy is used instead.',
      'skill.aligned': 'Aligned with the server',
      'skill.mismatch': 'The server expects version {expected}; the provided copy is {installed}.',
      'skill.copies': 'Copies for other agents are out of date. Refresh them with `npx rea-agents setup --skill` if you use them.',
      'start.prompt1': 'Explain how search works in a shipped app, and show the evidence.',
      'start.prompt2': 'Compare two builds of this Electron app and list the behavior that changed.',
      'start.prompt3': 'Decompile this .NET method and reconstruct the interface it implements.',
      'commands.setup': 'Install the workflow for other agents',
      'commands.doctor': 'Audit the local toolchain',
      'commands.mcp': 'Run the MCP server manually',
      'footer.note': 'REA runs locally. Analysis engines and commercial tools keep their own licenses.',
      'footer.github': 'GitHub',
      'footer.docs': 'REA documentation',
      loading: 'Reading REA status…',
      'error.title': 'Could not read REA status',
      'error.hint': 'The Harness Host did not answer. Reopen this panel, or restart Harness after installing the plugin.',
      'error.http': 'Request failed ({status}).',
      'date.justNow': 'just now',
      'date.seconds': '{count}s ago',
      'date.minutes': '{count} min ago',
    }

    const zh = {
      panel: 'REA',
      title: '逆向工程任意目标',
      subtitle: '基于证据分析已发布的二进制、应用、安装包与网页。',
      'status.ready': '就绪',
      'status.starting': '启动中',
      'status.offline': '未连接',
      'status.attention': '需要处理',
      'action.refresh': '刷新',
      'action.refreshing': '正在刷新…',
      'action.retry': '重试',
      'action.copy': '复制',
      'action.copied': '已复制',
      'section.server': 'MCP 服务',
      'section.serverSub': '本插件在 DeepSeek Harness 中注册的服务。',
      'section.workflow': '工作流技能',
      'section.workflowSub': '任务需要 REA 时，Agent 加载的说明。',
      'section.engines': '分析引擎',
      'section.enginesSub': 'REA 可用的本地工具，由 `rea doctor` 检查。',
      'section.tools': '工具目录',
      'section.toolsSub': 'Agent 当前可见的全部 REA 工具。',
      'section.start': '快速开始',
      'section.startSub': '把下面的提示词粘贴到会话中即可试用。',
      'section.commands': '命令',
      'section.commandsSub': '在终端或其他 Agent 中完成同样的配置。',
      'row.connection': '连接',
      'row.connected': '已连接 · {count} 个工具',
      'row.waiting': '正在等待服务',
      'row.namespace': '命名空间',
      'row.tools': '已注册工具',
      'row.package': '软件包',
      'row.launcher': '检查方式',
      'row.skill': '技能',
      'row.expectedSkill': '期望版本',
      'row.node': 'Node.js',
      'row.platform': '平台',
      'row.lastChecked': '上次检查',
      'row.envSource': '检查环境',
      'value.notInstalled': '未安装',
      'value.notReported': '未报告',
      'value.fromBundle': '随本插件提供',
      'value.fromPackage': '来自已安装的 REA 包',
      'value.fromEnvFile': 'REA 管理的环境',
      'value.fromProcess': 'Harness 进程环境',
      'tools.search': '搜索 {count} 个工具',
      'tools.empty': '没有匹配的工具。',
      'tools.none': '尚未注册 REA 工具。首次启动可能仍在下载服务，请稍后刷新。',
      'engines.empty': 'REA 未返回任何就绪检查。',
      'engines.healthy': '可用',
      'engines.missing': '未配置',
      'engines.drift': '配置漂移',
      'engines.failed': '检查失败',
      'engines.note': '分析引擎是可选的。静态 JavaScript、.NET、制品与浏览器分析无需引擎即可使用。',
      'engine.node': 'Node.js',
      'engine.host': '主机',
      'engine.hopper': 'Hopper',
      'engine.ghidra': 'Ghidra',
      'engine.ida': 'IDA',
      'engine.jadx': 'JADX',
      'engine.kuna': 'Kuna',
      'skill.note': '本插件自带工作流，因此全新安装无需单独配置技能。若已安装的 REA 包提供更新的技能，则优先使用该副本。',
      'skill.aligned': '与服务一致',
      'skill.mismatch': '服务期望版本 {expected}，当前提供的副本为 {installed}。',
      'skill.copies': '面向其他 Agent 的技能副本已过期；如需使用，可运行 `npx rea-agents setup --skill` 更新。',
      'start.prompt1': '解释已发布应用中的搜索是如何实现的，并给出证据。',
      'start.prompt2': '比较这个 Electron 应用的两个构建，列出行为差异。',
      'start.prompt3': '反编译这个 .NET 方法，并还原它实现的接口。',
      'commands.setup': '为其他 Agent 安装工作流',
      'commands.doctor': '检查本地工具链',
      'commands.mcp': '手动运行 MCP 服务',
      'footer.note': 'REA 完全在本地运行。分析引擎与商业工具遵循各自的许可。',
      'footer.github': 'GitHub',
      'footer.docs': 'REA 文档',
      loading: '正在读取 REA 状态…',
      'error.title': '无法读取 REA 状态',
      'error.hint': 'Harness Host 未响应。请重新打开本面板，或在安装插件后重启 Harness。',
      'error.http': '请求失败（{status}）。',
      'date.justNow': '刚刚',
      'date.seconds': '{count} 秒前',
      'date.minutes': '{count} 分钟前',
    }

    /* ---------------------------------------------------------------- css */

    const CSS = `
.rea-page{width:100%;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.6}
.rea-page *{box-sizing:border-box}
.rea-scroll{flex:1;min-width:0;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}
.rea-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 56px}
.rea-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px 24px;padding-top:28px;margin-bottom:22px}
[data-platform="darwin"] .rea-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}
.rea-brand{display:flex;align-items:flex-start;gap:12px;min-width:0}
.rea-mark{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:11px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.rea-brand h1{margin:0;font-size:20px;font-weight:500;line-height:28px}
.rea-brand p{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.rea-heading-actions{display:flex;align-items:center;gap:8px;flex:none;padding-top:5px}
.rea-pill{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 11px;border-radius:14px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;white-space:nowrap}
.rea-pill-success{color:var(--dsw-alias-state-success-primary)}
.rea-pill-warn{color:var(--dsw-alias-state-warn-primary)}
.rea-pill-error{color:var(--dsw-alias-state-error-primary)}
.rea-dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none;display:inline-block}
.rea-pill .rea-dot{background:currentColor}
.rea-btn{height:28px;padding:0 11px;display:inline-flex;align-items:center;gap:6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}
.rea-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.rea-btn:focus-visible,.rea-copy:focus-visible,.rea-link:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
.rea-btn:disabled{opacity:.55;cursor:default}
.rea-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;margin-bottom:16px}
.rea-grid-even{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.rea-card{min-width:0;border:.5px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);padding:16px 18px;margin-bottom:16px}
.rea-grid .rea-card{margin-bottom:0}
.rea-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.rea-card h2{margin:0;font-size:14px;font-weight:500;line-height:22px}
.rea-card-sub{margin:2px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}
.rea-card-aside{flex:none;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}
.rea-rows{margin-top:4px}
.rea-row{display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-top:.5px solid var(--dsw-alias-border-l1)}
.rea-row:first-child{border-top:0;padding-top:2px}
.rea-row-label{flex:0 0 128px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.rea-row-value{flex:1;min-width:0;font-size:13px;line-height:20px;overflow-wrap:anywhere}
.rea-row-sub{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.rea-inline{display:flex;align-items:flex-start;gap:7px;min-width:0}
.rea-inline .rea-dot{margin-top:7px}
.rea-mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:12px;line-height:19px}
.rea-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:19px;margin:8px 0 0}
.rea-warn{color:var(--dsw-alias-state-warn-primary)}
.rea-checks{display:flex;flex-direction:column;margin-top:2px}
.rea-check{padding:9px 0;border-top:.5px solid var(--dsw-alias-border-l1)}
.rea-check:first-child{border-top:0;padding-top:2px}
.rea-check-head{display:flex;align-items:center;gap:8px;min-width:0}
.rea-check-name{font-size:13px;line-height:20px;font-weight:500;flex:1;min-width:0}
.rea-badge{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;white-space:nowrap}
.rea-check-detail{margin:3px 0 0 15px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.rea-check-fix{margin:4px 0 0 15px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.rea-dot-success{color:var(--dsw-alias-state-success-primary);background:currentColor}
.rea-dot-warn{color:var(--dsw-alias-state-warn-primary);background:currentColor}
.rea-dot-error{color:var(--dsw-alias-state-error-primary);background:currentColor}
.rea-dot-idle{color:var(--dsw-alias-state-idle-primary);background:currentColor}
.rea-dot-pending{color:var(--dsw-alias-state-warn-primary);background:currentColor}
.rea-search{display:flex;align-items:center;gap:8px;height:34px;margin-top:10px;padding:0 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:10px;color:var(--dsw-alias-label-secondary)}
.rea-search:focus-within{border-color:var(--dsw-alias-state-business-primary)}
.rea-search input{flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.rea-search input::placeholder{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary))}
.rea-tool-list{margin-top:10px;max-height:272px;overflow:auto;border-top:.5px solid var(--dsw-alias-border-l1);--dsh-scrollbar-width:9px}
.rea-tool{display:flex;align-items:flex-start;gap:14px;padding:7px 0;border-bottom:.5px solid var(--dsw-alias-border-l1)}
.rea-tool:last-child{border-bottom:0}
.rea-tool-name{flex:0 0 228px;font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.rea-tool-desc{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.rea-prompt{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:9px 0;border-top:.5px solid var(--dsw-alias-border-l1)}
.rea-prompt:first-of-type{border-top:0;padding-top:2px}
.rea-prompt p{margin:0;flex:1;min-width:0;font-size:13px;line-height:20px}
.rea-cmd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:8px 10px;margin-top:8px;border-radius:10px;background:var(--dsw-alias-bg-layer-2)}
.rea-cmd:first-of-type{margin-top:2px}
.rea-cmd-body{min-width:0;flex:1}
.rea-cmd code{display:block;font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:12px;line-height:18px;overflow-wrap:anywhere}
.rea-cmd span{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.rea-copy{flex:none;height:24px;padding:0 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:16px;cursor:pointer}
.rea-copy:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rea-note{margin:12px 0 0;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.rea-footer{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;margin-top:22px;padding-top:16px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.rea-footer p{margin:0}
.rea-links{display:flex;align-items:center;gap:8px;flex:none}
.rea-link{color:var(--dsw-alias-label-secondary);text-decoration:none}
.rea-link:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}
.rea-sep{opacity:.5}
.rea-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;min-height:320px;padding:48px 24px;color:var(--dsw-alias-label-tertiary)}
.rea-empty h2{margin:0;font-size:14px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.rea-empty p{margin:0;max-width:420px;font-size:13px;line-height:20px}
.rea-skeleton{height:12px;border-radius:6px;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l1);animation:rea-pulse 1.4s ease-in-out infinite}
.rea-skeleton-card{height:104px;border-radius:16px;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l1);animation:rea-pulse 1.4s ease-in-out infinite;margin-bottom:16px}
@keyframes rea-pulse{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.rea-skeleton,.rea-skeleton-card{animation:none}}
@media (width<=860px){.rea-grid,.rea-grid-even{grid-template-columns:1fr}.rea-row{flex-direction:column;gap:2px}.rea-row-label{flex:none}.rea-tool{flex-direction:column;gap:2px}.rea-tool-name{flex:none}.rea-heading-actions{padding-top:0}}
`

    /* --------------------------------------------------------- components */

    function Mark({ size = 24 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M12 2.9 20 7.3v9.4L12 21.1 4 16.7V7.3L12 2.9Z',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M8.2 9.4h7.6M8.2 12h4.9M8.2 14.6h7.6',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 16.6, cy: 12, r: 1.15, fill: 'currentColor' }),
      )
    }

    function StatusDot({ tone }) {
      return h('span', { className: `rea-dot rea-dot-${tone}`, 'aria-hidden': true })
    }

    function StatusPill({ tone, children }) {
      return h('span', { className: `rea-pill rea-pill-${tone}` }, h(StatusDot, { tone }), children)
    }

    function Card({ title, subtitle, aside, children }) {
      return h(
        'section',
        { className: 'rea-card' },
        h(
          'header',
          { className: 'rea-card-head' },
          h('div', null, h('h2', null, title), subtitle === undefined ? null : h('p', { className: 'rea-card-sub' }, subtitle)),
          aside === undefined ? null : h('div', { className: 'rea-card-aside' }, aside),
        ),
        children,
      )
    }

    function Row({ label, value, tone, mono, hint }) {
      return h(
        'div',
        { className: 'rea-row' },
        h('div', { className: 'rea-row-label' }, label),
        h(
          'div',
          { className: 'rea-row-value' },
          h(
            'div',
            { className: mono === true ? 'rea-inline rea-mono' : 'rea-inline' },
            tone === undefined ? null : h(StatusDot, { tone }),
            h('span', null, value),
          ),
          hint === undefined ? null : h('div', { className: 'rea-row-sub' }, hint),
        ),
      )
    }

    function CopyButton({ text, label, copiedLabel }) {
      const [copied, setCopied] = React.useState(false)
      const timer = React.useRef(0)
      React.useEffect(() => () => window.clearTimeout(timer.current), [])
      return h(
        'button',
        {
          type: 'button',
          className: 'rea-copy',
          title: text,
          onClick: async () => {
            if (!(await copyText(text))) return
            setCopied(true)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), 1600)
          },
        },
        copied ? copiedLabel : label,
      )
    }

    function EngineCheck({ check, t }) {
      const tone = checkTone(check)
      return h(
        'div',
        { className: 'rea-check' },
        h(
          'div',
          { className: 'rea-check-head' },
          h(StatusDot, { tone }),
          h('span', { className: 'rea-check-name' }, engineLabel(check.name, t)),
          h('span', { className: 'rea-badge' }, toneLabel(tone, t)),
        ),
        check.detail === null ? null : h('div', { className: 'rea-check-detail' }, check.detail),
        check.ok === true || check.remediation === null ? null : h('div', { className: 'rea-check-fix' }, check.remediation),
      )
    }

    function ToolList({ tools, t }) {
      const [query, setQuery] = React.useState('')
      const needle = query.trim().toLowerCase()
      const matches = React.useMemo(() => {
        const source = needle.length === 0 ? tools : tools.filter((tool) => `${tool.name} ${tool.description}`.toLowerCase().includes(needle))
        return source.slice(0, MAX_RENDERED_TOOLS)
      }, [tools, needle])

      if (tools.length === 0) return h('p', { className: 'rea-muted' }, t('tools.none'))

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'rea-search' },
          h(
            'svg',
            { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
            h('circle', { cx: 11, cy: 11, r: 6.4, stroke: 'currentColor', strokeWidth: 1.6 }),
            h('path', { d: 'm16 16 5 5', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }),
          ),
          h('input', {
            type: 'search',
            value: query,
            placeholder: t('tools.search', { count: tools.length }),
            'aria-label': t('tools.search', { count: tools.length }),
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        matches.length === 0
          ? h('p', { className: 'rea-muted' }, t('tools.empty'))
          : h(
              'div',
              { className: 'rea-tool-list' },
              matches.map((tool) =>
                h(
                  'div',
                  { className: 'rea-tool', key: tool.name },
                  h('span', { className: 'rea-tool-name' }, tool.name),
                  h('span', { className: 'rea-tool-desc' }, tool.description),
                ),
              ),
            ),
      )
    }

    function ReaPage(props) {
      const { t = (key) => key } = props
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(true)
      const [loadedAt, setLoadedAt] = React.useState(0)
      const [now, setNow] = React.useState(() => Date.now())
      const alive = React.useRef(true)

      const load = React.useCallback(async (fresh) => {
        setBusy(true)
        try {
          const response = await fetch(fresh ? `${STATUS_PATH}?fresh=1` : STATUS_PATH, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          })
          if (!response.ok) {
            throw new Error(t('error.http', { status: response.status }))
          }
          const payload = await response.json()
          if (!alive.current) return
          setData(payload)
          setError(null)
          setLoadedAt(Date.now())
        } catch (cause) {
          if (!alive.current) return
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          if (alive.current) setBusy(false)
        }
      }, [t])

      React.useEffect(() => {
        alive.current = true
        void load(false)
        const refresh = window.setInterval(() => {
          if (document.visibilityState === 'visible') void load(false)
        }, REFRESH_MS)
        const tick = window.setInterval(() => setNow(Date.now()), 30_000)
        const onVisibility = () => {
          if (document.visibilityState === 'visible') void load(false)
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          alive.current = false
          window.clearInterval(refresh)
          window.clearInterval(tick)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [load])

      if (data === null && error !== null) {
        return h(
          'section',
          { className: 'rea-page', 'aria-label': t('panel') },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          h(
            'div',
            { className: 'rea-scroll' },
            h(
              'div',
              { className: 'rea-content' },
              h(
                'div',
                { className: 'rea-empty' },
                h(Mark, { size: 32 }),
                h('h2', null, t('error.title')),
                h('p', { role: 'alert' }, error),
                h('p', null, t('error.hint')),
                h(
                  'button',
                  { type: 'button', className: 'rea-btn', onClick: () => void load(true), disabled: busy },
                  busy ? t('action.refreshing') : t('action.retry'),
                ),
              ),
            ),
          ),
        )
      }

      if (data === null) {
        return h(
          'section',
          { className: 'rea-page', 'aria-label': t('panel') },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          h(
            'div',
            { className: 'rea-scroll' },
            h(
              'div',
              { className: 'rea-content' },
              h('div', { className: 'rea-heading' }, h('div', { className: 'rea-brand' }, h('span', { className: 'rea-mark' }, h(Mark, { size: 22 })), h('div', null, h('h1', null, t('title')), h('p', null, t('loading'))))),
              h('div', { className: 'rea-skeleton-card' }),
              h('div', { className: 'rea-grid' }, h('div', { className: 'rea-skeleton-card', style: { marginBottom: 0 } }), h('div', { className: 'rea-skeleton-card', style: { marginBottom: 0 } })),
            ),
          ),
        )
      }

      const mcp = data.mcp
      const doctor = data.doctor
      const rea = data.rea
      const identity = doctor.identity
      const checks = doctor.checks || []
      const engineChecks = checks.filter((check) => check.name !== 'node' && check.name !== 'host')
      const nodeCheck = checks.find((check) => check.name === 'node')
      const status = overallStatus(data)
      const skillVersion = rea.skill.found ? rea.skill.version : null
      const expectedSkill = identity === null ? null : identity.expectedSkillVersion
      const skillBehind = skillVersion !== null && expectedSkill !== null && compareVersion(skillVersion, expectedSkill) < 0
      const staleCopies = (doctor.skillCopies || []).filter((copy) => copy.ok !== true).length
      const skillSource = rea.skill.source === 'installed' ? t('value.fromPackage') : rea.skill.source === 'bundled' ? t('value.fromBundle') : t('value.notReported')
      const toolCount = mcp.toolCount
      const nodeVersion = nodeCheck !== undefined && nodeCheck.detail !== null ? nodeCheck.detail : data.runtime.node
      const platformHint = `${data.runtime.platform} · ${data.runtime.arch}`
      const nodeHint = nodeCheck !== undefined && nodeCheck.ok === false && typeof nodeCheck.remediation === 'string' ? `${platformHint} — ${nodeCheck.remediation}` : platformHint

      return h(
        'section',
        { className: 'rea-page', 'aria-label': t('panel') },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'div',
          { className: 'rea-scroll' },
          h(
            'div',
            { className: 'rea-content' },
            h(
              'header',
              { className: 'rea-heading' },
              h(
                'div',
                { className: 'rea-brand' },
                h('span', { className: 'rea-mark' }, h(Mark, { size: 22 })),
                h('div', null, h('h1', null, t('title')), h('p', null, t('subtitle'))),
              ),
              h(
                'div',
                { className: 'rea-heading-actions' },
                h(StatusPill, { tone: status.tone }, t(status.key)),
                h(
                  'button',
                  { type: 'button', className: 'rea-btn', onClick: () => void load(true), disabled: busy },
                  busy ? t('action.refreshing') : t('action.refresh'),
                ),
              ),
            ),

            h(
              'div',
              { className: 'rea-grid' },
              h(
                Card,
                { title: t('section.server'), subtitle: t('section.serverSub') },
                h(
                  'div',
                  { className: 'rea-rows' },
                  h(Row, {
                    label: t('row.connection'),
                    tone: mcp.connected ? 'success' : doctor.state === 'error' ? 'error' : 'pending',
                    value: mcp.connected ? t('row.connected', { count: toolCount }) : t('row.waiting'),
                  }),
                  h(Row, { label: t('row.namespace'), value: mcp.namespace, mono: true }),
                  h(Row, {
                    label: t('row.package'),
                    value: rea.found ? `rea-agents ${rea.version}` : t('value.notInstalled'),
                    mono: rea.found,
                    hint: rea.found ? rea.root : undefined,
                  }),
                  h(Row, { label: t('row.node'), value: nodeVersion, hint: nodeHint }),
                  h(Row, {
                    label: t('row.launcher'),
                    value: doctor.via === null ? t('value.notReported') : doctor.via,
                    mono: doctor.via !== null,
                  }),
                  h(Row, {
                    label: t('row.lastChecked'),
                    value: loadedAt === 0 ? t('date.justNow') : formatAge(now - loadedAt, t),
                    hint: doctor.envSource === 'rea-environment' ? t('value.fromEnvFile') : t('value.fromProcess'),
                  }),
                ),
              ),
              h(
                Card,
                { title: t('section.workflow'), subtitle: t('section.workflowSub') },
                h(
                  'div',
                  { className: 'rea-rows' },
                  h(Row, {
                    label: t('row.skill'),
                    tone: rea.skill.found ? 'success' : 'warn',
                    value: rea.skill.found ? `v${skillVersion ?? '?'}` : t('value.notInstalled'),
                    hint: rea.skill.found ? `${rea.skill.name} · ${skillSource}` : undefined,
                  }),
                  h(Row, {
                    label: t('row.expectedSkill'),
                    value: expectedSkill === null ? t('value.notReported') : expectedSkill,
                    hint: skillBehind ? undefined : t('skill.aligned'),
                  }),
                  h(
                    'p',
                    { className: skillBehind ? 'rea-note rea-warn' : 'rea-note' },
                    skillBehind ? t('skill.mismatch', { expected: expectedSkill, installed: skillVersion }) : t('skill.note'),
                  ),
                  staleCopies === 0 ? null : h('p', { className: 'rea-note rea-warn' }, t('skill.copies', { count: staleCopies })),
                ),
              ),
            ),

            h(
              Card,
              {
                title: t('section.engines'),
                subtitle: t('section.enginesSub'),
                aside: h(CopyButton, { text: 'npx rea-agents doctor', label: t('action.copy'), copiedLabel: t('action.copied') }),
              },
              doctor.state === 'error'
                ? h(
                    'div',
                    { className: 'rea-checks' },
                    h('p', { className: 'rea-muted', role: 'alert' }, doctor.error ?? t('section.enginesSub')),
                    h(
                      'p',
                      { className: 'rea-muted' },
                      h(
                        'button',
                        { type: 'button', className: 'rea-btn', onClick: () => void load(true), disabled: busy },
                        t('action.retry'),
                      ),
                    ),
                  )
                : engineChecks.length === 0
                  ? h('p', { className: 'rea-muted' }, t('engines.empty'))
                  : h('div', { className: 'rea-checks' }, engineChecks.map((check) => h(EngineCheck, { key: check.name, check, t }))),
              h('p', { className: 'rea-note' }, t('engines.note')),
            ),

            h(
              Card,
              {
                title: t('section.tools'),
                subtitle: t('section.toolsSub'),
                aside: mcp.connected ? `${toolCount}` : undefined,
              },
              h(ToolList, { tools: mcp.tools, t }),
            ),

            h(
              'div',
              { className: 'rea-grid rea-grid-even' },
              h(
                Card,
                { title: t('section.start'), subtitle: t('section.startSub') },
                ['start.prompt1', 'start.prompt2', 'start.prompt3'].map((key) =>
                  h(
                    'div',
                    { className: 'rea-prompt', key },
                    h('p', null, t(key)),
                    h(CopyButton, { text: t(key), label: t('action.copy'), copiedLabel: t('action.copied') }),
                  ),
                ),
              ),
              h(
                Card,
                { title: t('section.commands'), subtitle: t('section.commandsSub') },
                [
                  ['npx rea-agents setup --skill', 'commands.setup'],
                  ['npx rea-agents doctor', 'commands.doctor'],
                  ['npx rea-agents@6.8.0 mcp', 'commands.mcp'],
                ].map(([command, label]) =>
                  h(
                    'div',
                    { className: 'rea-cmd', key: command },
                    h('div', { className: 'rea-cmd-body' }, h('code', null, command), h('span', null, t(label))),
                    h(CopyButton, { text: command, label: t('action.copy'), copiedLabel: t('action.copied') }),
                  ),
                ),
              ),
            ),

            h(
              'footer',
              { className: 'rea-footer' },
              h('p', null, t('footer.note')),
              h(
                'div',
                { className: 'rea-links' },
                h('a', { className: 'rea-link', href: 'https://github.com/morluto/rea', target: '_blank', rel: 'noreferrer' }, t('footer.github')),
                h('span', { className: 'rea-sep' }, '·'),
                h('a', { className: 'rea-link', href: 'https://rea.tools/', target: '_blank', rel: 'noreferrer' }, t('footer.docs')),
              ),
            ),
          ),
        ),
      )
    }

    function ReaIcon({ size = 20 }) {
      return h(Mark, { size })
    }

    /* ------------------------------------------------------------- helpers */

    function overallStatus(data) {
      if (data.mcp.connected) return { tone: 'success', key: 'status.ready' }
      if (data.doctor.state === 'error') return { tone: 'error', key: 'status.offline' }
      return { tone: 'warn', key: 'status.starting' }
    }

    function checkTone(check) {
      if (check.ok === true) return 'success'
      const classification = typeof check.classification === 'string' ? check.classification : ''
      if (classification.includes('missing')) return 'idle'
      if (classification.includes('drift')) return 'warn'
      return 'error'
    }

    function toneLabel(tone, t) {
      if (tone === 'success') return t('engines.healthy')
      if (tone === 'warn') return t('engines.drift')
      if (tone === 'idle') return t('engines.missing')
      return t('engines.failed')
    }

    function engineLabel(name, t) {
      const known = {
        node: 'engine.node',
        host: 'engine.host',
        hopper: 'engine.hopper',
        ghidra: 'engine.ghidra',
        'ida-registration': 'engine.ida',
        ida: 'engine.ida',
        jadx: 'engine.jadx',
        'kuna-installation': 'engine.kuna',
        kuna: 'engine.kuna',
      }
      if (Object.hasOwn(known, name)) return t(known[name])
      return String(name)
        .split(/[-_]/)
        .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
        .join(' ')
    }

    function compareVersion(left, right) {
      const parse = (value) => String(value).split(/[.+-]/).map((part) => Number.parseInt(part, 10))
      const a = parse(left)
      const b = parse(right)
      const length = Math.max(a.length, b.length)
      for (let index = 0; index < length; index += 1) {
        const x = Number.isFinite(a[index]) ? a[index] : 0
        const y = Number.isFinite(b[index]) ? b[index] : 0
        if (x !== y) return x - y
      }
      return 0
    }

    function formatAge(elapsed, t) {
      const seconds = Math.max(0, Math.round(elapsed / 1000))
      if (seconds < 10) return t('date.justNow')
      if (seconds < 60) return t('date.seconds', { count: seconds })
      return t('date.minutes', { count: Math.round(seconds / 60) })
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        /* fall through to the selection copy */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'rea: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'rea',
              order: 20,
              locale: NS,
              label: () => t('panel'),
            },
            ReaIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'rea',
              locale: NS,
            },
            ReaPage,
          ),
        )
      },
    }
  },
})
