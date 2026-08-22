// INFO: Target picker for the "Behavior" tab. Trusted input cannot be
// synthesized in a content script (`isTrusted` is browser-set), so this script
// only RESOLVES a target: it picks one enabled action, finds a safe matching
// element, and returns viewport coordinates. The background executes the
// actual mouse/wheel input via chrome.debugger (CDP), which produces real,
// trusted events with native focus/caret/scroll semantics.
import type { BehaviorAction, BehaviorTarget } from '@/types/messages.types';

const UNSAFE_SELECTOR = [
	'[type="submit"]',
	'button[type="submit"]',
	`a[href^="http"]:not([href*="${location.hostname}"])`,
	'a[download]',
	'[data-danger]',
	'.delete, .logout, .signout',
].join(', ');

function visibleInViewport(el: Element): boolean {
	const rect = el.getBoundingClientRect();
	return (
		rect.width > 0 &&
		rect.height > 0 &&
		rect.top >= 0 &&
		rect.bottom <= window.innerHeight
	);
}

// INFO: Center of the element's bounding box with slight human-like offset.
function centerPoint(el: Element): { x: number; y: number } {
	const rect = el.getBoundingClientRect();
	const jitter = () => (Math.random() - 0.5) * Math.min(10, rect.width / 4);
	return {
		x: Math.round(rect.left + rect.width / 2 + jitter()),
		y: Math.round(rect.top + rect.height / 2 + jitter()),
	};
}

export function safeInteractiveElements(selector: string): Element[] {
	return Array.from(document.querySelectorAll(selector)).filter(
		(el) => !el.matches(UNSAFE_SELECTOR) && visibleInViewport(el),
	);
}

function pick<T>(items: T[]): T | undefined {
	if (items.length === 0) return undefined;
	return items[Math.floor(Math.random() * items.length)];
}

export function resolveBehaviorTarget(
	actions: BehaviorAction[],
	clickSelectors: string[],
): BehaviorTarget | undefined {
	const action = pick(actions);
	if (!action) return undefined;

	switch (action) {
		case 'scroll': {
			// Wheel at a viewport point near center; direction avoids edges when
			// possible, mirroring the old scroll logic.
			const delta = 100 + Math.random() * 400;
			const maxY = document.documentElement.scrollHeight - window.innerHeight;
			const currentY = window.scrollY;
			let direction: number;
			if (currentY < delta && maxY - currentY > delta) {
				direction = 1;
			} else if (maxY - currentY < delta && currentY > delta) {
				direction = -1;
			} else {
				direction = Math.random() < 0.5 ? -1 : 1;
			}
			return {
				x: Math.round(window.innerWidth / 2 + (Math.random() - 0.5) * 200),
				y: Math.round(window.innerHeight / 2 + (Math.random() - 0.5) * 200),
				kind: 'scroll',
				deltaY: Math.round(direction * delta),
			};
		}
		case 'hover': {
			const el = pick(safeInteractiveElements('button, a, input'));
			if (!el) return undefined;
			return { ...centerPoint(el), kind: 'hover' };
		}
		case 'click': {
			// ONLY user-provided selectors. No fallback pool: nothing is clicked
			// unless the operator explicitly listed it.
			const pool = clickSelectors.flatMap((sel) => {
				try {
					return safeInteractiveElements(sel);
				} catch {
					// Invalid user selector: skip it, keep the rest.
					return [];
				}
			});
			const el = pick(pool);
			if (!el) return undefined;
			el.scrollIntoView({ block: 'center' });
			return { ...centerPoint(el), kind: 'click' };
		}
	}
}
