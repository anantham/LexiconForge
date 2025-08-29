/**
 * Debug script to analyze the chain building logic with actual data
 */

// Mock the normalization function from useAppStore
const normalizeUrl = (url) => {
    if (!url) return null;
    try {
        const urlObj = new URL(url);
        // Remove the viewer and book parameter
        urlObj.searchParams.delete('viewer');
        urlObj.searchParams.delete('book');
        // Rebuild the URL without the hash and with a standardized path
        return urlObj.origin + urlObj.pathname.replace(/\/$/, "") + urlObj.search;
    } catch (e) {
        return url;
    }
};

// Simulate the exact import process
const chapters = [
    {
        chapterNumber: 1,
        nextUrl: "https://booktoki468.com/novel/3912078?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4&viewer=1",
        prevUrl: "https://booktoki468.com/novel/2119695",
        title: "던전 디펜스-1화",
        url: "https://booktoki468.com/novel/3912072"
    },
    {
        chapterNumber: 2,
        nextUrl: "https://booktoki468.com/novel/3912084?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4&viewer=1",
        prevUrl: "https://booktoki468.com/novel/3912072?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4",
        title: "던전 디펜스-2화",
        url: "https://booktoki468.com/novel/3912078?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4&viewer=1"
    },
    {
        chapterNumber: 3,
        nextUrl: "https://booktoki468.com/novel/3912102?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4&viewer=1",
        prevUrl: "https://booktoki468.com/novel/3912078?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4",
        title: "던전 디펜스-3화",
        url: "https://booktoki468.com/novel/3912084?book=%EC%99%84%EA%B2%B4%EC%86%8C%EC%84%A4&viewer=1"
    }
];

console.log('🔍 Debugging Chain Building Logic');
console.log('=====================================');

// Step 1: Simulate the import process
console.log('\n📥 Step 1: Import Process');
const sessionData = {};
for (const chapter of chapters) {
    const sourceUrl = normalizeUrl(chapter.url);
    const nextUrl = normalizeUrl(chapter.nextUrl);
    const prevUrl = normalizeUrl(chapter.prevUrl);
    
    console.log(`\nChapter ${chapter.chapterNumber}:`);
    console.log(`  Original URL: ${chapter.url}`);
    console.log(`  Normalized URL: ${sourceUrl}`);
    console.log(`  Original Next: ${chapter.nextUrl}`);
    console.log(`  Normalized Next: ${nextUrl}`);
    console.log(`  Original Prev: ${chapter.prevUrl}`);
    console.log(`  Normalized Prev: ${prevUrl}`);
    
    sessionData[sourceUrl] = {
        chapter: {
            title: chapter.title,
            originalUrl: sourceUrl,
            nextUrl: nextUrl,
            prevUrl: prevUrl,
            chapterNumber: chapter.chapterNumber,
        }
    };
}

console.log('\n📊 SessionData Keys:', Object.keys(sessionData));

// Step 2: Simulate the chain building logic
console.log('\n🔗 Step 2: Chain Building Logic');

const chapterMap = new Map();
Object.entries(sessionData).forEach(([url, data]) => {
    if (data?.chapter) {
        chapterMap.set(url, { url, data });
    }
});

console.log('ChapterMap size:', chapterMap.size);
console.log('ChapterMap keys:', Array.from(chapterMap.keys()));

// Find heads
const heads = new Set(chapterMap.values());
for (const chapter of chapterMap.values()) {
    const prevUrl = chapter.data.chapter.prevUrl;
    console.log(`\nChecking chapter ${chapter.data.chapter.chapterNumber}:`);
    console.log(`  URL: ${chapter.url}`);
    console.log(`  PrevUrl: ${prevUrl}`);
    console.log(`  Has prevUrl in chapterMap: ${prevUrl && chapterMap.has(prevUrl)}`);
    
    if (prevUrl && chapterMap.has(prevUrl)) {
        console.log(`  🗑️ Removing from heads: ${chapter.url}`);
        heads.delete(chapter);
    }
}

console.log('\n👑 Heads found:', heads.size);
for (const head of heads) {
    console.log(`  Head: ${head.url} (Chapter ${head.data.chapter.chapterNumber})`);
}

// Build chains
console.log('\n⛓️ Building chains:');
const chains = [];
for (const head of heads) {
    console.log(`\nBuilding chain from head: ${head.url}`);
    const currentChain = [];
    let currentNode = head;
    const visited = new Set(); // Prevent infinite loops
    
    while (currentNode) {
        if (visited.has(currentNode.url)) {
            console.log(`  ⚠️ CYCLE DETECTED: ${currentNode.url} already visited!`);
            break;
        }
        
        visited.add(currentNode.url);
        currentChain.push(currentNode);
        
        console.log(`  Adding to chain: ${currentNode.url} (Chapter ${currentNode.data.chapter.chapterNumber})`);
        
        const nextUrl = currentNode.data.chapter.nextUrl;
        console.log(`    NextUrl: ${nextUrl}`);
        console.log(`    Has nextUrl in chapterMap: ${nextUrl && chapterMap.has(nextUrl)}`);
        
        currentNode = nextUrl && chapterMap.has(nextUrl) ? chapterMap.get(nextUrl) : undefined;
        
        if (currentNode) {
            console.log(`    Next node found: ${currentNode.url}`);
        } else {
            console.log(`    Chain ended`);
        }
    }
    
    console.log(`  Chain completed with ${currentChain.length} chapters`);
    chains.push(currentChain);
}

// Flatten and check for duplicates
console.log('\n📋 Final Analysis:');
console.log(`Number of chains: ${chains.length}`);
const flattened = chains.flat();
console.log(`Total chapters after flattening: ${flattened.length}`);

const urlCounts = {};
flattened.forEach(chapter => {
    const url = chapter.url;
    urlCounts[url] = (urlCounts[url] || 0) + 1;
});

console.log('\n🔢 URL occurrence counts:');
for (const [url, count] of Object.entries(urlCounts)) {
    if (count > 1) {
        console.log(`  ❌ DUPLICATE: ${url} appears ${count} times`);
    } else {
        console.log(`  ✅ Unique: ${url} appears ${count} time`);
    }
}

console.log('\n🎯 Root Cause Analysis:');
if (Object.values(urlCounts).some(count => count > 1)) {
    console.log('❌ DUPLICATES DETECTED in chain building logic!');
    console.log('This explains the React key conflicts.');
} else {
    console.log('✅ No duplicates found in chain building logic.');
    console.log('The issue might be elsewhere.');
}