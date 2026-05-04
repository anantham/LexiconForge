#!/usr/bin/env python3
"""co-mingled-commits-survey.py

Survey recent commits for the "co-mingled commit" pattern: commit title describes one
kind of change, but the diff also includes unrelated control-flow or behavior changes.

The pattern was first noticed in the issue #1 archaeology — a commit titled
`fix: remove 15 unnecessary 'as any' casts` also added a (broken) StrictMode guard
to initializeStore.ts. The question this script answers: is that a one-off, or a
recurring multi-agent failure mode?

How it works
------------
For each commit in the survey window:

1. Parse the title's "stated intent" — bucketed into:
   - cleanup_only      (remove unused, fix as-any, typo, rename)
   - docs_only         (docs:, README, comment-only)
   - test_only         (test:, tests:)
   - build_chore       (chore: bumps deps, build config)
   - fix_bug           (fix: <area>) — has scope expectation
   - feat              (feat: <area>) — new feature, expected to be scoped
   - refactor          (refactor:) — restructure, no behavior change expected
   - other             (anything that didn't match)

2. Inspect the diff for "behavior signals" — code patterns that imply
   control-flow / lifecycle / async work, namely (in ADDED lines only,
   excluding test files and .md):
     - new useEffect / useCallback / useMemo
     - new async function / await / Promise / abortController
     - new try/catch / throw
     - new if/else with return / early bail
     - new state-set calls (set(...), setState, useState)
     - new subscriptions (subscribe, addEventListener)
     - new exported function / class

3. Score "smuggle suspicion" by mismatch between stated intent and diff signals:
     cleanup_only  + any behavior signal     → STRONG
     cleanup_only  + many files (>5)         → MEDIUM
     docs_only     + non-md files            → STRONG
     test_only     + non-test files          → STRONG
     refactor      + behavior change in path that wasn't being restructured → MEDIUM
     fix_bug       + cross-area changes      → WEAK

4. Print a ranked list of suspect commits with the smoking-gun snippets.

Output
------
Markdown to stdout, suitable for piping into an investigation document. Includes:
- Aggregate stats (commits surveyed, by bucket, by suspicion level)
- Top N flagged commits with title, score, files, and added-line excerpts that
  triggered the flag

Usage
-----
  python3 scripts/co-mingled-commits-survey.py [--n 100] [--top 20] [--since 2025-11-01]

Defaults: last 100 commits, top 20 flagged.
"""
from __future__ import annotations
import argparse
import re
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Optional


# --- Title classification ----------------------------------------------------

CONVENTIONAL_RE = re.compile(r'^(?P<type>\w+)(\((?P<scope>[^)]+)\))?(?P<bang>!)?:\s*(?P<rest>.+)$')

CLEANUP_KEYWORDS = (
    # title contains one of these → bucketed as cleanup_only.
    # NB: kept narrow to avoid false positives. "comment" was here in v1 but
    # mis-bucketed feat: commits with "comment markers" / "comment input" in
    # their title — drop unless prefixed by "fix typo in" or similar.
    'as any', 'as-any', 'remove unused', 'remove unnecessary',
    'unnecessary', 'unused imports', 'unused vars', 'unused variables',
    'rename ', 'fix typo', 'lint:', 'lint ', 'whitespace', 'formatting',
    'organize imports', 'sort imports', 'reformat',
)

DOCS_PREFIXES = ('docs:', 'doc:', 'docs(', 'doc(')
TEST_PREFIXES = ('test:', 'tests:', 'test(', 'tests(')
BUILD_PREFIXES = ('chore(deps', 'chore: bump', 'chore: upgrade', 'chore: update deps', 'build:', 'build(')
CHORE_PREFIXES = ('chore:', 'chore(')


def classify_title(title: str) -> str:
    """Bucket the commit's stated intent.

    The chore_other bucket replaces v1's bug of routing all chore: → cleanup_only.
    chore: titles like "enable X by default" or "telemetry improvements" aren't
    cleanups; they often hide feat-shaped work. They get their own bucket so we
    can apply scope-aware (not cleanup-shaped) suspicion checks.
    """
    t = title.strip().lower()
    if any(t.startswith(p) for p in DOCS_PREFIXES):
        return 'docs_only'
    if any(t.startswith(p) for p in TEST_PREFIXES):
        return 'test_only'
    if any(t.startswith(p) for p in BUILD_PREFIXES):
        return 'build_chore'
    if any(kw in t for kw in CLEANUP_KEYWORDS):
        return 'cleanup_only'
    if t.startswith('refactor'):
        return 'refactor'
    if t.startswith('feat'):
        return 'feat'
    if t.startswith('fix'):
        return 'fix_bug'
    if any(t.startswith(p) for p in CHORE_PREFIXES):
        return 'chore_other'
    return 'other'


