# 三大厂商 LLM API 格式对照

> 本文档对比 **OpenAI**、**Anthropic**、**Google** 三家主流大模型 API 的请求与响应参数格式，
> 为 core 层统一抽象设计提供参考。

---

## 1. OpenAI — Chat Completions API

**Endpoint**: `POST https://api.openai.com/v1/chat/completions`

### 请求头 (Headers)

| Header | 值 | 说明 |
|---|---|---|
| `Content-Type` | `application/json` | 必填 |
| `Authorization` | `Bearer sk-xxx` | API Key 鉴权 |

### 请求体 (Request Body)

```jsonc
{
  "model": "gpt-4o",                         // 必填 - 模型名称
  "messages": [                              // 必填 - 消息列表
    {
      "role": "system",                      // 角色: system | user | assistant | tool
      "content": "你是一个助手"               // 内容: string | ContentPart[]
    },
    {
      "role": "user",
      "content": "你好"
      // content 也可为多模态数组:
      // [
      //   { "type": "text", "text": "描述图片" },
      //   { "type": "image_url", "image_url": { "url": "https://..." } }
      // ]
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [                        // 模型发起的工具调用
        {
          "id": "call_abc123",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"location\":\"北京\"}"
          }
        }
      ]
    },
    {
      "role": "tool",                        // 工具调用结果
      "tool_call_id": "call_abc123",
      "content": "{\"temp\": 25}"
    }
  ],
  "tools": [                                 // 可选 - 工具定义列表
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "获取天气信息",
        "parameters": {                      // JSON Schema
          "type": "object",
          "properties": {
            "location": { "type": "string" }
          },
          "required": ["location"]
        }
      }
    }
  ],
  "temperature": 0.7,                        // 可选 - 温度 0~2
  "max_tokens": 4096,                        // 可选 - 最大输出 token
  "stream": false,                           // 可选 - 是否流式
  "stop": ["\n"],                            // 可选 - 停止词
  "top_p": 1,                                // 可选
  "frequency_penalty": 0,                    // 可选
  "presence_penalty": 0,                     // 可选
  "response_format": { "type": "json_object" } // 可选 - 输出格式约束
}
```

### 响应体 (Response Body)

```jsonc
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "gpt-4o-2024-08-06",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么可以帮你的？",
        "tool_calls": null                   // 有工具调用时为非 null
      },
      "finish_reason": "stop"                // stop | tool_calls | length | content_filter
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 15,
    "total_tokens": 35
  }
}
```

### 流式响应 (SSE)

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":"你"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"好"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

---

## 2. Anthropic — Messages API

**Endpoint**: `POST https://api.anthropic.com/v1/messages`

### 请求头 (Headers)

| Header | 值 | 说明 |
|---|---|---|
| `Content-Type` | `application/json` | 必填 |
| `x-api-key` | `sk-ant-xxx` | API Key 鉴权 |
| `anthropic-version` | `2023-06-01` | API 版本，必填 |
| `anthropic-beta` | `prompt-caching-2024-07-31` | Beta 功能标识，可选 |

### 请求体 (Request Body)

```jsonc
{
  "model": "claude-sonnet-4-20250514",        // 必填 - 模型名称
  "max_tokens": 4096,                        // 必填 - 最大输出 token
  "system": "你是一个助手",                   // 可选 - 系统提示 (string | ContentBlock[])
  // system 也支持带缓存的多块形式:
  // "system": [
  //   { "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }
  // ],
  "messages": [                              // 必填 - 消息列表 (user/assistant 交替)
    {
      "role": "user",
      "content": "你好"
      // content 可为 string 或 ContentBlock[]:
      // [
      //   { "type": "text", "text": "描述图片" },
      //   { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "..." } }
      // ]
    },
    {
      "role": "assistant",
      "content": [                           // assistant content 始终是 ContentBlock[]
        { "type": "text", "text": "让我查一下天气" },
        {
          "type": "tool_use",                // 模型发起的工具调用
          "id": "toolu_abc123",
          "name": "get_weather",
          "input": { "location": "北京" }    // 直接是对象，非 JSON 字符串
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",             // 工具调用结果
          "tool_use_id": "toolu_abc123",
          "content": "{\"temp\": 25}"        // string | ContentBlock[]
        }
      ]
    }
  ],
  "tools": [                                 // 可选 - 工具定义列表
    {
      "name": "get_weather",
      "description": "获取天气信息",
      "input_schema": {                      // JSON Schema (注意字段名是 input_schema)
        "type": "object",
        "properties": {
          "location": { "type": "string" }
        },
        "required": ["location"]
      }
    }
  ],
  "temperature": 0.7,                        // 可选
  "top_p": 1,                                // 可选
  "top_k": 40,                               // 可选 (Anthropic 独有)
  "stream": false,                           // 可选
  "stop_sequences": ["\n"],                  // 可选 - 停止词 (注意字段名)
  "thinking": {                              // 可选 - 扩展思考 (Extended Thinking)
    "type": "enabled",
    "budget_tokens": 10000
  }
}
```

