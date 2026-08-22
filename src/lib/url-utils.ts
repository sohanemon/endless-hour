// INFO: URL normalization + matching for URL-keyed config persistence.
// Configs are stored under a normalized origin+path key so the same page
// matches across sessions, ports, and query strings.

export function normalizeUrlKey(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const hostname = url.hostname.replace(/^www\./, '');
		const path = url.pathname.replace(/\/+$/, '') || '/';
		return `${url.protocol}//${hostname}${path}`;
	} catch {
		return rawUrl.trim();
	}
}

export function currentTabUrl(): Promise<string | undefined> {
	return chrome.tabs
		.query({ active: true, currentWindow: true })
		.then((tabs) => tabs[0]?.url);
}

export async function tabsForUrlKey(urlKey: string): Promise<number[]> {
	const tabs = await chrome.tabs.query({});
	return tabs
		.filter((t) => t.url && normalizeUrlKey(t.url) === urlKey)
		.map((t) => t.id)
		.filter((id): id is number => id != null);
}