# --- Title scope extraction --------------------------------------------------

SCOPE_RE = re.compile(r'^\w+\(([^)]+)\)!?:')


def title_scope(title: str) -> Optional[str]:
    """Extract the conventional-commit scope (e.g. fix(library): … → 'library').
    Returns lowercase scope string or None if no scope was named."""
    m = SCOPE_RE.match(title.strip())
    return m.group(1).lower() if m else None


# Mapping from scope-token to substrings that may legitimately appear in
# affected file paths. A file is "in scope" if its path contains any of these.
SCOPE_PATH_HINTS = {
    'bootstrap': ['bootstrap', 'initialize', 'init.ts', 'mainapp', 'index.tsx'],
    'shelf': ['shelf', 'novellibrary', 'app shell'],
    'library': ['library', 'novellibrary', 'novel'],
    'reader': ['reader', 'chapter', 'translation'],
    'db': ['db/', 'indexeddb', 'migration', 'schema'],
    'import': ['import'],
    'export': ['export', 'epub'],
    'epub': ['epub'],
    'sutta': ['sutta'],
    'audio': ['audio'],
    'translate': ['translat', 'adapter', 'provider'],
    'translation': ['translat', 'adapter', 'provider'],
    'image': ['image', 'illustration', 'gallery'],
    'feedback': ['feedback', 'comment'],
    'session': ['session'],
    'session-info': ['session'],
    'comparison': ['comparison'],
    'navigation': ['navig', 'navigation'],
    'streaming': ['stream', 'import'],
    'novel-library': ['library', 'novel'],
    'booktoki': ['booktoki', 'scrap', 'fetch'],
    'oscilloscope': ['oscilloscope'],
    'hooks': ['hooks/'],
    'store': ['store/'],
    'ui': ['component', 'css', 'index.css'],
    'settings': ['settings'],
    'fetch': ['fetch', 'scraping', 'transport'],
    'scraping': ['scrap', 'fetch'],
    'gallery': ['gallery', 'image'],
    'shell': ['shell', 'mainapp', 'app'],
    'shelf-features': ['shelf', 'library', 'novel'],
}


def files_outside_scope(scope: Optional[str], files: list[str]) -> list[str]:
    """If the title has a (scope), return files whose paths don't match the scope's hints.
    If no scope, return [] (no scope-aware filtering)."""
    if not scope:
        return []
    hints = SCOPE_PATH_HINTS.get(scope, [scope])
    out = []
    for f in files:
        fl = f.lower()
        if any(h in fl for h in hints):
            continue
        # Always exempt docs/tests/build files from scope check
        if PATH_IS_TEST.search(fl) or PATH_IS_DOCS.search(fl) or PATH_IS_BUILD.search(fl):
            continue
        out.append(f)
    return out


# --- Behavior-signal patterns (matched on ADDED lines in non-test/non-md files)

BEHAVIOR_PATTERNS = [
    ('useEffect', re.compile(r'\buseEffect\s*\(')),
    ('useCallback', re.compile(r'\buseCallback\s*\(')),
    ('useMemo', re.compile(r'\buseMemo\s*\(')),
    ('useState', re.compile(r'\buseState\s*\(')),
    ('useSubscribe', re.compile(r'\bsubscribe\s*\(')),
    ('addEventListener', re.compile(r'\baddEventListener\s*\(')),
    ('new Promise', re.compile(r'\bnew\s+Promise\s*\(')),
    ('AbortController', re.compile(r'\bAbortController\b')),
    ('async fn', re.compile(r'\b(async\s+function|async\s*\(|async\s+\w+\s*\()')),
    ('await', re.compile(r'\bawait\s+\w')),
    ('try/catch', re.compile(r'\btry\s*\{')),
    ('throw', re.compile(r'\bthrow\s+(new\s+)?\w')),
    ('return-bail', re.compile(r'\bif\s*\(.+\)\s*\{?\s*return')),
    ('store.set', re.compile(r'\bset\s*\(\s*\(?\w*\s*\)?\s*=>')),
    ('exported fn', re.compile(r'^\s*export\s+(const|function|async\s+function)\b')),
    ('exported class', re.compile(r'^\s*export\s+(default\s+)?class\b')),
]

