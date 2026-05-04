import { describe, expect, it } from 'vitest';
import { lookupKnown84000, build84000Url } from '../../services/librarySearch/known84000';

describe('lookupKnown84000', () => {
  it('matches Heart Sutra by Sanskrit title', () => {
    expect(lookupKnown84000({
      titleZh: null,
      titleEn: null,
      authorZh: null,
      aliases: ['Prajñāpāramitāhṛdaya'],
    })?.tohId).toBe('toh21');
  });

  it('matches Heart Sutra by Chinese title', () => {
    expect(lookupKnown84000({
      titleZh: '般若波羅蜜多心經',
      titleEn: 'Heart Sutra',
      authorZh: '玄奘',
      aliases: [],
    })?.tohId).toBe('toh21');
  });

  it('matches Heart Sutra by English title (case-insensitive)', () => {
    expect(lookupKnown84000({
      titleZh: null,
      titleEn: 'HEART SUTRA',
      authorZh: null,
      aliases: [],
    })?.tohId).toBe('toh21');
  });

  it('matches Lotus Sutra', () => {
    expect(lookupKnown84000({
      titleZh: '妙法蓮華經',
      titleEn: 'Lotus Sutra',
      authorZh: '鳩摩羅什',
      aliases: ['Saddharmapuṇḍarīka'],
    })?.tohId).toBe('toh113');
  });

  it('matches Vimalakīrti', () => {
    expect(lookupKnown84000({
      titleZh: '維摩詰經',
      titleEn: null,
      authorZh: null,
      aliases: [],
    })?.tohId).toBe('toh176');
  });

  it('returns null for unknown text', () => {
    expect(lookupKnown84000({
      titleZh: '某佛經',
      titleEn: 'Some random sutra',
      authorZh: null,
      aliases: [],
    })).toBeNull();
  });

  it('returns null for empty identity', () => {
    expect(lookupKnown84000({
      titleZh: null,
      titleEn: null,
      authorZh: null,
      aliases: [],
    })).toBeNull();
  });

  it('build84000Url constructs the correct URL', () => {
    expect(build84000Url('toh21')).toBe('https://84000.co/translation/toh21');
    expect(build84000Url('toh1-1')).toBe('https://84000.co/translation/toh1-1');
  });
});
