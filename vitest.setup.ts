import { vi } from 'vitest';

type MockBrowser = Record<string | symbol, unknown>;
type GlobalWithBrowser = typeof globalThis & { browser?: MockBrowser; chrome?: MockBrowser };

const browserProxy = new Proxy<MockBrowser>(
  {},
  {
    get: (_target, prop: string | symbol) => {
      const ext =
        (globalThis as GlobalWithBrowser).browser || (globalThis as GlobalWithBrowser).chrome;
      return ext ? ext[prop] : undefined;
    },
    set: (_target, prop: string | symbol, value: unknown) => {
      const g = globalThis as GlobalWithBrowser;
      if (!g.browser) {
        g.browser = {};
      }
      g.browser[prop] = value;
      return true;
    },
    has: (_target, prop: string | symbol) => {
      const ext =
        (globalThis as GlobalWithBrowser).browser || (globalThis as GlobalWithBrowser).chrome;
      return ext ? prop in ext : false;
    },
    deleteProperty: (_target, prop: string | symbol) => {
      const g = globalThis as GlobalWithBrowser;
      if (g.browser) {
        delete g.browser[prop];
      }
      if (g.chrome) {
        delete g.chrome[prop];
      }
      return true;
    },
  }
);

vi.mock('wxt/browser', () => ({
  browser: browserProxy,
}));
