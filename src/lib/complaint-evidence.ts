/** Şikayet kanıtı — ekran görüntüsü veya video zorunlu. */

export const EVIDENCE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const EVIDENCE_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const EVIDENCE_SUPPLEMENT_TYPES = ["application/pdf"] as const;

export const EVIDENCE_ACCEPTED_TYPES = [
  ...EVIDENCE_IMAGE_TYPES,
  ...EVIDENCE_VIDEO_TYPES,
  ...EVIDENCE_SUPPLEMENT_TYPES,
] as const;

export const MIN_EVIDENCE_FILES = 1;
export const MAX_EVIDENCE_FILES = 6;

export function isVisualEvidenceMime(type: string | null | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    (EVIDENCE_IMAGE_TYPES as readonly string[]).includes(t) ||
    (EVIDENCE_VIDEO_TYPES as readonly string[]).includes(t)
  );
}

export function isAcceptedEvidenceMime(type: string | null | undefined): boolean {
  if (!type) return false;
  return (EVIDENCE_ACCEPTED_TYPES as readonly string[]).includes(type.toLowerCase());
}

export function hasVisualEvidenceInFiles(files: { type: string }[]): boolean {
  return files.some((f) => isVisualEvidenceMime(f.type));
}
