/**
 * The composition rules, checked without an Electron runtime.
 *
 * Run: node --test test/*.test.js
 */

const test = require('node:test')
const assert = require('node:assert')

const { PRESETS, findPreset, stripImports, buildCss, MAX_CSS } = require('../presets')

test('the preset text is the wiki text, not a paraphrase', () => {
  // pinned verbatim from
  // https://github.com/electerm/electerm/wiki/Custom-CSS-examples
  assert.strictEqual(
    findPreset('stretch-terminal-background').css,
    '#container .session-batch-active .xterm-screen::before{background-size: 100% 100% !important;}'
  )
  assert.strictEqual(
    findPreset('hide-ai-suggestions').css,
    '.terminal-suggestions-sticky {\n  display: none;\n}'
  )
  assert.strictEqual(
    findPreset('sftp-swap-panes').css,
    `.term-sftp-box .sftp-wrap {
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
  )
  // the two long ones: check the load-bearing selectors survived
  const hide = findPreset('sftp-hide-local').css
  assert.ok(hide.includes('.sftp-local-section {\n  display: none !important;\n}'))
  assert.ok(hide.includes('.sftp-remote-section {\n  width: 100% !important;'))
  const stack = findPreset('split-view-stack').css
  assert.ok(stack.includes('.term-sftp-box > .ant-splitter-horizontal {\n  flex-direction: column !important;\n}'))
  assert.ok(stack.includes('.ant-splitter-bar-dragger {\n  display: none !important;\n}'))
  assert.ok(stack.includes('.sftp-table-content {\n  flex: 1 1 auto !important;'))
})

test('every preset has a unique key, a label and css', () => {
  const keys = PRESETS.map(p => p.key)
  assert.strictEqual(new Set(keys).size, keys.length)
  for (const preset of PRESETS) {
    assert.match(preset.key, /^[a-z0-9-]+$/)
    assert.ok(preset.label.length > 0)
    assert.ok(preset.description.length > 0)
    assert.ok(preset.css.trim().length > 0)
  }
})

test('the five wiki examples are all here', () => {
  assert.deepStrictEqual(PRESETS.map(p => p.key), [
    'stretch-terminal-background',
    'sftp-hide-local',
    'sftp-swap-panes',
    'hide-ai-suggestions',
    'split-view-stack'
  ])
})

test('findPreset ignores unknown keys and empty input', () => {
  assert.strictEqual(findPreset('sftp-swap-panes').key, 'sftp-swap-panes')
  assert.strictEqual(findPreset(' sftp-swap-panes ').key, 'sftp-swap-panes')
  assert.strictEqual(findPreset('nope'), null)
  assert.strictEqual(findPreset(''), null)
  assert.strictEqual(findPreset(undefined), null)
})

test('nothing selected produces no stylesheet', () => {
  for (const config of [{}, { preset: 'none' }, { css: '   ' }, { preset: '', css: '' }]) {
    const built = buildCss(config)
    assert.strictEqual(built.css, '')
    assert.deepStrictEqual(built.sources, [])
  }
})

test('a preset is applied and marked', () => {
  const built = buildCss({ preset: 'hide-ai-suggestions' })
  assert.match(built.css, /\.terminal-suggestions-sticky \{\n  display: none;\n\}/)
  assert.match(built.css, /preset: hide-ai-suggestions/)
  assert.deepStrictEqual(built.sources, ['hide-ai-suggestions'])
  assert.deepStrictEqual(built.warnings, [])
})

test('cascade order is preset, file, then textarea', () => {
  const built = buildCss({
    preset: 'hide-ai-suggestions',
    fileCss: '.from-file { color: red; }',
    css: '.from-box { color: blue; }'
  })
  const presetAt = built.css.indexOf('preset: hide-ai-suggestions')
  const fileAt = built.css.indexOf('.from-file')
  const boxAt = built.css.indexOf('.from-box')
  assert.ok(presetAt > -1 && fileAt > presetAt && boxAt > fileAt)
  assert.deepStrictEqual(built.sources, ['hide-ai-suggestions', 'file', 'inline'])
})

test('two presets can be combined, and an unknown one only warns', () => {
  const built = buildCss({ preset: 'hide-ai-suggestions, sftp-hide-local' })
  assert.deepStrictEqual(built.sources, ['hide-ai-suggestions', 'sftp-hide-local'])

  const withUnknown = buildCss({ preset: 'hide-ai-suggestions,not-a-preset' })
  assert.deepStrictEqual(withUnknown.sources, ['hide-ai-suggestions'])
  assert.match(withUnknown.warnings[0], /unknown preset "not-a-preset"/)
})

test('an unknown preset alone still yields no stylesheet', () => {
  const built = buildCss({ preset: 'not-a-preset' })
  assert.strictEqual(built.css, '')
  assert.strictEqual(built.warnings.length, 1)
})

test('@import is removed, other at-rules survive', () => {
  const { css, removed } = stripImports('@import url("https://x/y.css");\n@import "z.css";\n@media print { a { color: red } }')
  assert.strictEqual(removed, 2)
  assert.ok(!css.includes('@import'))
  assert.match(css, /@media print/)
})

test('the widget reports imports it dropped', () => {
  const built = buildCss({ css: '@import url("https://example.com/x.css"); .a { color: red }' })
  assert.ok(!built.css.includes('@import'))
  assert.match(built.warnings[0], /2?1 @import rule/)
  assert.match(built.css, /\.a \{ color: red \}/)
})

test('the marker header goes in, and byte count is real', () => {
  const built = buildCss({ css: '.a { color: red }' })
  assert.ok(built.css.startsWith('/* electerm custom-css widget */'))
  assert.strictEqual(built.bytes, Buffer.byteLength(built.css, 'utf8'))
})

test('a stylesheet over the size limit is refused, not truncated', () => {
  const huge = `/* ${'x'.repeat(MAX_CSS)} */`
  assert.throws(() => buildCss({ css: huge }), /limit is 200KB/)
})
