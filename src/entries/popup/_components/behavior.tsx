// entries/popup/_components/behavior.tsx
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { sendMessage } from '@/lib/messaging';

export default function Behavior() {
	const [tabId, setTabId] = useState<number>();
	const [min, setMin] = useState(2);
	const [max, setMax] = useState(8);
	const [enabled, setEnabled] = useState(false);
	const [scroll, setScroll] = useState(true);
	const [hover, setHover] = useState(true);
	const [click, setClick] = useState(false);

	const refresh = async (id: number) => {
		const info = await sendMessage<'GET_BEHAVIOR'>({ type: 'GET_BEHAVIOR', tabId: id });
		if (info.config) {
			setMin(info.config.min);
			setMax(info.config.max);
			setEnabled(info.config.enabled);
			setScroll(info.config.scroll);
			setHover(info.config.hover);
			setClick(info.config.click);
		}
	};

	useEffect(() => {
		void (async () => {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) return;
			setTabId(tab.id);
			await refresh(tab.id);
		})();
	}, []);

	const persist = async (overrides: Partial<{ enabled: boolean; scroll: boolean; hover: boolean; click: boolean }> = {}) => {
		if (tabId == null) return;
		await sendMessage<'SET_BEHAVIOR'>({
			type: 'SET_BEHAVIOR',
			tabId,
			config: { min, max, enabled, scroll, hover, click, ...overrides },
		});
	};

	const handleToggleEnabled = async () => {
		const next = !enabled;
		setEnabled(next);
		await persist({ enabled: next });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Actions</p>
				<div className="flex items-center gap-2">
					<Checkbox id="act-scroll" checked={scroll} onCheckedChange={(c) => { setScroll(c === true); void persist({ scroll: c === true }); }} />
					<Label htmlFor="act-scroll" className="text-xs font-normal">Scroll</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox id="act-hover" checked={hover} onCheckedChange={(c) => { setHover(c === true); void persist({ hover: c === true }); }} />
					<Label htmlFor="act-hover" className="text-xs font-normal">Hover</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox id="act-click" checked={click} onCheckedChange={(c) => { setClick(c === true); void persist({ click: c === true }); }} />
					<Label htmlFor="act-click" className="text-xs font-normal">Click</Label>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<p className="text-xs font-medium">Interval (seconds)</p>
				<div className="flex items-center gap-2">
					<Input type="number" min={1} value={min} onChange={(e) => setMin(Number(e.target.value))} placeholder="Min" />
					<span className="text-xs text-muted-foreground">to</span>
					<Input type="number" min={1} value={max} onChange={(e) => setMax(Number(e.target.value))} placeholder="Max" />
				</div>
			</div>

			<Button variant={enabled ? 'destructive' : 'default'} onClick={handleToggleEnabled}>
				{enabled ? 'Stop Behavior' : 'Start Behavior'}
			</Button>
		</div>
	);
}
