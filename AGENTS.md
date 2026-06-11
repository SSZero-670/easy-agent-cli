# AGENTS.md - easy-agent-cli 开发规范

## 项目概述

easy-agent-cli 是一个基于 TypeScript + Node.js 的轻量级命令行智能体工具。采用分层架构设计，支持多轮对话与工具调用。

## 技术栈

- **语言**: TypeScript 5.5+
- **运行时**: Node.js 20+
- **模块系统**: ESM (`"type": "module"`)
- **构建工具**: tsc
- **开发工具**: tsx (热重载)

## 目录结构

```
src/
├── cli/           # CLI 入口层 - 命令解析与交互入口
├── core/          # 核心逻辑层 - Agent 核心调度与流程控制
├── agents/        # 智能体层 - Agent 定义、注册与生命周期管理
├── tools/         # 工具层 - 内置工具与工具注册机制
├── context/       # 上下文层 - 对话上下文管理与记忆
├── session/       # 会话层 - 会话状态管理与持久化
├── ui/            # 界面层 - 终端渲染与用户交互
└── permissions/   # 权限层 - 工具调用权限与安全控制
```

## 架构分层说明

| 层级 | 职责 | 依赖方向 |
|------|------|----------|
| cli | 入口、命令路由、REPL 交互 | → core, ui |
| core | Agent 调度、消息路由、流程编排 | → agents, tools, context, session |
| agents | Agent 实现、能力定义 | → tools, context |
| tools | 工具实现与注册 | → permissions |
| context | 上下文构建与管理 | 无下层依赖 |
| session | 会话状态与历史管理 | 无下层依赖 |
| ui | 终端渲染、格式化输出 | 无下层依赖 |
| permissions | 权限校验与安全策略 | 无下层依赖 |

**依赖规则**: 上层可依赖下层，下层不可依赖上层。同层之间尽量避免直接依赖。

## 编码规范

### 命名约定

- **文件名**: `kebab-case.ts` (如 `agent-runner.ts`)
- **类名**: `PascalCase` (如 `AgentRunner`)
- **函数/变量**: `camelCase` (如 `runAgent`)
- **常量**: `UPPER_SNAKE_CASE` (如 `MAX_RETRIES`)
- **接口**: `I` 前缀 (如 `IAgent`)
- **类型**: `PascalCase` (如 `AgentConfig`)

### 代码风格

- 使用 ESM `import/export`，禁止 `require()`
- 优先使用 `interface` 定义类型，复杂联合类型用 `type`
- 所有函数必须有明确的返回类型注解
- 异步操作统一使用 `async/await`
- 错误处理使用自定义 Error 类

### 模块导出

- 每个层通过 `index.ts` 统一导出公共 API
- 内部实现文件不直接对外暴露

## 开发命令

```bash
# 安装依赖
npm install

# 开发模式 (热重载)
npm run dev

# 构建
npm run build

# 运行构建产物
npm start
```

## 提交规范

```
feat:     新功能
fix:      修复 Bug
refactor: 重构 (不新增功能/不修复 Bug)
docs:     文档变更
chore:    构建/工具链变更
test:     测试相关
```

## 注意事项

- 不要在 cli 层写业务逻辑，只做命令路由
- 工具调用必须经过 permissions 层校验
- session 数据应考虑持久化场景
- context 层需注意 token 限制管理
- 本项目为学习项目 未经允许时不需要编写代码
