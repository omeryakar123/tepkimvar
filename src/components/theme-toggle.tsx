import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, resolveTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Açık", icon: Sun },
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "system", label: "Sistem", icon: Monitor },
];

/**
 * Tema geçişi. "Sistem" seçiliyken işletim sistemi tercihini canlı takip eder.
 * Sunucuda hangi temanın seçili olduğunu bilemeyiz; bu yüzden ilk render'da
 * nötr görünüp mount sonrası gerçek değeri gösteriyoruz (hidrasyon uyuşmazlığı olmasın).
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setMounted(true);
  }, []);

  // "Sistem" modunda OS teması değişirse anında uy.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  if (compact) {
    // Tek butonla açık <-> koyu arası geçiş (mobil / dar alanlar için).
    const current = mounted ? resolveTheme(theme) : "light";
    const Icon = current === "dark" ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={() => choose(current === "dark" ? "light" : "dark")}
        aria-label={current === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        title={current === "dark" ? "Açık tema" : "Koyu tema"}
        className="grid place-items-center size-9 rounded-full text-navy hover:text-ink hover:bg-surface transition"
      >
        <Icon className="size-[18px]" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center gap-0.5 rounded-full bg-surface p-0.5 ring-1 ring-rule"
    >
      {OPTIONS.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => choose(o.value)}
            className={`grid place-items-center size-8 rounded-full transition ${
              active
                ? "bg-card text-brand shadow-soft"
                : "text-navy-mid hover:text-ink"
            }`}
          >
            <o.icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
