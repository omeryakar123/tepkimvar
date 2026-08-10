import { useCallback, useEffect, useRef, useState } from "react";
import { Send, MessageSquare, ArrowLeft } from "lucide-react";

type Conversation = {
  id: string;
  counterpart: string | null;
  brand_slug?: string;
  complaint_id: string | null;
  created_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

/**
 * Kullanıcı ↔ marka mesajlaşma paneli.
 * brandId verilirse MARKA görünümü (o markaya gelen yazışmalar), yoksa
 * KULLANICI görünümü (kendi başlattığı yazışmalar). Yetki hep sunucuda.
 */
export function Messenger({ brandId }: { brandId?: string }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadConvs = useCallback(async () => {
    const url = brandId ? `/api/conversations?brandId=${brandId}` : "/api/conversations";
    const res = await fetch(url, { credentials: "include" });
    if (res.ok) {
      const d = (await res.json()) as { items: Conversation[] };
      setConvs(d.items ?? []);
      setActiveId((cur) => cur ?? d.items?.[0]?.id ?? null);
    }
  }, [brandId]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 min-h-[460px]">
      {/* Yazışma listesi */}
      <aside className={`card-surface overflow-hidden ${activeId ? "hidden md:block" : ""}`}>
        <div className="px-4 py-3 border-b border-rule text-[13px] font-semibold text-ink">Yazışmalar</div>
        {convs.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-navy-mid">Henüz yazışma yok.</p>
        ) : (
          <ul className="divide-y divide-rule max-h-[420px] overflow-y-auto">
            {convs.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface transition ${activeId === c.id ? "bg-brand-soft/50" : ""}`}
                >
                  <span className="grid place-items-center size-9 shrink-0 rounded-full bg-brand-soft text-brand text-[12px] font-bold">
                    {(c.counterpart ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink truncate">{c.counterpart ?? "—"}</span>
                    <span className="block text-[11px] text-navy-mid">
                      {c.complaint_id ? "Şikayet üzerine" : "Genel"} · {new Date(c.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Aktif thread */}
      <section className={`card-surface flex flex-col ${activeId ? "" : "hidden md:flex"}`}>
        {activeId ? (
          <Thread conversationId={activeId} onBack={() => setActiveId(null)} />
        ) : (
          <div className="flex-1 grid place-items-center text-navy-mid text-[13px]">
            <div className="text-center">
              <MessageSquare className="size-8 mx-auto mb-2 opacity-40" />
              Bir yazışma seçin
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Thread({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages?conversationId=${conversationId}`, { credentials: "include" });
    if (res.ok) {
      const d = (await res.json()) as { items: Message[]; me: string };
      setMessages(d.items ?? []);
      setMe(d.me);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
    // Hafif yoklama — mesajlaşma canlı hissetsin.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const res = await fetch("/api/messages", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, body }),
    });
    setBusy(false);
    if (res.ok) { setText(""); load(); }
  }

  return (
    <>
      <div className="md:hidden px-4 py-3 border-b border-rule">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-navy-mid">
          <ArrowLeft className="size-4" /> Geri
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[400px]">
        {messages.length === 0 && (
          <p className="text-center text-[13px] text-navy-mid py-8">İlk mesajı siz yazın.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed ${mine ? "bg-brand text-brand-foreground" : "bg-surface text-ink"}`}>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <span className={`block mt-0.5 text-[10px] ${mine ? "text-brand-foreground/70" : "text-navy-mid"}`}>
                  {new Date(m.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-rule flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Mesaj yazın…"
          className="flex-1 resize-none rounded-xl ring-1 ring-rule px-3 py-2 text-sm max-h-32 focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <button disabled={busy || !text.trim()} onClick={send} className="grid place-items-center size-10 rounded-xl bg-brand text-brand-foreground disabled:opacity-50">
          <Send className="size-4" />
        </button>
      </div>
    </>
  );
}
