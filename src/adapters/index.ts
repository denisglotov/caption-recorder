import type { PlatformAdapter } from './PlatformAdapter';
import { GoogleMeetAdapter } from './GoogleMeetAdapter';

export * from './PlatformAdapter';
export * from './GoogleMeetAdapter';

const availableAdapters: PlatformAdapter[] = [new GoogleMeetAdapter()];

/**
 * Detect the appropriate platform adapter for the current URL.
 */
export function getAdapterForUrl(url: string = window.location.href): PlatformAdapter | null {
  for (const adapter of availableAdapters) {
    if (adapter.matchesUrl(url)) {
      return adapter;
    }
  }
  return null;
}
