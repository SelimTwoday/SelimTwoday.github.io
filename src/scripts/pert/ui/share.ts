import { toBlob } from 'html-to-image';
import { query } from './dom';

export interface ShareBinding {
	/** Enables or disables sharing. Disabled shows the "fill in all rows" hint. */
	setEnabled: (enabled: boolean) => void;
	/** Shows or hides the privacy notice about names in the link. */
	setNoticeVisible: (visible: boolean) => void;
	clearStatus: () => void;
}

const LONG_URL_LENGTH = 2000;
const LONG_URL_WARNING = 'Länken är lång och kan klippas av i vissa appar.';

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function downloadBlob(blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'pert-resultat.png';
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** Renders the result panel to a PNG. Export-only content is shown and share controls hidden while capturing. */
async function capturePng(panel: HTMLElement): Promise<Blob> {
	panel.dataset.exporting = 'true';
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	try {
		const blob = await toBlob(panel, { pixelRatio: 2 });
		if (!blob) throw new Error('Kunde inte generera bilden.');
		return blob;
	} finally {
		delete panel.dataset.exporting;
	}
}

export function bindShare(
	root: HTMLElement,
	panel: HTMLElement,
	getUrl: () => string | null,
): ShareBinding {
	const combinedButton = query<HTMLButtonElement>(root, '[data-share-combined]');
	const linkButton = query<HTMLButtonElement>(root, '[data-share-link]');
	const imageButton = query<HTMLButtonElement>(root, '[data-share-image]');
	const hint = query<HTMLElement>(root, '[data-share-hint]');
	const status = query<HTMLElement>(root, '[data-share-status]');
	const notice = root.querySelector<HTMLElement>('[data-share-notice]');

	const lengthWarning = (url: string): string => (url.length > LONG_URL_LENGTH ? ` ${LONG_URL_WARNING}` : '');
	const canWriteClipboard = (): boolean => !!navigator.clipboard && window.isSecureContext;

	linkButton.addEventListener('click', async () => {
		const url = getUrl();
		if (!url) return;
		try {
			if (!canWriteClipboard()) throw new Error('Clipboard API är inte tillgängligt i den här miljön.');
			await navigator.clipboard.writeText(url);
			status.textContent = `Länken har kopierats till urklipp.${lengthWarning(url)}`;
		} catch {
			status.textContent = `Kunde inte kopiera automatiskt. Här är länken: ${url}`;
		}
	});

	imageButton.addEventListener('click', async () => {
		status.textContent = 'Skapar bild …';
		try {
			const blob = await capturePng(panel);
			if (canWriteClipboard() && typeof ClipboardItem !== 'undefined') {
				try {
					await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
					status.textContent = 'Bilden har kopierats till urklipp.';
					return;
				} catch {
					// Clipboard image writes can be blocked; download the same PNG instead.
				}
			}
			downloadBlob(blob);
			status.textContent = 'Din webbläsare kunde inte kopiera bilden till urklipp — filen laddades ner i stället.';
		} catch {
			status.textContent = 'Något gick fel när bilden skulle skapas. Försök igen.';
		}
	});

	combinedButton.addEventListener('click', async () => {
		const url = getUrl();
		if (!url) return;
		status.textContent = 'Skapar bild …';

		let blob: Blob;
		try {
			blob = await capturePng(panel);
		} catch {
			status.textContent = 'Något gick fel när bilden skulle skapas. Försök igen.';
			return;
		}

		try {
			if (!canWriteClipboard() || typeof ClipboardItem === 'undefined') {
				throw new Error('Clipboard API är inte tillgängligt i den här miljön.');
			}
			// One text/html representation with an inline image plus a link lets
			// rich-text targets (Jira, Confluence, Docs, …) paste both at once.
			const dataUrl = await blobToDataUrl(blob);
			const escapedUrl = escapeHtml(url);
			const html = `<img src="${dataUrl}" alt="PERT-resultat" /><p><a href="${escapedUrl}">${escapedUrl}</a></p>`;
			await navigator.clipboard.write([
				new ClipboardItem({
					'text/html': new Blob([html], { type: 'text/html' }),
					'text/plain': new Blob([url], { type: 'text/plain' }),
					'image/png': blob,
				}),
			]);
			status.textContent = `Bild och länk har kopierats. Klistra in i t.ex. Jira.${lengthWarning(url)}`;
		} catch {
			// Fall back to downloading the image and copying just the link.
			downloadBlob(blob);
			try {
				if (!canWriteClipboard()) throw new Error('no clipboard');
				await navigator.clipboard.writeText(url);
				status.textContent =
					`Kunde inte kopiera bild och länk tillsammans. Länken kopierades och bilden laddades ner separat.${lengthWarning(url)}`;
			} catch {
				status.textContent = `Kunde inte kopiera automatiskt. Bilden laddades ner. Här är länken: ${url}`;
			}
		}
	});

	return {
		setEnabled(enabled: boolean): void {
			for (const button of [combinedButton, linkButton, imageButton]) button.disabled = !enabled;
			hint.hidden = enabled;
		},
		setNoticeVisible(visible: boolean): void {
			if (notice) notice.hidden = !visible;
		},
		clearStatus(): void {
			status.textContent = '';
		},
	};
}
