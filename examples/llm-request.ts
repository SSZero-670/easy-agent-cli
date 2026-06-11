/**
 * LLM API 请求示例
 * 使用 Node.js 原生 fetch + eventsource-parser
 *
 * 运行: npx tsx examples/llm-request.ts
 */

import { createParser } from "eventsource-parser";

// ─── 配置 ──────────────────────────────────────────────
const API_KEY = process.env.OPENAI_API_KEY ?? "sk-xxx";
const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const MODEL = process.env.MODEL ?? "gpt-4o";

// ─── 1. 普通 HTTP 请求（非流式）──────────────────────────
async function chatCompletion(prompt: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── 2. SSE 流式请求 ────────────────────────────────────
async function chatCompletionStream(
  prompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  if (!response.body) {
    throw new Error("响应体为空，无法读取流");
  }

  let fullContent = "";

  // 创建 SSE 解析器
  const parser = createParser({
    onEvent: (event) => {
      // OpenAI 流式数据格式: data: {...} 或 data: [DONE]
      if (!event.event && event.data) {
        if (event.data === "[DONE]") return;

        const chunk = JSON.parse(event.data);
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      }
    },
  });

  // 读取流并喂给解析器
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }

  return fullContent;
}

// ─── 3. 使用示例 ────────────────────────────────────────
async function main(): Promise<void> {
  const prompt = "用一句话解释什么是 TypeScript";

  // 普通请求
  console.log("=== 普通请求 ===");
  try {
    const result = await chatCompletion(prompt);
    console.log(result);
  } catch (err) {
    console.error("普通请求失败:", (err as Error).message);
  }

  console.log("\n=== SSE 流式请求 ===");
  try {
    const result = await chatCompletionStream(prompt, (chunk) => {
      process.stdout.write(chunk); // 实时输出每个 token
    });
    console.log("\n\n完整回复:", result);
  } catch (err) {
    console.error("流式请求失败:", (err as Error).message);
  }
}

main().catch(console.error);
