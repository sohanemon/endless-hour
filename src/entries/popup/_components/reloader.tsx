import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FeatureStatusBadge } from '@/entries/popup/_components/feature-status-badge';
import { useFeatureStatus } from '@/hooks/use-feature-status';
import { sendMessage } from '@/lib/messaging';
import { resolveBypassCache } from '@/lib/reload-utils';
import { tabsForUrlKey } from '@/lib/url-utils';
import { cn } from '@/lib/utils';
import type { AutoReloadConfig } from '@/types/messages.types';

const DEFAULT_CONFIG: AutoReloadConfig = {
	min: 30,
	max: 150,
	enabled: false,
	bypassCache: false,
	randomHardReload: false,
};

function formatAgo(timestamp: number, now: number): string {
	const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m ago`;
}

interface ReloaderProps {
	urlKey: string | undefined;
}

export default function Reloader({ urlKey }: ReloaderProps) {
	const [config, setConfig] = useState<AutoReloadConfig>(DEFAULT_CONFIG);
	const [lastReloadedAt, setLastReloadedAt] = useState<number>();
	const [now, setNow] = useState(Date.now());
	const status = useFeatureStatus('GET_AUTO_RELOAD_STATUS', urlKey);

	const refresh = useCallback(async (key: string) => {
		const info = await sendMessage<'GET_AUTO_RELOAD'>({
			type: 'GET_AUTO_RELOAD',
			urlKey: key,
		});
		if (info?.config) setConfig(info.config);
		else setConfig(DEFAULT_CONFIG);
		setLastReloadedAt(info?.lastReloadedAt);
	}, []);

	useEffect(() => {
		if (urlKey == null) return;
		void refresh(urlKey);
	}, [urlKey, refresh]);

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, []);

	const reload = useCallback(async () => {
		if (urlKey == null) return;
		const effectiveBypassCache = resolveBypassCache(config);
		const tabIds = await tabsForUrlKey(urlKey);
		for (const tabId of tabIds) {
			await sendMessage<'RELOAD_TAB'>({
				type: 'RELOAD_TAB',
				tabId,
				bypassCache: effectiveBypassCache,
			});
		}
		await refresh(urlKey);
	}, [config, urlKey, refresh]);

	const updateConfig = useCallback(
		async (partial: Partial<AutoReloadConfig> = {}) => {
			if (urlKey == null) return;
			const next = { ...config, ...partial };
			setConfig(next);
			await sendMessage<'SET_AUTO_RELOAD'>({
				type: 'SET_AUTO_RELOAD',
				urlKey,
				config: next,
			});
		},
		[urlKey, config],
	);

	if (urlKey == null) {
		return (
			<p className="text-xs text-muted-foreground">
				Add or select a target URL above to configure auto-reload.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-1">
				<FeatureStatusBadge
					status={status}
					copy={{
						running: 'Auto-reload is running',
						idle: 'Armed — no matching tab open',
						stopped: 'Stopped',
					}}
				/>
				<p className="text-xs text-muted-foreground">
					{lastReloadedAt
						? `Last reloaded ${formatAgo(lastReloadedAt, now)}`
						: 'Not reloaded yet'}
				</p>
			</div>

			<div className="flex flex-col gap-2">
				<Button onClick={() => void reload()}>Reload</Button>
				<div className="flex items-center gap-2">
					<Checkbox
						id="bypass-cache"
						checked={config.randomHardReload || config.bypassCache}
						disabled={config.randomHardReload}
						onCheckedChange={(checked) =>
							void updateConfig({ bypassCache: checked === true })
						}
					/>
					<Label
						htmlFor="bypass-cache"
						className={cn(
							'text-xs font-normal',
							config.randomHardReload && 'text-muted-foreground',
						)}
					>
						Hard reload (bypass cache)
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="random-hard-reload"
						checked={config.randomHardReload}
						onCheckedChange={(checked) =>
							void updateConfig({ randomHardReload: checked === true })
						}
					/>
					<Label htmlFor="random-hard-reload" className="text-xs font-normal">
						Randomize cache behavior
					</Label>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Random auto-reload (seconds)</p>
				<div className="flex items-center gap-2">
					<Input
						type="number"
						min={1}
						value={config.min}
						onChange={(e) => void updateConfig({ min: Number(e.target.value) })}
						placeholder="Min"
					/>
					<span className="text-xs text-muted-foreground">to</span>
					<Input
						type="number"
						min={1}
						value={config.max}
						onChange={(e) => void updateConfig({ max: Number(e.target.value) })}
						placeholder="Max"
					/>
				</div>
				<Button
					variant={config.enabled ? 'destructive' : 'default'}
					onClick={() => void updateConfig({ enabled: !config.enabled })}
				>
					{config.enabled ? 'Stop Auto-Reload' : 'Start Auto-Reload'}
				</Button>
			</div>
		</div>
	);
}
