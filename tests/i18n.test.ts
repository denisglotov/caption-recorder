import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale } from '../src/i18n';

describe('i18n subsystem', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('translates keys and reflects locale changes', () => {
    setLocale('en');
    expect(t('controls.newSession')).toBe('New Meeting');
    expect(t('tabs.live')).toBe('Live Transcript');
    expect(t('popup.idleTitle')).toBe('Ready for Meetings');

    setLocale('de');
    expect(t('controls.newSession')).toBe('Neues Meeting');
    expect(t('popup.idleTitle')).toBe('Bereit für Meetings');
  });
});
