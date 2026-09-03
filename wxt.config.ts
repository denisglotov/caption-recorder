import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  runner: {
    disabled: true,
  },
  manifest: {
    name: 'CaptionRecorder',
    description: 'Privacy-first live closed caption recorder and meeting transcript exporter.',
    version: '1.0.0',
    permissions: ['storage'],
    host_permissions: ['https://meet.google.com/*'],
    action: {
      default_title: 'CaptionRecorder',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
