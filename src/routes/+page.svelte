<script lang="ts">
	import { enhance } from '$app/forms';
	import { confetti } from '@neoconfetti/svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	let today = $derived(data.today);
	let yesterday = $derived(data.yesterday);
	let tomorrow = $derived(data.tomorrow);
	let date = $derived(data.date);

	let won = $derived(data.answers.at(-1) === 'xxxxx');
	let lost = $derived(!won && data.answers.length >= 6);
	let over = $derived(won || lost);
	let rowIndex = $derived(over ? -1 : data.answers.length);

	let currentGuess = $state('');
	$effect(() => {
		currentGuess = data.guesses[rowIndex] ?? '';
	});

	let submittable = $derived(currentGuess.length === 5);

	// Derived board state — reacts to currentGuess, rowIndex, and data changes
	let board = $derived(
		Array.from({ length: 6 }, (_, row) =>
			Array.from({ length: 5 }, (_, col) => {
				const g = row === rowIndex ? currentGuess : (data.guesses[row] ?? '');
				const letter = g[col] ?? '';
				const answer = data.answers[row]?.[col];
				return {
					letter: letter.toUpperCase(),
					state: !letter
						? 'empty'
						: !answer
							? 'filled'
							: answer === 'x'
								? 'correct'
								: answer === 'c'
									? 'present'
									: 'absent'
				};
			})
		)
	);
	let shake = $state(false);
	let animatingRow = $state(-1);
	let prevAnswerCount = $state(-1);

	$effect(() => {
		const count = data.answers.length;
		if (prevAnswerCount === -1) {
			// first run: initialize without animating (page load with existing guesses)
			prevAnswerCount = count;
			return;
		}
		if (count > prevAnswerCount) {
			animatingRow = count - 1;
			setTimeout(() => {
				animatingRow = -1;
			}, 1100);
		}
		prevAnswerCount = count;
	});

	let showArchive = $state(false);
	let archiveDisplayCount = $state(10);
	let toast = $state('');
	let toastTimer: ReturnType<typeof setTimeout>;

	let archiveDates = $derived.by(() => {
		const dates: string[] = [];
		const [y, m, d] = today.split('-').map(Number);
		const base = new Date(y, m - 1, d);
		for (let j = 2; j <= 365; j++) {
			const dt = new Date(base);
			dt.setDate(base.getDate() - j);
			const yyyy = dt.getFullYear();
			const mm = String(dt.getMonth() + 1).padStart(2, '0');
			const dd = String(dt.getDate()).padStart(2, '0');
			dates.push(`${yyyy}-${mm}-${dd}`);
		}
		return dates;
	});

	let keyColors = $derived.by(() => {
		const colors: Record<string, 'correct' | 'present' | 'absent'> = {};
		data.answers.forEach((answer, idx) => {
			const guess = data.guesses[idx];
			if (!guess) return;
			for (let k = 0; k < 5; k++) {
				const letter = guess[k];
				if (!letter) continue;
				if (answer[k] === 'x') {
					colors[letter] = 'correct';
				} else if (answer[k] === 'c' && colors[letter] !== 'correct') {
					colors[letter] = 'present';
				} else if (!colors[letter]) {
					colors[letter] = 'absent';
				}
			}
		});
		return colors;
	});

	function showToast(msg: string, duration = 1800) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), duration);
	}

	function pressKey(key: string) {
		if (over) return;
		if (key === 'backspace') {
			currentGuess = currentGuess.slice(0, -1);
			shake = false;
		} else if (currentGuess.length < 5) {
			currentGuess += key.toLowerCase();
		}
	}

	function keydown(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || over) return;
		const k = event.key.toLowerCase();
		if (k === 'enter') {
			if (!submittable) return;
			// let the form submit naturally
			document
				.querySelector<HTMLButtonElement>('[data-key="enter"]')
				?.closest('form')
				?.requestSubmit();
			return;
		}
		if (k === 'backspace') {
			pressKey('backspace');
			return;
		}
		if (/^[a-z]$/.test(k)) {
			pressKey(k);
		}
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function getDateLabel(dateStr: string): string {
		if (dateStr === today) return 'Today';
		if (dateStr === yesterday) return 'Yesterday';
		if (dateStr === tomorrow) return 'Tomorrow';
		return formatDate(dateStr);
	}

	const WIN_MESSAGES = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'];
</script>

<svelte:window onkeydown={keydown} />

<svelte:head>
	<title>Furdle</title>
	<meta name="description" content="A Wordle clone using NYT puzzles" />
</svelte:head>

