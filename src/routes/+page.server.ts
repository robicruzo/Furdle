import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Game } from './sverdle/game.ts';

function toDateStr(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function getTodayStr(): string {
	return toDateStr(new Date());
}

function dateOffset(base: string, days: number): string {
	const [y, m, d] = base.split('-').map(Number);
	const date = new Date(y, m - 1, d); // local midnight — avoids UTC offset ambiguity
	date.setDate(date.getDate() + days);
	return toDateStr(date);
}

async function fetchWordleAnswer(dateStr: string): Promise<string | null> {
	try {
		const res = await fetch(`https://www.nytimes.com/svc/wordle/v2/${dateStr}.json`, {
			headers: { 'User-Agent': 'Mozilla/5.0' }
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data.solution ? (data.solution as string).toLowerCase() : null;
	} catch {
		return null;
	}
}

export const load = (async ({ cookies, url }) => {
	const today = getTodayStr();
	const dateStr = url.searchParams.get('date') || today;

	const answer = await fetchWordleAnswer(dateStr);

	if (!answer) {
		return {
			date: dateStr,
			today,
			yesterday: dateOffset(today, -1),
			tomorrow: dateOffset(today, 1),
			error: 'Puzzle not available for this date',
			guesses: [] as string[],
			answers: [] as string[],
			answer: null as string | null
		};
	}

	const cookieName = `wordle_${dateStr}`;
	const game = new Game(answer, cookies.get(cookieName));

	const won = game.answers.at(-1) === 'xxxxx';
	const over = won || game.answers.length >= 6;

	return {
		date: dateStr,
		today,
		yesterday: dateOffset(today, -1),
		tomorrow: dateOffset(today, 1),
		error: null as string | null,
		guesses: game.guesses,
		answers: game.answers,
		answer: over ? game.answer : (null as string | null)
	};
}) satisfies PageServerLoad;

export const actions = {
	update: async ({ request, cookies }) => {
		const data = await request.formData();
		const key = data.get('key') as string;
		const dateStr = (data.get('_date') as string) || getTodayStr();

		const answer = await fetchWordleAnswer(dateStr);
		if (!answer) return;

		const cookieName = `wordle_${dateStr}`;
		const game = new Game(answer, cookies.get(cookieName));
		const i = game.answers.length;

		if (key === 'backspace') {
			game.guesses[i] = game.guesses[i].slice(0, -1);
		} else {
			game.guesses[i] += key;
		}

		cookies.set(cookieName, game.toString(), { path: '/' });
	},

	enter: async ({ request, cookies }) => {
		const data = await request.formData();
		const dateStr = (data.get('_date') as string) || getTodayStr();
		const guess = data.getAll('guess') as string[];

		const answer = await fetchWordleAnswer(dateStr);
		if (!answer) return fail(500, { error: 'Puzzle not available' });

		const cookieName = `wordle_${dateStr}`;
		const game = new Game(answer, cookies.get(cookieName));

		if (!game.enter(guess)) {
			return fail(400, { badGuess: true });
		}

		cookies.set(cookieName, game.toString(), { path: '/' });
	},

	restart: async ({ request, cookies }) => {
		const data = await request.formData();
		const dateStr = (data.get('_date') as string) || getTodayStr();
		const cookieName = `wordle_${dateStr}`;
		cookies.delete(cookieName, { path: '/' });
	}
} satisfies Actions;
