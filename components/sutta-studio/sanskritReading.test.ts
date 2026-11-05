// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sanskritReading } from './sanskritReading';
import source from '../../data/trimsika/source.json';

describe('contextual Sanskrit reading transliteration', () => {
  it('round-trips every written token exactly, including sandhi endings and elisions', () => {
    for (const verse of source) for (const word of verse.text.split(' ')) {
      const reading = sanskritReading(word);
      expect(reading, word).not.toBeNull();
      expect(reading!.units.map(u => u.rom).join('')).toBe(word);
      expect(reading!.units.map(u => u.text).join('')).toBe(reading!.devanagari);
    }
  });
  it('keeps conjuncts intact and distinguishes aksharas from phonological syllables', () => {
    expect(sanskritReading('vijñānaṃ')).toEqual({ devanagari: 'विज्ञानं', units: [{ text: 'वि', rom: 'vi' }, { text: 'ज्ञा', rom: 'jñā' }, { text: 'नं', rom: 'naṃ' }] });
    expect(sanskritReading('kṣa')?.units).toEqual([{ text: 'क्ष', rom: 'kṣa' }]);
    expect(sanskritReading('arhattve')?.devanagari).toBe('अर्हत्त्वे');
    expect(sanskritReading('vikalpo')?.units.map(u => u.rom)).toEqual(['vi', 'ka', 'lpo']);
    expect(sanskritReading("'sau")?.units).toEqual([{ text: 'ऽ', rom: "'" }, { text: 'सौ', rom: 'sau' }]);
    expect(sanskritReading('dhātur')?.devanagari).toBe('धातुर्');
    expect(sanskritReading('dhātuḥ')?.devanagari).toBe('धातुः');
  });
  it('falls back rather than silently dropping unsupported characters', () => {
    for (const value of ['', 'hello!', 'a-b', 'ॐ', 'Śrī', 'ka1', 'a\u0301']) expect(sanskritReading(value)).toBeNull();
  });
});
