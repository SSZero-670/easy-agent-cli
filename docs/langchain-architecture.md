# LangChain 框架架构设计分析

> 基于 LangChain 官方文档整理，涵盖 Model、Agent、非流式请求与 SSE 流式请求的架构设计。

---

## 一、整体架构概览

LangChain 生态由三个核心层次组成：

```
┌─────────────────────────────────────────────────┐
│                 LangChain (高层抽象)              │
│   createAgent / 中间件 / 结构化输出 / RAG        │
├─────────────────────────────────────────────────┤
│                 LangGraph (底层编排)              │
│   StateGraph / 节点 / 边 / 流式 / 持久化         │
├─────────────────────────────────────────────────┤
│                langchain-core (基础)              │
│   BaseChatModel / Messages / Tools / Callbacks   │
└─────────────────────────────────────────────────┘
```

| 层级 | 包名 | 职责 |
|------|------|------|
| 基础层 | `langchain-core` | 定义所有抽象基类：`BaseChatModel`、`BaseTool`、消息类型、回调系统 |
| 编排层 | `langgraph` | 基于状态图(StateGraph)的工作流编排，提供流式、持久化、人机协同等能力 |
| 应用层 | `langchain` | 高层 API（`createAgent`、中间件、结构化输出），面向终端开发者 |
| 集成层 | `langchain-openai` 等 | 各 LLM 提供商的具体集成包 |

---

## 二、Model 层架构设计

### 2.1 类继承体系

```
BaseChatModel (langchain-core)
├── ChatOpenAI (langchain-openai)
├── ChatAnthropic (langchain-anthropic)
├── ChatGoogleGenerativeAI (langchain-google-genai)
├── ChatBedrock (langchain-aws)
├── ChatOllama (langchain-ollama)
└── ... (700+ 集成)
```

**核心设计模式：模板方法模式**

`BaseChatModel` 定义了统一接口，各提供商只需实现内部生成方法：

| 方法 | 类型 | 说明 |
|------|------|------|
| `invoke()` | 公共 | 同步调用，接收消息列表，返回完整 `AIMessage` |
| `stream()` | 公共 | 流式调用，返回 `AsyncIterator<AIMessageChunk>` |
| `batch()` | 公共 | 批量调用，并行处理多个请求 |
| `streamEvents()` | 公共 | 语义事件流，返回结构化事件 |
| `bindTools()` | 公共 | 绑定工具定义到模型 |
| `_generate()` | 抽象 | 子类实现具体的 API 调用逻辑 |
| `_stream()` | 抽象 | 子类实现具体的流式 API 调用 |

### 2.2 统一消息格式

LangChain 定义了标准化的消息类型体系：

```typescript
// 消息类型层次
HumanMessage       // 用户输入
AIMessage          // 模型完整响应
AIMessageChunk     // 模型流式响应片段
SystemMessage      // 系统提示
ToolMessage        // 工具调用结果

// 消息内容块类型 (content blocks)
{ type: "text", text: "..." }
{ type: "reasoning", reasoning: "..." }
{ type: "tool_call_chunk", ... }
```

**关键设计：** 每个 `AIMessageChunk` 支持通过 `concat()` 累加成完整的 `AIMessage`，使得流式结果可以无缝转换为与非流式相同的输出格式。

### 2.3 模型初始化方式

```typescript
// 方式一：统一工厂函数（推荐）
import { init_chat_model } from "langchain/chat_models";
const model = init_chat_model("openai:gpt-5.4");

// 方式二：直接使用集成类
import { ChatOpenAI } from "@langchain/openai";
const model = new ChatOpenAI({ model: "gpt-5.4" });
```

### 2.4 Model Profiles（v1.1+）

