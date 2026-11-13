# electerm custom CSS widget

English | [中文](README_CN.md)

Style [electerm](https://electerm.org) itself: pick one of the CSS examples from
the wiki, point at your own `.css` file, or paste CSS into the box. It applies to
the window you are looking at, immediately, and comes back on every launch.

| | |
| --- | --- |
| Shape | instance widget, config form |
| Needs | electerm **v5.8.0** or newer |
| Runs in | the main process (`webContents.insertCSS`) |
| Unit tests | `npm test` — no dependencies, no install |

## Install

**Settings → Widgets → Import**, then paste:

```text
electerm/electerm-widget-custom-css
```

Or **Import folder** against a local clone. Working on it: clone, import the
folder, edit, re-import (import copies — there is no hot reload).

## Use

1. **Settings → Widgets → Custom CSS**.
2. Pick a preset, or leave it on *None* and write CSS. **Start widget**.
3. The stylesheet is on the window before the toast disappears. Leave *Apply on
   launch* on and it is re-applied at every start; **Stop** in *Running instances*
   removes it.

The form remembers what you typed, so the next visit starts where the last one
ended.

## Config

| Field | Type | What it does |
| --- | --- | --- |
| Preset | select | One stylesheet from the wiki. *None* means "only what I write below". |
| CSS file | file | A `.css` file to apply. Edited and saved while the widget runs, it is picked up (the file is watched). |
| CSS | textarea | Extra CSS. Applied last, so it wins over the preset and the file. |
| Apply on launch | boolean | Default on. This is what puts the widget in electerm's auto-run list when you start it. |

Cascade order is **preset → file → textarea**, matching the order of the form, so
a rule you write by hand overrides a preset rule of equal specificity.

To combine two presets, keep one in the dropdown and paste the other into the
**CSS** box.

## Presets

All five come from the wiki page
**[Custom CSS examples](https://github.com/electerm/electerm/wiki/Custom-CSS-examples)**,
verbatim — a test pins the text so it cannot drift into a paraphrase.

| Preset | Effect |
| --- | --- |
| `stretch-terminal-background` | Stretch the terminal background image to 100% instead of cover mode |
| `sftp-hide-local` | Hide the local half of the SFTP panel, remote takes the full width |
| `sftp-swap-panes` | Remote files on the left, local on the right |
| `hide-ai-suggestions` | Hide the AI suggestion list above the terminal |
| `split-view-stack` | Always stack terminal above SFTP in split view; the divider is pinned (not draggable) |

The last one only applies while split view is on, and a session that was already
open needs one window resize (or a split-view toggle) so the terminal re-fits.

## How it works

A widget's own UI is a sandboxed iframe on its own origin, so it cannot touch the
app's DOM. A widget's `main.js` runs in the **main process** with full Node
privileges, and there `webContents.insertCSS()` styles a page from the outside.
That is the whole mechanism: no app setting, no patched build, no injected script.

Three details make it behave like a setting rather than a one-shot:

- **Every renderer reload re-inserts the stylesheet.** An inserted sheet lives in
  the current document; a reload drops it (measured, not assumed), so a
  `did-finish-load` handler puts it back.
- **Windows opened later are covered** — `app.on('web-contents-created')`, so a
  second window (multi-instance mode) is styled too.
- **Stop removes it properly.** Each insert's key is kept per window, and inserts
  for one window are queued: two overlapping `insertCSS` calls would leave one
  stylesheet with a key nobody kept, and that sheet survives Stop.

The CSS is inserted with the default author origin, which is how the wiki
examples were written — so `!important` means what it means there, and no rule
behaves differently just because it is applied by this widget.

## Standalone: not the built-in setting

electerm has its own **Settings → Common → Custom CSS** box, which the app applies
into `<style id="custom-css">` and syncs across your devices. This widget does not
read or write it. It keeps its own stylesheet and inserts it from the main process.
The two can do the same thing, and they can both be active at once:

| | built-in setting | this widget |
| --- | --- | --- |
| CSS lives in | `config.customCss`, synced | the widget's config, this machine |
| applied by | the app, into `<style id="custom-css">` | `webContents.insertCSS` |
| presets | none | the five wiki examples |
| CSS from a file | no | yes, watched |
| in the cascade | last sheet in the document | after the app's CSS, before that sheet |

The last row is the one that bites: with both active, a rule that appears in both
places is won by the **setting**, because its sheet is last in the document
(measured). Keep a given rule in one place, not both.

## Limits

- **CSS only.** It cannot run JavaScript. `@import` rules are stripped before
  insertion: a stylesheet applied this way should not make the renderer fetch
  anything, and the widget reports how many rules it dropped.
- **200KB cap.** A larger stylesheet is refused with an error rather than
  truncated.
- **It applies to the whole window, including the settings panel** — that is the
  point of a stylesheet, and also the one way to hurt yourself: a rule that hides
  the widgets panel hides the Stop button with it. Recovery, if that happens:
  quit electerm and delete `<data dir>/widgets/custom-css/`. The auto-run entry
  then has nothing to start, so the app comes up unstyled and you can re-install.
  (`<data dir>` is `~/Library/Application Support/electerm` on macOS,
  `%APPDATA%/electerm` on Windows, `~/.config/electerm` on Linux.)
- **Not a theme.** Terminal colours, fonts and the theme picker are still the
  app's own; this is for layout and visibility changes the settings do not offer.
- **One instance.** `singleInstance` is on: two running copies would fight over
  the same stylesheet.

## Security

Installing any electerm widget means trusting its author — `main.js` runs in the
main process with full Node privileges, and nothing inspects it on import. Read
the code first; this repository is small on purpose:

- `main.js` — insertCSS, the reload handler, the file watcher. It reads one file
  (`cssFile`, if you set one) and touches no network.
- `presets.js` — the wiki stylesheets as data, plus the composition rules. No
  imports, no I/O.

## Files

```text
package.json   manifest: id, type, the four config fields
main.js        insertCSS lifecycle
presets.js     the wiki stylesheets + buildCss(), dependency free
test/          node --test, no dependencies
```

## License

MIT
