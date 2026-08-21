import type { BehaviorConfig } from '../types/messages.types';

const keyFor = (tabId: number) => `behavior:${tabId}`;

export async function getBehaviorConfig(
	tabId: number,
): Promise<BehaviorConfig | undefined> {
	const result = await chrome.storage.local.get(keyFor(tabId));
	return result[keyFor(tabId)] as BehaviorConfig | undefined;
}

export async function setBehaviorConfig(
	tabId: number,
	config: BehaviorConfig,
): Promise<void> {
	await chrome.storage.local.set({ [keyFor(tabId)]: config });
}

export async function clearBehaviorConfig(tabId: number): Promise<void> {
	await chrome.storage.local.remove(keyFor(tabId));
}
