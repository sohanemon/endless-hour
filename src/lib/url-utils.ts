// INFO: URL normalization + matching for URL-keyed config persistence.
// Configs are stored under a normalized origin+path key. A stored key matches
// any tab whose normalized URL STARTS WITH it, so `https://x.com/app` covers
// every deeper route (`/app/settings`, `/app/123`) plus query strings.

function stripWww(hostname: string): string {
	return hostname.replace(/^www\./, '');
}

export function normalizeUrlKey(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const path = url.pathname.replace(/\/+$/, '') || '/';
		return `${url.protocol}//${stripWww(url.hostname)}${path}`;
	} catch {
		// Not parseable as a URL: keep the operator's raw input as the key so
		// nothing they typed becomes unreachable; matching falls back to it.
		return rawUrl.trim();
	}
}

// INFO: Registrable-domain-style match without the public-suffix list:
// `gist.github.com` counts as github.com; `notgithub.com` does not.
export function hostMatchesDomain(hostname: string, domain: string): boolean {
	const host = stripWww(hostname);
	return host === domain || host.endsWith(`.${domain}`);
}

export function domainOf(rawUrl: string): string | undefined {
	try {
		return stripWww(new URL(rawUrl).hostname);
	} catch {
		return undefined;
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
