<script lang="ts">
	import { series } from '#lib/shared/validation/index.js';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getSeriesStatusText } from './series-labels';
	import GenreTagInput from './GenreTagInput.svelte';
	import { createSeries } from '#lib/remote/series.remote.js';
	import { type CreateSeries, type SeriesGenre } from '#lib/shared/validation/series.js';
	import { createEnhanceHandler } from '#lib/client/form-handlers.js';

	type Props = {
		triggerClass?: string;
		children?: Snippet;
	};

	let { children, triggerClass }: Props = $props();

	let open = $state(false);
	let selectedGenres = $state<SeriesGenre[]>([]);
	let pendingGenres = $state(0);

	$effect(() => {
		if (!open && pendingGenres === 0) selectedGenres = [];
	});

	const handleEnhance = createEnhanceHandler<CreateSeries, void>({
		success: m.dialog_series_add_success(),
		invalidData: m.dialog_series_add_invalid_data(),
		error: m.dialog_series_add_error(),
		onSuccess: () => {
			selectedGenres = [];
			open = false;
		}
	});
</script>

<Dialog bind:open {triggerClass}>
	{#snippet trigger()}
		{@render children?.()}
	{/snippet}
	{#snippet dialogTitle()}
		{m.dialog_series_add_title()}
	{/snippet}
	{#snippet content()}
		<form {...createSeries.enhance(handleEnhance)} class="space-y-2">
			<label class="label">
				<span class="label-text">{m.form_series_cu_title_label()}</span>
				<input
					class="input"
					{...createSeries.fields.title.as('text')}
					placeholder={m.form_series_cu_title_placeholder()}
				/>
				{#each createSeries.fields.title.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_series_cu_author_label()}</span>
				<input
					class="input"
					{...createSeries.fields.author.as('text')}
					placeholder={m.form_series_cu_author_placeholder()}
				/>
				{#each createSeries.fields.author.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_series_cu_status_label()}</span>
				<select class="select" {...createSeries.fields.status.as('select')}>
					{#each series.seriesStatusEnum.options as opt (opt)}
						<option value={opt}>{getSeriesStatusText(opt)}</option>
					{/each}
				</select>
				{#each createSeries.fields.status.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<div>
				<GenreTagInput bind:genres={selectedGenres} bind:pending={pendingGenres} />
				{#each selectedGenres.filter((genre) => genre.id) as genre (genre.id)}
					<input
						type="hidden"
						name={createSeries.fields.genres.as('checkbox', 'placeholder').name}
						value={genre.id}
					/>
				{/each}
				{#each createSeries.fields.genres.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</div>

			<button
				type="submit"
				class="btn w-full preset-filled-primary-500"
				disabled={pendingGenres > 0}
			>
				{m.dialog_series_add_submit()}
			</button>
		</form>
	{/snippet}
</Dialog>
