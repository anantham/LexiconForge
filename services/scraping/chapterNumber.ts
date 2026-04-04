/**
 * Chapter number derivation from URL and title text.
 * Supports Arabic numerals and CJK patterns (第百四十八話, 第十二章, etc.)
 */

/**
 * Attempt to derive a numeric chapter number from URL and/or title text.
 */
export function deriveChapterNumber(sourceUrl: string, title: string | null | undefined): number | null {
  const url = sourceUrl || '';
  const t = title || '';

  // 1) Domain-specific URL heuristics
  // Syosetu: https://ncode.syosetu.com/n1234ab/1/
  if (/ncode\.syosetu\.com/.test(url)) {
    const m = url.match(/\/([0-9]+)\/?$/);
    if (m) return parseInt(m[1], 10);
  }

  // NovelCool: path often contains "chapter-<num>"
  if (/novelcool\.com/.test(url)) {
    const m = url.match(/chapter[-_\s]?([0-9]+)/i);
    if (m) return parseInt(m[1], 10);
  }

  // dxmwx: /chapter/<num>
  if (/dxmwx\.org/.test(url)) {
    const m = url.match(/\/chapter\/(\d+)/i);
    if (m) return parseInt(m[1], 10);
  }

  // Kakuyomu/Kanunu: URLs don't expose a clean sequence → rely on title

  // 2) Title-based Arabic numerals: e.g., "Chapter 148", "第 148 話"
  {
    const m = t.match(/(?:chapter|chap\.|ch\.|第)\s*(\d{1,6})\s*(?:話|章|回)?/i);
    if (m) return parseInt(m[1], 10);
  }

  // 3) Title-based CJK numerals: 第百四十八話 / 第十二章 / 第一回
  {
    const m = t.match(/第\s*([一二三四五六七八九十百千〇零]+)\s*(話|章|回)/);
    if (m) {
      const n = kanjiToNumber(m[1]);
      if (n > 0) return n;
    }
  }

  // 4) Fallback: any first Arabic number in title
  {
    const m = t.match(/(\d{1,6})/);
    if (m) return parseInt(m[1], 10);
  }

  return null;
}

/**
 * Convert simple Japanese/Chinese numerals (一二三四五六七八九十百千〇零) to an integer.
 * Handles compositions like 百四十八 (148), 二十 (20), 十 (10), 千二百三 (1203).
 */
export function kanjiToNumber(kanji: string): number {
  const digits: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9,
  };
  const units: Record<string, number> = { '十': 10, '百': 100, '千': 1000 };

  let total = 0;
  let current = 0;
  for (const ch of kanji) {
    if (ch in units) {
      const unit = units[ch];
      const val = current === 0 ? 1 : current; // e.g., 十 => 10, 二十 => 20
      total += val * unit;
      current = 0;
    } else if (ch in digits) {
      current = digits[ch];
    } else {
      break;
    }
  }
  total += current;
  return total;
}