模型通过 `.profile` 属性暴露能力信息（来源于 [models.dev](https://models.dev)）：

```typescript
const model = init_chat_model("gpt-5.4");
console.log(model.profile);
// { max_input_tokens: 128000, supports_tool_calling: true, ... }
```

---

## 三、Agent 层架构设计

### 3.1 核心 Agent 循环

LangChain 1.0 的 Agent 基于 **ReAct (Reasoning + Acting)** 模式，核心是一个模型调用-工具执行的循环：

```
用户输入 → 模型推理 → 是否生成 tool_call?
                         ├── 是 → 执行工具 → 将结果作为 ToolMessage 追加 → 再次推理
                         └── 否 → 返回最终响应
```

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户输入  │────▶│  模型调用  │────▶│ 工具执行   │
└──────────┘     └──────────┘     └──────────┘
                      ▲                 │
                      │   ToolMessage   │
                      └─────────────────┘
```

### 3.2 createAgent（v1.0 标准接口）

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-5.4",
  tools: [getWeather, searchWeb],
  systemPrompt: "You are a helpful assistant.",
  middleware: [...],            // 可选中间件
  responseFormat: zodSchema,    // 可选结构化输出
});

// 非流式调用
const result = await agent.invoke({
  messages: [{ role: "user", content: "What's the weather?" }]
});

// 流式调用
for await (const chunk of await agent.stream(
  { messages: [{ role: "user", content: "..." }] },
  { streamMode: ["updates", "messages"] }
)) {
  console.log(chunk);
}
```

### 3.3 工具调用机制

```typescript
// 1. 定义工具
const getWeather = tool(
  (input) => `It's sunny in ${input.location}.`,
  {
    name: "get_weather",
    description: "Get the weather at a location.",
    schema: z.object({ location: z.string() }),
  }
);

// 2. 绑定工具到模型（底层方式）
const modelWithTools = model.bindTools([getWeather]);

// 3. 模型生成 tool_calls → 执行工具 → 返回结果
const response = await modelWithTools.invoke("Weather in Boston?");
// response.tool_calls = [{ name: "get_weather", args: { location: "Boston" }, id: "call_1" }]
```

**工具执行流：**

```
User Message → Model (bindTools) → AIMessage (tool_calls)
                                         ↓
                                   ToolNode 执行
                                         ↓
                                   ToolMessage (结果)
                                         ↓
                                   Model 再次推理
                                         ↓
                                   AIMessage (最终响应)
```

### 3.4 中间件系统（Middleware）

Agent 支持通过中间件扩展行为：

```typescript
const agent = createAgent({
  model: "gpt-5.4",
  tools: [...],
  middleware: [
    SummarizationMiddleware(...),    // 对话历史摘要
    ModelRetryMiddleware(...),       // 模型调用重试
    ContentModerationMiddleware(...), // 内容审核
    createFilesystemMiddleware(...), // 文件系统能力
    createSubAgentMiddleware(...),   // 子 Agent 委托
  ],
});
```

中间件钩子点：
- `beforeModel` — 模型调用前修改消息
- `afterModel` — 模型调用后处理响应
- `wrapModelCall` — 包装整个模型调用
- `beforeTool` / `afterTool` — 工具调用前后

### 3.5 多 Agent 协作模式

| 模式 | 说明 | 模型调用次数 |
|------|------|:---:|
| **Subagents** | 主 Agent 委托子 Agent，结果回传主 Agent 汇总 | 4 |
| **Handoffs** | Agent 间直接交接控制权 | 3 |
| **Skills** | Agent 调用特定技能模块 | 3 |
| **Router** | 路由 Agent 分发到专用 Agent | 3 |

---

## 四、非流式请求架构

### 4.1 调用链路

```
用户调用 agent.invoke(input)
    ↓
LangGraph CompiledStateGraph.invoke()
    ↓
执行图节点（模型调用节点）
    ↓
BaseChatModel.invoke(messages)
    ↓
_generate() → 调用 LLM API（HTTP 请求）
    ↓
解析响应 → 返回完整 AIMessage
    ↓
检查 tool_calls → 如有则执行工具节点
    ↓
