/**
 * Admin panelinin veri katmanı. Supabase istemcisinin yerine /api/admin/*
 * uçlarına konuşur. Yetki kontrolü sunucuda (requireStaff) yapılır; burada
 * yalnızca çerezi taşıyıp hataları tek biçimde gösteriyoruz.
 */
import { toast } from "sonner";

async function readError(res: Response): Promise<string> {
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  return j.error ?? "İşlem başarısız";
}

/** GET. Hata olursa toast gösterir ve null döner. */
export async function apiGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      toast.error(await readError(res));
      return null;
    }
    return (await res.json()) as T;
  } catch {
    toast.error("Bağlantı hatası");
    return null;
  }
}

/** POST/PATCH/PUT/DELETE. Başarılıysa true döner. */
export async function apiSend(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      toast.error(await readError(res));
      return false;
    }
    return true;
  } catch {
    toast.error("Bağlantı hatası");
    return false;
  }
}

/**
 * apiSend gibi ama sunucunun döndürdüğü GÖVDEYİ verir (üretim sonucu, sayaç
 * gibi bilgileri kullanıcıya göstermek gerektiğinde).
 */
export async function apiSendJson<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      toast.error(await readError(res));
      return null;
    }
    return (await res.json()) as T;
  } catch {
    toast.error("Bağlantı hatası");
    return null;
  }
}

/** Dosya yükleme — mevcut /api/upload ucunu kullanır, /api/files/<key> döner. */
export async function uploadFile(
  file: File,
  folder: string,
): Promise<{ key: string; url: string } | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
    if (!res.ok) {
      toast.error(await readError(res));
      return null;
    }
    return (await res.json()) as { key: string; url: string };
  } catch {
    toast.error("Bağlantı hatası");
    return null;
  }
}
