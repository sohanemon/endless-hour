// INFO: Popup-side status polling. Both feature panels need the same three
// facts (armed, alarm live, matching tabs open) refreshed while visible; the
// background derives them per request because only it can see chrome.alarms
// and query tabs. Polls every second alongside the "X ago" timestamps.
import { useCallback, useEffect, useState } from 'react';
import { deriveFeatureStatus, type FeatureStatus } from '@/lib/feature-status';
import { sendMessage } from '@/lib/messaging';
import type { MessageType } from '@/types/messages.types';

type StatusMessageType = Extract<
	MessageType,
	'GET_AUTO_RELOAD_STATUS' | 'GET_BEHAVIOR_STATUS'
>;

export function useFeatureStatus(
	messageType: StatusMessageType,
	urlKey: string | undefined,
): FeatureStatus | undefined {
	const [status, setStatus] = useState<FeatureStatus>();
	const refresh = useCallback(async () => {
		if (urlKey == null) return;
		const response = await sendMessage<StatusMessageType>({
			type: messageType,
			urlKey,
		});
		setStatus(deriveFeatureStatus(response));
	}, [messageType, urlKey]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (urlKey == null) return;
		const interval = setInterval(() => void refresh(), 1000);
		return () => clearInterval(interval);
	}, [urlKey, refresh]);

	return status;
}
