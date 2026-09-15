/** FlagCDN country logo (PNG). */
export function countryFlagUrl(iso: string, width: 40 | 80 | 160 = 80) {
  return `https://flagcdn.com/w${width}/${iso.toLowerCase()}.png`;
}

export function countryFlagEmoji(iso: string) {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.charCodeAt(0) - 65,
    A + code.charCodeAt(1) - 65,
  );
}
