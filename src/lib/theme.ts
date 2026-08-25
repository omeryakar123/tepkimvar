export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "tepkimvar-theme";

/**
 * <head> içine INLINE konur ve React'ten ÖNCE çalışır.
 * Amaç: koyu tema seçiliyken sayfa açılışında beyaz parlama (FOUC) olmaması.
 * Bu yüzden bir bundle'a bağlanmadan, düz string olarak gömülür.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var isDark = stored === 'dark' ||
      ((!stored || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.classList.toggle('dark', isDark);
    el.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim();

export function getStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Temayı uygular; geçiş sırasında renkleri yumuşatır. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const dark = resolveTheme(theme) === "dark";

  el.classList.add("theme-transition");
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";

  window.setTimeout(() => el.classList.remove("theme-transition"), 260);

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* gizli sekmede localStorage kapalı olabilir */
  }
}
