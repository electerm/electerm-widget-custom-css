/**
 * The stylesheets, as data.
 *
 * Every entry is copied verbatim from the wiki page "Custom CSS examples"
 * (https://github.com/electerm/electerm/wiki/Custom-CSS-examples), which is
 * where these were collected before this widget existed. Keeping them here as
 * data means the same text can be unit tested, shown in the config dropdown and
 * composed with the user's own CSS without three copies drifting apart.
 *
 * No imports: this module is loaded by main.js in the main process and by the
 * test file under node --test, so it must stay dependency free.
 */

const MAX_CSS = 200 * 1024

const HEADER = [
  '/* electerm custom-css widget */',
  '/* inserted with webContents.insertCSS, not part of the app */'
].join('\n')

const PRESETS = [
  {
    key: 'stretch-terminal-background',
    label: 'Terminal background image: stretch to 100%',
    description: 'Stretch the background image to fill the terminal instead of the default cover mode.',
    doc: 'https://github.com/electerm/electerm/wiki/Custom-CSS-examples#custom-css-examples%E8%87%AA%E5%AE%9A%E4%B9%89css%E6%A0%B7%E4%BE%8B',
    css: `#container .session-batch-active .xterm-screen::before{background-size: 100% 100% !important;}`
  },
  {
    key: 'sftp-hide-local',
    label: 'SFTP panel: hide the local pane',
    description: 'Hide the local half of the SFTP panel and let the remote half use the full width.',
    doc: 'https://github.com/electerm/electerm/wiki/Custom-CSS-examples',
    css: `/* Hide the local section */
.sftp-local-section {
  display: none !important;
}

/* Expand the remote section to full width */
.sftp-remote-section {
  width: 100% !important;
  left: 0 !important;
}

/* Ensure the parent container adjusts */
.sftp-wrap {
  display: block;
}`
  },
  {
    key: 'sftp-swap-panes',
    label: 'SFTP panel: swap local and remote panes',
    description: 'Show the remote files on the left and the local files on the right.',
    doc: 'https://github.com/electerm/electerm/wiki/Custom-CSS-examples',
    css: `.term-sftp-box .sftp-wrap {
  display: flex !important;
  flex-direction: row;
}

.term-sftp-box .sftp-section {
  flex: 1;
  position: static;
}

/* Optionally, if you want to adjust the inner layout */
.sftp-remote-section {
  order: 1 !important;
}

.sftp-local-section {
  order: 2;
}`
  },
  {
    key: 'hide-ai-suggestions',
    label: 'Hide the AI suggestion menu',
    description: 'Hide the suggestion list that appears above the terminal.',
    doc: 'https://github.com/electerm/electerm/wiki/Custom-CSS-examples',
    css: `.terminal-suggestions-sticky {
  display: none;
}`
  },
  {
    key: 'split-view-stack',
    label: 'Split view: always stack terminal above SFTP',
    description: 'Stack the two panes vertically in split view instead of only when the window is narrow. The divider is pinned, so it is no longer draggable.',
    doc: 'https://github.com/electerm/electerm/wiki/Custom-CSS-examples',
    css: `/* 1. the splitter stacks instead of sitting side by side */
.term-sftp-box > .ant-splitter-horizontal {
  flex-direction: column !important;
}

/* 2. panels become full-width halves (their flex-basis is px, set by JS) */
.term-sftp-box > .ant-splitter-horizontal > .ant-splitter-panel {
  flex: 1 1 0 !important;
  width: 100% !important;
  max-width: 100% !important;
}

/* 3. the gutter becomes a 1px rule; dragging is meaningless once sizes are pinned */
.term-sftp-box > .ant-splitter-horizontal > .ant-splitter-bar {
  flex: none !important;
  width: 100% !important;
  height: 1px !important;
  background: var(--main-darker);
}
.term-sftp-box > .ant-splitter-horizontal > .ant-splitter-bar .ant-splitter-bar-dragger {
  display: none !important;
}

/* 4. terminal fills its pane instead of the px box JS computed for a side-by-side split */
.term-sftp-box > .ant-splitter-horizontal .terms-box,
.term-sftp-box > .ant-splitter-horizontal .term-wrap {
  width: 100% !important;
  height: 100% !important;
}

/* 5. same for the sftp pane - every wrapper in the chain must pass height down */
.term-sftp-box > .ant-splitter-horizontal .sftp-wrap,
.term-sftp-box > .ant-splitter-horizontal .sftp-section,
.term-sftp-box > .ant-splitter-horizontal .sftp-section > .ant-spin-nested-loading,
.term-sftp-box > .ant-splitter-horizontal .sftp-section > .ant-spin-nested-loading > .ant-spin-container {
  height: 100% !important;
}
.term-sftp-box > .ant-splitter-horizontal .sftp-panel {
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}
.term-sftp-box > .ant-splitter-horizontal .sftp-panel > *:not(.file-list) {
  flex: none !important;
}
.term-sftp-box > .ant-splitter-horizontal .file-list {
  flex: 1 1 auto !important;
  min-height: 0 !important;
}
.term-sftp-box > .ant-splitter-horizontal .sftp-table {
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}
.term-sftp-box > .ant-splitter-horizontal .sftp-table > *:not(.sftp-table-content) {
  flex: none !important;
}
.term-sftp-box > .ant-splitter-horizontal .sftp-table-content {
  flex: 1 1 auto !important;
  height: auto !important;
  min-height: 0 !important;
}`
  }
]

