/** Small DOM helpers. User data is only ever set through textContent, value or fixed attribute names. */

export function query<T extends Element>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`Missing element: ${selector}`);
	return element;
}

export function queryAll<T extends Element>(root: ParentNode, selector: string): T[] {
	return Array.from(root.querySelectorAll<T>(selector));
}

/** Finds a result output element by its data-out name. */
export function out(root: ParentNode, name: string): HTMLElement {
	return query<HTMLElement>(root, `[data-out="${name}"]`);
}

export function setText(root: ParentNode, name: string, text: string): void {
	out(root, name).textContent = text;
}

interface ElementOptions {
	class?: string;
	text?: string;
	attrs?: Record<string, string>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options: ElementOptions = {},
	children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	if (options.class) element.className = options.class;
	if (options.text !== undefined) element.textContent = options.text;
	for (const [name, value] of Object.entries(options.attrs ?? {})) element.setAttribute(name, value);
	for (const child of children) element.append(child);
	return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A small stroked icon built from a fixed path. */
export function icon(path: string, size = 12): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	svg.setAttribute('viewBox', '0 0 12 12');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '1.5');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('aria-hidden', 'true');
	const shape = document.createElementNS(SVG_NS, 'path');
	shape.setAttribute('d', path);
	svg.append(shape);
	return svg;
}

export const CLOSE_ICON_PATH = 'M2 2l8 8M10 2l-8 8';

/** Circled exclamation mark used in warning rows. */
export function alertIcon(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('width', '16');
	svg.setAttribute('height', '16');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '1.5');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('aria-hidden', 'true');
	const circle = document.createElementNS(SVG_NS, 'circle');
	circle.setAttribute('cx', '8');
	circle.setAttribute('cy', '8');
	circle.setAttribute('r', '6.5');
	const mark = document.createElementNS(SVG_NS, 'path');
	mark.setAttribute('d', 'M8 4.5v4M8 11v.01');
	svg.append(circle, mark);
	return svg;
}

/** Swedish plural helper: pluralize(1, 'uppgift', 'uppgifter'). */
export function pluralize(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
