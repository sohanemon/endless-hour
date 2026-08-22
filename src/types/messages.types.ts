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
	clickSelectors: string[];
}

// INFO: Viewport-space targets for trusted CDP input, discriminated by `kind`
// so each variant carries exactly the fields its execution needs (a scroll
// must have deltaY; click/hover must not).
interface BehaviorPoint {
	x: number;
	y: number;
}

export interface ScrollTarget extends BehaviorPoint {
	kind: 'scroll';
	deltaY: number;
}

export interface HoverTarget extends BehaviorPoint {
	kind: 'hover';
}

export interface ClickTarget extends BehaviorPoint {
	kind: 'click';
}

export type BehaviorTarget = ScrollTarget | HoverTarget | ClickTarget;
export type BehaviorAction = BehaviorTarget['kind'];

export interface MessageMap {
	COUNT: { type: 'COUNT'; count: number };
	GET_TABS: { type: 'GET_TABS' };
	RELOAD_TAB: { type: 'RELOAD_TAB'; tabId?: number; bypassCache?: boolean };
	SET_AUTO_RELOAD: {
		type: 'SET_AUTO_RELOAD';
		urlKey: string;
		config: AutoReloadConfig;
	};
	GET_AUTO_RELOAD: { type: 'GET_AUTO_RELOAD'; urlKey: string };
	SET_BEHAVIOR: {
		type: 'SET_BEHAVIOR';
		urlKey: string;
		config: BehaviorConfig;
	};
	GET_BEHAVIOR: { type: 'GET_BEHAVIOR'; urlKey: string };
	CLEAR_ALL_STORAGE: { type: 'CLEAR_ALL_STORAGE' };
	BEHAVIOR_TARGET: {
		type: 'BEHAVIOR_TARGET';
		actions: BehaviorAction[];
		clickSelectors: string[];
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
	BEHAVIOR_TARGET: { ok: boolean; target?: BehaviorTarget };
	CLEAR_ALL_STORAGE: { ok: boolean };
}