<div class="app">
	<!-- Header -->
	<header>
		<div class="header-side">
			<button class="icon-btn" onclick={() => (showArchive = true)} aria-label="Open archive">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="3" y1="6" x2="21" y2="6" />
					<line x1="3" y1="12" x2="21" y2="12" />
					<line x1="3" y1="18" x2="21" y2="18" />
				</svg>
			</button>
		</div>
		<h1>Furdle</h1>
		<div class="header-side"></div>
	</header>

	<!-- Date Nav -->
	<nav class="date-nav">
		<a href="?date={yesterday}" class="date-btn" class:active={date === yesterday}>Yesterday</a>
		<a href="?date={today}" class="date-btn" class:active={date === today}>Today</a>
		<a href="?date={tomorrow}" class="date-btn" class:active={date === tomorrow}>Tomorrow</a>
	</nav>

	<!-- Toast -->
	{#if toast}
		<div class="toast" role="alert">{toast}</div>
	{/if}

	<main>
		{#if data.error}
			<div class="error-state">
				<p>{data.error}</p>
				<a href="?date={today}" class="btn-link">Play Today's Puzzle</a>
			</div>
		{:else}
			<!-- Board (outside form so tiles never accidentally submit) -->
			<div class="board" class:shake onanimationend={() => (shake = false)}>
				{#each board as rowTiles, row}
					<div class="row" class:current={row === rowIndex} class:flip={row === animatingRow}>
						{#each rowTiles as tile}
							<div class="tile" data-state={tile.state}>{tile.letter}</div>
						{/each}
					</div>
				{/each}
			</div>

			<!-- Game Over banner -->
			{#if over}
				<div class="game-over">
					{#if won}
						<p class="result-msg win">{WIN_MESSAGES[data.answers.length - 1] ?? 'Nice!'}</p>
					{:else}
						<p class="result-msg lose">{data.answer?.toUpperCase()}</p>
					{/if}
					<div class="game-over-actions">
						{#if date === today}
							<form method="post" action="?/restart">
								<input type="hidden" name="_date" value={date} />
								<button type="submit" class="restart-btn">Play Again</button>
							</form>
						{/if}
						{#if date !== today}
							<a href="?date={today}" class="today-btn">Play Today's</a>
						{/if}
					</div>
				</div>
			{:else}
				<!-- Guess submission form -->
				<form
					method="post"
					action="?/enter"
					use:enhance={() => {
						return ({ result, update: updatePage }) => {
							if (result.type === 'failure') {
								shake = true;
								if ((result.data as { badGuess?: boolean })?.badGuess) {
									showToast('Not in word list');
								}
							}
							updatePage({ reset: false });
						};
					}}
				>
					<input type="hidden" name="_date" value={date} />
					<input type="hidden" name="guess" value={currentGuess[0] ?? ''} />
					<input type="hidden" name="guess" value={currentGuess[1] ?? ''} />
					<input type="hidden" name="guess" value={currentGuess[2] ?? ''} />
					<input type="hidden" name="guess" value={currentGuess[3] ?? ''} />
					<input type="hidden" name="guess" value={currentGuess[4] ?? ''} />

					<!-- Keyboard -->
					<div class="keyboard">
						{#each ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as krow, rowIdx}
							<div class="key-row">
								{#if rowIdx === 2}
									<button
										type="submit"
										class="key wide"
										data-key="enter"
										class:selected={submittable}
										disabled={!submittable}
									>
										Enter
									</button>
								{/if}

								{#each krow as letter}
									<button
										type="button"
										class="key"
										class:correct={keyColors[letter] === 'correct'}
										class:present={keyColors[letter] === 'present'}
										class:absent={keyColors[letter] === 'absent'}
										data-key={letter}
										onclick={() => pressKey(letter)}
										aria-label={letter}
									>
										{letter.toUpperCase()}
									</button>
								{/each}

								{#if rowIdx === 2}
									<button
										type="button"
										class="key wide"
										data-key="backspace"
										aria-label="backspace"
										onclick={() => pressKey('backspace')}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
											<line x1="18" y1="9" x2="12" y2="15" />
											<line x1="12" y1="9" x2="18" y2="15" />
										</svg>
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</form>
			{/if}
		{/if}
	</main>

	<!-- Archive Modal -->
	{#if showArchive}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-backdrop" onclick={() => (showArchive = false)}>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="modal" onclick={(e) => e.stopPropagation()}>
				<div class="modal-header">
					<h2>Archive</h2>
					<button class="close-btn" onclick={() => (showArchive = false)} aria-label="Close">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
				<div class="archive-list">
					{#each archiveDates.slice(0, archiveDisplayCount) as archiveDate}
						<a
							href="?date={archiveDate}"
							class="archive-item"
							class:current-date={archiveDate === date}
							onclick={() => (showArchive = false)}
						>
							<span class="archive-date">{getDateLabel(archiveDate)}</span>
							<span class="archive-chevron">›</span>
						</a>
					{/each}
					{#if archiveDisplayCount < archiveDates.length}
						<button class="load-more-btn" onclick={() => (archiveDisplayCount += 10)}>
							Load More
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Confetti on win -->
	{#if won}
		<div
			style="position: fixed; left: 50%; top: 20%; pointer-events: none;"
			use:confetti={{
				particleCount: reducedMotion.current ? 0 : 100,
				force: 0.7,
				stageWidth: typeof window !== 'undefined' ? window.innerWidth : 500,
				stageHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
				colors: ['#6aaa64', '#c9b458', '#787c7e', '#538d4e']
			}}
		></div>
	{/if}
</div>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	:global(body) {
		margin: 0;
		background: #ffffff;
		color: #1a1a1b;
		font-family: 'Clear Sans', 'Helvetica Neue', Arial, sans-serif;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		align-items: center;
	}

	/* ── Header ── */
	header {
		width: 100%;
		max-width: 500px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		height: 50px;
		border-bottom: 1px solid #d3d6da;
		flex-shrink: 0;
	}

	.header-side {
		width: 44px;
		display: flex;
		align-items: center;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: 0.1rem;
		text-transform: uppercase;
		margin: 0;
		color: #1a1a1b;
	}

	.icon-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 6px;
		color: #1a1a1b;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.icon-btn:hover {
		background: #f5f5f5;
	}

	/* ── Date Nav ── */
	.date-nav {
		display: flex;
		gap: 4px;
		padding: 8px 12px;
		width: 100%;
		max-width: 500px;
	}

	.date-btn {
		flex: 1;
		text-align: center;
		padding: 6px 4px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border: 1.5px solid #d3d6da;
		border-radius: 4px;
		color: #1a1a1b;
		text-decoration: none;
		transition:
			background 0.15s,
			color 0.15s,
			border-color 0.15s;
	}

	.date-btn:hover {
		background: #f5f5f5;
		text-decoration: none;
	}

	.date-btn.active {
		background: #1a1a1b;
		color: #ffffff;
		border-color: #1a1a1b;
	}

	/* ── Toast ── */
	.toast {
		position: fixed;
		top: 70px;
		left: 50%;
		transform: translateX(-50%);
		background: #1a1a1b;
		color: #ffffff;
		padding: 10px 16px;
		border-radius: 6px;
		font-size: 0.85rem;
		font-weight: 700;
		z-index: 1000;
		pointer-events: none;
		white-space: nowrap;
	}

	/* ── Main ── */
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 100%;
		max-width: 500px;
		padding: 8px 0 12px;
		gap: 12px;
	}

	/* ── Board ── */
	.board {
		display: grid;
		grid-template-rows: repeat(6, 1fr);
		gap: 5px;
		padding: 4px 0;
		width: min(350px, calc(100vw - 24px));
		aspect-ratio: 5/6;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		10%,
		50%,
		90% {
			transform: translateX(-4px);
		}
		30%,
		70% {
			transform: translateX(4px);
		}
	}

	.board.shake {
		animation: shake 0.4s ease;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 5px;
	}

	/* ── Tile ── */
	.tile {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid #d3d6da;
		font-size: clamp(1.4rem, 6vw, 2rem);
		font-weight: 700;
		text-transform: uppercase;
		user-select: none;
		color: #1a1a1b;
		background: #ffffff;
	}

	.tile[data-state='filled'] {
		border-color: #878a8c;
	}

	@keyframes pop {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.12);
		}
	}

	.tile[data-state='filled'] {
		animation: pop 0.1s ease;
	}

	@keyframes flip-in {
		0% {
			transform: rotateX(0deg);
		}
		50% {
			transform: rotateX(-90deg);
		}
	}

	@keyframes flip-out {
		50% {
			transform: rotateX(-90deg);
		}
		100% {
			transform: rotateX(0deg);
		}
	}

	.tile[data-state='correct'],
	.tile[data-state='present'],
	.tile[data-state='absent'] {
		color: #ffffff;
	}

	.tile[data-state='correct'] {
		background: #6aaa64;
		border-color: #6aaa64;
	}

	.tile[data-state='present'] {
		background: #c9b458;
		border-color: #c9b458;
	}

	.tile[data-state='absent'] {
		background: #787c7e;
		border-color: #787c7e;
	}

	/* Flip animation only for newly submitted row */
	.row.flip .tile[data-state='correct'],
	.row.flip .tile[data-state='present'],
	.row.flip .tile[data-state='absent'] {
		animation:
			flip-in 0.25s ease forwards,
			flip-out 0.25s ease 0.25s forwards;
	}

	.row.flip .tile:nth-child(2)[data-state='correct'],
	.row.flip .tile:nth-child(2)[data-state='present'],
	.row.flip .tile:nth-child(2)[data-state='absent'] {
		animation-delay: 150ms, 400ms;
	}

	.row.flip .tile:nth-child(3)[data-state='correct'],
	.row.flip .tile:nth-child(3)[data-state='present'],
	.row.flip .tile:nth-child(3)[data-state='absent'] {
		animation-delay: 300ms, 550ms;
	}

	.row.flip .tile:nth-child(4)[data-state='correct'],
	.row.flip .tile:nth-child(4)[data-state='present'],
	.row.flip .tile:nth-child(4)[data-state='absent'] {
		animation-delay: 450ms, 700ms;
	}

	.row.flip .tile:nth-child(5)[data-state='correct'],
	.row.flip .tile:nth-child(5)[data-state='present'],
	.row.flip .tile:nth-child(5)[data-state='absent'] {
		animation-delay: 600ms, 850ms;
	}

	/* ── Game Over ── */
	.game-over {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.result-msg {
		font-size: 1.1rem;
		font-weight: 700;
		margin: 0;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.result-msg.win {
		color: #6aaa64;
	}

	.result-msg.lose {
		color: #1a1a1b;
	}

	.game-over-actions {
		display: flex;
		gap: 8px;
	}

	.restart-btn,
	.today-btn {
		padding: 10px 20px;
		background: #6aaa64;
		color: #ffffff;
		border: none;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		text-decoration: none;
		display: inline-block;
	}

	.restart-btn:hover,
	.today-btn:hover {
		background: #538d4e;
		text-decoration: none;
	}

	/* ── Keyboard form ── */
	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* ── Keyboard ── */
	.keyboard {
		width: min(500px, 100vw - 8px);
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 4px;
	}

	.key-row {
		display: flex;
		justify-content: center;
		gap: 6px;
	}

	.key {
		height: 58px;
		flex: 1;
		max-width: 43px;
		min-width: 0;
		border: none;
		border-radius: 4px;
		background: #d3d6da;
		color: #1a1a1b;
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.1s,
			color 0.1s;
		padding: 0;
		-webkit-tap-highlight-color: transparent;
	}

	.key:active {
		filter: brightness(0.85);
	}

	.key.wide {
		max-width: 65px;
		font-size: 0.72rem;
	}

	.key:disabled {
		cursor: default;
	}

	.key.correct {
		background: #6aaa64;
		color: #ffffff;
	}

	.key.present {
		background: #c9b458;
		color: #ffffff;
	}

	.key.absent {
		background: #787c7e;
		color: #ffffff;
	}

	.key.selected {
		background: #1a1a1b;
		color: #ffffff;
	}

	/* ── Error State ── */
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 40px 20px;
		color: #787c7e;
		text-align: center;
	}

	.btn-link {
		padding: 10px 20px;
		background: #1a1a1b;
		color: #ffffff;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.85rem;
		text-transform: uppercase;
	}

	/* ── Archive Modal ── */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 100;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 50px;
	}

	.modal {
		background: #ffffff;
		border-radius: 8px;
		width: min(440px, calc(100vw - 24px));
		max-height: calc(100dvh - 80px);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px;
		border-bottom: 1px solid #d3d6da;
		flex-shrink: 0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px;
		color: #1a1a1b;
		display: flex;
		align-items: center;
		border-radius: 4px;
	}

	.close-btn:hover {
		background: #f5f5f5;
	}

	.archive-list {
		overflow-y: auto;
		flex: 1;
	}

	.archive-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		border-bottom: 1px solid #f0f0f0;
		text-decoration: none;
		color: #1a1a1b;
		font-size: 0.9rem;
		font-weight: 600;
		transition: background 0.1s;
	}

	.archive-item:hover {
		background: #f5f5f5;
		text-decoration: none;
	}

	.archive-item.current-date {
		background: #f0f0f0;
	}

	.archive-chevron {
		color: #787c7e;
		font-size: 1.2rem;
	}

	.load-more-btn {
		width: 100%;
		padding: 14px;
		background: none;
		border: none;
		border-top: 1px solid #d3d6da;
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #1a1a1b;
		cursor: pointer;
		transition: background 0.1s;
	}

	.load-more-btn:hover {
		background: #f5f5f5;
	}
</style>
