import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getDictionary, type SupportedLocale } from '../src/i18n';

describe('i18n subsystem', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('translates English keys correctly', () => {
    setLocale('en');
    expect(t('controls.start')).toBe('Start Recording');
    expect(t('status.recording')).toBe('Recording');
    expect(t('tabs.summary')).toBe('AI Summary');
  });

  it('translates German keys correctly', () => {
    setLocale('de');
    expect(t('controls.start')).toBe('Aufnahme starten');
    expect(t('status.recording')).toBe('Aufnahme läuft');
  });

  it('translates French keys correctly', () => {
    setLocale('fr');
    expect(t('controls.start')).toBe("Démarrer l'enregistrement");
    expect(t('status.recording')).toBe('Enregistrement');
  });

  it('translates Russian keys correctly', () => {
    setLocale('ru');
    expect(t('controls.start')).toBe('Начать запись');
    expect(t('status.recording')).toBe('Запись');
  });

  it('translates Japanese keys correctly', () => {
    setLocale('ja');
    expect(t('controls.start')).toBe('録音を開始');
    expect(t('status.recording')).toBe('録音中');
  });

  it('translates Korean keys correctly', () => {
    setLocale('ko');
    expect(t('controls.start')).toBe('기록 시작');
    expect(t('status.recording')).toBe('기록 중');
  });

  it('translates Chinese keys correctly', () => {
    setLocale('zh');
    expect(t('controls.start')).toBe('开始录制');
    expect(t('status.recording')).toBe('正在录制');
  });

  it('all supported locales have non-empty dictionary entries', () => {
    const locales: SupportedLocale[] = ['en', 'de', 'fr', 'ru', 'ja', 'ko', 'zh'];
    for (const loc of locales) {
      const dict = getDictionary(loc);
      expect(dict.controls.start).toBeTruthy();
      expect(dict.status.recording).toBeTruthy();
      expect(dict.summary.generate).toBeTruthy();
      expect(dict.export.downloadTxt).toBeTruthy();
      expect(dict.recovery.title).toBeTruthy();
    }
  });
});
