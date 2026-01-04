# Future Features Backlog

Ideas and enhancements for future development. Items here are not committed - just captured for consideration.

---

## Display Customization (Features Panel)

**Current state:** Basic font size, font style (serif/sans-serif), line height

**Future enhancements:**
- [ ] Emphasis style choice: italics vs bold vs underline
- [ ] Paragraph spacing control (margin between paragraphs)
- [ ] Font family picker (beyond serif/sans-serif)
- [ ] Text alignment options (left, justified)
- [ ] Custom CSS injection for power users
- [ ] Theme presets (reading modes: day, sepia, night, AMOLED black)
- [ ] Column width / max-width control
- [ ] Footnote display style (inline, popup, end of chapter)

**Rationale:** Display is in Features panel because these are preference features, not core settings. Room to grow into rich customization.

---

## Audio Features (Conditional)

**Current state:** Audio panel always visible in settings

**Planned change:**
- [ ] "Enable Audio" toggle in Features panel
- [ ] When OFF: Audio section hidden from sidebar, audio icon hidden from chapter UI
- [ ] Same pattern as diff heatmap toggle

---

## Image Gallery & Cover Selection

**Status:** ✅ DONE (2025-12-30)

- [x] Gallery view showing all generated images across chapters
- [x] Full-size image preview (not just thumbnails)
- [x] Select image as EPUB cover (with portrait crop support)
- [x] Lives in new sidebar navigation under "Workspace" section

---

## Settings Modal Restructure

**Status:** ✅ DONE (2025-12-30)

Replacing horizontal tabs with sidebar navigation:

```
Settings
  ├ Providers
  ├ Prompt
  └ Advanced

Features
  ├ Display
  ├ Audio (conditional)
  └ Diff Heatmap

Workspace
  ├ Templates
  ├ Metadata
  └ Gallery

Export
  └ Export Panel
```

---

*Add new ideas below this line*
