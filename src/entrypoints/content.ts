import { defineContentScript } from 'wxt/sandbox';
import { createShadowRootUi } from 'wxt/client';
import { getAdapterForUrl } from '../adapters';
import { CaptionOverlay } from '../ui/CaptionOverlay';
import overlayStyles from '../ui/styles.css?raw';

export default defineContentScript({
  matches: ['https://meet.google.com/*'],
  cssInjectionMode: 'manual',
  async main(ctx) {
    const adapter = getAdapterForUrl(window.location.href);
    if (!adapter) {
      return;
    }

    const ui = await createShadowRootUi(ctx, {
      name: 'caption-recorder-root',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount: (_container, shadow) => {
        // Inject scoped styles into the Shadow DOM
        const styleSheet = document.createElement('style');
        styleSheet.textContent = overlayStyles;
        shadow.appendChild(styleSheet);

        // Mount the caption recorder overlay
        new CaptionOverlay(shadow, adapter);
      },
    });

    ui.mount();
  },
});
