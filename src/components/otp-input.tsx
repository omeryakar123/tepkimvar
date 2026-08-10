import { useEffect, useRef } from "react";

export function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);

  function setAt(i: number, ch: string) {
    const next = (value + "      ").slice(0, 6).split("");
    next[i] = ch;
    onChange(next.join("").replace(/\s/g, "").slice(0, 6));
  }

  return (
    <div className="flex justify-center gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (text) { e.preventDefault(); onChange(text); refs.current[Math.min(text.length, 5)]?.focus(); }
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, ch);
            if (ch && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className="size-12 sm:size-14 text-center text-xl font-bold rounded-xl ring-1 ring-rule bg-card focus:outline-none focus:ring-2 focus:ring-brand/50 disabled:opacity-60"
        />
      ))}
    </div>
  );
}
