/**
 * Audio Service Worker - Transparent caching for OST audio
 * 
 * Caches audio on first play without extra bandwidth usage.
 * Handles all audio requests and provides fallback for offline playback.
 */

const CACHE_NAME = 'ost-v1';
const AUDIO_CACHE_NAME = 'lexicon-forge-audio-v1';

// Audio URL patterns to cache
const AUDIO_URL_PATTERNS = [
  /\/ost\//,                    // /ost/ paths
  /api\.piapi\.ai.*\.(mp3|wav|ogg)$/,  // PiAPI audio outputs
  /piapi.*audio/,               // Any piapi audio endpoints
  /\.mp3(\?|$)/,                // .mp3 files
  /\.wav(\?|$)/,                // .wav files  
  /\.ogg(\?|$)/,                // .ogg files
];

// Helper function to check if request should be cached
function shouldCacheAudio(request) {
  // Check destination
  if (request.destination === 'audio') {
    return true;
  }
  
  // Check URL patterns
  const url = request.url;
  return AUDIO_URL_PATTERNS.some(pattern => pattern.test(url));
}

// Helper function to determine cache duration
function getCacheDuration(url) {
  if (url.includes('api.piapi.ai')) {
    // PiAPI URLs expire relatively quickly
    return 7 * 24 * 60 * 60 * 1000; // 7 days
  }
  return 30 * 24 * 60 * 60 * 1000; // 30 days for other audio
}

// Main fetch event handler
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Only handle audio requests
  if (!shouldCacheAudio(request)) {
    return; // Let browser handle normally
  }
  
  console.log('[SW-Audio] Handling audio request:', request.url);
  
  event.respondWith(
    handleAudioRequest(request)
      .catch(error => {
        console.error('[SW-Audio] Audio request failed:', error);
        // Return a basic error response rather than letting it fail silently
        return new Response('Audio temporarily unavailable', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const url = request.url;
  
  // Check cache first
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log('[SW-Audio] Serving from cache:', url);
    
    // Update last accessed time in cache headers if needed
    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache-Hit', 'true');
    headers.set('X-Cache-Date', new Date().toISOString());
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers: headers
    });
  }
  
  console.log('[SW-Audio] Fetching and caching:', url);
  
  // Fetch from network
  const networkResponse = await fetch(request);
  
  // Only cache successful responses
  if (networkResponse.ok && networkResponse.status === 200) {
    // Clone response for caching (response body can only be consumed once)
    const responseToCache = networkResponse.clone();
    
    // Add cache metadata
    const headers = new Headers(responseToCache.headers);
    headers.set('X-Cached-At', new Date().toISOString());
    headers.set('X-Cache-Duration', getCacheDuration(url).toString());
    
    const enhancedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers: headers
    });
    
    // Cache the enhanced response
    await cache.put(request, enhancedResponse.clone());
    console.log('[SW-Audio] Cached audio:', url);
    
    return enhancedResponse;
  }
  
  // Return network response even if not cacheable
  return networkResponse;
}

// Handle cache cleanup on activate
self.addEventListener('activate', (event) => {
  console.log('[SW-Audio] Service worker activated');
  
  event.waitUntil(
    cleanupExpiredCache()
  );
});

// Clean up expired cache entries
async function cleanupExpiredCache() {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const requests = await cache.keys();
    const now = Date.now();
    
    let cleanedCount = 0;
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      
      const cachedAt = response.headers.get('X-Cached-At');
      const cacheDuration = parseInt(response.headers.get('X-Cache-Duration') || '0');
      
      if (cachedAt && cacheDuration) {
        const cacheTime = new Date(cachedAt).getTime();
        if (now - cacheTime > cacheDuration) {
          await cache.delete(request);
          cleanedCount++;
          console.log('[SW-Audio] Cleaned expired cache entry:', request.url);
        }
      }
    }
    
    console.log(`[SW-Audio] Cache cleanup completed. Removed ${cleanedCount} expired entries.`);
  } catch (error) {
    console.error('[SW-Audio] Cache cleanup failed:', error);
  }
}

// Handle install event
self.addEventListener('install', (event) => {
  console.log('[SW-Audio] Service worker installing');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Message handler for commands from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'CACHE_AUDIO':
      // Manually cache a specific audio URL
      event.waitUntil(cacheAudioUrl(payload.url));
      break;
      
    case 'UNCACHE_AUDIO':
      // Remove specific audio from cache
      event.waitUntil(uncacheAudioUrl(payload.url));
      break;
      
    case 'CLEAR_AUDIO_CACHE':
      // Clear all audio cache
      event.waitUntil(clearAudioCache());
      break;
      
    case 'GET_CACHE_STATUS':
      // Return cache status
      event.waitUntil(getCacheStatus().then(status => {
        event.ports[0]?.postMessage(status);
      }));
      break;
      
    default:
      console.log('[SW-Audio] Unknown message type:', type);
  }
});

// Manually cache a specific audio URL
async function cacheAudioUrl(url) {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = await fetch(url);
    
    if (response.ok) {
      await cache.put(url, response);
      console.log('[SW-Audio] Manually cached:', url);
    }
  } catch (error) {
    console.error('[SW-Audio] Manual cache failed:', error);
  }
}

// Remove specific audio from cache
async function uncacheAudioUrl(url) {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const deleted = await cache.delete(url);
    console.log('[SW-Audio] Uncached:', url, deleted ? 'success' : 'not found');
  } catch (error) {
    console.error('[SW-Audio] Uncache failed:', error);
  }
}

// Clear all audio cache
async function clearAudioCache() {
  try {
    await caches.delete(AUDIO_CACHE_NAME);
    console.log('[SW-Audio] All audio cache cleared');
  } catch (error) {
    console.error('[SW-Audio] Clear cache failed:', error);
  }
}

// Get cache status information
async function getCacheStatus() {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const requests = await cache.keys();
    let totalSize = 0;
    const files = [];
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
        files.push({
          url: request.url,
          size: blob.size,
          cachedAt: response.headers.get('X-Cached-At'),
          type: response.headers.get('content-type')
        });
      }
    }
    
    return {
      files: files.length,
      totalSize,
      details: files
    };
  } catch (error) {
    console.error('[SW-Audio] Get cache status failed:', error);
    return { files: 0, totalSize: 0, details: [] };
  }
}