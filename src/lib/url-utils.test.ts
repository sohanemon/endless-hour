import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	domainOf,
	hostMatchesDomain,
	normalizeUrlKey,
	tabsForUrlKey,
} from './url-utils';

// INFO: Minimal chrome.tabs stub; url-utils touches only `query`.
const queryMock = vi.fn();
vi.stubGlobal('chrome', { tabs: { query: queryMock } });

afterEach(() => {
	queryMock.mockReset();
});

function tab(id: number, url: string | undefined) {
	return { id, url };
}

describe('normalizeUrlKey', () => {
	it('strips www, query, hash, and trailing slash', () => {
		expect(normalizeUrlKey('https://www.x.com/app/?q=1#top')).toBe(
			'https://x.com/app',
		);
	});

	it('keeps root path as slash', () => {
		expect(normalizeUrlKey('https://x.com/')).toBe('https://x.com/');
	});

	it('collapses repeated trailing slashes', () => {
		expect(normalizeUrlKey('https://x.com/a///')).toBe('https://x.com/a');
	});

	it('preserves deeper path prefix for starts-with matching', () => {
		expect(normalizeUrlKey('https://x.com/orgs/github')).toBe(
			'https://x.com/orgs/github',
		);
	});

	it('falls back to trimmed raw input when unparseable', () => {
		expect(normalizeUrlKey('  not a url  ')).toBe('not a url');
	});
});

describe('hostMatchesDomain', () => {
	it('matches exact host', () => {
		expect(hostMatchesDomain('github.com', 'github.com')).toBe(true);
	});

	it('matches subdomains of the domain', () => {
		expect(hostMatchesDomain('gist.github.com', 'github.com')).toBe(true);
	});

	it('ignores leading www on the host', () => {
		expect(hostMatchesDomain('www.github.com', 'github.com')).toBe(true);
	});

	it('rejects different domains', () => {
		expect(hostMatchesDomain('notgithub.com', 'github.com')).toBe(false);
	});

	it('rejects suffix lookalikes without dot boundary', () => {
		expect(hostMatchesDomain('badgithub.com', 'github.com')).toBe(false);
	});
});

describe('tabsForUrlKey', () => {
	it('matches tabs whose normalized URL starts with the key', async () => {
		queryMock.mockResolvedValue([
			tab(1, 'https://github.com/orgs/github/repositories'),
			tab(2, 'https://github.com/orgs'),
			tab(3, 'https://gitlab.com/orgs'),
			tab(4, undefined),
		]);
		await expect(tabsForUrlKey('https://github.com/orgs')).resolves.toEqual([
			1, 2,
		]);
	});

	it('normalizes tab URLs before matching (www, query, hash)', async () => {
		queryMock.mockResolvedValue([
			tab(1, 'https://www.github.com/orgs?q=1#feed'),
		]);
		await expect(tabsForUrlKey('https://github.com/orgs')).resolves.toEqual([
			1,
		]);
	});

	it('does not match a different path sharing the prefix text', async () => {
		queryMock.mockResolvedValue([tab(1, 'https://github.com/orgs2')]);
		// INFO: Literal string prefix: `/orgs` matches `/orgs2`. Documented
		// behavior — segment-boundary matching would be a product change.
		await expect(tabsForUrlKey('https://github.com/orgs')).resolves.toEqual([
			1,
		]);
	});

	it('returns only numeric tab ids, skipping null ids', async () => {
		queryMock.mockResolvedValue([
			tab(7, 'https://github.com/orgs'),
			{ id: undefined, url: 'https://github.com/orgs/x' },
		]);
		await expect(tabsForUrlKey('https://github.com/orgs')).resolves.toEqual([
			7,
		]);
	});
});

describe('domainOf', () => {
	it('extracts hostname minus www (URL lowercases host)', () => {
		expect(domainOf('https://www.GitHub.com/orgs')).toBe('github.com');
	});

	it('returns undefined for garbage input', () => {
		expect(domainOf(':::')).toBeUndefined();
	});
});
