import { describe, expect, it } from 'vitest';
import { auditLiturgyAlignments } from '../../../services/liturgy/alignmentAudit';
import type { LiturgyDoc } from '../../../types/liturgy';

function doc(reviewed: boolean): LiturgyDoc {
  return {
    slug: 'audit-test',
    sangha: 'test',
    title: 'Audit test',
    tradition: 'theravada',
    sections: [
      {
        id: 'body',
        shape: 'triple-script-witness',
        segments: [
          {
            id: 'line',
            pali: 'Dutiyampi',
            words: [
              {
                form: 'dutiyampi',
                gloss: 'for the second time also',
                morphemes: [
                  { text: 'dutiyam', type: 'stem', gloss: 'second time' },
                  { text: 'pi', type: 'suffix', gloss: 'also' },
                ],
              },
            ],
            witnesses: [
              {
                by: 'Test',
                text: 'second time',
                alignTo: [0, 0],
                tokenAlignTo: reviewed
                  ? [{ kind: 'morpheme', index: 0 }, { kind: 'morpheme', index: 0 }]
                  : undefined,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('auditLiturgyAlignments', () => {
  it('reports an unauthored many-to-one multi-morpheme group', () => {
    const result = auditLiturgyAlignments([{ route: 'test/audit-test', doc: doc(false) }]);
    expect(result.summary.sourceWordRecords).toBe(1);
    expect(result.summary.englishTokens).toBe(2);
    expect(result.summary.fineTargetReviewGroups).toBe(1);
    expect(result.issues[0]).toMatchObject({
      paliForm: 'Dutiyampi',
      englishTokens: ['second', 'time'],
      unreviewedEnglishTokens: ['second', 'time'],
    });
  });

  it('clears the issue only after every token has an explicit reviewed target', () => {
    const result = auditLiturgyAlignments([{ route: 'test/audit-test', doc: doc(true) }]);
    expect(result.summary.explicitReviewedTargets).toBe(2);
    expect(result.summary.fineTargetReviewGroups).toBe(0);
  });

  it('accepts an intentional whole-word decision but rejects partial review', () => {
    const wholeWord = doc(false);
    const section = wholeWord.sections[0];
    if (section.shape !== 'triple-script-witness') return;
    section.segments[0].witnesses[0].tokenAlignTo = [
      { kind: 'word' },
      { kind: 'word' },
    ];
    expect(
      auditLiturgyAlignments([{ route: 'test/audit-test', doc: wholeWord }]).summary
        .fineTargetReviewGroups
    ).toBe(0);

    section.segments[0].witnesses[0].tokenAlignTo[1] = null;
    const partial = auditLiturgyAlignments([
      { route: 'test/audit-test', doc: wholeWord },
    ]);
    expect(partial.summary.fineTargetReviewGroups).toBe(1);
    expect(partial.issues[0].unreviewedEnglishTokens).toEqual(['time']);
  });
});
