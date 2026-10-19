'use strict';
const BASE = '/comics/the-occasion/';
const byId = id => document.getElementById(id);
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function cropFor(panel, book) {
  const crop = book.panels[panel.id].crop || [0, 0, 0, 0];
  if (!Array.isArray(crop) || crop.length !== 4 || crop.some(n => !Number.isFinite(n) || n < 0 || n >= 1)) throw Error(`Invalid crop: ${panel.id}`);
  const [left, top, right, bottom] = crop, width = 1-left-right, height = 1-top-bottom;
  if (width <= 0 || height <= 0 || (crop.some(Boolean) && Object.keys(panel.surfaces || {}).length)) throw Error(`Unsupported crop: ${panel.id}`);
  return {left, top, width, height, cropped: crop.some(Boolean)};
}

function validateCompanion(book, analysis) {
  const text = value => typeof value === 'string' && !!value.trim();
  if (analysis.edition !== book.id || !Array.isArray(book.pages) || !book.pages.length || book.pages.length !== book.pageRange?.[1]) throw Error('Editorial edition does not match the complete book.');
  const entries = [], ids = new Set();
  for (const [index, page] of book.pages.entries()) {
    const rationale = analysis.pages?.[page.page];
    if (page.page !== index+1 || !page.panels?.length || !text(rationale?.purpose) || !text(rationale?.compositionReason)) throw Error(`Missing page analysis: ${page.page}`);
    for (const panel of page.panels) {
      const note = analysis.panels?.[panel.id], record = book.panels?.[panel.id], asset = book.assets?.[panel.imagePath];
      if (ids.has(panel.id) || !/^v5-\d{2}-\d{2}$/.test(panel.id) || panel.imagePath !== `${panel.id}.webp` || record?.status !== 'ready' || record.imagePath !== panel.imagePath || !asset || !(asset.width > 0 && asset.height > 0)) throw Error(`Unresolved picture: ${panel.id}`);
      if (!Array.isArray(panel.imageSize) || panel.imageSize[0] !== asset.width || panel.imageSize[1] !== asset.height) throw Error(`Mismatched picture dimensions: ${panel.id}`);
      if (!text(note?.purpose) || !text(note?.predictedReading) || !Array.isArray(note?.copyReasons) || note.copyReasons.length !== panel.copy.length || !note.copyReasons.every(text)) throw Error(`Missing copy or reading analysis: ${panel.id}`);
      if (!Array.isArray(note.eyePath) || !note.eyePath.length || note.eyePath.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || !text(p.label) || !text(p.reason))) throw Error(`Invalid eye path: ${panel.id}`);
      cropFor(panel, book); ids.add(panel.id); entries.push({page, panel, note});
    }
  }
  if (Object.keys(analysis.panels).length !== ids.size || Object.keys(analysis.pages).length !== book.pages.length) throw Error('Editorial analysis has unmatched entries.');
  return entries;
}

function eyeOverlay(points, crop) {
  const mapped = points.map((p, i) => ({x:(p.x-crop.left)/crop.width, y:(p.y-crop.top)/crop.height, number:i+1}));
  const coordinates = mapped.map(p => `${p.x*100},${p.y*100}`).join(' ');
  return `<div class="eye-layer" hidden aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline class="shadow" points="${coordinates}"/><polyline points="${coordinates}"/></svg>${mapped.filter(p => p.x>=0 && p.x<=1 && p.y>=0 && p.y<=1).map(p => `<span class="eye-marker" style="left:${p.x*100}%;top:${p.y*100}%">${p.number}</span>`).join('')}</div>`;
}

function pictureHTML(panel, note, book) {
  const crop = cropFor(panel, book), [width, height] = panel.imageSize;
  const style = `aspect-ratio:${width*crop.width}/${height*crop.height}`;
  const imageStyle = crop.cropped ? `width:${100/crop.width}%;left:${-crop.left/crop.width*100}%;top:${-crop.top/crop.height*100}%` : '';
  return `<div class="image-stage${crop.cropped?' cropped':''}" style="${style}"><img src="${BASE}images/${panel.imagePath}" alt="${escapeText(panel.scene)}" width="${width}" height="${height}" style="${imageStyle}">${window.PictureLettering.render(panel)}${window.PictureLettering.narration(panel)}${eyeOverlay(note.eyePath, crop)}</div>`;
}

function copyHTML(panel, note) {
  const kept = panel.copy.map((copy, index) => ({copy, reason:note.copyReasons[index]})).filter(({copy}) => copy.decision !== 'cut' && copy.text.trim());
  if (!kept.length) return `<p><strong>Silence.</strong> ${escapeText(note.purpose)}</p>`;
  return kept.map(({copy, reason}) => `<div class="copy-item"><blockquote>${escapeText(copy.text)}</blockquote><p>${escapeText(reason)}</p></div>`).join('');
}

function selectedIndex(entries, hash) {
  if (!hash || hash === '#' || hash === '#workbench') return 0;
  const params = new URLSearchParams(hash.slice(1));
  if (params.has('panel')) return entries.findIndex(entry => entry.panel.id === params.get('panel'));
  if (params.has('page')) return entries.findIndex(entry => String(entry.page.page) === params.get('page'));
  return -1;
}

function companionFailure(error) {
  console.error('Comic editorial companion failed:', error);
  const status = byId('status'); status.hidden = false;
  status.textContent = 'The editorial companion could not load. Reload this page to try again; the comic is still available from Read comic.';
  byId('workbench').hidden = true; byId('pages-toggle').disabled = true; byId('page-list').hidden = true;
}

