import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const popupSource = readFileSync(resolve('chrome_extension/popup.js'), 'utf8');
const inspectorHtml = readFileSync(resolve('public/db-inspector.html'), 'utf8');
const inspectorSource = inspectorHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const allowedUrl = 'https://www2.hf.uio.no/polyglotta/index.php?page=fulltext&view=fulltext';

function setupPopup() {
  document.body.innerHTML = ['status', 'log', 'siteIndicator', 'progressContainer', 'progressFill',
    'progressText', 'maxSections', 'startPolyglotta', 'downloadPolyglotta', 'clearAllData', 'stopScraping']
    .map(id => `<div id="${id}"></div>`).join('');
  const chrome = {
    runtime: { id: 'our-extension', onMessage: { addListener: vi.fn() } },
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7, url: allowedUrl }]),
      get: vi.fn().mockResolvedValue({ id: 7, url: allowedUrl }),
      sendMessage: vi.fn().mockResolvedValue({ pong: true }),
    },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
  };
  const { Popup, isAllowed } = new Function('document', 'chrome', `${popupSource}\nreturn { Popup: LexiconForgeScraperPopup, isAllowed: isAllowedPolyglottaUrl };`)(document, chrome);
  const popup = Object.create(Popup.prototype);
  popup.initializeElements();
  return { popup, chrome, isAllowed };
}

beforeEach(() => document.body.replaceChildren());

describe('extension popup input boundary', () => {
  it.each(['https://evil.example/?polyglotta=hf.uio.no', 'https://hf.uio.no.evil.example/polyglotta/',
    'https://hf.uio.no@evil.example/polyglotta/', 'https://hf.uio.no/other/',
    'https://hf.uio.no:8443/polyglotta/', 'file:///polyglotta/hf.uio.no', 'javascript:polyglotta'])('rejects lookalike or unsupported URL %s', url => {
      expect(setupPopup().isAllowed(url)).toBe(false);
    });

  it('renders content and error messages literally without creating elements', () => {
    const { popup } = setupPopup();
    const message = '<img src=x onerror="globalThis.injected=true">';
    popup.updateLog(message);
    popup.handleMessage({ type: 'ERROR', data: { message } });
    expect(document.getElementById('log')?.textContent).toContain(message);
    expect(document.getElementById('status')?.textContent).toBe(message);
    expect(document.querySelector('img')).toBeNull();
  });

  it('accepts messages only from our active allowed top frame', async () => {
    const { popup, chrome } = setupPopup();
    const valid = { id: chrome.runtime.id, frameId: 0, tab: { id: 7, url: allowedUrl }, url: allowedUrl };
    const message = { type: 'LOG', data: { message: 'Synthetic allowed log' } };
    for (const sender of [
      { ...valid, id: 'another-extension' }, { ...valid, frameId: 1 },
      { ...valid, tab: { id: 8, url: allowedUrl } },
      { ...valid, url: 'https://evil.example/polyglotta/' },
      { ...valid, tab: { id: 7, url: 'https://evil.example/polyglotta/' } },
      { ...valid, url: 'https://www2.hf.uio.no/polyglotta/another-page' },
      { ...valid, tab: undefined },
    ]) await popup.handleContentMessage(message, sender);
    expect(document.getElementById('log')?.textContent).toBe('');
    await popup.handleContentMessage(message, valid);
    expect(document.getElementById('log')?.textContent).toContain('Synthetic allowed log');
    chrome.tabs.query.mockResolvedValue([{ id: 7, url: 'https://evil.example/' }]);
    await popup.handleContentMessage({ type: 'LOG', data: { message: 'ignored after navigation' } }, valid);
    expect(document.getElementById('log')?.textContent).not.toContain('ignored after navigation');
  });

  it('does not message or inject scripts into unrelated active tabs', async () => {
    const { popup, chrome } = setupPopup();
    chrome.tabs.query.mockResolvedValue([{ id: 7, url: 'https://evil.example/?polyglotta' }]);
    chrome.tabs.get.mockResolvedValue({ id: 7, url: 'https://evil.example/?polyglotta' });
    expect(await popup.sendMessageToTab('START_SCRAPING')).toBe(false);
    expect(await popup.tryInjectContentScript(7)).toBe(false);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('preserves the normal allowed scraping command', async () => {
    const { popup, chrome } = setupPopup();
    expect(await popup.sendMessageToTab('START_SCRAPING', { maxSections: 2 })).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(7, { action: 'START_SCRAPING', maxSections: 2 });
  });
});

describe('legacy database inspector literal rendering', () => {
  function inspector() {
    document.body.innerHTML = '<div id="loading"></div><div id="results"></div>';
    return new Function('document', 'window', `${inspectorSource}\nreturn { displayResults, displayError };`)(
      document, { addEventListener: vi.fn() });
  }

  it('renders imported titles and other fields as text', () => {
    const renderer = inspector();
    const malicious = '<svg onload="globalThis.injected=true">Synthetic</svg>';
    renderer.displayResults({
      chapterStats: [{ number: malicious, title: malicious, translations: 1, hasActive: true,
        footnotes: 0, illustrations: 0, images: 0, imageSize: 0, audio: 0, audioSize: 0 }],
      totals: { chapters: 1, translations: 1, activeTranslations: 1, totalFootnotes: 0,
        totalIllustrations: 0, images: 0, totalImageSize: 0, audio: 0, totalAudioSize: 0 },
    });
    expect(document.getElementById('results')?.textContent).toContain(malicious);
    expect(document.querySelector('svg')).toBeNull();
    expect(document.querySelectorAll('table')).toHaveLength(3);
  });

  it('renders caught errors literally', () => {
    const renderer = inspector();
    const message = '<img src=x onerror="globalThis.injected=true">';
    renderer.displayError({ message });
    expect(document.querySelector('pre')?.textContent).toBe(message);
    expect(document.querySelector('img')).toBeNull();
  });
});
