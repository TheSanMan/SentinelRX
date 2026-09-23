import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import Icon from "./Icon";
import type { Medication } from "./types";

type Message = { role: "user" | "assistant"; content: string; error?: boolean };
interface Reply { answer: string; referenced_drug_ids: string[] }

export default function ChatComponent({ meds }: { meds: Medication[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);
  const suggestions = meds.length >= 2 ? ["Check interactions in my list", "Are there food interactions with my medications?", "Summarize the drugs in my list"] : meds.length ? [`What should I know about ${meds[0].name}?`, "Are there food interactions with my medication?", "What is in my list?"] : ["What should I know about metformin?", "Can aspirin and warfarin interact?", "What are food interactions with warfarin?"];

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setInput(""); setBusy(true);
    setMessages(previous => [...previous, { role: "user", content: question }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/assistant/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, drug_ids: meds.map(med => med.drugbank_id), context_drug_ids: contextIds }), signal: AbortSignal.timeout(25000) });
      const data: Reply & { detail?: string } = await response.json().catch(() => ({ answer: "", referenced_drug_ids: [] }));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The DrugBank service is unavailable.");
      if (!data.answer) throw new Error("The assistant returned an empty answer.");
      setContextIds(data.referenced_drug_ids || []);
      setMessages(previous => [...previous.slice(0, -1), { role: "assistant", content: data.answer }]);
    } catch (cause) {
      setMessages(previous => [...previous.slice(0, -1), { role: "assistant", content: cause instanceof Error && cause.name === "Error" ? cause.message : "The request timed out. Please try again.", error: true }]);
    } finally { setBusy(false); }
  }
  return <section className="feature-card assistant-view" aria-labelledby="assistant-heading"><div className="assistant-heading"><div><span className="overline">DATABASE ASSISTANT</span><h2 id="assistant-heading">Ask about medications</h2><p>Answers come from the local DrugBank records and include your saved list when relevant.</p></div><span className="context-pill"><Icon name="capsule" size={16}/>{meds.length} in context</span></div>
    <div className="conversation" role="log" aria-label="Conversation">{messages.length === 0 ? <div className="assistant-intro"><div className="assistant-icon"><Icon name="conversation" size={30}/></div><h3>What would you like to know?</h3><p>Ask about a drug, your list, recorded interactions, or food warnings.</p><div className="prompt-list">{suggestions.map(question => <button key={question} onClick={() => { setInput(question); inputRef.current?.focus(); }}>{question}<Icon name="arrow" size={18}/></button>)}</div></div> : messages.map((message, index) => message.content && <article key={index} className={`chat-message ${message.role} ${message.error ? "error" : ""}`}><span>{message.role === "user" ? "YOU" : "DRUGBANK ASSISTANT"}</span><div className="markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div></article>)}{busy && <div className="thinking" role="status"><Icon name="spinner" size={18} className="spin"/>Reviewing DrugBank records…</div>}<div ref={end}/></div>
    <form className="assistant-composer" onSubmit={event => { event.preventDefault(); void ask(input); }}><label htmlFor="assistant-input" className="sr-only">Ask a medication question</label><textarea id="assistant-input" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} rows={2} placeholder="Ask about a medication or your list…" disabled={busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(input); } }}/><button className="primary-button" type="submit" disabled={!input.trim() || busy}><Icon name="arrowUp" size={18}/>Ask</button></form><p className="assistant-caveat">Reference data can be incomplete. Do not change medication use based on this tool alone.</p>
  </section>;
}
