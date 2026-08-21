function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

let pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function trackedTimeout(
	fn: () => void,
	delay: number,
): ReturnType<typeof setTimeout> {
	const id = setTimeout(() => {
		pendingTimeouts = pendingTimeouts.filter((t) => t !== id);
		fn();
	}, delay);
	pendingTimeouts.push(id);
	return id;
}

function clearPendingTimeouts(): void {
	pendingTimeouts.forEach(clearTimeout);
	pendingTimeouts = [];
}

function humanScroll(targetY: number): void {
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

function moveMouseTo(
	targetX: number,
	targetY: number,
	onArrive?: () => void,
): void {
	const startX = window.lastMouseX ?? window.innerWidth / 2;
	const startY = window.lastMouseY ?? window.innerHeight / 2;
	const steps = 10;

	for (let i = 0; i <= steps; i++) {
		trackedTimeout(() => {
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
			window.lastMouseX = currentX;
			window.lastMouseY = currentY;

			if (i === steps) onArrive?.();
		}, i * 20);
	}
}

function humanHover(element: Element): void {
	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
	});
}

function humanClick(element: Element): void {
	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

		trackedTimeout(
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

function safeInteractiveElements(selector: string): Element[] {
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

type BehaviorAction = () => void;

let scheduleTimeout: ReturnType<typeof setTimeout> | undefined;
let running = false;

function runRandomAction(): void {
	if (!running) return;

	const actions: BehaviorAction[] = [
		() => humanScroll(window.scrollY + randomBetween(100, 500)),
		() => {
			const els = safeInteractiveElements('button, a[href], [role="button"]');
			if (els.length) humanClick(els[Math.floor(Math.random() * els.length)]);
		},
		() => {
			const els = safeInteractiveElements('button, a, input');
			if (els.length) humanHover(els[Math.floor(Math.random() * els.length)]);
		},
	];

	actions[Math.floor(Math.random() * actions.length)]();
	scheduleTimeout = trackedTimeout(runRandomAction, randomBetween(2000, 8000));
}

function startAutomatedBehavior(): void {
	if (running) return;
	running = true;
	runRandomAction();
}

function stopAutomatedBehavior(): void {
	running = false;
	if (scheduleTimeout) clearTimeout(scheduleTimeout);
	clearPendingTimeouts();
}

chrome.runtime.onMessage.addListener((message: { type: string }) => {
	if (message.type === 'ENDLESS_HOUR_START') startAutomatedBehavior();
	if (message.type === 'ENDLESS_HOUR_STOP') stopAutomatedBehavior();
});
