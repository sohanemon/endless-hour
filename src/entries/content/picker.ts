import type { MessageMap } from '@/types/messages.types';
import { resolveBehaviorTarget } from './behavior';

// NOTE: Raw runtime.onMessage listener (not the shared `onMessage` helper) so
// that non-matching messages return falsy WITHOUT calling sendResponse. The
// shared helper always responds (even `undefined`), which would race the
// background's async GET_BEHAVIOR / SET_BEHAVIOR responses on the shared
// chrome.runtime.sendMessage channel. Only BEHAVIOR_TARGET (a
// chrome.tabs.sendMessage targeted at this tab's content script) is answered.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (
		message &&
		typeof message === 'object' &&
		message.type === 'BEHAVIOR_TARGET'
	) {
		try {
			const { actions, clickSelectors } =
				message as MessageMap['BEHAVIOR_TARGET'];
			const target = resolveBehaviorTarget(actions, clickSelectors);
			sendResponse({ ok: true, target });
		} catch {
			sendResponse({ ok: false });
		}
		return true;
	}
	return undefined;
});
