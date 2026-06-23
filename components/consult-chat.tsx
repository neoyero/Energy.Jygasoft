"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageCircleQuestion,
  X,
  Send,
  Bot,
  User,
  MessageCircle,
} from "lucide-react";
import { WHATSAPP_URL } from "@/lib/site";

interface Msg {
  id: string;
  sender: "user" | "assistant";
  text: string;
}

const SUGERENCIAS = [
  "¿Cuánto puedo ahorrar?",
  "¿Qué es la tarifa DAC?",
  "¿Ustedes hacen el trámite con CFE?",
  "¿Cuánto cuesta un sistema?",
];

const SALUDO: Msg = {
  id: "init",
  sender: "assistant",
  text: "¡Hola! Soy el Asesor Solar de Jygasoft Energy. Puedo ayudarte con dudas sobre ahorro, tarifas de CFE, instalación y el trámite de interconexión. ¿En qué te ayudo?",
};

export function ConsultChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([SALUDO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  // Permite abrir el chat desde otros componentes (ej. CTA del hero del home).
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-consult-chat", handler);
    return () => window.removeEventListener("open-consult-chat", handler);
  }, []);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    const userMsg: Msg = { id: `u${Date.now()}`, sender: "user", text: clean };
    const history = messages.slice(-10).map((m) => ({ sender: m.sender, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      });
      const data = (await res.json()) as { text?: string };
      setMessages((prev) => [
        ...prev,
        {
          id: `a${Date.now()}`,
          sender: "assistant",
          text:
            data.text ??
            "Tuvimos un problema. Escríbenos por WhatsApp y un asesor te ayudará.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e${Date.now()}`,
          sender: "assistant",
          text: "Sin conexión por ahora. Puedes escribirnos por WhatsApp y un asesor te atiende enseguida.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir consulta con el asesor solar"
        className="group fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-brand-green px-4 py-3 text-sm font-bold text-white shadow-lg ring-1 ring-black/5 transition-all hover:bg-brand-green-dark hover:shadow-xl"
      >
        <MessageCircleQuestion className="h-5 w-5" />
        <span className="hidden sm:inline">Consulta</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[min(70vh,560px)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-brand p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-green">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold leading-tight">
              Asesor Solar
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </p>
            <span className="text-[11px] font-light text-brand-mint">
              Jygasoft Energy · IA
            </span>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          className="rounded-lg p-1.5 text-brand-mint transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50/60 p-4">
        {messages.map((m) => {
          const isA = m.sender === "assistant";
          return (
            <div
              key={m.id}
              className={`flex max-w-[88%] gap-2 ${isA ? "mr-auto" : "ml-auto flex-row-reverse"}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isA ? "bg-brand-green text-white" : "bg-brand-gold text-brand-ink"
                }`}
              >
                {isA ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={`whitespace-pre-line rounded-2xl p-3 text-sm font-light leading-relaxed shadow-sm ${
                  isA
                    ? "rounded-tl-none border border-stone-100 bg-white text-stone-800"
                    : "rounded-tr-none bg-brand-700 text-white"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="mr-auto flex max-w-[88%] gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-none border border-stone-100 bg-white p-3 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: "0.15s" }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}

        {messages.length <= 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Handoff humano */}
      <div className="flex items-center gap-2 border-t border-stone-200 bg-white px-3 py-2">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green/10 px-2.5 py-1.5 text-xs font-semibold text-brand-green hover:bg-brand-green/15"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        <a
          href="/contacto"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
        >
          Dejar mis datos
        </a>
        <span className="ml-auto text-[10px] text-stone-400">Asistente con IA</span>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-stone-200 bg-white p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta…"
          disabled={loading}
          className="flex-1 rounded-xl border border-stone-200 bg-brand-surface px-3 py-2.5 text-sm outline-none transition-all focus:border-brand-green"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          className="flex items-center justify-center rounded-xl bg-brand-green p-2.5 text-white transition-colors hover:bg-brand-green-dark disabled:bg-stone-300"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