### 响应体 (Response Body)

```jsonc
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [                               // 始终是 ContentBlock[] 数组
    {
      "type": "text",
      "text": "你好！有什么可以帮你的？"
    }
    // 工具调用时:
    // {
    //   "type": "tool_use",
    //   "id": "toolu_abc123",
    //   "name": "get_weather",
    //   "input": { "location": "北京" }
    // }
    // 扩展思考时:
    // { "type": "thinking", "thinking": "...", "signature": "..." }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",                 // end_turn | tool_use | max_tokens | stop_sequence
  "stop_sequence": null,
  "usage": {
    "input_tokens": 20,
    "output_tokens": 15,
    // 缓存相关:
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

### 流式响应 (SSE)

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_abc","type":"message",...}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"你好"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}

event: message_stop
data: {"type":"message_stop"}
```

---

## 3. Google — Gemini generateContent API

**Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}`

> API Key 通过 URL query 参数传递，而非 Header。

### 请求头 (Headers)

| Header | 值 | 说明 |
|---|---|---|
| `Content-Type` | `application/json` | 必填 |

### 请求体 (Request Body)

```jsonc
{
  "contents": [                              // 必填 - 对话内容列表
    {
      "role": "user",                        // 角色: user | model (注意不是 assistant)
      "parts": [                             // 内容块数组 (不是 content)
        { "text": "你好" }
        // 多模态:
        // { "inline_data": { "mime_type": "image/png", "data": "base64..." } }
        // { "file_data": { "mime_type": "image/png", "file_uri": "gs://..." } }
      ]
    },
    {
      "role": "model",                       // 注意: 用 "model" 而非 "assistant"
      "parts": [
        { "text": "你好！有什么可以帮你的？" }
      ]
    },
    // 工具调用与结果
    {
      "role": "model",
      "parts": [
        {
          "function_call": {                 // 模型发起的工具调用 (注意字段名)
            "name": "get_weather",
            "args": { "location": "北京" }   // 直接是对象
          }
        }
      ]
    },
    {
      "role": "user",
      "parts": [
        {
          "function_response": {             // 工具调用结果
            "name": "get_weather",
            "response": { "temp": 25 }
          }
        }
      ]
    }
  ],
  "systemInstruction": {                     // 可选 - 系统提示 (注意命名风格)
    "parts": [
      { "text": "你是一个助手" }
    ]
  },
  "tools": [                                 // 可选 - 工具定义 (function_declarations)
    {
      "function_declarations": [
        {
          "name": "get_weather",
          "description": "获取天气信息",
          "parameters": {                    // JSON Schema
            "type": "object",
            "properties": {
              "location": { "type": "string" }
            },
            "required": ["location"]
          }
        }
      ]
    }
  ],
  "generationConfig": {                      // 可选 - 生成配置 (独立对象)
    "temperature": 0.7,
    "topP": 1,
    "topK": 40,
    "maxOutputTokens": 4096,                 // 注意字段名
    "stopSequences": ["\n"],
    "candidateCount": 1,
    "responseMimeType": "application/json",  // 可选 - 强制 JSON 输出
    "responseSchema": {}                     // 可选 - JSON Schema 约束
  },
  "safetySettings": [                        // 可选 - 安全设置 (Google 独有)
    {
      "category": "HARM_CATEGORY_HARASSMENT",
      "threshold": "BLOCK_ONLY_HIGH"
    }
  ]
}
```

### 响应体 (Response Body)

```jsonc
{
  "candidates": [                            // 候选结果数组
    {
      "content": {
        "role": "model",
        "parts": [
          { "text": "你好！有什么可以帮你的？" }
          // 工具调用时:
          // {
          //   "functionCall": {
          //     "name": "get_weather",
          //     "args": { "location": "北京" }
          //   }
          // }
        ]
      },
      "finishReason": "STOP",                // STOP | MAX_TOKENS | SAFETY | RECITATION | OTHER
      "safetyRatings": [                     // 安全评分 (Google 独有)
        {
          "category": "HARM_CATEGORY_HARASSMENT",
          "probability": "NEGLIGIBLE"
        }
      ],
      "index": 0
    }
  ],
  "usageMetadata": {                         // token 用量 (注意命名风格)
    "promptTokenCount": 20,
    "candidatesTokenCount": 15,
    "totalTokenCount": 35
  },
  "modelVersion": "gemini-2.5-flash"
}
```

### 流式响应 (SSE) — streamGenerateContent

```
data: {"candidates":[{"content":{"role":"model","parts":[{"text":"你"}]},"finishReason":null}],"usageMetadata":{"promptTokenCount":20}}

