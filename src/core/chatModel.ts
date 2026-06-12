import { ChatRequest, ChatResponse, BaseChatModel, ChatResponseSchema } from "./types.js";

export class ChatModel implements BaseChatModel {
    private readonly _baseUrl: string;
    private readonly _apiKey: string;
    readonly model: string;

    constructor(model: string, baseUrl: string) {
        this.model = model;
        this._baseUrl = baseUrl;
        this._apiKey = process.env.API_KEY || "";
    }

    async invoke(request: ChatRequest): Promise<ChatResponse> {
        const requestJson = JSON.stringify(request);
        const response = await fetch(this._baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this._apiKey}`,
            },
            body: requestJson,
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
        }

        return response.json();
        // const data = await response.json();
        // return ChatResponseSchema.parse(data);
    }

}

export async function chatModelTest() {
    const chatModel = new ChatModel("qwen3.6-plus", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions");
    const request: ChatRequest = {
        model: "qwen3.6-plus",
        messages: [{ role: "user", content: "你是谁？" }],
    };
    const response = await chatModel.invoke(request);
    console.log(JSON.stringify(response));
}