async function initEditorial() {
  try {
    const getJSON = async name => {const response = await fetch(BASE+name); if (!response.ok) throw Error(`${name}: HTTP ${response.status}`); return response.json();};
    const [book, analysis] = await Promise.all([getJSON('book.json'), getJSON('editorial.json')]);
    const entries = validateCompanion(book, analysis);
    let current = -1;
    const panelHash = entry => `#panel=${entry.panel.id}`;
    byId('eye-toggle').checked = false;
    function syncEyes() {const layer = byId('picture').querySelector('.eye-layer'); if (layer) layer.hidden = !byId('eye-toggle').checked;}
    function fitLettering() {
      const stage = byId('picture').querySelector('.image-stage'), layer = stage?.querySelector('.lettering-layer');
      const overflow = !!layer && window.PictureLettering.overflowGroups(stage).length > 0;
      layer?.classList.toggle('lettering-hidden', overflow); byId('lettering-notice').hidden = !overflow;
    }
    function closePages() {byId('page-list').hidden = true; byId('pages-toggle').setAttribute('aria-expanded', 'false');}
    function renderSelection(focus = false) {
      const index = selectedIndex(entries, location.hash), valid = index >= 0;
      const status = byId('status'); status.hidden = valid;
      status.textContent = valid ? '' : 'That picture link is unavailable. Showing the first picture; choose another from Pages.';
      current = valid ? index : 0;
      const {page, panel, note} = entries[current];
      byId('workbench').hidden = false;
      byId('picture-title').textContent = `${page.page}. ${page.title}`;
      byId('picture-tabs').innerHTML = page.panels.map((p,i) => `<a href="#panel=${p.id}" aria-label="Picture ${page.page}.${i+1}"${p.id===panel.id?' aria-current="true"':''}>${i+1}</a>`).join('');
      byId('picture').innerHTML = pictureHTML(panel, note, book);
      byId('picture-purpose').textContent = note.purpose;
      byId('predicted-reading').textContent = note.predictedReading;
      byId('copy-reasons').innerHTML = copyHTML(panel, note);
      byId('eye-steps').innerHTML = note.eyePath.map(p => `<li><strong>${escapeText(p.label)}</strong><p>${escapeText(p.reason)}</p></li>`).join('');
      byId('page-purpose').textContent = analysis.pages[page.page].purpose;
      byId('composition-reason').textContent = analysis.pages[page.page].compositionReason;
      byId('read-comic').href = `${BASE}#panel-${panel.id}`;
      byId('read-page').href = `${BASE}#read-page-${page.page}`;
      byId('position').textContent = `${current+1} / ${entries.length}`;
      for (const [id, delta] of [['previous',-1],['next',1]]) {
        const link = byId(id), target = entries[current+delta];
        if (target) {link.href = panelHash(target); link.removeAttribute('aria-disabled');}
        else {link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true');}
      }
      byId('page-list').querySelectorAll('a').forEach(link => {if (link.hash === `#page=${page.page}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');});
      const img = byId('picture').querySelector('img');
      img.onerror = () => {
        console.error('Editorial picture failed to load:', {panelId:panel.id, path:img.getAttribute('src')});
        status.hidden = false; status.textContent = 'This picture could not load. Reload to retry, or choose another picture.';
      };
      if (img.complete && !img.naturalWidth) img.onerror();
      syncEyes(); fitLettering();
      if (focus) {byId('picture-title').focus({preventScroll:true}); byId('workbench').scrollIntoView({block:'start'});}
    }
    byId('page-list').innerHTML = book.pages.map(page => {
      const chapter = book.chapters.find(c => c.start === page.page);
      return `${chapter?`<p>${escapeText(chapter.title)}</p>`:''}<a href="#page=${page.page}">${page.page} · ${escapeText(page.title)}</a>`;
    }).join('');
    byId('pages-toggle').disabled = false;
    byId('pages-toggle').onclick = () => {const open = byId('page-list').hidden; byId('page-list').hidden = !open; byId('pages-toggle').setAttribute('aria-expanded', String(open)); fitLettering();};
    byId('page-list').addEventListener('click', event => {if (event.target.closest('a')) {closePages(); byId('picture-title').focus({preventScroll:true});}});
    byId('eye-toggle').onchange = syncEyes;
    byId('toolbar-toggle').onclick = () => {
      const hidden = !byId('toolbar').hidden; byId('toolbar').hidden = hidden; document.body.classList.toggle('toolbar-hidden', hidden);
      byId('toolbar-toggle').setAttribute('aria-expanded', String(!hidden)); byId('toolbar-toggle').setAttribute('aria-label', hidden?'Show editorial controls':'Hide editorial controls');
      byId('toolbar-toggle').textContent = hidden?'Menu':'Hide'; if (hidden) closePages(); fitLettering();
    };
    document.addEventListener('keydown', event => {if (event.key === 'Escape' && !byId('page-list').hidden) {closePages(); byId('pages-toggle').focus();}});
    window.addEventListener('hashchange', () => {if (location.hash === '#workbench') return; try {renderSelection(true);} catch(error) {companionFailure(error);}});
    window.addEventListener('resize', fitLettering);
    if (window.ResizeObserver) new ResizeObserver(fitLettering).observe(byId('picture'));
    renderSelection();
  } catch(error) {companionFailure(error);}
}
initEditorial();