data: {"candidates":[{"content":{"role":"model","parts":[{"text":"好"}]},"finishReason":null}]}

data: {"candidates":[{"content":{"role":"model","parts":[{"text":"！"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":20,"candidatesTokenCount":15,"totalTokenCount":35}}
```

---

## 关键差异对照表

| 维度 | OpenAI | Anthropic | Google |
|------|--------|-----------|--------|
| **Endpoint** | `/v1/chat/completions` | `/v1/messages` | `/v1beta/models/{model}:generateContent` |
| **鉴权方式** | `Authorization: Bearer xxx` | `x-api-key: xxx` | URL 参数 `?key=xxx` |
| **系统提示** | `messages[{role:"system"}]` | 顶层 `system` 字段 | 顶层 `systemInstruction` |
| **消息角色** | `system/user/assistant/tool` | `user/assistant` (交替) | `user/model` |
| **消息内容字段** | `content` (string\|array) | `content` (string\|ContentBlock[]) | `parts` (Part[]) |
| **工具定义** | `tools[].function` | `tools[]` (扁平) | `tools[].function_declarations` |
| **工具 Schema 字段** | `parameters` | `input_schema` | `parameters` |
| **工具调用** | `tool_calls[].function.arguments` (JSON字符串) | `content[].input` (对象) | `parts[].functionCall.args` (对象) |
| **工具结果** | `{role:"tool", tool_call_id, content}` | `{type:"tool_result", tool_use_id}` | `{function_response: {name, response}}` |
| **最大输出** | `max_tokens` (可选) | `max_tokens` (**必填**) | `generationConfig.maxOutputTokens` |
| **停止原因** | `finish_reason` ("stop"/"tool_calls") | `stop_reason` ("end_turn"/"tool_use") | `finishReason` ("STOP") |
| **Token 用量** | `usage` | `usage` | `usageMetadata` |
| **响应结构** | `choices[].message` | 顶层 `content[]` | `candidates[].content.parts[]` |
| **content 形式** | string 或 null | **始终** ContentBlock[] | **始终** Part[] |
| **流式终止符** | `data: [DONE]` | `event: message_stop` | 无特殊终止符 |
| **独有特性** | `response_format`、`logprobs` | `thinking`、`cache_control`、`top_k` | `safetySettings`、`systemInstruction` |

---

## 统一抽象建议

设计 core 层的统一接口时，建议以 **OpenAI 格式为基准**，理由：

1. **生态最广** — 绝大多数国内外厂商 (DeepSeek、通义、智谱、Moonshot、零一万物等) 均兼容 OpenAI 格式
2. **结构最简** — 消息结构扁平，字段命名直观
3. **转换成本低** — Anthropic 和 Google 的差异可通过 adapter 层处理

### 需要 adapter 处理的核心差异

```
OpenAI → Anthropic:
  - system message → 顶层 system 字段
  - tool_calls[].function.arguments (string) → content[].input (object)
  - role:"tool" → content[{type:"tool_result"}]
  - finish_reason "stop" → "end_turn", "tool_calls" → "tool_use"

OpenAI → Google:
  - messages → contents (role: assistant → model)
  - content (string) → parts[{text}]
  - system message → systemInstruction
  - tools[].function → tools[].function_declarations
  - tool_calls → functionCall, tool result → functionResponse
  - max_tokens → generationConfig.maxOutputTokens
```
