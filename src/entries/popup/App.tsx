import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Reloader from '@/entries/popup/_components/reloader';

export default function App() {
	return (
		<main className="flex dark flex-col bg-background text-foreground gap-6 p-5">
			<h1 className="text-3xl font-extrabold">Endless Hour</h1>
			{/* INFO: Additional feature tabs (e.g. screenshot, css-injector) slot in here. */}
			<Tabs defaultValue="reloader" className="w-full">
				<TabsList>
					<TabsTrigger value="reloader">Reloader</TabsTrigger>
					<TabsTrigger value="behavior">Behavior</TabsTrigger>
				</TabsList>
				<TabsContent value="reloader" className="w-full">
					<Reloader />
				</TabsContent>
			</Tabs>
		</main>
	);
}