PATH_IS_TEST = re.compile(r'(^|/)(tests?|__tests__|spec|fixtures?)(/|$)|\.test\.|\.spec\.')
PATH_IS_DOCS = re.compile(r'\.(md|markdown|txt)$|/docs?/|^issues/|^archive/', re.IGNORECASE)
PATH_IS_BUILD = re.compile(r'(package(-lock)?\.json|\.config\.(js|ts|cjs|mjs)|tsconfig|vite\.config|playwright\.config|^\.github/|^\.gitignore$|^\.env)')
# logic-bearing paths where smuggled changes have the most consequence
PATH_IS_HOTSPOT = re.compile(r'^(store/|hooks/|services/|adapters/|store/bootstrap|services/db/operations|services/translate|services/scraping)')


@dataclass
class CommitReport:
    sha: str
    short_sha: str
    date: str
    author: str
    title: str
    body: str
    bucket: str
    files: list[str]
    added_lines_total: int
    deleted_lines_total: int
    behavior_hits: dict[str, list[tuple[str, str]]]   # signal -> [(file, line)]
    files_changed_outside_scope: list[str]            # files that don't fit bucket
    suspicion_score: int
    suspicion_label: str
    reasons: list[str] = field(default_factory=list)


def run(*args, cwd: Optional[str] = None) -> str:
    return subprocess.check_output(
        list(args),
        cwd=cwd,
        text=True,
        stderr=subprocess.DEVNULL,
    )


def get_commits(n: int, since: Optional[str]) -> list[dict]:
    args = ['git', 'log', f'-n{n}', '--no-merges',
            '--date=iso-strict',
            '--pretty=format:%H%x1f%h%x1f%ad%x1f%an%x1f%s%x1f%b%x1e']
    if since:
        args.insert(2, f'--since={since}')
    raw = run(*args)
    out = []
    for chunk in raw.split('\x1e'):
        chunk = chunk.strip('\n')
        if not chunk:
            continue
        parts = chunk.split('\x1f')
        if len(parts) < 6:
            parts += [''] * (6 - len(parts))
        out.append({
            'sha': parts[0],
            'short_sha': parts[1],
            'date': parts[2],
            'author': parts[3],
            'title': parts[4],
            'body': parts[5],
        })
    return out


def get_commit_diff(sha: str) -> tuple[list[str], int, int, dict[str, list[str]]]:
    """Return (files, total_added, total_deleted, added_lines_per_file)."""
    numstat = run('git', 'show', sha, '--numstat', '--format=', '--no-color')
    files = []
    added = deleted = 0
    for line in numstat.strip().splitlines():
        parts = line.split('\t')
        if len(parts) != 3:
            continue
        a, d, fname = parts
        try:
            added += int(a) if a != '-' else 0
            deleted += int(d) if d != '-' else 0
        except ValueError:
            pass
        files.append(fname)

    # collect added lines per file from the patch
    patch = run('git', 'show', sha, '--format=', '--no-color', '-U0')
    current_file: Optional[str] = None
    added_per_file: dict[str, list[str]] = defaultdict(list)
    for line in patch.splitlines():
        if line.startswith('diff --git'):
            m = re.search(r'b/(.+?)$', line)
            current_file = m.group(1) if m else None
        elif line.startswith('+++'):
            m = re.search(r'b/(.+?)$', line)
            if m:
                current_file = m.group(1)
        elif line.startswith('+') and not line.startswith('+++'):
            if current_file is None:
                continue
            added_per_file[current_file].append(line[1:])
    return files, added, deleted, dict(added_per_file)


