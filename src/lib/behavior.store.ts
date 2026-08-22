import type { BehaviorConfig } from '../types/messages.types';

const keyFor = (urlKey: string) => `behavior:${urlKey}`;

export async function getBehaviorConfig(
	urlKey: string,
): Promise<BehaviorConfig | undefined> {
	const result = await chrome.storage.local.get(keyFor(urlKey));
	return result[keyFor(urlKey)] as BehaviorConfig | undefined;
}

export async function setBehaviorConfig(
	urlKey: string,
	config: BehaviorConfig,
): Promise<void> {
	await chrome.storage.local.set({ [keyFor(urlKey)]: config });
}

export async function clearBehaviorConfig(urlKey: string): Promise<void> {
	await chrome.storage.local.remove(keyFor(urlKey));
}

// INFO: Returns every stored behavior config, keyed by urlKey. Used by the
// background alarm tick to drive all matching tabs for all enabled URLs.
export async function getAllBehaviorConfigs(): Promise<
	Array<{ urlKey: string; config: BehaviorConfig }>
> {
	const all = await chrome.storage.local.get(null);
	return Object.entries(all)
		.filter(([key]) => key.startsWith('behavior:'))
		.map(([key, value]) => ({
			urlKey: key.slice('behavior:'.length),
			config: value as BehaviorConfig,
		}));
}
