const fs = require('fs');

// Read the JSON file
const sessionData = JSON.parse(fs.readFileSync('./booktoki_chapters_509_2025-08-14T09-52-28-127Z.json', 'utf8'));

console.log('🔍 URL Collision Analysis');
console.log('========================');

const normalizeUrl = (url) => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        urlObj.searchParams.delete('viewer');
        urlObj.searchParams.delete('book');
        return urlObj.origin + urlObj.pathname.replace(/\/$/, "") + urlObj.search;
    } catch (e) {
        return url;
    }
};

// Analyze all chapters for potential collisions
const originalUrls = new Set();
const normalizedUrls = new Set();
const normalizedToOriginalMap = new Map();
const collisions = [];

console.log(`📊 Analyzing ${sessionData.chapters.length} chapters...\n`);

sessionData.chapters.forEach((chapter) => {
    const original = chapter.url;
    const normalized = normalizeUrl(original);
    
    originalUrls.add(original);
    
    if (normalizedToOriginalMap.has(normalized)) {
        // Collision detected!
        const existingOriginal = normalizedToOriginalMap.get(normalized);
        collisions.push({
            normalized,
            originals: [existingOriginal, original],
            chapters: [
                sessionData.chapters.find(ch => ch.url === existingOriginal),
                chapter
            ]
        });
    } else {
        normalizedToOriginalMap.set(normalized, original);
        normalizedUrls.add(normalized);
    }
});

console.log(`📈 Statistics:`);
console.log(`  Original URLs:   ${originalUrls.size}`);
console.log(`  Normalized URLs: ${normalizedUrls.size}`);
console.log(`  Collisions:      ${collisions.length}`);

if (collisions.length > 0) {
    console.log('\n❌ COLLISION DETECTED!');
    console.log('===================');
    
    collisions.slice(0, 5).forEach((collision, i) => {
        console.log(`\nCollision ${i + 1}:`);
        console.log(`  Normalized: ${collision.normalized}`);
        console.log(`  Original 1: ${collision.originals[0]}`);
        console.log(`  Original 2: ${collision.originals[1]}`);
        console.log(`  Chapter 1:  ${collision.chapters[0]?.chapterNumber} - ${collision.chapters[0]?.title}`);
        console.log(`  Chapter 2:  ${collision.chapters[1]?.chapterNumber} - ${collision.chapters[1]?.title}`);
    });
    
    if (collisions.length > 5) {
        console.log(`\n... and ${collisions.length - 5} more collisions`);
    }
} else {
    console.log('\n✅ NO COLLISIONS DETECTED!');
    console.log('All normalized URLs are unique.');
}

console.log('\n🔍 Sample URL transformations:');
sessionData.chapters.slice(0, 5).forEach((ch, i) => {
    const normalized = normalizeUrl(ch.url);
    const changed = ch.url !== normalized;
    console.log(`\nChapter ${ch.chapterNumber}:`);
    console.log(`  Original:   ${ch.url}`);
    console.log(`  Normalized: ${normalized}`);
    console.log(`  Changed:    ${changed ? '✅ YES' : '❌ NO'}`);
});

console.log('\n🎯 CONCLUSION:');
if (collisions.length > 0) {
    console.log(`❌ URL normalization will cause ${collisions.length} collisions!`);
    console.log('This would overwrite chapter data and break navigation.');
    console.log('Recommendation: Use a different approach or add chapter number to keys.');
} else {
    console.log('✅ URL normalization is safe - no collisions detected.');
    console.log('All chapters will maintain unique identifiers after normalization.');
}