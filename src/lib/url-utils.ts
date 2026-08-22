// INFO: URL normalization + matching for URL-keyed config persistence.
// Configs are stored under a normalized origin+path key. A stored key matches
// any tab whose normalized URL STARTS WITH it, so `https://x.com/app` covers
// every deeper route (`/app/settings`, `/app/123`) plus query strings.

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
		.filter((t) => t.url && normalizeUrlKey(t.url).startsWith(urlKey))
		.map((t) => t.id)
		.filter((id): id is number => id != null);
}