const PRESET_BY_KEY = new Map(PRESETS.map(p => [p.key, p]))

function findPreset (key) {
  return PRESET_BY_KEY.get(String(key || '').trim()) || null
}

/**
 * Drop @import rules. A stylesheet the user pasted in should not be able to
 * make the renderer fetch a remote URL: this widget's job is styling, and an
 * import is a request the user did not ask for (and one that keeps firing after
 * they forgot the line). Everything else is passed through untouched.
 */
function stripImports (css) {
  let removed = 0
  const out = String(css).replace(/@import\b[^;]*;?/gi, () => {
    removed++
    return ''
  })
  return { css: out, removed }
}

/**
 * Compose the stylesheet from the three sources, in cascade order: presets,
 * then the file, then the textarea. Later wins on equal specificity, which is
 * the order the config form is laid out in, so the panel reads top to bottom.
 *
 * `preset` takes one key, or several separated by commas (the form's dropdown
 * offers one, but the composition itself has no reason to be limited to one).
 *
 * Returns { css, sources, warnings }. `css` is '' when nothing was selected.
 * Throws only for input that cannot be applied at all (too large).
 */
function buildCss ({ preset, css, fileCss } = {}) {
  const parts = []
  const sources = []
  const warnings = []

  const keys = (Array.isArray(preset) ? preset : String(preset || '').split(','))
    .map(key => String(key || '').trim())
    .filter(key => key && key !== 'none')

  for (const key of keys) {
    const found = findPreset(key)
    if (found) {
      parts.push(`/* preset: ${found.key} */\n${found.css.trim()}`)
      sources.push(found.key)
    } else {
      warnings.push(`unknown preset "${key}", ignored`)
    }
  }

  if (typeof fileCss === 'string' && fileCss.trim()) {
    parts.push(`/* from css file */\n${fileCss.trim()}`)
    sources.push('file')
  }

  if (typeof css === 'string' && css.trim()) {
    parts.push(`/* custom css */\n${css.trim()}`)
    sources.push('inline')
  }

  const stripped = stripImports(parts.join('\n\n'))
  if (stripped.removed) {
    warnings.push(`${stripped.removed} @import rule(s) removed: a stylesheet applied this way must not fetch anything`)
  }

  const body = stripped.css.trim()
  if (!body) {
    return { css: '', sources, warnings }
  }

  const out = `${HEADER}\n${body}\n`
  const bytes = Buffer.byteLength(out, 'utf8')
  if (bytes > MAX_CSS) {
    throw new Error(`the stylesheet is ${Math.round(bytes / 1024)}KB, the limit is ${MAX_CSS / 1024}KB`)
  }
  return { css: out, sources, warnings, bytes }
}

module.exports = {
  MAX_CSS,
  PRESETS,
  findPreset,
  stripImports,
  buildCss
}
