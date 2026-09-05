/**
 * Normalizes a single telephone candidate string into a WhatsApp-compatible MSISDN (country code + number).
 */
function normalizeSingleNumber(candidate: string): string | null {
  let digits = candidate.replace(/\D/g, "");
  if (!digits) return null;

  // Handle leading international access code 00
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Pakistani domestic mobile format: 03001234567 (11 digits) -> 923001234567
  if (digits.startsWith("0") && digits.length === 11) {
    digits = `92${digits.slice(1)}`;
  }
  // Missing country code: 3001234567 (10 digits starting with 3) -> 923001234567
  else if (digits.startsWith("3") && digits.length === 10) {
    digits = `92${digits}`;
  }

  // Valid international E.164 without plus: typically 10 to 15 digits
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return digits;
}

/**
 * Normalizes any phone string (including multiple numbers separated by slash, comma, or dashes)
 * to a clean WhatsApp international number.
 * Example: "03446176261/03339180978" -> "923446176261"
 */
export function normalizeWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  // Split multiple phone numbers if present (e.g. "03001234567 / 03211234567" or "0300-1234567, 0321-1234567")
  const candidates = String(phone)
    .split(/[/,;|\\]+|\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeSingleNumber(candidate);
    if (normalized) return normalized;
  }

  // Fallback: try raw digits on the entire string if short enough
  return normalizeSingleNumber(String(phone));
}

/**
 * Generates the standard web WhatsApp URL (works on all desktop & mobile browsers).
 */
export function whatsappUrl(phone: string | null | undefined, message: string): string | null {
  const number = normalizeWhatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}

/**
 * Generates native mobile deep-link URL (whatsapp://send?phone=...&text=...).
 * This opens the WhatsApp mobile app directly on Android & iOS without opening a blank browser tab.
 */
export function whatsappNativeUrl(phone: string | null | undefined, message: string): string | null {
  const number = normalizeWhatsAppNumber(phone);
  return number ? `whatsapp://send?phone=${number}&text=${encodeURIComponent(message)}` : null;
}
