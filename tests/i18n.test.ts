import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale } from '../src/i18n';

describe('i18n subsystem', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('translates keys and reflects locale changes', () => {
    setLocale('en');
    expect(t('controls.newSession')).toBe('New Meeting');
    expect(t('controls.closePanel')).toBe('Close Panel');
    expect(t('controls.discardSession')).toBe('Discard Session');
    expect(t('tabs.live')).toBe('Live Transcript');
    expect(t('idle.title')).toBe('Ready for Meetings');
    expect(t('status.idle')).toBe('Idle');
    expect(t('metrics.duration')).toBe('Duration');
    expect(t('metrics.speakers')).toBe('Speakers');
    expect(t('metrics.words')).toBe('Words');
    expect(t('metrics.turns')).toBe('Turns');
    expect(t('export.sponsorGithub')).toBe('Sponsor on GitHub');

    setLocale('de');
    expect(t('controls.newSession')).toBe('Neues Meeting');
    expect(t('controls.closePanel')).toBe('Panel schließen');
    expect(t('controls.discardSession')).toBe('Sitzung verwerfen');
    expect(t('idle.title')).toBe('Bereit für Meetings');
    expect(t('status.idle')).toBe('Bereit');
    expect(t('metrics.duration')).toBe('Dauer');
    expect(t('metrics.speakers')).toBe('Sprecher');
    expect(t('metrics.words')).toBe('Wörter');
    expect(t('metrics.turns')).toBe('Wechsel');
    expect(t('export.sponsorGithub')).toBe('Auf GitHub sponsern');

    setLocale('ru');
    expect(t('export.sponsorGithub')).toBe('Поддержать на GitHub');

    setLocale('ja');
    expect(t('export.sponsorGithub')).toBe('GitHubでスポンサーになる');
  });
});
