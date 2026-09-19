/**
 * Structured content for the "Kodfilosofi" page. Preserves every item from
 * the original source list, grouped by category and re-ordered into a
 * progression from introductory to advanced levels. Purely static data —
 * no client-side JavaScript is needed to render this page.
 */
export interface KodfilosofiCategory {
	title: string;
	items: string[];
}

export interface KodfilosofiLevel {
	level: number;
	label: string;
	intro: string;
	categories: KodfilosofiCategory[];
}

export const kodfilosofiLevels: KodfilosofiLevel[] = [
	{
		level: 1,
		label: 'Intro & grundläggande',
		intro: 'Grunderna som allt annat bygger på — börja här.',
		categories: [
			{
				title: 'Intro/Grundläggande',
				items: [
					'Domänspråk (Ubiquitous language, Domänexpert)',
					'Test Driven Development',
					'Parprogrammering',
					'Läsa kod (Code review)',
					'Continuous improvement (Kaizen)',
				],
			},
		],
	},
	{
		level: 2,
		label: 'Koddesign & process',
		intro: 'Vanor och principer som gör kod och arbetssätt hållbara över tid.',
		categories: [
			{
				title: 'Koddesign',
				items: [
					'Clean Code',
					'Single Responsibility Principle',
					'Command Query Separation',
					'Vertical slices',
					'Service pattern',
				],
			},
			{
				title: 'Process',
				items: ['Done done done', 'Acceptance criteria/Definition of Done (Scope creep)', 'Good enough'],
			},
		],
	},
	{
		level: 3,
		label: 'Fördjupning',
		intro: 'Djupare tekniker inom domänmodellering, refaktorisering, tester och kundfokus.',
		categories: [
			{
				title: 'Domain driven design',
				items: ['Core/supporting/generic Domain', 'Domänspråk'],
			},
			{
				title: 'Refaktorisering',
				items: ['Refaktorisera till Clean Code', 'Scout rule'],
			},
			{
				title: 'Test Driven Development',
				items: [
					'Formulera test som önskat beteende',
					'Buggar=test som saknas',
					'Red green refactor',
					'Gör "intressanta" tester',
					'Make it work → Make it pretty',
				],
			},
			{
				title: 'Building in small batches',
				items: ['Story splitting', 'INVEST', 'Feature toggles/feature rollout', 'Continuous feedback'],
			},
			{
				title: 'Kundbehov',
				items: [
					'Job to be Done (User stories)',
					'Domänspråk (Ubiquitous language, Domänexpert)',
					'Customer collaboration',
				],
			},
			{
				title: 'Design patterns',
				items: [
					'Aggregate root + Repository',
					'Domain Service',
					'ValueObject',
					'Transaction script',
					'CRUD',
				],
			},
		],
	},
	{
		level: 4,
		label: 'Avancerat',
		intro: 'När grunderna sitter — skärpa koddesign och processer ytterligare.',
		categories: [
			{
				title: 'Avancerad koddesign',
				items: [
					'Börja med output',
					'Express intent',
					'Bounded context',
					'Scrutinize awkwardness',
					'Contemplate contradictions',
					'Refactoring Toward Deeper Insight',
				],
			},
			{
				title: 'Avancerad process',
				items: ['Continuous integration', 'Continuous delivery', 'Continuous deployment', 'Automatisera'],
			},
		],
	},
	{
		level: 5,
		label: 'Expert',
		intro: 'De mest krävande teknikerna, ofta kopplade till stora och gamla kodbaser.',
		categories: [
			{
				title: 'Avancerad kundbehov',
				items: ['Naked objects'],
			},
			{
				title: 'Avancerad refaktorisering',
				items: ['Legacy refactoring', 'Legacy testing'],
			},
		],
	},
];
