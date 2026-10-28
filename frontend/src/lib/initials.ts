const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * The two letters of an avatar: the first letter of the first word and of the last word of the name ("Mohand Ahmed Hatem" is MH,
 * "Mohand" is M). A word with no letter or digit (an emoji, a dash) is skipped, accents and Arabic marks are never taken as the
 * letter, and a name with nothing usable falls back to the first letter of the email, then "?".
 */
export function initials(name: string, email?: string): string {
  const first = name.trim().split(/\s+/).map((word) => word.match(LETTER_OR_DIGIT)?.[0]).filter((c): c is string => !!c);
  const picked = first.length > 1 ? [first[0], first[first.length - 1]] : first;
  return (picked.join("") || email?.match(LETTER_OR_DIGIT)?.[0] || "?").toLocaleUpperCase();
}
