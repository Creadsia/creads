"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "./ui";

// "Asistente Creads": a support chat in every studio page. It knows the customer's plan, credits and
// last jobs (the server builds that) and answers on the spot, 24/7, with buttons to the right page.
// Anything can open it with a question: window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: "…" })).

export const ASK_EVENT = "creads:asistente";
/** Opens the assistant, optionally sending a question right away. */
export const askAssistant = (q?: string) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: q ?? "" }));

interface Msg { role: "user" | "assistant"; content: string; links?: { label: string; href: string }[]; error?: boolean }

const KEY = "creads-asistente";
const STARTERS = ["¿Cómo hago mi primer anuncio?", "¿Por qué falló mi video?", "¿Cuántos créditos me quedan y cuándo vencen?", "¿Cómo clono mi voz?"];

function load(): Msg[] {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.slice(-30) : []; } catch { return []; }
}
function save(m: Msg[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(m.slice(-30))); } catch {}
}

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const CHAT = "M4 5h16v11H9l-5 4V5Zm4 5h.01M12 10h.01M16 10h.01";
const CLOSE = "M6 6l12 12M18 6 6 18";
const SEND = "M4 12 20 4l-6 16-3-7-7-1Z";

export default function Assistant() {
  const path = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sendRef = useRef<(q: string) => void>(() => {});
  const busyRef = useRef(false);
  const convo = useRef(0); // bumps on «Nueva»: a late answer from the old chat is dropped
  const launcher = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); setTimeout(() => launcher.current?.focus(), 0); };

  useEffect(() => { setMsgs(load()); }, []);
  useEffect(() => { save(msgs); list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 50); }, [open]);
  useEffect(() => {
    const onAsk = (e: Event) => {
      setOpen(true);
      const q = String((e as CustomEvent).detail ?? "").trim();
      if (q) sendRef.current(q);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen((o) => { if (o) setTimeout(() => launcher.current?.focus(), 0); return false; }); };
    window.addEventListener(ASK_EVENT, onAsk);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(ASK_EVENT, onAsk); window.removeEventListener("keydown", onKey); };
  }, []);

  async function send(q: string) {
    const content = q.trim().slice(0, 1500);
    if (!content || busyRef.current) return;
    busyRef.current = true;
    const mine = convo.current;
    const next: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page: path, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No pude responder ahora. Vuelve a intentarlo en un momento.");
      if (mine === convo.current) setMsgs((m) => [...m, { role: "assistant", content: d.answer, links: d.links }]);
    } catch (e) {
      if (mine === convo.current) setMsgs((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "No pude responder ahora.", error: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  sendRef.current = send;

  async function persona() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const mine = convo.current;
    try {
      const res = await fetch("/api/asistente/persona", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: path, messages: msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }) });
      const d = await res.json().catch(() => ({}));
      if (mine === convo.current) setMsgs((m) => [...m, { role: "assistant", content: d.mensaje || d.error || "Listo, te vamos a escribir por correo.", error: !res.ok && res.status !== 429 }]);
    } catch {
      if (mine === convo.current) setMsgs((m) => [...m, { role: "assistant", content: "No pude enviarlo. Escríbenos a hola@creadsia.com y te respondemos.", error: true }]);
    } finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <>
      {/* Automático is already a chat: the help bubble would sit on top of its «Enviar» button */}
      {!open && !path.startsWith("/app/automatico") && (
        <button ref={launcher} type="button" onClick={() => setOpen(true)} aria-label="Abrir el Asistente Creads"
          className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[55] flex items-center gap-2 rounded-full bg-[image:var(--grad)] p-3 lg:bottom-4 lg:p-3.5 font-semibold text-white shadow-[0_12px_32px_-10px_rgba(124,58,237,0.7)] transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-3 print:hidden">
          <Icon d={CHAT} />
          <span className="hidden text-sm sm:inline">¿Te ayudo?</span>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label="Asistente Creads"
          className="fixed inset-0 z-[60] flex flex-col bg-surface sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(620px,calc(100svh-32px))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[image:var(--grad)] text-white"><Icon d={CHAT} className="h-[18px] w-[18px]" /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-sm">Asistente Creads</b>
              <span className="flex items-center gap-1.5 text-xs text-muted"><span className="h-1.5 w-1.5 rounded-full bg-good" aria-hidden="true" />Responde al instante, a toda hora</span>
            </span>
            {msgs.length > 0 && <button type="button" onClick={() => { convo.current++; busyRef.current = false; setBusy(false); setMsgs([]); }} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink">Nueva</button>}
            <button type="button" onClick={close} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"><Icon d={CLOSE} /></button>
          </header>

          <div ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
            <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-sm">
              ¡Hola! Soy el asistente de Creads. Veo tu plan, tus créditos y tus últimos trabajos, así que pregúntame lo que necesites.
            </div>
            {msgs.length === 0 && (
              <div className="flex flex-col items-start gap-1.5">
                {STARTERS.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-line px-3 py-1.5 text-left text-sm text-muted transition-colors hover:border-accent hover:text-ink">{q}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="max-w-[88%] self-end whitespace-pre-line rounded-2xl rounded-tr-md bg-accent px-3.5 py-2.5 text-sm text-accent-ink">{m.content}</div>
            ) : (
              <div key={i} className="flex max-w-[92%] flex-col gap-2">
                <div className={`whitespace-pre-line rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm ${m.error ? "border border-warn/40 bg-warn/10" : "bg-surface-2"}`}>{m.content}</div>
                {m.links && m.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.links.map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => { if (window.innerWidth < 640) setOpen(false); }}
                        className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm font-semibold text-accent-text hover:bg-accent/10">{l.label} →</Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="flex w-fit items-center gap-2 rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2.5 text-sm text-muted"><Spinner />Escribiendo…</div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2 border-t border-line p-3">
            <label htmlFor="asistente-q" className="sr-only">Tu pregunta</label>
            <textarea id="asistente-q" ref={input} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1500}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              placeholder="Escribe tu pregunta…"
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none focus:border-accent" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-40"><Icon d={SEND} className="h-[18px] w-[18px]" /></button>
          </form>
          <p className="px-4 pb-3 text-center text-[11px] text-muted">
            <button type="button" onClick={persona} disabled={busy} className="font-semibold text-ink underline disabled:opacity-50">Hablar con una persona</button> · Respuestas con IA; revisa lo importante. <Link href="/app/ayuda" className="underline" onClick={() => { if (window.innerWidth < 640) setOpen(false); }}>Centro de ayuda</Link>
          </p>
        </section>
      )}
    </>
  );
}
