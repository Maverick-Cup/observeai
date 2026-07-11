/**
 * Chat Action — server-side proxy for Fireworks AI chat completions.
 *
 * The frontend calls this action instead of calling Fireworks directly.
 * The API key lives ONLY in Convex environment variables (never the browser).
 */
import { v } from "convex/values";
import { action } from "./_generated/server";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const REQUEST_TIMEOUT_MS = 15_000;

interface FireworksMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface FireworksChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

interface FireworksResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: FireworksChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const sendMessage = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    max_tokens: v.optional(v.number()),
  },
  handler: async (_, args): Promise<{ content: string; usage?: { prompt: number; completion: number; total: number } }> => {
    const apiKey = process.env.FIREWORKS_API_KEY;

    if (!apiKey) {
      return {
        content:
          "⚠️ **Fireworks AI key not configured.** An admin needs to add `FIREWORKS_API_KEY` in the Convex dashboard (Settings → Environment Variables). Once set, I'll be ready to help!",
      };
    }

    const model = args.model ?? "llama-v3p1-8b-instruct";
    console.log("Chat action: using model", model);
    const temperature = args.temperature ?? 0.4;
    const maxTokens = args.max_tokens ?? 512;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: args.messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const detail = (errorBody as { detail?: string }).detail ?? response.statusText;
        console.error("Fireworks API error:", response.status, detail, "for model:", model);
        // 404 typically means the model name is wrong or the key lacks access
        if (response.status === 404) {
          return {
            content: `The AI model wasn't found (404). The model name \`${model}\` may be incorrect, or your Fireworks API key doesn't have access to it. Check the model name in \`convex/chat.ts\` line 59, or verify in the [Fireworks dashboard](https://fireworks.ai/account/api-keys) that your key is active.`,
          };
        }
        return {
          content: `I hit an issue reaching the AI model (HTTP ${response.status}: ${detail}). Could you try again?`,
        };
      }

      const data = (await response.json()) as FireworksResponse;
      const content = data.choices[0]?.message?.content?.trim();
      const usage = data.usage;

      if (!content) {
        return {
          content: "I got an empty response from the model. Could you rephrase that?",
        };
      }

      return {
        content,
        usage: usage
          ? { prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens }
          : undefined,
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return { content: "The request timed out. Could you try again?" };
      }
      console.error("Chat action error:", err);
      return {
        content: "Something went wrong on my end. Let me know if it persists!",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});