def assess(commit: dict) -> CommitReport:
    bucket = classify_title(commit['title'])
    scope = title_scope(commit['title'])
    files, added, deleted, added_per_file = get_commit_diff(commit['sha'])

    # Categorize files
    nonscope_files = []
    behavior_hits: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for fname in files:
        is_test = bool(PATH_IS_TEST.search(fname))
        is_docs = bool(PATH_IS_DOCS.search(fname))
        is_build = bool(PATH_IS_BUILD.search(fname))

        # files that don't fit the bucket's expected scope
        if bucket == 'docs_only' and not is_docs:
            nonscope_files.append(fname)
        elif bucket == 'test_only' and not is_test:
            nonscope_files.append(fname)
        elif bucket == 'build_chore' and not (is_build or is_docs):
            nonscope_files.append(fname)

        # collect behavior signals from non-test, non-docs files only
        if is_test or is_docs:
            continue
        for sig_name, pat in BEHAVIOR_PATTERNS:
            for line in added_per_file.get(fname, []):
                if pat.search(line):
                    behavior_hits[sig_name].append((fname, line.rstrip()[:160]))

    # Files that are outside the title's named scope (only meaningful if scope present)
    out_of_scope_files = files_outside_scope(scope, files)

    # Suspicion scoring
    score = 0
    reasons: list[str] = []

    if bucket == 'cleanup_only':
        # any behavior signal in cleanup is a strong signal
        if behavior_hits:
            score += 5
            kinds = sorted(behavior_hits.keys())
            reasons.append(f"cleanup_only commit added behavior signals: {', '.join(kinds[:6])}")
        # large file count for a cleanup
        nontrivial = [f for f in files if not PATH_IS_DOCS.search(f) and not PATH_IS_TEST.search(f)]
        if len(nontrivial) > 8:
            score += 2
            reasons.append(f"cleanup_only commit touches {len(nontrivial)} non-docs/test files")
        # touches a hotspot
        hotspot_files = [f for f in files if PATH_IS_HOTSPOT.search(f)]
        if hotspot_files:
            score += 3
            reasons.append(f"cleanup_only commit modifies hotspot path(s): {hotspot_files[:3]}")
    elif bucket == 'chore_other':
        # chore: titles that aren't deps/bumps and don't match cleanup keywords.
        # Often "enable X by default" or "telemetry improvements" — feat-shaped,
        # but pretending to be chore. Apply a softer version of cleanup checks.
        smuggle_signals = {k: v for k, v in behavior_hits.items()
                           if k in ('useEffect', 'addEventListener', 'try/catch',
                                    'throw', 'return-bail', 'AbortController',
                                    'subscribe', 'store.set')}
        if smuggle_signals:
            score += 3
            reasons.append(f"chore (non-deps) added control-flow signals: {', '.join(sorted(smuggle_signals.keys()))}")
        hotspot_files = [f for f in files if PATH_IS_HOTSPOT.search(f)]
        if hotspot_files:
            score += 2
            reasons.append(f"chore (non-deps) modifies hotspot path(s): {hotspot_files[:3]}")
    elif bucket == 'docs_only':
        if nonscope_files:
            score += 4
            reasons.append(f"docs_only commit modifies non-docs files: {nonscope_files[:3]}")
    elif bucket == 'test_only':
        if nonscope_files:
            score += 4
            reasons.append(f"test_only commit modifies non-test files: {nonscope_files[:3]}")
    elif bucket == 'refactor':
        # refactor should have minimal behavior signals (control-flow / new useEffects)
        smuggle_signals = {k: v for k, v in behavior_hits.items()
                           if k in ('useEffect', 'try/catch', 'throw', 'return-bail',
                                    'AbortController', 'addEventListener')}
        if smuggle_signals:
            score += 2
            reasons.append(f"refactor added control-flow signals: {', '.join(sorted(smuggle_signals.keys()))}")
    elif bucket == 'fix_bug':
        # fix should be focused; check for cross-area changes
        toplevels = sorted({f.split('/')[0] for f in files if '/' in f})
        if len(toplevels) >= 4 and len(files) >= 6:
            score += 1
            reasons.append(f"fix touches {len(toplevels)} top-level areas: {toplevels[:5]}")

    # Scope-aware check: if title named a (scope), files outside it are suspect.
    # Only fire when the commit is titled fix/feat/refactor with a scope.
    if scope and bucket in ('fix_bug', 'feat', 'refactor', 'chore_other'):
        hotspot_oos = [f for f in out_of_scope_files if PATH_IS_HOTSPOT.search(f)]
        if hotspot_oos:
            score += 2
            reasons.append(
                f"title scope is `{scope}` but commit modifies out-of-scope hotspot(s): {hotspot_oos[:3]}"
            )

    # Independent flag: any commit (regardless of bucket) that modifies init / bootstrap
    # without saying so in the title is interesting. EXEMPT cleanup_only since that
    # already gets a hotspot bonus.
    bootstrap_files = [f for f in files if 'bootstrap' in f or 'initializeStore' in f]
    title_lc = commit['title'].lower()
    if bootstrap_files and not any(k in title_lc for k in ('boot', 'init', 'bootstrap', 'startup', 'shell')):
        if bucket != 'cleanup_only':  # already credited
            score += 2
            reasons.append(f"modifies bootstrap/init without naming it in title: {bootstrap_files[:3]}")

    # Label
    if score >= 6:
        label = 'STRONG'
    elif score >= 3:
        label = 'MEDIUM'
    elif score >= 1:
        label = 'WEAK'
    else:
        label = 'CLEAN'

    return CommitReport(
        sha=commit['sha'],
        short_sha=commit['short_sha'],
        date=commit['date'],
        author=commit['author'],
        title=commit['title'],
        body=commit['body'],
        bucket=bucket,
        files=files,
        added_lines_total=added,
        deleted_lines_total=deleted,
        behavior_hits=dict(behavior_hits),
        files_changed_outside_scope=nonscope_files,
        suspicion_score=score,
        suspicion_label=label,
        reasons=reasons,
    )


