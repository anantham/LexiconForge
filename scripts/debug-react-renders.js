/**
 * Debug script to analyze React re-rendering patterns
 * This script simulates the useShallow pattern to understand why SessionInfo re-renders
 */

// Mock the useShallow behavior
const useShallow = (selector) => {
    // useShallow performs shallow comparison of the returned object
    const result = selector();
    console.log('🔍 useShallow selector called, returning:', {
        keys: Object.keys(result),
        sessionDataKeys: result.sessionData ? Object.keys(result.sessionData).length : 0
    });
    return result;
};

// Simulate store state changes
let mockState = {
    currentUrl: 'https://booktoki468.com/novel/3912072',
    sessionData: {
        'https://booktoki468.com/novel/3912072': {
            chapter: { title: 'Chapter 1', chapterNumber: 1 }
        },
        'https://booktoki468.com/novel/3912078': {
            chapter: { title: 'Chapter 2', chapterNumber: 2 }
        },
        'https://booktoki468.com/novel/3912084': {
            chapter: { title: 'Chapter 3', chapterNumber: 3 }
        }
    },
    urlHistory: [],
    handleNavigate: () => {},
    exportSession: () => {},
    exportEpub: () => {},
    setShowSettingsModal: () => {}
};

console.log('🚀 Simulating React re-rendering patterns');
console.log('===========================================');

// Simulate the exact selector used in SessionInfo
const sessionInfoSelector = (state) => ({
    currentUrl: state.currentUrl,
    sessionData: state.sessionData,
    urlHistory: state.urlHistory,
    handleNavigate: state.handleNavigate,
    exportSession: state.exportSession,
    exportEpub: state.exportEpub,
    setShowSettingsModal: state.setShowSettingsModal,
});

console.log('\n📊 Initial selector call:');
const result1 = useShallow(() => sessionInfoSelector(mockState));

console.log('\n📊 Second selector call (same state):');
const result2 = useShallow(() => sessionInfoSelector(mockState));

console.log('\n🔄 Checking if results are identical:', result1 === result2);
console.log('SessionData reference identical:', result1.sessionData === result2.sessionData);

// Simulate a state change that creates a new sessionData object reference
console.log('\n⚡ Simulating sessionData change (new object reference):');
mockState = {
    ...mockState,
    sessionData: { ...mockState.sessionData } // New object reference, same content
};

const result3 = useShallow(() => sessionInfoSelector(mockState));
console.log('New sessionData reference identical to previous:', result2.sessionData === result3.sessionData);

// This is the problem: useShallow will see sessionData as "changed" even if content is the same
console.log('\n🎯 ROOT CAUSE ANALYSIS:');
console.log('If sessionData gets a new object reference on every store update,');
console.log('useShallow will trigger a re-render of SessionInfo component,');
console.log('causing the map() function to run again with the same data,');
console.log('resulting in duplicate React keys within a single render cycle.');

console.log('\n💡 SOLUTION:');
console.log('Need to prevent sessionData from getting new object references,');
console.log('or use a more specific selector that only triggers on actual content changes.');