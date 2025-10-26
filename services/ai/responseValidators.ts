type Illustration = {
  placementMarker: string;
  imagePrompt: string;
};

type Footnote = {
  marker: string;
  text: string;
};

export const validateAndFixIllustrations = (
  translation: string,
  suggestedIllustrations: Illustration[] | undefined
): { translation: string; suggestedIllustrations: Illustration[] } => {
  const textMarkers = translation.match(/\[ILLUSTRATION-\d+[A-Za-z]*\]/g) || [];
  const jsonIllustrations = suggestedIllustrations || [];
  const jsonMarkers = jsonIllustrations.map(item => item.placementMarker);

  if (textMarkers.length === jsonMarkers.length) {
    const textMarkerSet = new Set(textMarkers);
    const jsonMarkerSet = new Set(jsonMarkers);

    if (
      textMarkers.every(marker => jsonMarkerSet.has(marker)) &&
      jsonMarkers.every(marker => textMarkerSet.has(marker))
    ) {
      return { translation, suggestedIllustrations: jsonIllustrations };
    }
  }

  if (jsonMarkers.length > textMarkers.length) {
    const textMarkerSet = new Set(textMarkers);
    const unmatchedPrompts = jsonIllustrations.filter(item => !textMarkerSet.has(item.placementMarker));

    let updatedTranslation = translation;
    for (const prompt of unmatchedPrompts) {
      updatedTranslation = updatedTranslation.trim() + ` ${prompt.placementMarker}`;
    }
    return { translation: updatedTranslation, suggestedIllustrations: jsonIllustrations };
  }

  if (textMarkers.length > jsonMarkers.length) {
    const textMarkerSet = new Set(textMarkers);
    const jsonMarkerSet = new Set(jsonMarkers);
    const orphanedMarkers = textMarkers.filter(marker => !jsonMarkerSet.has(marker));

    console.error('Illustration validation failed - insufficient prompts:', {
      textMarkers,
      jsonMarkers,
      orphanedMarkers,
    });

    throw new Error(
      `AI response validation failed: Cannot auto-fix - missing illustration prompts.\n- Text has ${textMarkers.length} markers but JSON only has ${jsonMarkers.length} prompts\n- Orphaned markers: ${orphanedMarkers.join(', ')}\n\nThis requires AI to regenerate with proper prompts for all markers.`
    );
  }

  const textMarkerSet = new Set(textMarkers);
  const jsonMarkerSet = new Set(jsonMarkers);
  const textOnlyMarkers = textMarkers.filter(m => !jsonMarkerSet.has(m));

  if (textOnlyMarkers.length === jsonMarkers.filter(m => !textMarkerSet.has(m)).length) {
    const updatedIllustrations = jsonIllustrations.map(item => {
      if (!textMarkerSet.has(item.placementMarker) && textOnlyMarkers.length > 0) {
        const newMarker = textOnlyMarkers.shift()!;
        console.log(`[IllustrationFix] Remapped ${item.placementMarker} -> ${newMarker}`);
        return { ...item, placementMarker: newMarker };
      }
      return item;
    });
    console.log('[IllustrationFix] Marker reconciliation successful - saved translation');
    return { translation, suggestedIllustrations: updatedIllustrations };
  }

  console.error('Illustration validation failed - complex mismatch:', {
    textMarkers,
    jsonMarkers,
    textOnlyMarkers,
  });

  throw new Error(
    `AI response validation failed: Complex illustration mismatch cannot be auto-fixed.\n- Text markers: ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}\n\nRequires AI regeneration with proper marker alignment.`
  );
};

export const validateAndFixFootnotes = (
  translation: string,
  footnotes: Footnote[] | undefined,
  strictMode: 'append_missing' | 'fail' = 'append_missing'
): { translation: string; footnotes: Footnote[] } => {
  const allMatches = translation.match(/\[(\d+)\]/g) || [];
  const seenText = new Set<string>();
  const textMarkers: string[] = [];

  for (const m of allMatches) {
    if (/\[ILLUSTRATION-/i.test(m)) continue;
    if (!seenText.has(m)) {
      seenText.add(m);
      textMarkers.push(m);
    }
  }

  const jsonFootnotes = Array.isArray(footnotes) ? footnotes.slice() : [];
  const normalize = (m: string) => (m.startsWith('[') ? m : `[${m.replace(/\[|\]/g, '')}]`);
  const jsonMarkersRaw = jsonFootnotes.map(fn => normalize(String(fn.marker || '')));
  const jsonMarkers = Array.from(new Set(jsonMarkersRaw));

  if (textMarkers.length === jsonMarkers.length) {
    const tSet = new Set(textMarkers);
    const jSet = new Set(jsonMarkers);

    if (textMarkers.every(m => jSet.has(m)) && jsonMarkers.every(m => tSet.has(m))) {
      const fixed = jsonFootnotes.map(fn => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
      return { translation, footnotes: fixed };
    }

    const textOnly = textMarkers.filter(m => !jSet.has(m));
    const fixed = jsonFootnotes.map(fn => {
      const nm = normalize(String(fn.marker || ''));
      if (!tSet.has(nm) && textOnly.length > 0) {
        const use = textOnly.shift()!;
        return { ...fn, marker: use };
      }
      return { ...fn, marker: nm };
    });
    return { translation, footnotes: fixed };
  }

  if (jsonMarkers.length > textMarkers.length) {
    if (strictMode === 'fail') {
      console.error('[Footnote validation] strict mode fail on extra JSON footnotes');
      throw new Error(
        `AI response validation failed: Extra footnotes without matching markers.\n- Text markers (unique): ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}`
      );
    }

    const tSet = new Set(textMarkers);
    const extra = jsonMarkers.filter(m => !tSet.has(m));

    let updated = translation.trim();
    for (const m of extra) updated += ` ${m}`;

    const fixed = jsonFootnotes.map(fn => ({ ...fn, marker: normalize(String(fn.marker || '')) }));
    return { translation: updated, footnotes: fixed };
  }

  console.error('Footnote validation failed - insufficient footnotes:', {
    textMarkers,
    jsonMarkers,
  });
  throw new Error(
    `AI response validation failed: Missing footnotes for markers.\n- Text markers (unique): ${textMarkers.join(', ')}\n- JSON markers: ${jsonMarkers.join(', ')}\n\nRequires regeneration with matching footnotes.`
  );
};
