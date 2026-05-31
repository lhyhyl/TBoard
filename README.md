<div align="center">
  <img src="https://img.icons8.com/external-flatart-icons-flat-flatarticons/120/external-whiteboard-online-education-flatart-icons-flat-flatarticons.png" alt="TBoard Logo" width="100"/>
  <h1>🖌️ TBoard</h1>
  <p><strong>一款极简、流畅且支持工作空间的桌面端白板笔记工具</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  </p>
</div>

---

TBoard 是一款基于 **Electron** 和 **Fabric.js** 开发的独立白板应用。它专为手写笔记、思维导图、题目讲解与草稿记录设计，注重于**无感知的毫秒级存储**与**高效的沉浸式空间**。

<br />

## 🌟 核心特性

- 🎨 **压感书写**：搭载自适应压感笔刷，还原最真实、流畅的书写体验。
- 🗂 **项目制管理**：引入类似 VS Code 的工作空间概念，支持自由切换不同的本地存储目录。
- 📦 **草稿导入**：支持一键导入外部的完整白板草稿文件夹。
- 🖥 **沉浸式画布**：重新设计的智能布局将标题栏融入工具栏，释放 100% 画布空间，拒绝遮挡。
- 🔒 **安全同步**：毫秒级自动快照保存 + 场景切换强制落盘，确保您的每一笔都万无一失。
- 🖨 **高清导出**：支持将当前白板或整个分类批量导出为高清晰度 PDF，便于分享或存档。

<br />

## 🛠️ 技术生态

| 领域 | 核心技术栈 | 简介 |
| --- | --- | --- |
| **前端框架** | `React 18` + `TypeScript` | 构建稳健的用户界面 |
| **构建工具** | `Vite` | 极速的冷启动与热重载 |
| **跨端方案** | `Electron` | 强大的底层桌面支持 |
| **画布引擎** | `Fabric.js (v6+)` | 提供丰富灵活的图形绘制能力 |
| **状态管理** | `Zustand` | 简约高效的全局状态中心 |
| **样式方案** | `Tailwind CSS` | 原子化驱动的高效 UI 布局 |

<br />

## 🚀 极速上手

### 1. 环境准备
确保您的计算机已安装 [Node.js](https://nodejs.org/zh-cn/) (建议版本 **v18+**)。

### 2. 本地调试
安装依赖并启动应用：
```bash
# 获取依赖
npm install

# 唤起本地开发服与桌面应用
npm run dev
```

### 3. 应用打包
```bash
# 构建 Windows 版本 (.exe)
npm run build --win

# 构建 macOS 版本 (.dmg)
npm run build --mac

# 预打包测试 (不执行安装包生成)
npm run package
```

<br />

## ⌨️ 效率快捷键

为您准备了高效的键盘快捷操作，一切皆可在应用**设置**面板中按需调整：

| 快捷键 | 动作 | 快捷键 | 动作 |
| --- | --- | --- | --- |
| <kbd>1</kbd> ~ <kbd>9</kbd> | 切换笔刷工具/橡皮擦等 | <kbd>F11</kbd> | 进入/退出演示模式 |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | 撤销上一步骤 | <kbd>Ctrl</kbd> + <kbd>C</kbd> | 复制选中元素 |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | 重做撤销步骤 | <kbd>Ctrl</kbd> + <kbd>V</kbd> | 粘贴剪贴板元素 |
| <kbd>Delete</kbd> | 删除当前选中的内容 | <kbd>Esc</kbd> | 取消当前操作 / 退出演示|

*(注：Mac 用户请将 `Ctrl` 替换为 `Cmd` 键)*

<br />

## 💾 数据持久化架构

为了保护用户隐私并摆脱网络依赖，TBoard 坚持完全**本地化驱动**：

- **系统配置**：位于操作系统级用户目录（如 `AppData/Roaming/writeboard/settings.json`）。
- **工作空间**：每个空间都是一个包含特定数据的物理文件夹：
  - 📄 `index.json`：存放空间内的所有分类和对应的看板元数据。
  - 🧩 `boards/`：独立拆分的各个看板 JSON 文件 (依靠 UUID 标识文件)，承载序列化点阵数据。
  - 🖼️ `images/`：内嵌图片或涂鸦素材的集中库。

> **💡 数据安全提示**：在执行关闭软件或切换看板等操作时，系统会自动发出 `flushSave()` 指令阻断异步数据流，以强制完成即时的磁盘落盘写入。

<br />

## 📁 代码结构拓扑

<details>
<summary><b>点击展开查看完整代码目录树</b></summary>

```text
.
├── electron/               # Electron 主进程与预加载脚本（底层控制层）
│   ├── main.ts             # IPC 拦截、系统原生对话框、文件读写调度
│   └── preload.ts          # 环境隔离桥接脚本
├── src/                    # 界面渲染主进程
│   ├── components/         # 视图组件库
│   │   ├── Canvas/         # ✏️ 核心画布组件群与 Hook
│   │   ├── Sidebar/        # 🗂 侧栏项目树与数据交互
│   │   ├── Toolbar/        # 🛠 工具栏与全局应用状态展示
│   │   └── Settings/       # ⚙️ 参数设定与映射
│   ├── store/              # 📦 Zustand 集中状态派发
│   ├── services/           # 🔌 业务服务类（针对 IPC 进行上层封装）
│   └── types/              # 🏷️ TypeScript 全局类型声明指引
└── storage_example/        # 静态资源存储形态演示目录
```
</details>

<br />

## ❓ FAQ（常见问题排查）

<details>
<summary><b>Q: 运行 <code>npm run dev</code> 时报错 <code>Error: Electron uninstall</code>？</b></summary>

- **原因**：国内网络环境导致 npm 拉取 Electron 底层二进制文件时发生超时截断。
- **解决方案**：为 Electron 指定专属国内加速镜像，而后重试安装即可：
  ```bash
  npm config set electron_mirror https://npmmirror.com/mirrors/electron/
  npm install electron --save-dev
  ```
</details>

<details>
<summary><b>Q: 怎样快速恢复历史草稿？</b></summary>
 
- 展开左侧系统边栏，在底部点击 **“导入文件夹”** 功能按钮。<br/>
- 将包含了原始 `index.json` 与 `boards/` 的全量文件夹导入即可，系统将自动映射所有历史板绘。
</details>

<br />

---

<div align="center">
  <sub>✨ <b>TBoard - 聚焦于你的每一份灵感</b> ✨</sub><br/>
  <sub><i>强烈建议配合数位板/手写笔使用以获得最佳压感体验</i></sub>
</div>
