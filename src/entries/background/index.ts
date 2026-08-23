import {
	getAllAutoReloadConfigs,
	getAutoReloadConfig,
	getLastReloadedAt,
	setAutoReloadConfig,
	setLastReloadedAt,
} from '../../lib/auto-reload.store.ts';
import {
	getAllBehaviorConfigs,
	getBehaviorConfig,
	setBehaviorConfig,
} from '../../lib/behavior.store.ts';
import {
	detachAllBehaviors,
	detachBehavior,
	performClick,
	performHover,
	performScroll,
} from '../../lib/cdp-input.ts';
import type { FeatureStatusResponse } from '../../lib/feature-status';
import { onMessage, sendTabMessage } from '../../lib/messaging';
import { resolveBypassCache } from '../../lib/reload-utils.ts';
import { URL_LIST_KEY } from '../../lib/storage-keys.ts';
import { tabsForUrlKey } from '../../lib/url-utils';
import type { BehaviorConfig } from '../../types/messages.types';

// --- URL-keyed alarms ---
// One alarm per URL key per feature. On each tick the background resolves
// every open tab whose normalized URL matches and drives them all.

// INFO: The popup can only tell "running" from "stopped" by checking whether
// the feature's next-tick alarm actually exists — storage survives browser
// restarts, the alarm chain does not. Exported via GET_*_STATUS messages.
function getAlarm(name: string): Promise<chrome.alarms.Alarm | undefined> {
	return chrome.alarms.get(name);
}

const behaviorAlarmName = (urlKey: string) => `behavior:${urlKey}`;
const autoReloadAlarmName = (urlKey: string) => `autoReload:${urlKey}`;

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
		if (config.enabled) {
			await scheduleNextBehavior(urlKey, config);
		} else {
			// INFO: Feature disabled: drop the debugger banner immediately.
			const tabIds = await tabsForUrlKey(urlKey);
			await Promise.all(tabIds.map((id) => detachBehavior(id)));
		}
		return { ok: true };
	}

	if (message.type === 'CLEAR_ALL_STORAGE') {
		// INFO: Wipe every feature config and alarm, drop all debugger sessions.
		// The saved URL list survives — it's operator curation, not feature
		// state; re-adding every target after a reset would be pure friction.
		detachAllBehaviors();
		await chrome.alarms.clearAll();
		const all = await chrome.storage.local.get(null);
		await chrome.storage.local.remove(
			Object.keys(all).filter((key) => key !== URL_LIST_KEY),
		);
		return { ok: true };
	}

	if (
		message.type === 'GET_AUTO_RELOAD_STATUS' ||
		message.type === 'GET_BEHAVIOR_STATUS'
	) {
		// INFO: Both features share the same status shape: armed flag, whether
		// the next-tick alarm actually exists, and how many open tabs currently
		// match. The popup derives running/idle/stopped from these three facts.
		const config =
			message.type === 'GET_AUTO_RELOAD_STATUS'
				? await getAutoReloadConfig(message.urlKey)
				: await getBehaviorConfig(message.urlKey);
		const alarm = await getAlarm(
			message.type === 'GET_AUTO_RELOAD_STATUS'
				? autoReloadAlarmName(message.urlKey)
				: behaviorAlarmName(message.urlKey),
		);
		const enabled = Boolean(config?.enabled);
		return {
			enabled,
			alarmScheduled: alarm != null,
			liveTabCount: enabled ? (await tabsForUrlKey(message.urlKey)).length : 0,
		} satisfies FeatureStatusResponse;
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
			// Transient failure (SW cold start, storage hiccup): keep the config
			// and reschedule so the chain self-heals on the next tick.
		}
		await scheduleNext(urlKey, config);
		return;
	}

	if (alarm.name.startsWith('behavior:')) {
		await runBehaviorTick(alarm.name.slice('behavior:'.length));
	}
});

// INFO: One behavior tick for a URL key: ask each matching tab's content
// script to resolve WHAT to interact with (safe element, viewport coords),
// then execute trusted input on it via chrome.debugger (CDP).
async function runBehaviorTick(urlKey: string): Promise<void> {
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
				// INFO: Content script resolves WHAT to interact with (safe
				// element, viewport coordinates); the background then executes
				// trusted input via chrome.debugger.
				const response = await sendTabMessage<'BEHAVIOR_TARGET'>(tabId, {
					type: 'BEHAVIOR_TARGET',
					actions,
					clickSelectors: config.clickSelectors ?? [],
				});
				const target = response?.target;
				if (!response?.ok || !target) continue;

				const cdpTarget = { tabId };
				if (target.kind === 'scroll') {
					await performScroll(cdpTarget, target, target.deltaY);
				} else if (target.kind === 'click') {
					await performClick(cdpTarget, target);
				} else {
					await performHover(cdpTarget, target);
				}
			} catch {
				// Tab mid-reload, content script not ready, or debugger attach
				// failed (DevTools open); skip this tab this tick.
			}
		}
	} catch {
		// Transient failure (SW cold start, storage hiccup): keep the config
		// so the chain self-heals on the next tick.
	}
	await scheduleNextBehavior(urlKey, config);
}
// INFO: One-time cleanup of legacy tabId-keyed storage entries
// (`autoReload:<n>`, `lastReloadedAt:<n>`, `behavior:<n>`). URL keys always
// contain `://`, so a bare integer suffix identifies stale rows. NOTE: no
// detachAllBehaviors() here — the worker wakes on every alarm tick and must
// not tear down live debugger sessions; attach() tolerates re-attach instead.
chrome.runtime.onStartup.addListener(() => {
	void reconcileAlarms();
	void purgeLegacyTabKeys();
});
void reconcileAlarms();
void purgeLegacyTabKeys();

// INFO: chrome.alarms "generally persist" across browser restarts but the
// docs explicitly do not guarantee it; when they are lost, an enabled config
// sits armed with no next tick forever — the exact dead state the popup's
// status query exposes. Reconcile on every worker cold start: re-arm any
// enabled config whose alarm is missing (covers browser restart, extension
// reload, and SW eviction edge cases alike).
async function reconcileAlarms(): Promise<void> {
	try {
		const [reloadConfigs, behaviorConfigs] = await Promise.all([
			getAllAutoReloadConfigs(),
			getAllBehaviorConfigs(),
		]);
		await Promise.all([
			...reloadConfigs
				.filter((entry) => entry.config.enabled)
				.map(async (entry) => {
					if ((await getAlarm(autoReloadAlarmName(entry.urlKey))) != null)
						return;
					await scheduleNext(entry.urlKey, entry.config);
				}),
			...behaviorConfigs
				.filter((entry) => entry.config.enabled)
				.map(async (entry) => {
					if ((await getAlarm(behaviorAlarmName(entry.urlKey))) != null) return;
					await scheduleNextBehavior(entry.urlKey, entry.config);
				}),
		]);
	} catch {
		// Transient storage failure: the popup status readout still reports
		// the gap honestly; reconciliation retries on next worker start.
	}
}

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
