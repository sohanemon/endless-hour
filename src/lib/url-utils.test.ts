import { describe, expect, it } from 'vitest';
import { domainOf, hostMatchesDomain, normalizeUrlKey } from './url-utils';

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

describe('domainOf', () => {
	it('extracts hostname minus www (URL lowercases host)', () => {
		expect(domainOf('https://www.GitHub.com/orgs')).toBe('github.com');
	});

	it('returns undefined for garbage input', () => {
		expect(domainOf(':::')).toBeUndefined();
	});
});
