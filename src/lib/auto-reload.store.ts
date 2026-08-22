import type { AutoReloadConfig } from '../types/messages.types';

const configKey = (urlKey: string) => `autoReload:${urlKey}`;
const lastReloadKey = (urlKey: string) => `lastReloadedAt:${urlKey}`;

export async function getAutoReloadConfig(
	urlKey: string,
): Promise<AutoReloadConfig | undefined> {
	const result = await chrome.storage.local.get(configKey(urlKey));
	return result[configKey(urlKey)] as AutoReloadConfig | undefined;
}

export async function setAutoReloadConfig(
	urlKey: string,
	config: AutoReloadConfig,
): Promise<void> {
	await chrome.storage.local.set({ [configKey(urlKey)]: config });
}

export async function getLastReloadedAt(
	urlKey: string,
): Promise<number | undefined> {
	const result = await chrome.storage.local.get(lastReloadKey(urlKey));
	return result[lastReloadKey(urlKey)] as number | undefined;
}

export async function setLastReloadedAt(
	urlKey: string,
	timestamp: number,
): Promise<void> {
	await chrome.storage.local.set({ [lastReloadKey(urlKey)]: timestamp });
}

// INFO: Returns every stored autoReload config, keyed by urlKey. Used by the
// background alarm tick to drive all matching tabs for all enabled URLs.
export async function getAllAutoReloadConfigs(): Promise<
	Array<{ urlKey: string; config: AutoReloadConfig }>
> {
	const all = await chrome.storage.local.get(null);
	return Object.entries(all)
		.filter(([key]) => key.startsWith('autoReload:'))
		.map(([key, value]) => ({
			urlKey: key.slice('autoReload:'.length),
			config: value as AutoReloadConfig,
		}));
}
