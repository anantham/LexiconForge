/**
 * Service Worker registration and communication for audio caching
 */

class AudioServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private isRegistered = false;

  /**
   * Register the audio service worker
   */
  async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[AudioSW] Service Workers not supported');
      return;
    }

    if (this.isRegistered) {
      return; // Already registered
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw-audio.js', {
        scope: '/'
      });

      console.log('[AudioSW] Registered successfully:', this.registration.scope);
      this.isRegistered = true;

      // Handle updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[AudioSW] New service worker available, refreshing cache');
            }
          });
        }
      });

    } catch (error) {
      console.error('[AudioSW] Registration failed:', error);
    }
  }

  /**
   * Check if service worker is registered and active
   */
  isActive(): boolean {
    return this.isRegistered && !!navigator.serviceWorker.controller;
  }

  /**
   * Send a message to the service worker
   */
  private async sendMessage(type: string, payload?: any): Promise<any> {
    if (!this.isActive()) {
      throw new Error('Service worker not active');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller!.postMessage(
        { type, payload },
        [messageChannel.port2]
      );

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Service worker message timeout')), 10000);
    });
  }

  /**
   * Manually cache a specific audio URL
   */
  async cacheAudio(url: string): Promise<void> {
    if (this.isActive()) {
      await this.sendMessage('CACHE_AUDIO', { url });
    }
  }

  /**
   * Remove specific audio from cache
   */
  async uncacheAudio(url: string): Promise<void> {
    if (this.isActive()) {
      await this.sendMessage('UNCACHE_AUDIO', { url });
    }
  }

  /**
   * Clear all audio cache
   */
  async clearCache(): Promise<void> {
    if (this.isActive()) {
      await this.sendMessage('CLEAR_AUDIO_CACHE');
    }
  }

  /**
   * Get cache status information
   */
  async getCacheStatus(): Promise<{ files: number; totalSize: number; details: any[] }> {
    if (!this.isActive()) {
      return { files: 0, totalSize: 0, details: [] };
    }

    try {
      return await this.sendMessage('GET_CACHE_STATUS');
    } catch {
      return { files: 0, totalSize: 0, details: [] };
    }
  }

  /**
   * Check if a URL is cached
   */
  async isCached(url: string): Promise<boolean> {
    if (!this.isActive()) {
      return false;
    }

    try {
      const status = await this.getCacheStatus();
      return status.details.some(file => file.url === url);
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const audioServiceWorker = new AudioServiceWorkerManager();