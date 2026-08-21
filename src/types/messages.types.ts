export interface AutoReloadConfig {
	min: number;
	max: number;
	enabled: boolean;
	bypassCache: boolean;
	randomHardReload: boolean;
}

export interface BehaviorConfig {
	enabled: boolean;
	min: number; // seconds between actions
	max: number;
	scroll: boolean;
	hover: boolean;
	click: boolean;
}

export interface MessageMap {
	COUNT: { type: 'COUNT'; count: number };
	GET_TABS: { type: 'GET_TABS' };
	RELOAD_TAB: { type: 'RELOAD_TAB'; tabId?: number; bypassCache?: boolean };
	SET_AUTO_RELOAD: {
		type: 'SET_AUTO_RELOAD';
		tabId: number;
		config: AutoReloadConfig;
	};
	GET_AUTO_RELOAD: { type: 'GET_AUTO_RELOAD'; tabId: number };
	SET_BEHAVIOR: { type: 'SET_BEHAVIOR'; tabId: number; config: BehaviorConfig };
	GET_BEHAVIOR: { type: 'GET_BEHAVIOR'; tabId: number };
	RUN_BEHAVIOR_ACTION: {
		type: 'RUN_BEHAVIOR_ACTION';
		actions: Array<'scroll' | 'hover' | 'click'>;
	};
}
export type MessageType = keyof MessageMap;
export type Message<T extends MessageType> = MessageMap[T];
export type ResponseOf<T extends MessageType> = T extends keyof ResponseMap
	? ResponseMap[T]
	: undefined;
export interface ResponseMap {
	COUNT: undefined;
	GET_TABS: { tabs: chrome.tabs.Tab[] };
	RELOAD_TAB: { ok: boolean };
	SET_AUTO_RELOAD: { ok: boolean };
	GET_AUTO_RELOAD: {
		config: AutoReloadConfig | undefined;
		lastReloadedAt: number | undefined;
	};
	SET_BEHAVIOR: { ok: boolean };
	GET_BEHAVIOR: { config: BehaviorConfig | undefined };
	RUN_BEHAVIOR_ACTION: { ok: boolean };
}
