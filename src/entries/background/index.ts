import { resolveBypassCache } from '@/lib/reload-utils.ts';
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
import type { BehaviorConfig } from '../../types/messages.types';

// --- Reload alarms ---
const alarmName = (tabId: number) => `autoReload:${tabId}`;
const tabIdFromAlarm = (name: string) => Number(name.split(':')[1]);

// --- Behavior alarms ---
const behaviorAlarmName = (tabId: number) => `behavior:${tabId}`;
const tabIdFromBehaviorAlarm = (name: string) => Number(name.split(':')[1]);

function randomDelaySeconds(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

async function scheduleNext(
	tabId: number,
	config: { min: number; max: number },
) {
	const delaySeconds = randomDelaySeconds(config.min, config.max);
	await chrome.alarms.create(alarmName(tabId), {
		delayInMinutes: delaySeconds / 60,
	});
}

async function scheduleNextBehavior(tabId: number, config: BehaviorConfig) {
	const delaySeconds = randomDelaySeconds(config.min, config.max);
	await chrome.alarms.create(behaviorAlarmName(tabId), {
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

async function reloadAndStamp(tabId: number, bypassCache = false) {
	await chrome.tabs.reload(tabId, { bypassCache });
	await setLastReloadedAt(tabId, Date.now());
}

onMessage(async (message) => {
	if (message.type === 'RELOAD_TAB') {
		const tabId = message.tabId ?? (await getActiveTabId());
		if (tabId != null)
			await reloadAndStamp(tabId, message.bypassCache ?? false);
		return { ok: tabId != null };
	}

	if (message.type === 'SET_AUTO_RELOAD') {
		const { tabId, config } = message;
		await setAutoReloadConfig(tabId, config);
		await chrome.alarms.clear(alarmName(tabId));
		if (config.enabled) await scheduleNext(tabId, config);
		return { ok: true };
	}

	if (message.type === 'GET_AUTO_RELOAD') {
		const config = await getAutoReloadConfig(message.tabId);
		const lastReloadedAt = await getLastReloadedAt(message.tabId);
		return { config, lastReloadedAt };
	}

	if (message.type === 'SET_BEHAVIOR') {
		const { tabId, config } = message;
		await setBehaviorConfig(tabId, config);
		await chrome.alarms.clear(behaviorAlarmName(tabId));
		if (config.enabled) await scheduleNextBehavior(tabId, config);
		return { ok: true };
	}

	if (message.type === 'GET_BEHAVIOR') {
		const config = await getBehaviorConfig(message.tabId);
		return { config };
	}

	return undefined;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name.startsWith('autoReload:')) {
		const tabId = tabIdFromAlarm(alarm.name);
		const config = await getAutoReloadConfig(tabId);
		if (!config?.enabled) return;
		try {
			await reloadAndStamp(tabId, resolveBypassCache(config));
		} catch {
			await clearAutoReloadConfig(tabId);
			return;
		}
		await scheduleNext(tabId, config);
		return;
	}

	if (alarm.name.startsWith('behavior:')) {
		const tabId = tabIdFromBehaviorAlarm(alarm.name);
		const config = await getBehaviorConfig(tabId);
		if (!config?.enabled) return;

		const actions = enabledActions(config);
		if (actions.length === 0) return;

		try {
			await sendTabMessage(tabId, { type: 'RUN_BEHAVIOR_ACTION', actions });
		} catch {
			await clearBehaviorConfig(tabId);
			return;
		}
		await scheduleNextBehavior(tabId, config);
	}
});

async function getActiveTabId(): Promise<number | undefined> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}
