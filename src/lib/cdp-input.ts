// INFO: Trusted input executor. Content scripts cannot produce trusted events
// (`isTrusted` is browser-set), so the background attaches chrome.debugger and
// drives CDP Input domain commands: real input pipeline injection — native
// focus, caret placement, native scrolling.
import type { BehaviorTarget } from '../types/messages.types';

export type BehaviorAction = BehaviorTarget['kind'];

interface Point {
	x: number;
	y: number;
}

type DebuggerTarget = { tabId: number };

function sendCommand<T = object>(
	target: DebuggerTarget,
	method: string,
	params?: Record<string, unknown>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		chrome.debugger.sendCommand(target, method, params ?? {}, (result) => {
			if (chrome.runtime.lastError) {
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}
			resolve(result as T);
		});
	});
}

async function attach(target: DebuggerTarget): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		chrome.debugger.attach(target, '1.3', () => {
			const message = chrome.runtime.lastError?.message;
			if (!message) {
				resolve();
				return;
			}
			// INFO: Already attached (e.g. previous tick never detached) is fine;
			// anything else — DevTools open, another client, unsupported target.
			if (/already attached/i.test(message)) {
				resolve();
				return;
			}
			reject(new Error(message));
		});
	});
}

function detach(target: DebuggerTarget): void {
	chrome.debugger.detach(target, () => void chrome.runtime.lastError);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function jitter(range: number): number {
	return (Math.random() - 0.5) * range;
}

// INFO: Human-ish pointer glide: eased interpolation with per-step timing and
// positional jitter. CDP synthesizes pointer events from mouse commands.
function moveSteps(from: Point, to: Point): Array<Point & { dt: number }> {
	const steps = 8 + Math.floor(Math.random() * 5);
	const points: Array<Point & { dt: number }> = [];
	for (let i = 1; i <= steps; i++) {
		const progress = i / steps;
		const ease =
			progress < 0.5
				? 2 * progress * progress
				: -1 + (4 - 2 * progress) * progress;
		points.push({
			x: Math.round(from.x + (to.x - from.x) * ease + jitter(2)),
			y: Math.round(from.y + (to.y - from.y) * ease + jitter(2)),
			dt: Math.round(8 + Math.random() * 24),
		});
	}
	return points;
}

export class BehaviorInputError extends Error {}

// --- Per-tab virtual cursor state ---
const cursorPositions = new Map<number, Point>();

// INFO: Tabs currently driven by this extension's debugger session.
const attachedTabs = new Set<number>();

export async function detachBehavior(tabId: number): Promise<void> {
	attachedTabs.delete(tabId);
	cursorPositions.delete(tabId);
	detach({ tabId });
}

export function detachAllBehaviors(): void {
	for (const tabId of [...attachedTabs]) detachBehavior(tabId);
}

// INFO: Service workers die between alarm ticks; attachment tracking would be
// stale across runs, so each run re-attaches fresh ("already attached" tolerated).
attachedTabs.clear();

async function glideTo(
	target: DebuggerTarget,
	tabId: number,
	point: Point,
): Promise<void> {
	const from = cursorPositions.get(tabId) ?? { x: point.x, y: point.y };
	for (const step of moveSteps(from, point)) {
		await sendCommand(target, 'Input.dispatchMouseEvent', {
			type: 'mouseMoved',
			x: step.x,
			y: step.y,
			buttons: 0,
			pointerType: 'mouse',
		});
		await sleep(step.dt);
	}
	cursorPositions.set(tabId, { x: point.x, y: point.y });
}

export async function performClick(tabId: number, point: Point): Promise<void> {
	const target: DebuggerTarget = { tabId };
	await attach(target);
	try {
		await glideTo(target, tabId, point);
		await sendCommand(target, 'Input.dispatchMouseEvent', {
			type: 'mousePressed',
			x: point.x,
			y: point.y,
			button: 'left',
			buttons: 1,
			clickCount: 1,
			pointerType: 'mouse',
		});
		// INFO: Human press duration; also lets hover-intent menus settle.
		await sleep(60 + Math.random() * 90);
		await sendCommand(target, 'Input.dispatchMouseEvent', {
			type: 'mouseReleased',
			x: point.x,
			y: point.y,
			button: 'left',
			buttons: 0,
			clickCount: 1,
			pointerType: 'mouse',
		});
	} catch (error) {
		throw new BehaviorInputError(
			error instanceof Error ? error.message : String(error),
		);
	}
}

export async function performHover(tabId: number, point: Point): Promise<void> {
	const target: DebuggerTarget = { tabId };
	await attach(target);
	try {
		await glideTo(target, tabId, point);
		// INFO: Dwell so hover-intent UIs register the visit.
		await sleep(400 + Math.random() * 800);
	} catch (error) {
		throw new BehaviorInputError(
			error instanceof Error ? error.message : String(error),
		);
	}
}

export async function performScroll(
	tabId: number,
	point: Point,
	deltaY: number,
): Promise<void> {
	const target: DebuggerTarget = { tabId };
	await attach(target);
	try {
		// INFO: Wheel over the given viewport point; Chrome scrolls the scrollable
		// ancestor under it, natively. Positive deltaY scrolls down.
		const totalTicks = Math.max(3, Math.round(Math.abs(deltaY) / 100));
		const sign = Math.sign(deltaY) || 1;
		for (let i = 0; i < totalTicks; i++) {
			const remaining = Math.abs(deltaY) - i * sign * 100;
			if (remaining <= 0) break;
			const tickDelta =
				sign * Math.min(remaining, 100 + Math.round(jitter(30)));
			if (tickDelta === 0) break;
			await sendCommand(target, 'Input.dispatchMouseEvent', {
				type: 'mouseWheel',
				x: point.x,
				y: point.y,
				deltaX: 0,
				deltaY: tickDelta,
				pointerType: 'mouse',
			});
			await sleep(40 + Math.random() * 80);
		}
	} catch (error) {
		throw new BehaviorInputError(
			error instanceof Error ? error.message : String(error),
		);
	}
}
