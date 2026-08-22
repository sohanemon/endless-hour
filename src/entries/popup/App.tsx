import { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Reloader from '@/entries/popup/_components/reloader';
import { sendMessage } from '@/lib/messaging';
import Behavior from './_components/behavior';
import { UrlBar, useUrlSelection } from './_components/url-bar';

export default function App() {
	const url = useUrlSelection();
	const clearAll = useCallback(() => {
		void sendMessage<'CLEAR_ALL_STORAGE'>({ type: 'CLEAR_ALL_STORAGE' });
		window.close();
	}, []);

	return (
		<main className="flex dark w-96 flex-col bg-background text-foreground gap-6 p-5">
			<h1 className="text-3xl font-extrabold">Endless Hour</h1>
			<UrlBar
				urlKeys={url.urlKeys}
				selected={url.selected}
				onSelect={url.select}
				onAdd={(key) => void url.addUrl(key)}
				onAddCurrent={() => void url.addCurrentTab()}
				onRemove={(key) => void url.removeUrl(key)}
				onClearAll={clearAll}
			/>
			{/* INFO: Additional feature tabs (e.g. screenshot, css-injector) slot in here. */}
			<Tabs defaultValue="reloader" className="w-full">
				<TabsList>
					<TabsTrigger value="reloader">Reloader</TabsTrigger>
					<TabsTrigger value="behavior">Behavior</TabsTrigger>
				</TabsList>
				<TabsContent value="reloader" className="w-full">
					<Reloader urlKey={url.selected} />
				</TabsContent>
				<TabsContent value="behavior" className="w-full">
					<Behavior urlKey={url.selected} />
				</TabsContent>
			</Tabs>
		</main>
	);
}
