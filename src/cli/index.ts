#!/usr/bin/env node

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const HELP_TEXT = `
easy-agent-cli - 简易 CLI 智能体

用法:
  easy-agent [命令]

可用命令:
  /help       显示帮助信息
  /exit       退出程序
  /version    显示版本号

描述:
  一个轻量级的命令行智能体工具，支持多轮对话与工具调用。
`;

const VERSION = "0.0.01";

async function main(): Promise<void> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
  });

  console.log("easy-agent-cli v" + VERSION);
  console.log('输入 /help 查看帮助信息，输入 /exit 退出\n');

  try {
    while (true) {
      const input = (await rl.question("> ")).trim();

      if (!input) continue;

      switch (input) {
        case "/help":
          console.log(HELP_TEXT);
          break;
        case "/exit":
          console.log("再见！");
          rl.close();
          return;
        case "/version":
          console.log(`v${VERSION}`);
          break;
        default:
          console.log(`未知命令: ${input}`);
          console.log('输入 /help 查看可用命令');
          break;
      }
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error("发生错误:", err);
  process.exit(1);
});
