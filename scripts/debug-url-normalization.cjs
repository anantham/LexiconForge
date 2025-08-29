const fs = require('fs');

// Read the JSON file
const sessionData = JSON.parse(fs.readFileSync('./booktoki_chapters_509_2025-08-14T09-52-28-127Z.json', 'utf8'));

console.log('🔍 URL Normalization Analysis');
console.log('============================');

// Mock the normalization function from useAppStore
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

console.log('\n📊 First 3 chapters analysis:');
sessionData.chapters.slice(0, 3).forEach((ch, i) => {
    const original = ch.url;
    const normalized = normalizeUrl(ch.url);
    console.log(`\nChapter ${ch.chapterNumber}:`);
    console.log(`  Original:   ${original}`);
    console.log(`  Normalized: ${normalized}`);
    console.log(`  Match:      ${original === normalized ? '✅' : '❌'}`);
});

console.log('\n🔍 What the console log shows:');
console.log('Navigation URL: https://booktoki468.com/novel/3912078');
const navUrl = 'https://booktoki468.com/novel/3912078';
const normalizedNavUrl = normalizeUrl(navUrl);
console.log(`Normalized Navigation: ${normalizedNavUrl}`);

console.log('\n🔍 Chapter 2 from import:');
const chapter2 = sessionData.chapters.find(ch => ch.chapterNumber === 2);
if (chapter2) {
    console.log(`  Import URL:  ${chapter2.url}`);
    console.log(`  Normalized:  ${normalizeUrl(chapter2.url)}`);
    console.log(`  Match with nav: ${normalizeUrl(chapter2.url) === normalizedNavUrl ? '✅' : '❌'}`);
}

console.log('\n🎯 ROOT CAUSE:');
console.log('If normalized import URLs don\'t match navigation URLs,');
console.log('the cache lookup will fail even though data exists!');