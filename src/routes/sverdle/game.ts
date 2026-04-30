import { allowed } from './words.server.ts';

export class Game {
	guesses: string[];
	answers: string[];
	answer: string;

	constructor(answer: string, serialized: string | undefined = undefined) {
		this.answer = answer.toLowerCase();

		if (serialized) {
			const pipeIdx = serialized.indexOf('|');
			const guessesStr = pipeIdx >= 0 ? serialized.slice(0, pipeIdx) : serialized;
			const answersStr = pipeIdx >= 0 ? serialized.slice(pipeIdx + 1) : '';

			this.guesses = guessesStr ? guessesStr.split(' ') : ['', '', '', '', '', ''];
			this.answers = answersStr ? answersStr.split(' ').filter((s) => s.length > 0) : [];
		} else {
			this.guesses = ['', '', '', '', '', ''];
			this.answers = [];
		}
	}

	enter(letters: string[]) {
		const word = letters.join('');
		const valid = allowed.has(word) || word === this.answer;

		if (!valid) return false;

		this.guesses[this.answers.length] = word;

		const available = Array.from(this.answer);
		const answer = Array(5).fill('_');

		for (let i = 0; i < 5; i += 1) {
			if (letters[i] === available[i]) {
				answer[i] = 'x';
				available[i] = ' ';
			}
		}

		for (let i = 0; i < 5; i += 1) {
			if (answer[i] === '_') {
				const index = available.indexOf(letters[i]);
				if (index !== -1) {
					answer[i] = 'c';
					available[index] = ' ';
				}
			}
		}

		this.answers.push(answer.join(''));
		return true;
	}

	toString() {
		return `${this.guesses.join(' ')}|${this.answers.join(' ')}`;
	}
}
