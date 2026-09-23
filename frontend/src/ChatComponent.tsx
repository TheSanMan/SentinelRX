import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Icon from "./Icon";
interface Message {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}
interface StreamEvent {
  type: "thinking" | "tool_use" | "tool_result" | "delta" | "done" | "error";
  content?: string;
  tool?: string;
}
const suggestions = [
  "What should I know about Metformin?",
  "Can Aspirin and Warfarin interact?",
  "What are food interactions?",
];
export default function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (messages.length && contentRef.current)
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [messages, status]);
  useEffect(() => () => controller.current?.abort(), []);
  async function sendMessage() {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setIsLoading(true);
    setStatus("Reading your question…");
    setMessages((previous) => [
      ...previous,
      { role: "user", content: userMsg },
      { role: "assistant", content: "" },
    ]);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 90000);
    let current = "";
    const update = (content: string, isError = false) =>
      setMessages((previous) => [
        ...previous.slice(0, -1),
        { role: "assistant", content, isError },
      ]);
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
        signal: abort.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(
          "The reference assistant is unavailable. Please try again when the service is connected.",
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let complete = false;
      while (!complete) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        buffer = buffer.replace(/\r\n/g, "\n");
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const payload = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n");
          if (!payload) continue;
          if (payload === "[DONE]") {
            complete = true;
            break;
          }
          const event: StreamEvent = JSON.parse(payload);
          if (event.type === "delta") {
            current += event.content ?? "";
            update(current);
            setStatus("Writing a response…");
          } else if (event.type === "thinking")
            setStatus("Reading your question…");
          else if (event.type === "tool_use")
            setStatus("Consulting medication records…");
          else if (event.type === "tool_result")
            setStatus("Reviewing the results…");
          else if (event.type === "error")
            throw new Error(
              "The assistant could not complete this request. Please check the service connection and try again.",
            );
          else if (event.type === "done") complete = true;
        }
        if (done) break;
      }
      await reader.cancel();
      if (!complete)
        throw new Error(
          "The connection ended before the response was complete. Please try again.",
        );
      if (!current)
        throw new Error("No response was returned. Please try again.");
    } catch (cause) {
      update(
        cause instanceof Error && cause.name === "Error"
          ? cause.message
          : "The connection was interrupted. Please try again.",
        true,
      );
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      setIsLoading(false);
      setStatus("");
    }
  }
  return (
    <section
      className="panel chat-panel"
      id="assistant"
      aria-labelledby="assistant-title"
    >
      <div className="panel-header">
        <div className="panel-title">
          <Icon name="conversation" size={23} />
          <div>
            <div className="panel-kicker">MAKE SENSE OF THE DETAILS</div>
            <h2 id="assistant-title">The reference desk</h2>
          </div>
        </div>
        <span className="reference-label">AI ASSISTED</span>
      </div>
      <div className="chat-content" ref={contentRef}>
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="assistant-symbol">
              <Icon name="branch" size={23} />
            </div>
            <h3>
              Good questions lead
              <br />
              to better understanding.
            </h3>
            <p>
              Explore medication information and recorded interactions. A useful
              place to start, before a conversation with your care team.
            </p>
            <div className="suggestion-label">A FEW PLACES TO START</div>
            {suggestions.map((question) => (
              <button
                className="suggestion"
                key={question}
                onClick={() => {
                  setInput(question);
                  inputRef.current?.focus();
                }}
              >
                {question}
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div role="log" aria-label="Conversation">
            {messages.map(
              (message, index) =>
                message.content && (
                  <div
                    key={index}
                    className={`message ${message.role} ${message.isError ? "error" : ""}`}
                  >
                    <div className="message-label">
                      {message.role === "user"
                        ? "YOUR QUESTION"
                        : message.isError
                          ? "UNABLE TO RESPOND"
                          : "REFERENCE DESK"}
                    </div>
                    <div className="message-body">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
        <div role="status">
          {status && (
            <div className="chat-status">
              <Icon name="spinner" className="spin" size={13} />
              {status}
            </div>
          )}
        </div>
      </div>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <div className="composer-box">
          <label className="sr-only" htmlFor="chat-question">
            Ask a medication question
          </label>
          <textarea
            id="chat-question"
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isLoading}
            placeholder="What would you like to understand?"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button
            className="send-button"
            aria-label="Send question"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Icon name="spinner" size={16} className="spin" />
            ) : (
              <Icon name="arrowUp" size={18} />
            )}
          </button>
        </div>
        <div className="composer-caption">
          <span>AI can make mistakes. Verify important details.</span>
          <span>↵ to send</span>
        </div>
      </form>
    </section>
  );
}
