import { resolveBypassCache } from '@/lib/reload-utils.ts';
import {
	clearAutoReloadConfig,
	getAutoReloadConfig,
	getLastReloadedAt,
	setAutoReloadConfig,
	setLastReloadedAt,
} from '../../lib/auto-reload.store.ts';
import { onMessage } from '../../lib/messaging';

const alarmName = (tabId: number) => `autoReload:${tabId}`;
const tabIdFromAlarm = (name: string) => Number(name.split(':')[1]);

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
	return undefined;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (!alarm.name.startsWith('autoReload:')) return;
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
});

async function getActiveTabId(): Promise<number | undefined> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}
