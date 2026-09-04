import type { InterimCaption, KnownPlatform } from '../core/types';

export interface PlatformAdapter {
  readonly name: string;
  readonly platformId: KnownPlatform;
  matchesUrl(url: string): boolean;
  isCaptionsEnabled(): boolean;
  observe(
    onCaption: (caption: InterimCaption) => void,
    onCaptionsStateChange?: (enabled: boolean) => void,
    onActiveCaption?: (caption: InterimCaption | null) => void
  ): void;
  stop(): void;
  flush?(): void;
  isSameMeeting?(url1: string, url2: string): boolean;
}
