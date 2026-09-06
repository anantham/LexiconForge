#!/usr/bin/env node

import { LITURGY_DOCS_BY_SANGHA } from '../../data/liturgy';
import {
  auditLiturgyAlignments,
  type LiturgyRouteDoc,
} from '../../services/liturgy/alignmentAudit';

function registeredRoutes(): LiturgyRouteDoc[] {
  return Object.entries(LITURGY_DOCS_BY_SANGHA).flatMap(([sangha, docs]) =>
    Object.entries(docs).map(([slug, doc]) => ({
      route: `${sangha}/${slug}`,
      doc,
    }))
  );
}

function printHumanReadable(): void {
  const result = auditLiturgyAlignments(registeredRoutes());
  const summary = result.summary;
  console.log('Liturgy semantic-alignment audit');
  console.log(`Routes: ${summary.routes}`);
  console.log(`Segments: ${summary.segments}`);
  console.log(`Route-visible source-word records inspected: ${summary.sourceWordRecords}`);
  console.log(
    `Route-visible English tokens (includes pooled/unmapped witnesses): ${summary.routeVisibleEnglishTokens}`
  );
  console.log(
    `English tokens in witnesses with authored alignTo: ${summary.tokensInWitnessesWithAlignTo}`
  );
  console.log(`English tokens linked to a source word: ${summary.sourceAlignedEnglishTokens}`);
  console.log(`Explicit reviewed targets: ${summary.explicitReviewedTargets}`);
  console.log(`Fine-target review groups: ${summary.fineTargetReviewGroups}`);
  console.log('');
  console.log('Review groups by route:');
  for (const [route, count] of Object.entries(result.issuesByRoute).sort()) {
    console.log(`  ${route}: ${count}`);
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(auditLiturgyAlignments(registeredRoutes()), null, 2));
} else {
  printHumanReadable();
}
