import type { AutoReloadConfig } from '../types/messages.types';

const configKey = (tabId: number) => `autoReload:${tabId}`;
const lastReloadKey = (tabId: number) => `lastReloadedAt:${tabId}`;

export async function getAutoReloadConfig(
	tabId: number,
): Promise<AutoReloadConfig | undefined> {
	const result = await chrome.storage.local.get(configKey(tabId));
	return result[configKey(tabId)] as AutoReloadConfig | undefined;
}

export async function setAutoReloadConfig(
	tabId: number,
	config: AutoReloadConfig,
): Promise<void> {
	await chrome.storage.local.set({ [configKey(tabId)]: config });
}

export async function clearAutoReloadConfig(tabId: number): Promise<void> {
	await chrome.storage.local.remove(configKey(tabId));
}

export async function getLastReloadedAt(
	tabId: number,
): Promise<number | undefined> {
	const result = await chrome.storage.local.get(lastReloadKey(tabId));
	return result[lastReloadKey(tabId)] as number | undefined;
}

export async function setLastReloadedAt(
	tabId: number,
	timestamp: number,
): Promise<void> {
	await chrome.storage.local.set({ [lastReloadKey(tabId)]: timestamp });
}
