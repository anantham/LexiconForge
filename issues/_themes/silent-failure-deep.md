# Theme — Silent Failure Deep in the Pipeline

## Statement

> Validation that should fire at the request boundary instead fires deep inside a long async pipeline. User pays seconds (or tens of seconds) of work before learning the request couldn't have succeeded.

## The shape

```ts
async function importFromUrl(url, scope) {
  for (const chapter of streamChapters(url)) {
    if (chapter.scope !== scope) {       // ← validation here
      throw new Error('scope mismatch');  // ← but the URL was knowable upfront
    }
    await writeChapter(chapter);
  }
}
```

The validation is correct. Its *placement* is wrong. The mismatch was determinable from the request alone — but it surfaces only after the streaming consumer hits a non-matching record. Worst case (issue #1's case): the mismatch surfaces at chapter 1000 of N, after 20+ seconds of writes that all get rolled back.

A vision-aligned shape: validate at request creation time. If validation requires the first byte of the response, validate after the first byte and bail before any side effects. If validation requires the full document, run it before any side effects, not interleaved.

## Instances (current)

| # | What fails late | Provisional class |
|---|---|---|
| 1 | `ImportService.importFromUrl` runs ~20s before throwing `Scoped stableId scope mismatch` on Chapter 1000. The mismatch was determinable at request time (caller's `scope` is the silently-remapped `v1-st-enhanced`; URL's chapters are `v1-composite`). | `(A3, B2, C2)` |

So far only issue #1 is confirmed. Strong candidates that may also instance:
- Issue 2 (fan toggle) — does the toggle path validate the desired translation early, or attempt and fail?
- Issue 16 (version switch comments vanish) — does the switch validate that comments port over, or quietly drop them?

## Leverage point

This theme is a candidate for an **eventual** ADR (`CORE-011-validate-at-request-boundary`?) but **N=1 is too thin to write a doc against yet**. The right move is:

1. Keep watching for instances. If issues 2 and 16 prove to be examples, promote.
2. In the meantime, document the principle inside the per-issue fix sketches when relevant.

The principle as a one-liner that can be quoted into reviews:

> Validation belongs at the boundary of an action, not woven through it. If you can know it can't work, say so before any side effects.

## Connection to other themes

- **jit-vs-precompute**: the silent remap (`v1-composite → v1-st-enhanced`) is itself a precomputation defect — the system canonicalized the version name without keeping the user's request available for downstream consumers to honor or reject.
- **silent-feedback-gaps**: the user paying 20s and seeing nothing is also a feedback failure. The two themes intersect: validation-at-boundary fixes the work-waste, immediate-feedback fixes the silent-button experience.
