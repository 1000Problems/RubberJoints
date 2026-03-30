"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const chips = [
    "My status",
    "Today's focus",
    "Weekly progress",
    "+ Add to plan",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ background: "var(--s1)" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            {/* AI Avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <h2 className="text-[17px] font-bold mb-1" style={{ color: "var(--tx)" }}>
              Your Mobility Coach
            </h2>
            <p className="text-[13px] mb-6" style={{ color: "var(--tx3)" }}>
              Ask me about your exercises, supplements, or plan
            </p>

            {/* Disclaimer */}
            <div
              className="rounded-lg p-3 mb-6 text-[11px] text-left w-full"
              style={{ background: "#fff8e1", border: "1px solid #ffe082", color: "#8d6e00" }}
            >
              <span style={{ color: "#e65100" }}>⚠</span> AI suggestions are for informational purposes. Consult a healthcare provider for medical advice.
            </div>

            {/* Chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
                  style={{
                    background: chip.startsWith("+") ? "rgba(74,108,247,0.06)" : "var(--s1)",
                    border: `1px solid ${chip.startsWith("+") ? "var(--acc)" : "var(--brd)"}`,
                    color: chip.startsWith("+") ? "var(--acc)" : "var(--tx)",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="flex gap-2 mb-3"
            style={{
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {msg.role === "assistant" && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1"
                style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
            )}
            <div
              className="max-w-[85%] px-3.5 py-2.5 text-[14px] leading-relaxed"
              style={{
                background: msg.role === "user" ? "var(--acc)" : "var(--s1)",
                color: msg.role === "user" ? "white" : "var(--tx)",
                border: msg.role === "assistant" ? "1px solid var(--s3)" : "none",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              }}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 mb-3" style={{ animation: "fadeIn 0.3s ease" }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--acc), var(--pur))" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <div
              className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
              style={{ background: "var(--s1)", border: "1px solid var(--s3)" }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[7px] h-[7px] rounded-full"
                  style={{
                    background: "var(--tx3)",
                    animation: `aiBounce 1.4s infinite ease-in-out ${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chips bar */}
      {messages.length > 0 && (
        <div
          className="flex gap-1.5 px-3 py-2 overflow-x-auto"
          style={{
            background: "var(--bg)",
            borderTop: "1px solid var(--s3)",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {chips.map((chip) => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150"
              style={{
                background: chip.startsWith("+") ? "rgba(74,108,247,0.06)" : "var(--s1)",
                border: `1px solid ${chip.startsWith("+") ? "var(--acc)" : "var(--brd)"}`,
                color: chip.startsWith("+") ? "var(--acc)" : "var(--tx)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2" style={{ background: "var(--bg)", borderTop: messages.length === 0 ? "1px solid var(--s3)" : "none" }}>
        <div
          className="flex items-end gap-2 rounded-[20px] px-4 py-1.5"
          style={{ background: "var(--s1)", border: "1px solid var(--brd)" }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask your coach..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-[14px] leading-[1.4] py-1.5"
            style={{ color: "var(--tx)", maxHeight: "120px" }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5 transition-all duration-150"
            style={{
              background: loading || !input.trim() ? "var(--s3)" : "var(--acc)",
              color: loading || !input.trim() ? "var(--tx3)" : "white",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
