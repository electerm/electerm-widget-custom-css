# electerm 自定义 CSS 插件

[English](README.md) | 中文

给 [electerm](https://electerm.org) 自己套一层样式：直接选 wiki 里的示例，或者指向你自己的
`.css` 文件、在输入框里写 CSS。立刻作用在你正看着的那个窗口上，每次启动都会自动恢复。

| | |
| --- | --- |
| 形态 | instance 插件，生成式配置表单 |
| 需要 | electerm **v5.8.0** 及以上 |
| 运行位置 | 主进程（`webContents.insertCSS`） |
| 单元测试 | `npm test`，零依赖，无需安装 |

## 安装

**设置 → 插件 → 导入**，粘贴：

```text
electerm/electerm-widget-custom-css
```

也可以用**导入文件夹**指向本地克隆。要改它：克隆 → 导入文件夹 → 改 → 重新导入（导入是复制，
没有热更新）。

## 使用

1. **设置 → 插件 → Custom CSS**。
2. 选一个预设，或者保持 *None* 自己写 CSS，点 **Start widget**。
3. 提示还没消失，样式就已经生效了。保留 *Apply on launch*，每次启动都会重新应用；在
   *Running instances* 里点 **Stop** 可以移除。

表单会记住上次填的值，下次打开接着上次的状态。

## 配置项

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| Preset | 下拉 | wiki 里的某一个样式表。*None* 表示只用下面自己写的。 |
| CSS file | 文件 | 要应用的 `.css` 文件。插件运行期间改动并保存该文件会被自动重新应用（有文件监听）。 |
| CSS | 多行文本 | 额外 CSS，最后应用，因此会盖住预设和文件里的同名规则。 |
| Apply on launch | 布尔 | 默认开。点 Start 时就是它把插件放进 electerm 的自动运行列表。 |

层叠顺序是 **预设 → 文件 → 输入框**，和表单的排列一致：手写的规则会覆盖同优先级的预设规则。

想同时用两个预设：下拉里留一个，另一个贴进 **CSS** 输入框。

## 预设

五个全部来自 wiki 页面
**[Custom CSS examples](https://github.com/electerm/electerm/wiki/Custom-CSS-examples)**，
逐字复制——有测试锁定原文，不会被悄悄改写成"意思差不多"的版本。

| 预设 | 效果 |
| --- | --- |
| `stretch-terminal-background` | 终端背景图拉伸到 100%，而不是封面（cover）模式 |
| `sftp-hide-local` | 隐藏 sftp 面板的本地部分，远程部分占满宽度 |
| `sftp-swap-panes` | 远程在左、本地在右，交换两侧 |
| `hide-ai-suggestions` | 隐藏终端上方的 AI 建议列表 |
| `split-view-stack` | 分屏时始终上下排列终端和 sftp；分隔条被固定，不可拖动 |

最后一条只在分屏打开时生效；如果应用时已经有会话开着，需要拖动一次窗口大小（或把分屏关掉再打开），
让终端按新尺寸重新排版。

## 实现方式

插件自己的 UI 是独立 origin 上的沙箱 iframe，碰不到应用的 DOM。但插件的 `main.js` 跑在**主进程**
里、有完整 Node 权限，而 `webContents.insertCSS()` 正好能从外部给页面套样式。机制就这一句话：
不需要应用加设置项，不需要改构建，也不注入脚本。

三个细节让它表现得像一个设置，而不是一次性动作：

- **渲染进程每次重载都会重新插入。** 插入的样式表属于当前文档，重载就没了（实测，不是推测），
  所以监听 `did-finish-load` 再插一次。
- **之后新开的窗口也会被覆盖**——`app.on('web-contents-created')`，多开窗口时同样有样式。
- **Stop 能干净移除。** 每个窗口的插入 key 都留着，同一个窗口的插入是排队的：两次重叠的
  `insertCSS` 会让其中一张样式表失去 key，那张表会一直留到 Stop 之后。

样式以默认的 author origin 插入，和 wiki 示例当初的写法一致——所以 `!important` 的含义不变，
不会因为"是插件插的"就表现不同。

## 限制

- **只有 CSS。** 不会执行 JavaScript。`@import` 在插入前被剥掉：以这种方式应用的样式表不应该让
  渲染进程去请求任何东西，剥掉了几条会在插件日志里说明。
- **上限 200KB。** 超过就报错，不截断。
- **作用于整个窗口，包括设置面板。** 这正是样式表的意义，也是唯一能把自己坑到的地方：把插件面板
  藏起来的规则，会把 Stop 按钮一起藏起来。真遇到了：退出 electerm，删掉
  `<data dir>/widgets/custom-css/`，自动运行项没有东西可启动，应用会以无样式的状态起来，然后重新
  安装即可。（`<data dir>`：macOS 是 `~/Library/Application Support/electerm`，Windows 是
  `%APPDATA%/electerm`，Linux 是 `~/.config/electerm`。）
- **不是主题。** 终端配色、字体、主题选择器仍然归应用自己管；这个插件处理的是设置里没有的布局与
  显隐调整。
- **单实例。** `singleInstance` 开着：跑两份会抢同一张样式表。

## 安全

安装任何 electerm 插件都等于信任作者——`main.js` 在主进程里以完整 Node 权限运行，导入时没有任何
代码检查。请先读代码；这个仓库是刻意做小的：

- `main.js` —— insertCSS、重载后重插、文件监听。只读一个文件（你设了 `cssFile` 的话），不碰网络。
- `presets.js` —— wiki 样式表的数据形式，以及组合规则。没有 import，没有 I/O。

## 文件

```text
package.json   清单：id、类型、四个配置项
main.js        insertCSS 生命周期
presets.js     wiki 样式表 + buildCss()，零依赖
test/          node --test，零依赖
```

## License

MIT
