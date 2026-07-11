import { useState, useRef, useEffect, useCallback } from "react";
import { convexAction } from "../../lib/convex";
import { CONFIG } from "../../constants/config";
import SITEMAP from "../../data/sitemap";
import {
  Sparkles,
  Send,
  Bot,
  User,
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
  X,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  googleUrl?: string;
}

interface AIAssistantProps {
  onClose: () => void;
  /** When true, renders without backdrop/dialog shell — for embedding inside PortalSearch */
  inline?: boolean;
}

// ── System Prompt Builder ──────────────────────────────────────────

function buildSystemPrompt(): string {
  const pages = SITEMAP.map(
    (e) =>
      `- ${e.label} (${e.path}): ${e.description} [Tags: ${e.tags.join(", ")}]`,
  ).join("\n");

  return `You are ObserveAI Assistant — the built-in AI help agent for the ObserveAI platform, an AI Observability Platform.

Your job is to help users understand, navigate, and troubleshoot their AI stack using platform knowledge.

## Platform Pages & Features

${pages}

## How to Answer

1. **Platform questions** — Be specific. Mention page names, paths, and features so the user can navigate there.
2. **General AI knowledge** — You can answer general questions about LLMs, observability, guardrails, etc., but clearly mark when you're speaking from general knowledge vs. platform-specific data.
3. **"Show me my data" requests** — You cannot query live data. Guide the user to the relevant page in the platform (e.g. "Head to /traces to see your recent traces").
4. **Uncertainty** — If you genuinely don't know or the question is outside your scope, say so honestly and suggest a Google search. Provide a search URL like: https://www.google.com/search?q=encoded+query+here
5. **Tone** — Be conversational, confident, and concise. 2–4 sentences is ideal. Don't be overly formal. You're a helpful platform expert, not a robot.
6. **Ironic self-awareness** — If someone asks "do you hallucinate?" feel free to make a lighthearted self-referential joke about it — that's the point.`;
}

// ── Google Fallback URL ────────────────────────────────────────────

function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

// ── Component ──────────────────────────────────────────────────────

export function AIAssistant({ onClose, inline = false }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm your ObserveAI assistant. Ask me anything about the platform — how to use features, what each page does, or best practices for AI observability. I can also answer general AI questions, though I'll let you know when I'm stepping outside platform knowledge.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convexMissing, setConvexMissing] = useState(!CONFIG.convexUrl);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking]);

  // Auto-focus input
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // ── Send message ───────────────────────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || thinking) return;

      setError(null);
      setInput("");

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      try {
        const systemPrompt = buildSystemPrompt();

        const conversation = [
          { role: "system" as const, content: systemPrompt },
          ...messages
            .filter((m) => m.id !== "welcome" || messages.indexOf(m) === 0)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          { role: "user" as const, content: trimmed },
        ];

        // Call server-side Convex action — API key stays on the server
        const result = await convexAction<{ messages: typeof conversation }, { content: string }>(
          "chat:sendMessage",
          { messages: conversation },
        );

        if (!result) {
          throw new Error("Convex returned no result — check if it's deployed.");
        }

        const reply = result.content?.trim() || "I'm not sure how to answer that. Could you rephrase?";

        const googleMatch = reply.match(
          /https?:\/\/www\.google\.com\/search\?q=([^\s)]+)/,
        );
        const googleUrl = googleMatch ? googleMatch[0] : undefined;

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          googleUrl,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error("AI Assistant error:", err);

        let userMessage = "I couldn't reach the AI model right now.";
        if (err instanceof Error && err.message) {
          if (err.message.includes("401") || err.message.includes("UNAUTHORIZED")) {
            userMessage =
              "The AI model key needs to be set in the Convex dashboard (Settings → Environment Variables). Ask an admin to add `FIREWORKS_API_KEY`.";
          } else if (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")) {
            userMessage = "Network issue — check your connection.";
          } else {
            userMessage = err.message;
          }
        }

        setError(userMessage);

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-fallback-${Date.now()}`,
            role: "assistant",
            content: `I hit a snag reaching the AI. In the meantime, try searching for "${trimmed}" on Google:`,
            googleUrl: googleSearchUrl(trimmed),
          },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [messages, thinking],
  );

  // ── Keyboard handler ───────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  // ── Suggested prompts ──────────────────────────────────────────

  const suggestions = [
    "What can I do on the Dashboard?",
    "How do guardrails work?",
    "How do you handle hallucinations?",
    "What's a good reliability score?",
  ];

  // ── Sub-renderers ──────────────────────────────────────────────

  const renderHeader = () => (
    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ask ObserveAI</h2>
          <p className="text-[11px] text-muted-foreground">
            Powered by Fireworks AI · Server-side · Key stays private
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  const renderWarning = () =>
    convexMissing ? (
      <div className="mx-5 mt-3 p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Convex not configured.</span>{" "}
          Add a{" "}
          <code className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded">
            VITE_CONVEX_URL
          </code>{" "}
          to your environment to enable AI answers.
        </div>
      </div>
    ) : null;

  const renderMessages = () => (
    <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
      {messages.length === 1 && !thinking && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
            <Search className="w-3 h-3" />
            Try asking about:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={thinking || convexMissing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted border border-border rounded-full
                  text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5
                  transition-all duration-150 ease-out cursor-pointer active:scale-[0.97]
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {s}
                <ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {msg.role === "assistant" && (
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
          )}

          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
              msg.role === "user"
                ? "bg-primary text-on-primary rounded-tr-md"
                : "bg-muted border border-border rounded-tl-md"
            }`}
          >
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user" ? "text-on-primary" : "text-foreground"
              }`}
            >
              {msg.content}
            </p>

            {msg.googleUrl && (
              <a
                href={msg.googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 text-xs font-medium
                  bg-background border border-border rounded-full text-muted-foreground
                  hover:text-foreground hover:border-primary/30 transition-all duration-150 ease-out"
              >
                <Globe className="w-3 h-3" />
                Search Google
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {msg.role === "user" && (
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="w-3.5 h-3.5 text-on-primary" />
            </div>
          )}
        </div>
      ))}

      {thinking && (
        <div className="flex gap-3 justify-start">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="max-w-[80%] rounded-2xl rounded-tl-md px-4 py-3 bg-muted border border-border">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking…</span>
            </div>
          </div>
        </div>
      )}

      {error && !thinking && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );

  const renderInput = () => (
    <div className="border-t border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            convexMissing
              ? "Configure Convex to ask questions…"
              : "Ask anything about ObserveAI…"
          }
          disabled={thinking || convexMissing}
          className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground
            placeholder:text-muted-foreground outline-none
            focus:border-primary/40 focus:ring-1 focus:ring-primary/20
            transition-all duration-150 ease-out
            disabled:opacity-50 disabled:cursor-not-allowed"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || thinking || convexMissing}
          className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center
            transition-all duration-150 ease-out cursor-pointer
            hover:brightness-110 active:scale-[0.92]
            disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          {thinking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[10px] text-muted-foreground">
          <Info className="w-3 h-3 inline mr-1" />
          API key stays on the server · Never touches your browser
        </p>
        <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
          Esc to close
        </kbd>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────

  if (inline) {
    return (
      <div className="flex flex-col" style={{ maxHeight: "70vh" }}>
        {renderHeader()}
        {renderWarning()}
        {renderMessages()}
        {renderInput()}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col animate-slide-up"
        style={{ maxHeight: "80vh" }}
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
      >
        {renderHeader()}
        {renderWarning()}
        {renderMessages()}
        {renderInput()}
      </div>
    </div>
  );
}