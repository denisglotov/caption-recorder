import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale } from '../src/i18n';

describe('i18n subsystem', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('translates keys and reflects locale changes', () => {
    setLocale('en');
    expect(t('controls.start')).toBe('Start Recording');
    expect(t('status.recording')).toBe('Recording');
    expect(t('tabs.live')).toBe('Live Transcript');

    setLocale('de');
    expect(t('controls.start')).toBe('Aufnahme starten');
  });
});
