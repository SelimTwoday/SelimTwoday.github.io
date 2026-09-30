import { describe, expect, it } from 'vitest';
import { calculateTaskPert, varianceShares } from '../calculate';

describe('varianceShares', () => {
	const tasks = [
		{ title: 'Teknisk undersökning och API-kontrakt', o: 8, m: 10, p: 16 },
		{ title: 'Fältmappning och triggeranalys', o: 4, m: 6, p: 10 },
		{ title: 'Grundsynk och initial export', o: 10, m: 14, p: 20 },
		{ title: 'Löpande förändringsflöden', o: 15, m: 20, p: 28 },
	];

	it('sums to 1 and is sorted by variance, largest first', () => {
		const shares = varianceShares(calculateTaskPert(tasks, 8));
		expect(shares.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
		expect(shares.map((item) => item.variance)).toEqual([...shares.map((item) => item.variance)].sort((a, b) => b - a));
	});

	it('gives the largest share to the most uncertain task', () => {
		const [first] = varianceShares(calculateTaskPert(tasks, 8));
		expect(first.title).toBe('Löpande förändringsflöden');
		expect(first.share).toBeCloseTo(0.46, 2);
	});

	it('returns only zeros when the total variance is 0', () => {
		const shares = varianceShares(calculateTaskPert([{ title: 'A', o: 5, m: 5, p: 5 }, { title: 'B', o: 2, m: 2, p: 2 }], 8));
		expect(shares.map((item) => item.share)).toEqual([0, 0]);
	});
});
