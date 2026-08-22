import { resolveBypassCache } from '../../lib/reload-utils.ts';
import {
	clearAutoReloadConfig,
	getAutoReloadConfig,
	getLastReloadedAt,
	setAutoReloadConfig,
	setLastReloadedAt,
} from '../../lib/auto-reload.store.ts';
import {
	clearBehaviorConfig,
	getBehaviorConfig,
	setBehaviorConfig,
} from '../../lib/behavior.store.ts';
import { onMessage, sendTabMessage } from '../../lib/messaging';
import { tabsForUrlKey } from '../../lib/url-utils';
import type { BehaviorConfig } from '../../types/messages.types';

// --- URL-keyed alarms ---
// One alarm per URL key per feature. On each tick the background resolves
// every open tab whose normalized URL matches and drives them all.
const autoReloadAlarmName = (urlKey: string) => `autoReload:${urlKey}`;
const behaviorAlarmName = (urlKey: string) => `behavior:${urlKey}`;

function randomDelaySeconds(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

async function scheduleNext(
	urlKey: string,
	config: { min: number; max: number },
): Promise<void> {
	const delaySeconds = randomDelaySeconds(config.min, config.max);
	await chrome.alarms.create(autoReloadAlarmName(urlKey), {
		delayInMinutes: delaySeconds / 60,
	});
}

async function scheduleNextBehavior(
	urlKey: string,
	config: BehaviorConfig,
): Promise<void> {
	const delaySeconds = randomDelaySeconds(config.min, config.max);
	await chrome.alarms.create(behaviorAlarmName(urlKey), {
		delayInMinutes: delaySeconds / 60,
	});
}

function enabledActions(
	config: BehaviorConfig,
): Array<'scroll' | 'hover' | 'click'> {
	const actions: Array<'scroll' | 'hover' | 'click'> = [];
	if (config.scroll) actions.push('scroll');
	if (config.hover) actions.push('hover');
	if (config.click) actions.push('click');
	return actions;
}

async function reloadAndStamp(
	urlKey: string,
	tabId: number,
	bypassCache: boolean,
): Promise<void> {
	await chrome.tabs.reload(tabId, { bypassCache });
	await setLastReloadedAt(urlKey, Date.now());
}

onMessage(async (message) => {
	if (message.type === 'RELOAD_TAB') {
		if (message.tabId != null) {
			await chrome.tabs.reload(message.tabId, {
				bypassCache: message.bypassCache ?? false,
			});
			return { ok: true };
		}
		return { ok: false };
	}

	if (message.type === 'SET_AUTO_RELOAD') {
		const { urlKey, config } = message;
		await setAutoReloadConfig(urlKey, config);
		await chrome.alarms.clear(autoReloadAlarmName(urlKey));
		if (config.enabled) await scheduleNext(urlKey, config);
		return { ok: true };
	}

	if (message.type === 'GET_AUTO_RELOAD') {
		const config = await getAutoReloadConfig(message.urlKey);
		const lastReloadedAt = await getLastReloadedAt(message.urlKey);
		return { config, lastReloadedAt };
	}

	if (message.type === 'SET_BEHAVIOR') {
		const { urlKey, config } = message;
		await setBehaviorConfig(urlKey, config);
		await chrome.alarms.clear(behaviorAlarmName(urlKey));
		if (config.enabled) await scheduleNextBehavior(urlKey, config);
		return { ok: true };
	}

	if (message.type === 'GET_BEHAVIOR') {
		const config = await getBehaviorConfig(message.urlKey);
		return { config };
	}

	return undefined;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name.startsWith('autoReload:')) {
		const urlKey = alarm.name.slice('autoReload:'.length);
		const config = await getAutoReloadConfig(urlKey);
		if (!config?.enabled) return;
		try {
			const tabIds = await tabsForUrlKey(urlKey);
			for (const tabId of tabIds) {
				try {
					await reloadAndStamp(urlKey, tabId, resolveBypassCache(config));
				} catch {
					// Tab closed mid-cycle; keep driving remaining tabs.
				}
			}
		} catch {
			await clearAutoReloadConfig(urlKey);
			return;
		}
		await scheduleNext(urlKey, config);
		return;
	}

	if (alarm.name.startsWith('behavior:')) {
		const urlKey = alarm.name.slice('behavior:'.length);
		const config = await getBehaviorConfig(urlKey);
		if (!config?.enabled) return;

		const actions = enabledActions(config);
		if (actions.length === 0) {
			await scheduleNextBehavior(urlKey, config);
			return;
		}

		try {
			const tabIds = await tabsForUrlKey(urlKey);
			for (const tabId of tabIds) {
				try {
					await sendTabMessage(tabId, {
						type: 'RUN_BEHAVIOR_ACTION',
						actions,
						clickSelectors: config.clickSelectors ?? [],
					});
				} catch {
					// Tab mid-reload or content script not ready; skip this tick.
				}
			}
		} catch {
			await clearBehaviorConfig(urlKey);
			return;
		}
		await scheduleNextBehavior(urlKey, config);
	}
});

// INFO: One-time cleanup of legacy tabId-keyed entries (`autoReload:<n>`,
// `lastReloadedAt:<n>`, `behavior:<n>`). URL keys always contain `://`, so a
// bare integer suffix identifies stale rows. Runs once per service-worker
// start; cheap no-op after the first run.
chrome.runtime.onStartup.addListener(() => {
	void purgeLegacyTabKeys();
});
void purgeLegacyTabKeys();

async function purgeLegacyTabKeys(): Promise<void> {
	const all = await chrome.storage.local.get(null);
	const legacyKeys = Object.keys(all).filter((key) => {
		const separator = key.indexOf(':');
		if (separator === -1) return false;
		const suffix = key.slice(separator + 1);
		return /^\d+$/.test(suffix);
	});
	if (legacyKeys.length > 0) await chrome.storage.local.remove(legacyKeys);
}
