// INFO: App-level shared URL selection. Both feature tabs bind to this single
// urlKey so a URL configured once is targetable by reloader and behavior.
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { URL_LIST_KEY } from '@/lib/storage-keys';
import {
	currentTabUrl,
	domainOf,
	hostMatchesDomain,
	normalizeUrlKey,
} from '@/lib/url-utils';
import { cn } from '@/lib/utils';

async function loadUrlList(): Promise<string[]> {
	const result = await chrome.storage.local.get(URL_LIST_KEY);
	return (result[URL_LIST_KEY] as string[] | undefined) ?? [];
}

async function saveUrlList(keys: string[]): Promise<void> {
	await chrome.storage.local.set({ [URL_LIST_KEY]: keys });
}

export function useUrlSelection(): {
	urlKeys: string[];
	selected: string | undefined;
	select: (key: string) => void;
	addUrl: (key: string) => Promise<void>;
	addCurrentTab: () => Promise<void>;
	removeUrl: (key: string) => Promise<void>;
} {
	const [urlKeys, setUrlKeys] = useState<string[]>([]);
	const [selected, setSelected] = useState<string>();

	// INFO: Load the full list, then show ONLY keys under the active tab's
	// registrable domain (gist.github.com counts as github.com). Storage keeps
	// every key so other domains stay configured; switching tabs re-filters on
	// next popup open.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const [keys, active] = await Promise.all([
				loadUrlList(),
				currentTabUrl(),
			]);
			if (cancelled) return;

			const domain = domainOf(active ?? '');
			const visible =
				domain === undefined
					? keys
					: keys.filter((key) => {
							try {
								return hostMatchesDomain(new URL(key).hostname, domain);
							} catch {
								return true;
							}
						});

			setUrlKeys(visible);
			setSelected((prev) =>
				prev !== undefined && visible.includes(prev) ? prev : visible[0],
			);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const select = useCallback((key: string) => setSelected(key), []);

	const addUrl = useCallback(async (key: string) => {
		// INFO: urlKeys is the domain-filtered VIEW; storage holds every domain's
		// keys. Mutations must read-modify-write the FULL list or an add/remove
		// from one domain's popup would erase every other domain's saved URLs.
		const full = await loadUrlList();
		if (!full.includes(key)) {
			await saveUrlList([...full, key].sort());
		}
		setUrlKeys((prev) => (prev.includes(key) ? prev : [...prev, key].sort()));
		setSelected(key);
	}, []);

	const removeUrl = useCallback(
		async (key: string) => {
			// INFO: Same full-list read-modify-write as addUrl: storage holds every
			// domain's keys; the view only shows the current domain's.
			const remaining = (await loadUrlList()).filter((k) => k !== key);
			await saveUrlList(remaining);
			setUrlKeys((prev) => prev.filter((k) => k !== key));
			if (selected === key) {
				// INFO: Prefer a same-domain sibling as the next selection.
				const removedDomain = domainOf(key);
				const visibleNext = remaining.find(
					(k) =>
						k !== key &&
						(removedDomain === undefined ||
							hostMatchesDomain(new URL(k).hostname, removedDomain ?? '')),
				);
				setSelected(visibleNext);
			}
		},
		[selected],
	);

	const addCurrentTab = useCallback(async () => {
		const url = await currentTabUrl();
		if (!url) return;
		await addUrl(normalizeUrlKey(url));
	}, [addUrl]);

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
