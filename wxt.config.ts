import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  runner: {
    disabled: true,
  },
  manifest: ({ browser }) => ({
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    version: '1.1.0',
    permissions:
      browser === 'firefox' ? ['storage', 'tabs'] : ['storage', 'sidePanel', 'tabs'],
    host_permissions: ['https://meet.google.com/*'],
    action: {
      default_title: '__MSG_extensionName__',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'caption-recorder@dymka.org',
          strict_min_version: '109.0',
        },
      },
    }),
  }),
});
