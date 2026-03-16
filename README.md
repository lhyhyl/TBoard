# TBoard - 极简白板笔记工具

TBoard 是一款基于 **Electron** 和 **Fabric.js** 开发的桌面端白板笔记工具。它专为手写笔记、题目讲解和草稿记录设计，支持压感书写、图形绘制、多项目管理及 PDF 导出。

## 🚀 核心特性

- **压感书写**：支持自适应压感笔刷，书写体验流畅。
- **项目制管理**：模仿 VS Code 的工作空间模式，可自由切换不同的本地存储目录。
- **草稿导入**：支持一键导入完整的白板草稿文件夹（包含 `index.json` 和 `boards`）。
- **智能布局**：标题栏整合进工具栏，释放 100% 画布空间，拒绝遮挡。
- **安全同步**：毫秒级自动保存机制 + 切换强制落盘，确保每一笔都不会丢失。
- **导出功能**：支持将白板或整个分类批量导出为高清晰度 PDF。

---

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **跨端方案**: Electron
- **画布引擎**: Fabric.js (v6+)
- **状态管理**: Zustand
- **样式方案**: Tailwind CSS

---

## 📂 目录结构

```text
├── electron/               # Electron 主进程与预加载脚本
│   ├── main.ts             # IPC 通信逻辑、文件系统操作
│   └── preload.ts          # 暴露给渲染进程的 API
├── src/
│   ├── components/
│   │   ├── Canvas/         # 画布核心组件（WhiteBoard, useCanvas）
│   │   ├── Sidebar/        # 侧边栏（分类、白板列表、导入功能）
│   │   ├── Toolbar/        # 顶部工具栏（工具切换、标题编辑）
│   │   └── Settings/       # 设置面板（存储路径、快捷键）
│   ├── store/              # Zustand 状态仓库（boardStore, toolStore）
│   ├── services/           # 存储服务层，封装 IPC 调用
│   └── types/              # 全局类型定义
└── storage_example/        # 存储结构示例
    ├── index.json          # 分类索引
    ├── boards/             # 白板 JSON 数据 (UUID.json)
    └── images/             # 插入的图片资源
```

---

## ⌨️ 开发指南

### 1. 环境准备
确保已安装 Node.js (建议 v18+)。

### 2. 安装依赖
```bash
npm install
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 构建应用
```bash
# 构建 Windows 版本
npm run build
```

---

## 💾 数据架构与持久化

TBoard 采用 **本地文件系统** 作为数据库：

1. **设置文件**：存储在用户目录 `AppData/Roaming/writeboard/settings.json`。
2. **工作空间**：
   - `index.json`：存储分类信息和白板元数据。
   - `boards/`：每个白板为一个独立的 JSON 文件，包含 Fabric.js 序列化数据。
   - `images/`：白板引用的本地图片资源。

**注意**：切换白板时，系统会触发 `flushSave()` 强制同步，防止因异步写入导致的丢失。

---

## 🔧 常见操作说明

### 如何导入草稿？
1. 点击侧边栏左下角的 **“导入文件夹”**。
2. 选择包含 `index.json` 和 `boards` 文件夹的目录。
3. 系统会自动将数据合并到当前工作空间。

### 如何切换项目？
点击侧边栏顶部的 **文件夹图标**。这允许您打开一个全新的存储目录，应用会重新加载并显示该目录下的内容。

### 如何设置保存路径？
在 **设置 -> 通用** 标签页中，您可以查看并更改当前白板数据的存储位置。

---

## 🤝 贡献规范

- **代码风格**：遵循 ESLint 和 Prettier 配置。
- **状态修改**：涉及画布数据的修改请通过 `boardStore` 的 `updateBoardCanvas` 接口。
- **IPC 通信**：新的文件系统操作需在 `electron/main.ts` 注册处理函数，并在 `preload.ts` 中暴露。

---

💡 *提示：本工具针对手写板进行了优化，建议配合手写板使用以获得最佳压感效果。*
