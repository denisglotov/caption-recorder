import { defineContentScript } from 'wxt/sandbox';
import { getAdapterForUrl } from '../adapters';
import { SessionRecorder } from '../core/SessionRecorder';

export default defineContentScript({
  matches: ['https://meet.google.com/*'],
  main() {
    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter) {
      return;
    }

    new SessionRecorder(adapter);
  },
});
