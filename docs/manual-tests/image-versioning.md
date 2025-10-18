# Image Versioning Manual QA Checklist

- [ ] Generate images for a chapter with multiple suggested illustrations; confirm each renders as Version 1/1.
- [ ] Retry an illustration with a new prompt; confirm Version 2/2 appears and navigation toggles between v1 and v2.
- [ ] Retry again with altered advanced controls (LoRA/guidance); confirm Version 3/3 metadata reflects new settings.
- [ ] Navigate away and back to the chapter; ensure active version persists and correct image renders.
- [ ] Delete the currently active version; verify the next appropriate version becomes active and cache entry is removed.
- [ ] Export an EPUB while v1 is active; open the EPUB and confirm the caption uses v1 metadata.
- [ ] Switch to v3, re-export EPUB; confirm new export includes v3 image and caption.
- [ ] Import a legacy session containing base64 images; ensure migration runs and images load with versioned cache keys.
