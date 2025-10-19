/**
 * Manual test to demonstrate HR tag spacing fix
 * Run with: npx tsx tests/manual/test-hr-spacing.ts
 */

import { HtmlRepairService } from '../../services/translate/HtmlRepairService';

// Test case from the user's example
const input = `"…Haa."

Somehow Laura sighed. This girl sometimes performs acts beyond my comprehension. Is this how women are? The world remains a strange place.<hr>The battle ended in a decisive defeat for the Habsburgs. Of the fifteen hundred knights, fewer than two hundred returned alive. The work of Laura de Farnese had proven flawless. Heidelberg's garrison exhausted almost all their knight-power; the rest would be needed to defend the fortress. Our encirclement stood firm.

Now the only potential reinforcements were from the central capital, but the New Habsburg Republic lacked the capability to wage true war. The mountain faction wasn't the lone threat facing Leader Elizabeth—the baronial plains of Barbatos, Marbas's neutral faction, and Gamigin's forces all bordered the Republic. They were surrounded by enemies on all sides.`;

console.log('=== BEFORE HTML REPAIR ===');
console.log(input);
console.log('\n');

const { html: repaired, stats } = HtmlRepairService.repair(input, { enabled: true, verbose: true });

console.log('=== AFTER HTML REPAIR ===');
console.log(repaired);
console.log('\n');

console.log('=== REPAIR STATS ===');
console.log('Applied repairs:', stats.applied);
console.log('Warnings:', stats.warnings);
console.log('\n');

// Verify the fix
if (repaired.includes('<br><br><hr><br><br>')) {
  console.log('✅ SUCCESS: HR tag now has proper spacing!');
} else {
  console.log('❌ FAILED: HR tag still lacks spacing');
}

// Show the specific section with the fix
const hrSection = repaired.slice(
  Math.max(0, repaired.indexOf('<hr>') - 50),
  Math.min(repaired.length, repaired.indexOf('<hr>') + 100)
);
console.log('\n=== HR SECTION (50 chars before and after) ===');
console.log(hrSection);
