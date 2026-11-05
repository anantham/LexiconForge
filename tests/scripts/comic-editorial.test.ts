import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

const root = resolve('public/comics/the-occasion');
const read = (file: string) => readFileSync(resolve(root, file), 'utf8');
const book = JSON.parse(read('book.json'));
const analysis = JSON.parse(read('editorial.json'));
const context = vm.createContext({ window: {}, URLSearchParams, console });
vm.runInContext(read('picture-lettering.js'), context);
vm.runInContext(read('editorial.js').replace(/initEditorial\(\);\s*$/, ''), context);
const call = (name: string) => vm.runInContext(name, context);
const entries = call('validateCompanion')(book, analysis);

describe('public editorial companion', () => {
  it('joins every real picture to nonempty copy, response and gaze analysis', () => {
    expect(entries).toHaveLength(95);
    expect(Object.keys(analysis.pages)).toHaveLength(45);
    for (const { panel, note } of entries) {
      expect(call('pictureHTML')(panel, note, book)).toContain(`/images/${panel.id}.webp`);
      expect(call('pictureHTML')(panel, note, book)).toContain('class="eye-layer" hidden');
      const copy = call('copyHTML')(panel, note);
      if (panel.copy.length) expect(copy).toContain('<blockquote>');
      else expect(copy).toContain('Silence.');
    }
  });

  it('refuses mismatched editions, missing analysis, broken images, bad coordinates and incomplete copy reasons', () => {
    const validate = call('validateCompanion');
    expect(() => validate(book, {...analysis, edition:'wrong'})).toThrow(/edition/);
    expect(() => validate({...book,pages:book.pages.slice(1)}, analysis)).toThrow(/complete book/);
    expect(() => validate(book, {...analysis,panels:{}})).toThrow(/analysis/);
    expect(() => validate({...book,assets:{}},analysis)).toThrow(/picture/);
    const first = entries[0].panel.id, note = analysis.panels[first];
    expect(() => validate(book,{...analysis, panels:{...analysis.panels,[first]:{...note,copyReasons:[]}}})).toThrow(/copy/);
    expect(() => validate(book,{...analysis, panels:{...analysis.panels,[first]:{...note,eyePath:[{x:NaN,y:0,label:'a',reason:'b'}]}}})).toThrow(/eye path/);
  });

  it('maps gaze through the same retained crop and preserves lettering layers', () => {
    const {panel,note} = entries.find((e: any) => e.panel.id === 'v5-09-01');
    const crop = call('cropFor')(panel,book);
    expect(crop.width).toBeCloseTo(.88);
    expect(crop.height).toBeCloseTo(.88);
    const svg = call('eyeOverlay')([{x:.5,y:.48,label:'center',reason:'contrast'}],crop);
    const position = svg.match(/left:([\d.]+)%;top:([\d.]+)%/);
    expect(Number(position[1])).toBeCloseTo(50);
    expect(Number(position[2])).toBeCloseTo(50);
    expect(call('pictureHTML')(panel,note,book)).toContain('image-stage cropped');
    const first = entries[0];
    expect(call('pictureHTML')(first.panel,first.note,book)).toContain('lettering-layer');
  });

  it('resolves direct links and history without silently accepting unknown pictures', () => {
    const select = call('selectedIndex');
    expect(select(entries,'')).toBe(0);
    expect(select(entries,'#panel=v5-45-03')).toBe(94);
    expect(entries[select(entries,'#page=29')].page.page).toBe(29);
    expect(select(entries,'#panel=missing')).toBe(-1);
    expect(select(entries,'#page=999')).toBe(-1);
  });

  it('publishes only intentionally selected analysis and escapes copy and reasons', () => {
    expect(Object.keys(analysis).sort()).toEqual(['edition','pages','panels']);
    for (const page of Object.values(analysis.pages) as any[]) {
      expect(Object.keys(page).sort()).toEqual(['compositionReason','purpose']);
    }
    for (const note of Object.values(analysis.panels) as any[]) {
      expect(Object.keys(note).sort()).toEqual(['copyReasons','eyePath','predictedReading','purpose']);
      for (const point of note.eyePath) expect(Object.keys(point).sort()).toEqual(['label','reason','x','y']);
    }
    expect(read('editorial.json')).not.toMatch(/"(?:notes|prompt|revisedPrompt|provenance|sourceIds|referenceImage|review|artAssessment)":/);
    const html = call('copyHTML')({copy:[{text:'<img src=x onerror=alert(1)>',decision:'keep'}]},{copyReasons:['<script>bad</script>']});
    expect(html).not.toContain('<img'); expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(read('editorial/index.html')).toContain('not measured responses');
    expect(read('editorial/index.html')).toContain('id="eye-toggle" type="checkbox" autocomplete="off"');
    expect(read('index.html')).toContain('/comics/the-occasion/editorial/');
  });
  it('shows retry and retains the comic escape route when analysis fetch fails', async () => {
    const nodes: Record<string, any> = Object.fromEntries(['status','workbench','pages-toggle','page-list'].map(id => [id, {}]));
    const errors: unknown[] = [];
    const failure = vm.createContext({
      window: {}, document: { getElementById: (id: string) => nodes[id] },
      console: { error: (...args: unknown[]) => errors.push(args) },
      fetch: async () => ({ok:false,status:503}),
    });
    vm.runInContext(read('editorial.js').replace(/initEditorial\(\);\s*$/, ''), failure);
    await vm.runInContext('initEditorial()', failure);
    expect(nodes.status.hidden).toBe(false);
    expect(nodes.status.textContent).toContain('Reload this page');
    expect(nodes.status.textContent).toContain('Read comic');
    expect(nodes.workbench.hidden).toBe(true);
    expect(nodes['pages-toggle'].disabled).toBe(true);
    expect(errors).toHaveLength(1);
    expect(read('editorial/index.html')).toContain('id="read-comic" href="/comics/the-occasion/"');
  });

});
