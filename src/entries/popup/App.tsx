// popup/App.tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendMessage } from '@/lib/messaging';

function formatAgo(timestamp: number, now: number): string {
	const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m ago`;
}

export default function App() {
	const [tabId, setTabId] = useState<number>();
	const [min, setMin] = useState(30);
	const [max, setMax] = useState(60);
	const [enabled, setEnabled] = useState(false);
	const [lastReloadedAt, setLastReloadedAt] = useState<number>();
	const [now, setNow] = useState(Date.now());

	const refresh = async (id: number) => {
		const info = await sendMessage({ type: 'GET_AUTO_RELOAD', tabId: id });
		if (info?.config) {
			setMin(info.config.min);
			setMax(info.config.max);
			setEnabled(info.config.enabled);
		}
		setLastReloadedAt(info.lastReloadedAt);
	};

	useEffect(() => {
		void (async () => {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});
			if (!tab?.id) return;
			setTabId(tab.id);
			await refresh(tab.id);
		})();
	}, []);

	// tick the "x ago" label every second
	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	const handleReload = async () => {
		await sendMessage({ type: 'RELOAD_TAB' });
		if (tabId != null) await refresh(tabId);
	};

	const handleToggleAutoReload = async () => {
		if (tabId == null) return;
		const nextEnabled = !enabled;
		setEnabled(nextEnabled);
		await sendMessage({
			type: 'SET_AUTO_RELOAD',
			tabId,
			config: { min, max, enabled: nextEnabled },
		});
	};

	return (
		<main className="flex flex-col gap-6 p-5">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-extrabold">Endless Hour</h1>
				<p className="text-xs text-muted-foreground">
					{lastReloadedAt
						? `Last reloaded ${formatAgo(lastReloadedAt, now)}`
						: 'Not reloaded yet'}
				</p>
			</div>

			<Button onClick={handleReload}>Reload</Button>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Random auto-reload (seconds)</p>
				<div className="flex items-center gap-2">
					<Input
						type="number"
						min={1}
						value={min}
						onChange={(e) => setMin(Number(e.target.value))}
						placeholder="Min"
					/>
					<span className="text-xs text-muted-foreground">to</span>
					<Input
						type="number"
						min={1}
						value={max}
						onChange={(e) => setMax(Number(e.target.value))}
						placeholder="Max"
					/>
				</div>
				<Button
					variant={enabled ? 'destructive' : 'default'}
					onClick={handleToggleAutoReload}
				>
					{enabled ? 'Stop Auto-Reload' : 'Start Auto-Reload'}
				</Button>
			</div>
		</main>
	);
}
