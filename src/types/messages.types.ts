export interface AutoReloadConfig {
	min: number;
	max: number;
	enabled: boolean;
	bypassCache: boolean;
	randomHardReload: boolean;
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
}
