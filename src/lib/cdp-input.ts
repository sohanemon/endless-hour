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

interface Viewport {
	width: number;
	height: number;
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

// INFO: Standard-normal sample via Box-Muller. Aim scatter and seeded origins
// use it so offsets cluster near center with a realistic tail instead of a
// flat uniform band.
function gauss(): number {
	let u = 0;
	let v = 0;
	while (u === 0) u = Math.random();
	while (v === 0) v = Math.random();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface GlideStep extends Point {
	dt: number;
}

// INFO: Multi-segment curved glide. A single eased line is trivially
// classified: humans move in arcs that overshoot slightly and correct, scale
// step count and timing with distance, and wobble perpendicular to the path.
// The perpendicular sine hump is the arc; the terminal overshoot is the
// correction a real hand makes past the target.
function moveSteps(from: Point, to: Point): GlideStep[] {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const distance = Math.hypot(dx, dy);
	const steps = Math.max(
		4,
		Math.round(distance / (12 + Math.random() * 10)) + 3,
	);
	// INFO: Arc bulge grows sublinearly with distance, random side per stroke.
	const bulge =
		distance * (0.04 + Math.random() * 0.1) * (Math.random() < 0.5 ? -1 : 1) +
		gauss() * 2;
	const overshoot = distance > 60 ? gauss() * 4 : 0;
	const points: GlideStep[] = [];
	for (let i = 1; i <= steps; i++) {
		const progress = i / steps;
		const ease =
			progress < 0.5
				? 2 * progress * progress
				: -1 + (4 - 2 * progress) * progress;
		const arcOffset =
			bulge * Math.sin(Math.PI * progress) +
			jitter(1.6) +
			(i === steps ? overshoot : 0);
		points.push({
			x: Math.round(from.x + dx * ease - (dy / (distance || 1)) * arcOffset),
			y: Math.round(from.y + dy * ease + (dx / (distance || 1)) * arcOffset),
			dt: Math.round(9 + Math.random() * 22 + (distance / steps) * 0.35),
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

async function viewportOf(target: DebuggerTarget): Promise<Viewport> {
	try {
		const metrics = await sendCommand<{
			cssVisualViewport?: { clientWidth?: number; clientHeight?: number };
		}>(target, 'Page.getLayoutMetrics');
		const width = metrics.cssVisualViewport?.clientWidth;
		const height = metrics.cssVisualViewport?.clientHeight;
		if (width && height) return { width, height };
	} catch {
		// Layout metrics unavailable (rare); fall through to the default.
	}
	return { width: 1280, height: 800 };
}

async function glideTo(
	target: DebuggerTarget,
	point: Point,
	viewport: Viewport,
): Promise<void> {
	const tabId = target.tabId;
	// INFO: First action after a service-worker restart has no cursor memory.
	// Teleporting (press with zero preceding mouseMoved) is a known bot tell,
	// so seed a Gaussian origin near the viewport center and glide in.
	const from = cursorPositions.get(tabId) ?? {
		x: Math.round(viewport.width / 2 + gauss() * viewport.width * 0.15),
		y: Math.round(viewport.height / 2 + gauss() * viewport.height * 0.15),
	};
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

export async function performClick(
	target: DebuggerTarget,
	point: Point,
): Promise<void> {
	await attach(target);
	try {
		await glideTo(target, point, await viewportOf(target));
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

export async function performHover(
	target: DebuggerTarget,
	point: Point,
): Promise<void> {
	await attach(target);
	try {
		await glideTo(target, point, await viewportOf(target));
		// INFO: Dwell so hover-intent UIs register the visit.
		await sleep(400 + Math.random() * 800);
	} catch (error) {
		throw new BehaviorInputError(
			error instanceof Error ? error.message : String(error),
		);
	}
}

export async function performScroll(
	target: DebuggerTarget,
	point: Point,
	deltaY: number,
): Promise<void> {
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