def render_markdown(reports: list[CommitReport], n_commits: int, since: Optional[str], top: int) -> str:
    out = []
    out.append('# Co-mingled commits — survey results')
    out.append('')
    out.append(f'_Surveyed {n_commits} commits' + (f' since {since}' if since else '') + '._')
    out.append('')

    bucket_counts = Counter(r.bucket for r in reports)
    label_counts = Counter(r.suspicion_label for r in reports)

    out.append('## Aggregate stats')
    out.append('')
    out.append('### By title bucket')
    out.append('')
    out.append('| Bucket | Count |')
    out.append('|---|---:|')
    for b in ('feat', 'fix_bug', 'refactor', 'cleanup_only', 'chore_other',
              'docs_only', 'test_only', 'build_chore', 'other'):
        out.append(f'| `{b}` | {bucket_counts.get(b, 0)} |')
    out.append('')
    out.append('### By suspicion label')
    out.append('')
    out.append('| Label | Count |')
    out.append('|---|---:|')
    for lbl in ('STRONG', 'MEDIUM', 'WEAK', 'CLEAN'):
        out.append(f'| {lbl} | {label_counts.get(lbl, 0)} |')
    out.append('')

    # Crosstab: bucket × label
    out.append('### Bucket × suspicion crosstab')
    out.append('')
    buckets_seen = ('cleanup_only', 'chore_other', 'docs_only', 'test_only', 'build_chore',
                    'fix_bug', 'feat', 'refactor', 'other')
    out.append('| Bucket | STRONG | MEDIUM | WEAK | CLEAN |')
    out.append('|---|---:|---:|---:|---:|')
    for b in buckets_seen:
        cells = []
        for lbl in ('STRONG', 'MEDIUM', 'WEAK', 'CLEAN'):
            n = sum(1 for r in reports if r.bucket == b and r.suspicion_label == lbl)
            cells.append(str(n))
        out.append(f'| `{b}` | {" | ".join(cells)} |')
    out.append('')

    # Top flagged
    flagged = sorted(
        [r for r in reports if r.suspicion_label in ('STRONG', 'MEDIUM')],
        key=lambda r: (-r.suspicion_score, r.date),
    )[:top]

    out.append(f'## Top {len(flagged)} flagged commits')
    out.append('')
    if not flagged:
        out.append('_None — no commits scored MEDIUM or STRONG._')
        return '\n'.join(out)

    for r in flagged:
        out.append(f'### `{r.short_sha}` — {r.suspicion_label} (score {r.suspicion_score}) — `{r.bucket}`')
        out.append('')
        out.append(f'**Title:** {r.title}')
        out.append(f'**Date:** {r.date}  **Author:** {r.author}')
        out.append(f'**Files:** {len(r.files)} ({r.added_lines_total}+ / {r.deleted_lines_total}-)')
        out.append('')
        out.append('**Why flagged:**')
        for reason in r.reasons:
            out.append(f'- {reason}')
        out.append('')
        if r.behavior_hits:
            out.append('**Behavior signals (added lines):**')
            for sig, hits in sorted(r.behavior_hits.items()):
                out.append(f'- `{sig}` (×{len(hits)})')
                for fname, line in hits[:2]:
                    line_clean = line.strip()[:130]
                    out.append(f'  - `{fname}` → `{line_clean}`')
            out.append('')
        out.append('---')
        out.append('')

    return '\n'.join(out)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--n', type=int, default=100)
    p.add_argument('--top', type=int, default=20)
    p.add_argument('--since', type=str, default=None,
                   help='git log --since= argument, e.g. 2025-11-01')
    args = p.parse_args()

    commits = get_commits(args.n, args.since)
    reports = [assess(c) for c in commits]
    print(render_markdown(reports, len(commits), args.since, args.top))


if __name__ == '__main__':
    main()
