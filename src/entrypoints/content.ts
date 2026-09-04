import { defineContentScript } from 'wxt/sandbox';
import type { ContentScriptContext } from 'wxt/client';
import { getAdapterForUrl, ADAPTER_MATCH_PATTERNS } from '../adapters';
import { SessionRecorder } from '../core/SessionRecorder';

export function initContentScript(ctx: ContentScriptContext) {
  let recorder: SessionRecorder | null = null;
  let currentUrl = '';

  const syncRecorder = () => {
    const newUrl = typeof window !== 'undefined' ? window.location.href : '';
    const adapter = getAdapterForUrl(newUrl);

    if (!adapter) {
      if (recorder) {
        recorder.destroy();
        recorder = null;
      }
      currentUrl = '';
      return;
    }

    if (recorder) {
      const isSame = adapter.isSameMeeting
        ? adapter.isSameMeeting(currentUrl, newUrl)
        : currentUrl === newUrl;

      if (currentUrl && isSame) {
        return;
      }
      recorder.destroy();
      recorder = null;
    }

    recorder = new SessionRecorder(adapter);
    currentUrl = newUrl;
  };

  syncRecorder();

  if (typeof window !== 'undefined') {
    ctx.addEventListener(window, 'wxt:locationchange', () => syncRecorder());
  }

  ctx.onInvalidated(() => {
    if (recorder) {
      recorder.destroy();
      recorder = null;
    }
    currentUrl = '';
  });

  return {
    getRecorder: () => recorder,
    syncRecorder,
  };
}

export default defineContentScript({
  matches: [...ADAPTER_MATCH_PATTERNS],
  main(ctx) {
    initContentScript(ctx);
  },
});
