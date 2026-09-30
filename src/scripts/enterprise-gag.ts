import { formatSwedishNumber } from '../lib/pert/format';

export const ENTERPRISE_GAG_PRICE = 4990;
export const ENTERPRISE_GAG_MONTHS = 12;
export const ENTERPRISE_GAG_STORAGE_KEY = 'pert-pro-enterprise-gag-dismissed';

export function initEnterpriseGag(): { show: () => void } {
	const dialog = document.getElementById('enterprise-gag-dialog') as HTMLDialogElement;
	const offer = document.getElementById('enterprise-gag-offer') as HTMLElement;
	const receipt = document.getElementById('enterprise-gag-receipt') as HTMLElement;
	const amount = document.getElementById('enterprise-gag-amount') as HTMLElement;
	const progress = document.getElementById('enterprise-gag-progress') as HTMLElement;
	const message = document.getElementById('enterprise-gag-message') as HTMLElement;
	const storageStatus = document.getElementById('enterprise-gag-storage-status') as HTMLElement;
	const continueButton = document.getElementById('enterprise-gag-continue') as HTMLButtonElement;
	const buyButtons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-enterprise-buy]'));
	const months = Array.from(dialog.querySelectorAll<HTMLElement>('[data-enterprise-month]'));
	let acknowledged = false;
	let animationFrame: number | null = null;

	function storageUnavailable(error: unknown): void {
		if (!(error instanceof DOMException)) throw error;
		storageStatus.textContent =
			'Webbläsaren tillåter inte att vi sparar engångsflaggan. Skämtet kan visas igen nästa gång du öppnar sidan.';
	}

	function hasAcknowledged(): boolean {
		if (acknowledged) return true;
		try {
			return window.localStorage.getItem(ENTERPRISE_GAG_STORAGE_KEY) === '1';
		} catch (error) {
			storageUnavailable(error);
			return false;
		}
	}

	function paintDebit(chargedMonths: number): void {
		amount.textContent = `${formatSwedishNumber(chargedMonths * ENTERPRISE_GAG_PRICE, 0)} kr`;
		progress.textContent = `${chargedMonths} av ${ENTERPRISE_GAG_MONTHS} månader debiterade i låtsaspengar`;
		months.forEach((month, index) => {
			month.dataset.charged = String(index < chargedMonths);
		});
	}

	function finishDebit(): void {
		animationFrame = null;
		paintDebit(ENTERPRISE_GAG_MONTHS);
		dialog.dataset.phase = 'complete';
		message.textContent =
			`${formatSwedishNumber(ENTERPRISE_GAG_PRICE * ENTERPRISE_GAG_MONTHS, 0)} kr har dragits från ditt konto. Ekonomiavdelningen tackar för din oerhört generösa betalning!`;
		continueButton.disabled = false;
		continueButton.focus();
	}

	function buy(): void {
		if (acknowledged || !dialog.open || dialog.dataset.phase !== 'offer') return;
		acknowledged = true;
		for (const button of buyButtons) button.disabled = true;
		try {
			window.localStorage.setItem(ENTERPRISE_GAG_STORAGE_KEY, '1');
		} catch (error) {
			storageUnavailable(error);
		}
		offer.hidden = true;
		receipt.hidden = false;
		dialog.dataset.phase = 'charging';
		continueButton.disabled = true;
		message.textContent = 'Tömmer ditt låtsaskonto. Vår säljare har redan bokat konferensresan …';
		paintDebit(0);
		receipt.focus({ preventScroll: true });
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			finishDebit();
			return;
		}
		const start = performance.now();
		const animate = (now: number): void => {
			const fraction = Math.min(1, (now - start) / 2400);
			paintDebit(Math.floor(fraction * ENTERPRISE_GAG_MONTHS));
			if (fraction < 1) animationFrame = requestAnimationFrame(animate);
			else finishDebit();
		};
		animationFrame = requestAnimationFrame(animate);
	}

	for (const button of buyButtons) button.addEventListener('click', buy);
	continueButton.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => {
		if (animationFrame !== null) cancelAnimationFrame(animationFrame);
		animationFrame = null;
	});

	return {
		show(): void {
			if (dialog.open || hasAcknowledged()) return;
			dialog.dataset.phase = 'offer';
			offer.hidden = false;
			receipt.hidden = true;
			dialog.showModal();
			buyButtons[0].focus();
		},
	};
}
