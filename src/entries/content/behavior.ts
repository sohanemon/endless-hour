// INFO: DOM-simulation primitives for the "Behavior" popup tab.
// Timing is owned by the background (chrome.alarms), mirroring the reloader:
// each alarm tick dispatches a `RUN_BEHAVIOR_ACTION` message here, which
// performs a single randomized human-like action from the enabled set.

let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

export function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

export function humanScroll(targetY: number): void {
	const startY = window.scrollY;
	const maxY = document.documentElement.scrollHeight - window.innerHeight;
	const clampedTarget = Math.max(0, Math.min(targetY, maxY));
	const distance = clampedTarget - startY;
	if (Math.abs(distance) < 1) return;

	const duration = randomBetween(300, 800);
	const steps = 20;
	let currentStep = 0;

	const interval = setInterval(() => {
		currentStep++;
		const progress = currentStep / steps;
		const easeProgress =
			progress < 0.5
				? 2 * progress * progress
				: -1 + (4 - 2 * progress) * progress;

		window.scrollTo(0, startY + distance * easeProgress);

		if (currentStep >= steps) clearInterval(interval);
	}, duration / steps);
}

export function moveMouseTo(
	targetX: number,
	targetY: number,
	onArrive?: () => void,
): void {
	const startX = lastMouseX;
	const startY = lastMouseY;
	const steps = 10;

	for (let i = 0; i <= steps; i++) {
		setTimeout(() => {
			const progress = i / steps;
			const currentX = startX + (targetX - startX) * progress;
			const currentY = startY + (targetY - startY) * progress;
			const target: Element | Document =
				document.elementFromPoint(currentX, currentY) ?? document;

			target.dispatchEvent(
				new MouseEvent('mousemove', {
					bubbles: true,
					clientX: currentX,
					clientY: currentY,
				}),
			);
			lastMouseX = currentX;
			lastMouseY = currentY;

			if (i === steps) onArrive?.();
		}, i * 20);
	}
}

export function humanHover(element: Element): void {
	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
	});
}

export function humanClick(element: Element): void {
	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

		setTimeout(
			() => {
				element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
				element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
				element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			},
			randomBetween(50, 150),
		);
	});
}

const UNSAFE_SELECTOR = [
	'[type="submit"]',
	'button[type="submit"]',
	`a[href^="http"]:not([href*="${location.hostname}"])`,
	'a[download]',
	'[data-danger]',
	'.delete, .logout, .signout',
].join(', ');

export function safeInteractiveElements(selector: string): Element[] {
	return Array.from(document.querySelectorAll(selector)).filter((el) => {
		if (el.matches(UNSAFE_SELECTOR)) return false;
		const rect = el.getBoundingClientRect();
		return (
			rect.width > 0 &&
			rect.height > 0 &&
			rect.top >= 0 &&
			rect.top <= window.innerHeight
		);
	});
}

export type BehaviorAction = 'scroll' | 'hover' | 'click';

export function runBehaviorAction(actions: BehaviorAction[]): void {
	if (actions.length === 0) return;

	const action = actions[Math.floor(Math.random() * actions.length)];

	switch (action) {
		case 'scroll':
			humanScroll(window.scrollY + randomBetween(100, 500));
			break;
		case 'click': {
			const els = safeInteractiveElements('button, a[href], [role="button"]');
			if (els.length) humanClick(els[Math.floor(Math.random() * els.length)]);
			break;
		}
		case 'hover': {
			const els = safeInteractiveElements('button, a, input');
			if (els.length) humanHover(els[Math.floor(Math.random() * els.length)]);
			break;
		}
	}
}
