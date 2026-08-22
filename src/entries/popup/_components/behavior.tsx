// entries/popup/_components/behavior.tsx
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { sendMessage } from '@/lib/messaging';
import type { BehaviorConfig } from '@/types/messages.types';

const DEFAULT_CONFIG: BehaviorConfig = {
	enabled: false,
	min: 2,
	max: 8,
	scroll: true,
	hover: true,
	click: false,
	clickSelectors: [],
};

interface BehaviorProps {
	urlKey: string | undefined;
}

export default function Behavior({ urlKey }: BehaviorProps) {
	const [config, setConfig] = useState<BehaviorConfig>(DEFAULT_CONFIG);
	const [newSelector, setNewSelector] = useState('');

	const refresh = useCallback(async (key: string) => {
		const info = await sendMessage<'GET_BEHAVIOR'>({
			type: 'GET_BEHAVIOR',
			urlKey: key,
		});
		if (info?.config) setConfig(info.config);
		else setConfig(DEFAULT_CONFIG);
	}, []);

	useEffect(() => {
		if (urlKey == null) return;
		void refresh(urlKey);
	}, [urlKey, refresh]);

	const updateConfig = useCallback(
		async (partial: Partial<BehaviorConfig> = {}) => {
			if (urlKey == null) return;
			const next = { ...config, ...partial };
			setConfig(next);
			await sendMessage<'SET_BEHAVIOR'>({
				type: 'SET_BEHAVIOR',
				urlKey,
				config: next,
			});
		},
		[urlKey, config],
	);

	const addSelector = () => {
		const trimmed = newSelector.trim();
		if (!trimmed || config.clickSelectors.includes(trimmed)) return;
		void updateConfig({ clickSelectors: [...config.clickSelectors, trimmed] });
		setNewSelector('');
	};

	const removeSelector = (selector: string) => {
		void updateConfig({
			clickSelectors: config.clickSelectors.filter((s) => s !== selector),
		});
	};

	if (urlKey == null) {
		return (
			<p className="text-xs text-muted-foreground">
				Add or select a target URL above to configure behavior.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Actions</p>
				<div className="flex items-center gap-2">
					<Checkbox
						id="act-scroll"
						checked={config.scroll}
						onCheckedChange={(c) => void updateConfig({ scroll: c === true })}
					/>
					<Label htmlFor="act-scroll" className="text-xs font-normal">
						Scroll
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="act-hover"
						checked={config.hover}
						onCheckedChange={(c) => void updateConfig({ hover: c === true })}
					/>
					<Label htmlFor="act-hover" className="text-xs font-normal">
						Hover
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="act-click"
						checked={config.click}
						onCheckedChange={(c) => void updateConfig({ click: c === true })}
					/>
					<Label htmlFor="act-click" className="text-xs font-normal">
						Click
					</Label>
				</div>
			</div>

			{config.click && (
				<div className="flex flex-col gap-2">
					<p className="text-xs font-medium">Click selectors</p>
					{config.clickSelectors.map((selector) => (
						<div key={selector} className="flex items-center gap-2">
							<Input
								value={selector}
								readOnly
								className="h-8 text-xs font-mono"
							/>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 p-0"
								onClick={() => removeSelector(selector)}
								aria-label={`Remove ${selector}`}
							>
								×
							</Button>
						</div>
					))}
					<div className="flex items-center gap-2">
						<Input
							value={newSelector}
							onChange={(e) => setNewSelector(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') addSelector();
							}}
							placeholder=".cta-button, #submit-btn"
							className="h-8 text-xs font-mono"
						/>
						<Button size="sm" className="h-8" onClick={addSelector}>
							Add
						</Button>
					</div>
				</div>
			)}

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Interval (seconds)</p>
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
			</div>

			<Button
				variant={config.enabled ? 'destructive' : 'default'}
				onClick={() => void updateConfig({ enabled: !config.enabled })}
			>
				{config.enabled ? 'Stop Behavior' : 'Start Behavior'}
			</Button>
		</div>
	);
}
