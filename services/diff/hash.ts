export function computeDiffHash(text: string): string {
  if (!text) return '00000000';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // 32-bit
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
