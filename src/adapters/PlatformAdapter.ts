import type { InterimCaption } from '../core/types';

export interface PlatformAdapter {
  readonly name: string;
  readonly platformId: 'google-meet' | 'zoom' | 'teams';
  matchesUrl(url: string): boolean;
  isCaptionsEnabled(): boolean;
  observe(
    onCaption: (caption: InterimCaption) => void,
    onCaptionsStateChange?: (enabled: boolean) => void,
    onActiveCaption?: (caption: InterimCaption | null) => void
  ): void;
  stop(): void;
  flush?(): void;
}
