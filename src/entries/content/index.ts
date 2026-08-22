import type { MessageMap } from '@/types/messages.types';
import { runBehaviorAction } from './behavior';

console.info('content script running');

// NOTE: Raw runtime.onMessage listener (not the shared `onMessage` helper) so
// that non-matching messages return falsy WITHOUT calling sendResponse. The
// shared helper always responds (even `undefined`), which would race the
// background's async GET_BEHAVIOR / SET_BEHAVIOR responses on the shared
// chrome.runtime.sendMessage channel. Only RUN_BEHAVIOR_ACTION (a
// chrome.tabs.sendMessage targeted at this tab's content script) is answered.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (
		message &&
		typeof message === 'object' &&
		message.type === 'RUN_BEHAVIOR_ACTION'
	) {
		try {
			const { actions, clickSelectors } =
				message as MessageMap['RUN_BEHAVIOR_ACTION'];
			runBehaviorAction(actions, clickSelectors);
			sendResponse({ ok: true });
		} catch {
			sendResponse({ ok: false });
		}
		return true;
	}
	return undefined;
});
