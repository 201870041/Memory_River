# Reverie · 时间长河

完整 React + Three.js 项目，包含照片河流、滚动镜头、背景音乐和终点光点烟花。
当前版本保留最近一次调整：镜头距离 8、高度 6、照片基准间距 7、屏幕防遮挡和光点烟花。

## 在 CodeSandbox 使用

这是 **React + Vite 项目**，请使用支持 Node.js 的 Vite / Devbox 环境。
和旧版 React 模板相比，Vite 的 `index.html` 在项目根目录，而不是 `public/`。

1. 解压 `时间长河-CodeSandbox.zip`。
2. 在 CodeSandbox 新建 React + Vite 项目或 Node.js Devbox。
3. 将解压后的全部文件和目录按原结构上传到项目根目录，覆盖同名文件。包括 `package.json`、`package-lock.json`、`index.html`、`vite.config.js`、`src/` 和 `.codesandbox/`。
4. 在终端运行 `npm ci`，然后运行 `npm run dev`。如果平台已经自动安装并启动，无需重复运行。
5. 打开 5173 端口的预览，选择照片，滚动浏览。

如果你当前的导入界面支持 ZIP，可以直接选择 ZIP；否则先解压再上传文件。不要把整个 ZIP 作为普通资源上传到 `src/`。
不要将本项目的入口文件与旧模板的 `src/index.js`、`public/index.html` 混用。

## 文件位置

- `src/App.jsx`：唯一的应用源码；后续照片、间距、镜头、粒子效果的修改都在这里。
- `src/index.jsx`：React 入口。
- `src/styles.css`：全局样式。
- `index.html`：页面入口。
- `public/`：可选静态资源。
- `package.json` / `package-lock.json`：依赖和启动命令。
- `vite.config.js`：开发服务配置。
- `.codesandbox/tasks.json`：CodeSandbox 开发启动任务。

## 本地启动

需要 Node.js 22.12 或以上。

```sh
npm ci
npm run dev
```

构建：`npm run build`。构建产物位于 `dist/`。

## 后续修改与同步

上传 ZIP 是一次性复制，不会把这里的文件修改自动传到 CodeSandbox。
持续同步需要让本地项目和 CodeSandbox 使用同一个 GitHub 仓库、同一个分支：

1. 将本项目保存到你自己的 GitHub 仓库。
2. 在 CodeSandbox 使用 Import from GitHub 导入这个仓库。
3. 此后在这里修改文件，检查后提交并 push 到 GitHub。
4. 在 CodeSandbox 中拉取 / 同步同一分支的最新提交。仅保存本地文件不会触发远程同步。
5. 如果你在 CodeSandbox 也修改了代码，先 commit / push，再在本地 pull 后继续修改，避免覆盖。

仓库：https://github.com/201870041/Reverie
工作分支：`codex/memory-river`（`main` 暂时保留原始版本）。
CodeSandbox 导入链接：https://codesandbox.io/p/github/201870041/Reverie/tree/codex/memory-river

本地和远端配置完成后，后续在这个聊天里请求修改，我会检查后将需要同步的改动提交到工作分支。
CodeSandbox 端请使用同一分支并拉取最新提交。这里没有启用后台监视、自动提交或自动推送；修改完成后的同步是一次明确的 Git 提交和推送。

## 照片和音乐

照片、音乐由运行时在浏览器里选择，代码使用本地 object URL；当前实现不会把选择的文件保存到 GitHub。
刷新预览后需要重新选择文件。当前照片仍使用统一的 4:3 展示框，竖图可能裁切。

## 参考

- CodeSandbox GitHub 项目入口：https://projects.codesandbox.io/
- GitHub 本地项目推送说明：https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
