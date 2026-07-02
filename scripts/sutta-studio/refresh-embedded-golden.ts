/**
 * refresh-embedded-golden — re-baseline existing benchmark runs onto the CURRENT golden.
 *
 * Each run's pipeline-<phase>.json embeds a snapshot of the golden taken at run time.
 * backfill-quality-scores, judge-content and publish-compare all read that embedded copy —
 * so after a golden update (e.g. golden v2, ADR SUTTA-011 path B) the runs must be
 * re-baselined or every consumer keeps scoring against the stale reference.
 *
 * This rewrites ONLY data.golden.anatomist / data.golden.lexicographer from the fixtures
 * (model output is never touched; the original golden remains in git history).
 *
 * Usage: npx tsx scripts/sutta-studio/refresh-embedded-golden.ts <reportDir> [<reportDir> ...]
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');

const lexFix = JSON.parse(fs.readFileSync(path.join(REPO, 'test-fixtures/sutta-studio-lexicographer-golden.json'), 'utf8'));
const anatFix = JSON.parse(fs.readFileSync(path.join(REPO, 'test-fixtures/sutta-studio-anatomist-golden.json'), 'utf8'));

let updated = 0, missing = 0;
for (const dirArg of process.argv.slice(2)) {
  const runDir = path.resolve(dirArg);
  const outputsDir = path.join(runDir, 'outputs');
  if (!fs.existsSync(outputsDir)) continue;

  // PROVENANCE (codex review #7): reports/ is gitignored, so the run-time golden exists
  // ONLY inside these files. Before the first rebaseline, snapshot the original embedded
  // golden (identical across models — take the first model that has each phase) so the
  // v1 reference stays recoverable.
  const snapshotPath = path.join(runDir, 'golden-v1-snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    const snap: Record<string, any> = {};
    for (const model of fs.readdirSync(outputsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
      for (const pf of fs.readdirSync(path.join(outputsDir, model)).filter((f) => f.startsWith('pipeline-') && f.endsWith('.json'))) {
        const phaseId = pf.replace('pipeline-', '').replace('.json', '');
        if (snap[phaseId]) continue;
        const data = JSON.parse(fs.readFileSync(path.join(outputsDir, model, pf), 'utf8'));
        if (data.golden && !data.goldenRebaselined) snap[phaseId] = { anatomist: data.golden.anatomist, lexicographer: data.golden.lexicographer };
      }
    }
    fs.writeFileSync(snapshotPath, JSON.stringify({ _note: 'run-time embedded golden, snapshotted before rebaselining', phases: snap }, null, 2));
    console.log(`snapshotted original golden → ${snapshotPath} (${Object.keys(snap).length} phases)`);
  }

  for (const model of fs.readdirSync(outputsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const modelDir = path.join(outputsDir, model);
    for (const pf of fs.readdirSync(modelDir).filter((f) => f.startsWith('pipeline-') && f.endsWith('.json'))) {
      const phaseId = pf.replace('pipeline-', '').replace('.json', '');
      const ga = anatFix.anatomist?.[phaseId];
      const gl = lexFix.lexicographer?.[phaseId];
      if (!ga || !gl) { missing++; continue; }
      const p = path.join(modelDir, pf);
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (!data.golden) { missing++; continue; }
      data.golden.anatomist = ga;
      data.golden.lexicographer = {
        id: data.golden.lexicographer?.id ?? phaseId,
        // strip fixture-only acceptedSenses: the embedded golden mirrors what the scorer reads
        senses: (gl.senses || []).map((e: any) => ({ wordId: e.wordId, wordClass: e.wordClass, senses: e.senses })),
        handoff: data.golden.lexicographer?.handoff,
      };
      // mark the file as a rebaselined artifact, not the run-time original (codex review #7)
      data.goldenRebaselined = { date: '2026-07-02', source: 'test-fixtures golden v2 (SUTTA-011 path B + SUTTA-012)', originalSnapshot: 'golden-v1-snapshot.json' };
      fs.writeFileSync(p, JSON.stringify(data, null, 2));
      updated++;
    }
  }
}
console.log(`re-baselined ${updated} pipeline file(s) onto the current golden (${missing} without fixture golden left untouched)`);