循环直到无 tool_calls → 返回最终状态
```

### 4.2 核心特征

| 特征 | 说明 |
|------|------|
| **阻塞等待** | `invoke()` 等待模型生成完整响应后一次性返回 |
| **返回类型** | 完整的 `AIMessage`，包含 `content`、`tool_calls` 等 |
| **适用场景** | 简单问答、后台任务、不需要实时展示生成过程的场景 |
| **Auto-streaming** | 在 LangGraph Agent 中，即使节点内用 `invoke()`，外层 `stream()` 时会自动切换为内部流式模式 |

### 4.3 Auto-streaming 机制

LangChain 的一个重要设计：**当外层使用 `stream()` 时，节点内部的 `model.invoke()` 会自动切换为内部流式模式**。

```
agent.stream(...)  →  内部节点中 model.invoke()
                              ↓ 自动检测
                       切换为 model.stream()
                              ↓
                       触发 on_llm_new_token 回调
                              ↓
                       外层 stream 实时收到 token
```

这意味着开发者可以在节点中使用简单的 `invoke()`，而不会丢失流式能力。

---

## 五、SSE 流式请求架构

### 5.1 流式层次体系

LangChain 提供了多层次的流式能力：

```
┌──────────────────────────────────────────────────────────┐
│  应用层：Event Streaming（v1.3+ 推荐）                     │
│  streamEvents() / stream_events()                        │
│  → 类型安全的语义事件流                                    │
├──────────────────────────────────────────────────────────┤
│  编排层：LangGraph Stream Modes                           │
│  stream(streamMode: "values"|"updates"|"messages"|...)   │
│  → 多种粒度的图执行流                                      │
├──────────────────────────────────────────────────────────┤
│  模型层：Chat Model Streaming                              │
│  model.stream() / model.streamEvents()                   │
│  → token 级别的模型输出流                                   │
├──────────────────────────────────────────────────────────┤
│  传输层：SSE / WebSocket                                   │
│  LangSmith Server / Agent Protocol                       │
│  → HTTP SSE 或全双工 WebSocket                            │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Chat Model 级流式

```typescript
// 基础 token 流
const stream = await model.stream("Tell me a story");
for await (const chunk of stream) {
  console.log(chunk.text);  // 逐 token 输出
}

// 累加成完整消息
let full: AIMessageChunk | null = null;
for await (const chunk of stream) {
  full = full ? full.concat(chunk) : chunk;
}
// full 等价于 invoke() 返回的 AIMessage

// 语义事件流
const eventStream = await model.streamEvents("Hello");
for await (const event of eventStream) {
  switch (event.event) {
    case "on_chat_model_start":   // 模型开始
    case "on_chat_model_stream":  // 每个 token
    case "on_chat_model_end":     // 模型完成（含完整消息）
  }
}
```

### 5.3 LangGraph Stream Modes

| 模式 | 输出内容 | 适用场景 |
|------|---------|---------|
| `values` | 每个步骤后的完整状态快照 | 调试、状态追踪 |
| `updates` | 每个节点的增量状态更新 | 进度展示 |
| `messages` | `(token, metadata)` 元组 | 聊天 UI、token 流 |
| `custom` | 节点通过 `writer` 发出的自定义数据 | 进度条、工具状态 |
| `tools` | 工具调用生命周期事件 | 工具执行可视化 |
| `debug` | 所有可用的执行信息 | 深度调试 |

**多模式组合：**

```typescript
for await (const [mode, chunk] of await agent.stream(
  input,
  { streamMode: ["updates", "messages", "custom"] }
)) {
  if (mode === "messages") { /* token 流 */ }
  if (mode === "updates")  { /* 状态更新 */ }
  if (mode === "custom")   { /* 自定义事件 */ }
}
```

### 5.4 v2 统一输出格式（LangGraph v1.1+）

```typescript
// version="v2" 提供统一的 StreamPart 格式
for await (const part of agent.stream(input, {
  streamMode: ["values", "updates", "messages"],
  version: "v2"
})) {
  // 统一格式：{ type, ns, data }
  console.log(part.type);  // "values" | "updates" | "messages"
  console.log(part.ns);    // 命名空间（子图场景）
  console.log(part.data);  // 实际负载
}
```

### 5.5 Agent Protocol — SSE 传输层

