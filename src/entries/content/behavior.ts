// INFO: DOM-simulation primitives for the "Behavior" popup tab.
// Timing is owned by the background (chrome.alarms), mirroring the reloader:
// each alarm tick dispatches a `RUN_BEHAVIOR_ACTION` message here, which
// performs a single randomized human-like action from the enabled set.

let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

export function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

// INFO: Trusted input emits a pointer event before every mouse event, and many
// frameworks (React, Turbo) bind pointer-only handlers. These factories mirror
// that pairing, including the `buttons` bitmask and pointer identity.
interface InputPoint {
	clientX: number;
	clientY: number;
	buttons?: number;
}

function mouseEvent(type: string, point: InputPoint): MouseEvent {
	return new MouseEvent(type, {
		bubbles: type !== 'mouseenter' && type !== 'mouseleave',
		cancelable: true,
		view: window,
		clientX: point.clientX,
		clientY: point.clientY,
		buttons: point.buttons ?? 0,
	});
}

function pointerEvent(type: string, point: InputPoint): PointerEvent {
	return new PointerEvent(type, {
		bubbles: type !== 'pointerenter' && type !== 'pointerleave',
		cancelable: true,
		view: window,
		clientX: point.clientX,
		clientY: point.clientY,
		buttons: point.buttons ?? 0,
		pointerId: 1,
		pointerType: 'mouse',
		isPrimary: true,
	});
}

// INFO: Dispatches `pointer<type>` then `<type>`. A prevented pointer event
// suppresses the compatibility mouse event, matching native semantics.
function dispatchPointerPair(
	target: EventTarget,
	type: 'move' | 'down' | 'up' | 'over' | 'out' | 'enter' | 'leave',
	point: InputPoint,
): void {
	const pointer = pointerEvent(`pointer${type}`, point);
	target.dispatchEvent(pointer);
	if (!pointer.defaultPrevented) target.dispatchEvent(mouseEvent(type, point));
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
		const y = startY + distance * easeProgress;
		const deltaY = y - window.scrollY;

		if (Math.abs(deltaY) >= 1) {
			// INFO: Untrusted wheel events do not scroll natively. Emit the wheel
			// signal for listeners, then apply the delta manually unless canceled.
			const wheel = new WheelEvent('wheel', {
				bubbles: true,
				cancelable: true,
				view: window,
				deltaY,
				deltaMode: WheelEvent.DOM_DELTA_PIXEL,
				clientX: lastMouseX,
				clientY: lastMouseY,
			});
			const target: Element | Document =
				document.elementFromPoint(lastMouseX, lastMouseY) ?? document;
			target.dispatchEvent(wheel);
			if (!wheel.defaultPrevented) window.scrollBy(0, deltaY);
		}

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
			// Same ease-in-out curve as humanScroll; linear motion reads robotic.
			const easeProgress =
				progress < 0.5
					? 2 * progress * progress
					: -1 + (4 - 2 * progress) * progress;
			const currentX = startX + (targetX - startX) * easeProgress;
			const currentY = startY + (targetY - startY) * easeProgress;
			const target: Element | Document =
				document.elementFromPoint(currentX, currentY) ?? document;

			dispatchPointerPair(target, 'move', {
				clientX: currentX,
				clientY: currentY,
			});
			lastMouseX = currentX;
			lastMouseY = currentY;

			if (i === steps) onArrive?.();
		}, i * 20);
	}
}

let activeHover:
	| { element: Element; timeoutId: ReturnType<typeof setTimeout> }
	| undefined;

export function humanHover(element: Element, onDone?: () => void): void {
	// If a hover is already in progress, end it immediately before starting the new one.
	if (activeHover) {
		clearTimeout(activeHover.timeoutId);
		dispatchPointerPair(activeHover.element, 'out', {
			clientX: lastMouseX,
			clientY: lastMouseY,
		});
		dispatchPointerPair(activeHover.element, 'leave', {
			clientX: lastMouseX,
			clientY: lastMouseY,
		});
		activeHover = undefined;
	}

	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		dispatchPointerPair(element, 'over', {
			clientX: targetX,
			clientY: targetY,
		});
		dispatchPointerPair(element, 'enter', {
			clientX: targetX,
			clientY: targetY,
		});

		const dwellMs = randomBetween(400, 1200);
		const timeoutId = setTimeout(() => {
			dispatchPointerPair(element, 'out', {
				clientX: targetX,
				clientY: targetY,
			});
			dispatchPointerPair(element, 'leave', {
				clientX: targetX,
				clientY: targetY,
			});
			if (activeHover?.element === element) activeHover = undefined;
			onDone?.();
		}, dwellMs);

		activeHover = { element, timeoutId };
	});
}

// FIX: Browsers only apply native click activation (caret placement, focus)
// to trusted events. A synthetic mousedown/mouseup/click alone is a no-op for
// form fields, so focusable targets are explicitly focused after the press.
export function humanClick(element: Element): void {
	element.scrollIntoView({ block: 'center' });

	const rect = element.getBoundingClientRect();
	const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
	const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

	moveMouseTo(targetX, targetY, () => {
		element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

		setTimeout(
			() => {
				dispatchPointerPair(element, 'down', {
					clientX: targetX,
					clientY: targetY,
					buttons: 1,
				});
				dispatchPointerPair(element, 'up', {
					clientX: targetX,
					clientY: targetY,
				});
				element.dispatchEvent(
					mouseEvent('click', { clientX: targetX, clientY: targetY }),
				);

				if (
					element instanceof HTMLElement &&
					element.matches(
						'input:not([type="hidden"]), textarea, select, a[href], button, summary, [contenteditable="true"], [contenteditable=""], [tabindex]',
					)
				) {
					element.focus({ preventScroll: true });
				}
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

export function runBehaviorAction(
	actions: BehaviorAction[],
	clickSelectors: string[] = [],
): void {
	if (actions.length === 0) return;

	const action = actions[Math.floor(Math.random() * actions.length)];

	switch (action) {
		case 'scroll': {
			const delta = randomBetween(100, 500);
			const maxY = document.documentElement.scrollHeight - window.innerHeight;
			const currentY = window.scrollY;

			// Near top edge with room to go down → scroll down.
			// Near bottom edge with room to go up → scroll up.
			// Otherwise pick a random direction.
			let direction: number;
			if (currentY < delta && maxY - currentY > delta) {
				direction = 1;
			} else if (maxY - currentY < delta && currentY > delta) {
				direction = -1;
			} else {
				direction = Math.random() < 0.5 ? -1 : 1;
			}

			humanScroll(currentY + direction * delta);
			break;
		}
		case 'click': {
			const pool = clickSelectors.flatMap((sel) => {
				try {
					return safeInteractiveElements(sel);
				} catch {
					// Invalid user selector: skip it, keep the rest.
					return [];
				}
			});
			if (pool.length)
				humanClick(pool[Math.floor(Math.random() * pool.length)]);
			break;
		}
		case 'hover': {
			const els = safeInteractiveElements('button, a, input');
			if (els.length) humanHover(els[Math.floor(Math.random() * els.length)]);
			break;
		}
	}
}
