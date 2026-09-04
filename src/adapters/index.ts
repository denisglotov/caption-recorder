import type { PlatformAdapter } from './PlatformAdapter';
import { GoogleMeetAdapter } from './GoogleMeetAdapter';

export * from './PlatformAdapter';
export * from './GoogleMeetAdapter';

type AdapterConstructor = new () => PlatformAdapter;

const adapterClasses: AdapterConstructor[] = [GoogleMeetAdapter];

/**
 * Detect the appropriate platform adapter for the current URL.
 * Returns a fresh adapter instance to avoid shared mutable state.
 */
export function getAdapterForUrl(url: string = window.location.href): PlatformAdapter | null {
  for (const AdapterClass of adapterClasses) {
    const adapter = new AdapterClass();
    if (adapter.matchesUrl(url)) {
      return adapter;
    }
  }
  return null;
}
