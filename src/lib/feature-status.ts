// INFO: Runtime status model shared by the popup feature panels. `enabled`
// in storage means "armed": the loop actually runs only while the next-tick
// alarm exists AND at least one open tab matches the URL key. Closing the
// last tab — or losing the alarm chain across a browser restart, which
// chrome.alarms does not guarantee against — leaves a config armed but
// inactive; this derives the honest state the UI should show.
export type FeatureStatus = 'running' | 'idle' | 'stopped';

export interface FeatureStatusResponse {
	enabled: boolean;
	alarmScheduled: boolean;
	liveTabCount: number;
}

export function deriveFeatureStatus(
	response: FeatureStatusResponse | undefined,
): FeatureStatus {
	if (!response?.enabled) return 'stopped';
	return response.alarmScheduled && response.liveTabCount > 0
		? 'running'
		: 'idle';
}
