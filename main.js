/**
 * Custom CSS — put a stylesheet on electerm's own window.
 *
 * A widget's UI runs in a sandboxed iframe on its own origin, so it cannot
 * touch the app's DOM. The main process can: `webContents.insertCSS()` is the
 * one API that styles a page from the outside, and a widget's main.js already
 * runs there with full Node privileges. So this widget needs no cooperation
 * from the app — it is CSS applied from above, and it works on the window the
 * user is already looking at.
 *
 * Instance widget on purpose: electerm's auto-run list starts an instance on
 * every launch, which is what makes "my CSS is always there" true. The other
 * half of that promise is the reload handler below — a stylesheet inserted this
 * way lives in the current document, so every `did-finish-load` re-inserts it.
 *
 * What it will not do: run JavaScript, or load a remote stylesheet — `@import`
 * is stripped before the CSS is inserted. It is insertCSS, plus the same
 * stylesheet re-inserted after every renderer reload.
 */

const fs = require('fs')
const path = require('path')
const { app, webContents } = require('electron')
const { buildCss } = require('./presets')

const RELOAD = 'did-finish-load'
const NOOP = () => {}

// devtools and the widget's own iframe are `window`-ish webContents too; the
// app renderer is served over http://127.0.0.1:<port>, so filtering on the
// scheme is what keeps this from styling the wrong document
const SKIP_SCHEME = /^(devtools|electerm-widget|chrome|chrome-extension|about|data):/i

// one stylesheet for the whole app: instances share this module, and
// singleInstance in package.json keeps a second start from fighting over it
let currentCss = ''
const applied = new Map() // webContents.id -> { wc, onLoad, key }
let watcher = null

function isAppWindow (wc) {
  if (!wc || wc.isDestroyed() || wc.getType() !== 'window') {
    return false
  }
  return !SKIP_SCHEME.test(wc.getURL() || '')
}

function appWindows () {
  return webContents.getAllWebContents().filter(isAppWindow)
}

// One insert at a time, per window. Two overlapping insertCSS calls both see
// `key === null`, both insert, and only one key is kept — the other stylesheet
// is unremovable. Measured: with the double insert this file used to do on
// start, the first stop removed one sheet and the CSS stayed applied, because
// the duplicate was still there with a key nobody had.
function insert (wc) {
  const entry = applied.get(wc.id)
  if (!entry) {
    return Promise.resolve()
  }
  entry.queue = entry.queue.then(() => applyOnce(entry)).catch(NOOP)
  return entry.queue
}

async function applyOnce (entry) {
  const { wc } = entry
  if (wc.isDestroyed()) {
    return
  }
  if (entry.key) {
    const key = entry.key
    entry.key = null
    await wc.removeInsertedCSS(key).catch(NOOP)
  }
  if (!currentCss) {
    return
  }
  try {
    entry.key = await wc.insertCSS(currentCss)
  } catch (e) {
    // a window still on about:blank has no document to style yet; the
    // did-finish-load handler gets another chance
  }
}

function attach (wc) {
  const existing = applied.get(wc.id)
  if (existing) {
    insert(wc)
    return
  }
  const onLoad = () => insert(wc)
  const entry = { wc, onLoad, key: null, queue: Promise.resolve() }
  applied.set(wc.id, entry)
  wc.on(RELOAD, onLoad)
  wc.once('destroyed', () => {
    applied.delete(wc.id)
  })
  insert(wc)
}

async function detachAll () {
  const entries = [...applied.values()]
  applied.clear()
  // before draining: a queued insert must not put a stylesheet back after this
  currentCss = ''
  await Promise.all(entries.map(async entry => {
    try {
      entry.wc.removeListener(RELOAD, entry.onLoad)
    } catch (e) {}
    await entry.queue.catch(NOOP)
    if (!entry.key) {
      return
    }
    const key = entry.key
    entry.key = null
    if (!entry.wc.isDestroyed()) {
      await entry.wc.removeInsertedCSS(key).catch(NOOP)
    }
  }))
}

function readCssFile (file) {
  if (!file) {
    return ''
  }
  try {
    return fs.readFileSync(file, 'utf8')
  } catch (e) {
    throw new Error(`cannot read ${file}: ${e.message}`)
  }
}

function sizeLabel (bytes) {
  return bytes > 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${bytes}B`
}

function widgetRun (instanceConfig = {}, ctx = {}) {
  const { log = NOOP } = ctx
  const config = instanceConfig || {}
  const instanceId = `custom-css-${Date.now()}`
  let onCreated = null
  let started = false

  // Compose, then push the result at every window we can see. Called on start,
  // when a new window appears, and when the watched file changes. attach()
  // handles a window that is already attached (it re-inserts), so this stays a
  // single pass: doing it twice used to leak a stylesheet that stop could not
  // remove.
  function refresh () {
    const built = buildCss({
      preset: config.preset,
      css: config.css,
      fileCss: readCssFile(config.cssFile)
    })
    currentCss = built.css
    if (currentCss) {
      appWindows().forEach(attach)
    } else {
      detachAll()
    }
    return built
  }

  function watch (file) {
    if (watcher) {
      try {
        watcher.close()
      } catch (e) {}
      watcher = null
    }
    if (!file) {
      return
    }
    try {
      watcher = fs.watch(file, { persistent: false }, () => {
        try {
          const built = refresh()
          log('info', `re-applied after ${path.basename(file)} changed (${sizeLabel(built.bytes || 0)})`)
        } catch (e) {
          log('error', `cannot re-apply ${file}: ${e.message}`)
        }
      })
    } catch (e) {
      // a missing file is reported by readCssFile on start; watching it is a
      // convenience, not a requirement
      log('warn', `cannot watch ${file}: ${e.message}`)
    }
  }

  return {
    instanceId,

    async start () {
      if (started) {
        throw new Error('Custom CSS is already applied')
      }
      const built = refresh()
      if (!built.css) {
        throw new Error('no CSS selected: pick a preset or write some CSS')
      }
      started = true
      onCreated = (event, wc) => {
        if (isAppWindow(wc)) {
          attach(wc)
        }
      }
      app.on('web-contents-created', onCreated)
      watch(config.cssFile)
      // let the queued inserts land before reporting, so the message and a
      // stop issued right after this both describe the same state
      await Promise.all([...applied.values()].map(entry => entry.queue.catch(NOOP)))

      const windows = applied.size
      const sources = built.sources.length ? built.sources.join(', ') : 'custom'
      built.warnings.forEach(warning => log('warn', warning))
      log('info', `applied ${sizeLabel(built.bytes)} to ${windows} window(s): ${sources}`)
      return {
        msg: `Applied ${sizeLabel(built.bytes)} of CSS to ${windows} window(s)`
      }
    },

    async stop () {
      if (onCreated) {
        app.removeListener('web-contents-created', onCreated)
        onCreated = null
      }
      if (watcher) {
        try {
          watcher.close()
        } catch (e) {}
        watcher = null
      }
      await detachAll()
      started = false
      log('info', 'custom CSS removed')
    }
  }
}

module.exports = { widgetRun }
