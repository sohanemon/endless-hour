// INFO: App-level shared URL selection. Both feature tabs bind to this single
// urlKey so a URL configured once is targetable by reloader and behavior.
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { currentTabUrl, normalizeUrlKey } from '@/lib/url-utils';
import { cn } from '@/lib/utils';

const URL_LIST_KEY = 'urlList';

async function loadUrlList(): Promise<string[]> {
	const result = await chrome.storage.local.get(URL_LIST_KEY);
	return (result[URL_LIST_KEY] as string[] | undefined) ?? [];
}

async function saveUrlList(keys: string[]): Promise<void> {
	await chrome.storage.local.set({ [URL_LIST_KEY]: keys });
}

export function useUrlSelection(currentDomain?: string): {
	urlKeys: string[];
	selected: string | undefined;
	select: (key: string) => void;
	addUrl: (key: string) => Promise<void>;
	addCurrentTab: () => Promise<void>;
	removeUrl: (key: string) => Promise<void>;
} {
	const [urlKeys, setUrlKeys] = useState<string[]>([]);
	const [selected, setSelected] = useState<string>();

	// INFO: Load the full list, then show only keys under the current tab's
	// domain. Storage keeps every key so other domains stay configured.
	useEffect(() => {
		void (async () => {
			const [keys, active] = await Promise.all([
				loadUrlList(),
				currentTabUrl(),
			]);
			setUrlKeys(keys);

			let domain = currentDomain;
			if (!domain && active) {
				try {
					domain = new URL(active).hostname.replace(/^www\./, '');
				} catch {
					domain = undefined;
				}
			}

			const visible =
				domain === undefined
					? keys
					: keys.filter((key) => {
							try {
								return new URL(key).hostname.replace(/^www\./, '') === domain;
							} catch {
								return true;
							}
						});

			if (visible.length > 0) setSelected((prev) => prev ?? visible[0]);
		})();
	}, [currentDomain]);

	const select = useCallback((key: string) => setSelected(key), []);

	const addUrl = useCallback(async (key: string) => {
		setUrlKeys((prev) => {
			if (prev.includes(key)) return prev;
			void saveUrlList([...prev, key].sort());
			return [...prev, key];
		});
		setSelected(key);
	}, []);

	const addCurrentTab = useCallback(async () => {
		const url = await currentTabUrl();
		if (!url) return;
		await addUrl(normalizeUrlKey(url));
	}, [addUrl]);

	const removeUrl = useCallback(
		async (key: string) => {
			const next = urlKeys.filter((k) => k !== key);
			setUrlKeys(next);
			await saveUrlList(next);
			if (selected === key) {
				setSelected(next[0]);
			}
		},
		[urlKeys, selected],
	);

	return { urlKeys, selected, select, addUrl, addCurrentTab, removeUrl };
}

interface UrlBarProps {
	urlKeys: string[];
	selected: string | undefined;
	onSelect: (key: string) => void;
	onAdd: (key: string) => void;
	onAddCurrent: () => void;
	onRemove: (key: string) => void;
	onClearAll: () => void;
}

export function UrlBar({
	urlKeys,
	selected,
	onSelect,
	onAdd,
	onAddCurrent,
	onRemove,
	onClearAll,
}: UrlBarProps) {
	const [newUrl, setNewUrl] = useState('');

	const addManual = () => {
		if (!newUrl.trim()) return;
		onAdd(normalizeUrlKey(newUrl));
		setNewUrl('');
	};

	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs font-medium">Target URLs</p>
			{urlKeys.length > 0 && (
				<div className="flex flex-col gap-1">
					{urlKeys.map((key) => (
						<div key={key} className="flex items-center gap-1">
							<button
								type="button"
								title={key}
								onClick={() => onSelect(key)}
								className={cn(
									'min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-xs font-mono transition-colors',
									key === selected
										? 'bg-primary text-primary-foreground'
										: 'bg-muted/50 hover:bg-muted',
								)}
							>
								{key}
							</button>
							<Button
								variant="ghost"
								size="icon-xs"
								onClick={() => onRemove(key)}
								aria-label={`Remove ${key}`}
							>
								×
							</Button>
						</div>
					))}
				</div>
			)}
			<div className="flex items-center gap-2">
				<Input
					value={newUrl}
					onChange={(e) => setNewUrl(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') addManual();
					}}
					placeholder="example.com/page"
					className="h-8 text-xs font-mono"
				/>
				<Button size="sm" className="h-8" onClick={addManual}>
					Add
				</Button>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="h-8"
				onClick={onAddCurrent}
			>
				Use current tab URL
			</Button>
			<Button
				variant="destructive"
				size="sm"
				className="h-8"
				onClick={onClearAll}
			>
				Clear all storage
			</Button>
		</div>
	);
}
