# The Occasion

The library includes an original illustrated comic at `/comics/the-occasion/`.
Its curated shelf entry opens the complete reader directly; it does not create
translation sessions, import chapters into IndexedDB or invoke AI providers.
Existing prose cards keep their detail-sheet and import behavior.

The publication contains 45 pages and 95 selected pictures. Art is stored as
WebP at its original dimensions. Narration and device screens are separate
HTML/SVG layers; phone, tablet and laptop compositions remain authored data.
The reader includes a page menu, picture enlargement and a Library return link.

`public/comics/the-occasion/metadata.json` supplies the shelf identity and counts.
`book.json` contains only the current edition's rendering data. Editorial
notebooks, generation prompts, review evidence and previous cuts are not shipped.
The static subtree is explicitly routed before the application's SPA fallback;
both trailing-slash forms resolve to the same entry point.

The source artwork, copy and layouts remain in the author's separate `comic`
workspace. Its `publication/export_comic.py` exports this subtree using Pillow;
`publication/alt-text.json` supplies concise reader-facing image descriptions.
The export checks the selected edition and all ready artwork before writing it.
Published output is committed so deployment does not require private source
material or image-generation credentials.

Verification: `tests/scripts/comic-publication.test.ts` checks the actual 45/95
package, every asset, rendering, incomplete-data refusal and the public-file
allowlist. `tests/components/IllustratedBookCard.test.tsx` checks the comic link
and preserved prose behavior. Deployment must also verify the live library
link, static routes/assets, page menu and enlargement without authentication.
