# DeepSeek Desktop Client

基于 Electron 的 DeepSeek macOS 桌面客户端（本地 Web 封装），访问 [chat.deepseek.com](https://chat.deepseek.com)，提供接近原生应用的体验。

## 功能特性

- **桌面化窗口**：独立的原生窗口，支持窗口位置/大小记忆
- **自动聚焦输入框**：页面加载、导航或窗口获得焦点时，自动将光标定位到聊天输入框，无需手动点击
- **快捷键优化**：`Cmd+N` 映射为站点的「新建对话」快捷键（`Cmd+J`）
- **菜单栏托盘**：
  - 点击托盘图标显示/隐藏窗口
  - 「清除登录状态」一键清除站点 Cookie 与缓存，重新登录
  - 「退出」关闭应用
- **登录弹窗支持**：Google OAuth / 微信扫码等登录弹窗以真实子窗口打开，保持 `window.opener` 与 `postMessage` 正常通信

## 环境要求

- macOS（Apple Silicon / Intel）
- Node.js >= 18
- npm

## 开发运行

```bash
npm install
npm start
```

## 构建与安装

一键构建、签名并安装到 `/Applications`：

```bash
bash build.sh
```

脚本执行步骤：

1. 清理旧构建产物
2. 使用 `electron-builder` 打包 `.app`（`npm run build` 等价于 `electron-builder --mac dir`）
3. ad-hoc 签名并校验
4. 复制到 `/Applications/DeepSeek.app`

构建完成后启动：

```bash
open -a DeepSeek
```

## 项目结构

```
├── main.js           # Electron 主进程
├── preload.js        # 预加载脚本（预留 IPC）
├── build.sh          # 一键构建脚本
├── assets/           # 应用图标
└── package.json      # 项目配置与依赖
```

## 声明

本项目仅为官方网页的本地封装，不包含任何 DeepSeek 私有代码与接口，所有对话功能由官方服务提供。
