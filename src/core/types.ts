import { z } from 'zod';

export const ToolFunctionSchema = z.object({
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.object({
            type: z.literal('object'),
            properties: z.record(z.string(), z.any()),
            required: z.array(z.string()),
        }),
    })
});

export type ToolFunction = z.infer<typeof ToolFunctionSchema>;

// 消息角色
export const ChatMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

// 多模态消息内容
export const MultiChatMessageContentSchema = z.object({
    type: z.enum(['text', 'image_url', 'video_url']),
    text: z.string().optional(),
    image_url: z.object({ url: z.string() }).optional(),
    video_url: z.object({ url: z.string() }).optional(),
    fps: z.number().optional(),
});
export type MultiChatMessageContent = z.infer<typeof MultiChatMessageContentSchema>;

// 工具函数调用
export const ToolFunctionCallSchema = z.object({
    type: z.literal('function'),
    function: z.object({
        name: z.string(),
        arguments: z.string(),
    }),
});
export type ToolFunctionCall = z.infer<typeof ToolFunctionCallSchema>;

// 聊天消息
export const ChatMessageSchema = z.object({
    role: ChatMessageRoleSchema,
    content: z.union([z.string(), z.array(MultiChatMessageContentSchema), z.null()]),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(ToolFunctionCallSchema).optional(),
    enable_search: z.boolean().optional(),
    enable_thinking: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// 请求
export const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema),
    model: z.string(),
    tools: z.array(ToolFunctionSchema).optional(),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    top_p: z.number().optional(),
    frequency_penalty: z.number().optional(),
    presence_penalty: z.number().optional(),
    response_format: z.string().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// 聊天响应
export const ChatResponseSchema = z.object({
    id: z.string(),
    object: z.string(),
    created: z.number(),
    model: z.string(),
    choices: z.array(z.object({
        index: z.number(),
        finish_reason: z.string().optional(),
        delta: z.object({
            content: z.union([z.string(), z.null()]),
            reasoning_content: z.union([z.string(), z.null()]),
            tool_calls: z.object({
                id: z.string(),
                index: z.number(),
                type: z.string(),
                function: z.object({
                    name: z.union([z.string(), z.null()]),
                    arguments: z.string(),
                }),
            }).optional(),
        }),
    })),
    usage: z.object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number(),
    }).optional(),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export interface BaseChatModel {
    readonly model: string;
    invoke: (request: ChatRequest) => Promise<ChatResponse>;
}