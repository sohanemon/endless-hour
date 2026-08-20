import type { AutoReloadConfig } from '../types/messages.types';

export function resolveBypassCache(
	config: Pick<AutoReloadConfig, 'bypassCache' | 'randomHardReload'>,
): boolean {
	if (config.randomHardReload) return Math.random() < 0.5;
	return config.bypassCache;
}