LangChain 的部署层（LangSmith Server）基于 **Agent Protocol** 提供 SSE 流式接口：

**SSE 连接流程：**

```
1. 创建 Thread
   POST /threads → { thread_id }

2. 打开 SSE 事件订阅
   POST /threads/{thread_id}/stream/events
   Body: { "channels": ["values", "updates", "messages", "tools", "lifecycle", ...] }
   → 保持长连接，持续接收 SSE 事件

3. 发送运行命令（独立请求）
   POST /threads/{thread_id}/commands
   Body: { "id": 1, "method": "run.start", "params": { "assistant_id": "agent", "input": {...} } }

4. SSE 连接持续推送 ProtocolEvent
   data: {"method": "messages", "data": {...}}
   data: {"method": "updates", "data": {...}}
   ...
```

**协议要点：**
- SSE 订阅和运行命令是**两个独立的 HTTP 请求**
- 每个 SSE 行是一个 `ProtocolEvent` 信封
- 支持 `transport: "websocket"` 切换为全双工 WebSocket

### 5.6 前端流式消费

LangChain 提供 `useStream` Hook 用于前端消费：

```tsx
import { useStream } from "@langchain/react";

function Chat() {
  const stream = useStream<typeof myAgent>({
    apiUrl: "http://localhost:2024",
    assistantId: "agent",
  });

  return (
    <div>
      {stream.messages.map((msg) => (
        <Message key={msg.id} message={msg} toolCalls={stream.toolCalls} />
      ))}
    </div>
  );
}
```

`useStream` 返回的核心状态：
- `messages` — 实时消息数组
- `toolCalls` — `AssembledToolCall[]`，包含工具名、参数、输出、状态
- 支持 React / Vue / Svelte / Angular

---

## 六、非流式 vs 流式对比

| 维度 | 非流式 (`invoke`) | 流式 (`stream` / SSE) |
|------|-------------------|----------------------|
| **返回方式** | 一次性返回完整结果 | 逐步返回增量数据 |
| **延迟体验** | 等待全部生成完成 | 首个 token 即可展示 |
| **返回类型** | `AIMessage` | `AIMessageChunk` 迭代器 / SSE 事件流 |
| **适用场景** | 后台处理、简单 API | 聊天 UI、实时交互 |
| **工具调用** | 完整的 `tool_calls` | `ToolCallChunk` 逐步构建 |
| **内存占用** | 一次性 | 分块处理，适合长文本 |
| **Auto-streaming** | 外层 stream 时自动启用 | 原生支持 |

---

## 七、关键设计模式总结

| 设计模式 | 应用位置 | 说明 |
|---------|---------|------|
| **模板方法** | `BaseChatModel` | 基类定义流程，子类实现 `_generate()` / `_stream()` |
| **策略模式** | 结构化输出 | `ToolStrategy` / `ProviderStrategy` 可选 |
| **观察者/回调** | 流式系统 | `on_llm_new_token` 等回调驱动流式事件 |
| **中间件/插件** | Agent 扩展 | `AgentMiddleware` 钩子系统 |
| **状态图** | LangGraph | 节点+边编排，支持条件路由和循环 |
| **累加器** | 流式消息 | `AIMessageChunk.concat()` 累加成完整消息 |
| **工厂方法** | 模型初始化 | `init_chat_model()` 统一创建不同提供商的模型 |

---

## 八、版本演进时间线

| 时间 | 版本 | 关键变化 |
|------|------|---------|
| 2022-10 | v0.0.1 | 初始发布，LLM 抽象 + Chains |
| 2022-12 | — | 加入 ReAct Agent |
| 2023-03 | — | 适配 OpenAI Function Calling |
| 2024-02 | LangGraph | 发布 LangGraph，支持状态图编排 |
| 2024-10 | — | LangGraph 成为推荐编排方式 |
| 2025-10 | v1.0.0 | `createAgent` 统一接口，标准消息格式 |
| 2026-03 | v1.1.0 | v2 类型安全流式格式，Model Profiles |
| 2026-05 | v1.3.0 | Event Streaming API (v3)，内容块中心的流式协议 |
