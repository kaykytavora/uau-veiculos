// Client for the Motomarks API (motomarks.io) — serves car brand logo images by slug.
// Uses the PUBLISHABLE key only (pk_...), same trust level as the Fipe token: fine to ship in the
// client bundle, never the secret key.
const KEY = import.meta.env.VITE_MOTOMARKS_KEY;

// Combining Diacritical Marks block (U+0300..U+036F), used below to strip accents after NFD
// normalization (e.g. "á" -> "a" + U+0301 -> "a"). Built from char codes rather than a literal
// character-range in source, since combining marks are unreliable to type/store as plain text.
const ACCENTS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

// Fipe (and some manual entries) prefix a few brands with the parent group, e.g. "GM - Chevrolet"
// or "VW - VolksWagen" — Motomarks expects just the brand itself.
function stripGroupPrefix(marca: string) {
  const idx = marca.indexOf(" - ");
  return idx === -1 ? marca : marca.slice(idx + 3);
}

export function motomarksSlug(marca: string | undefined | null): string {
  if (!marca) return "";
  return stripGroupPrefix(marca.trim())
    .toLowerCase()
    .normalize("NFD").replace(ACCENTS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Returns null when there's no key configured or no usable brand name, so callers can fall back
// to a generic icon instead of requesting a broken image.
export function brandLogoUrl(marca: string | undefined | null): string | null {
  if (!KEY) return null;
  const slug = motomarksSlug(marca);
  if (!slug) return null;
  return `https://motomarks.io/img/${slug}?token=${KEY}`;
}
