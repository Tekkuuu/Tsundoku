<script lang="ts">
	import { series } from '$lib/validation';
	import { Dialog } from '$lib/components/composition';
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { getSeriesStatusText } from './utils';
	import { createSeries } from '$lib/components/forms/series/createSeries.remote';
	import { type CreateSeries } from '$lib/validation/series';
	import { createEnhanceHandler } from '$lib/utils/formUtils';

	type Props = {
		triggerClass?: string;
		children?: Snippet;
	};

	let { children, triggerClass }: Props = $props();

	let open = $state(false);

	const handleEnhance = createEnhanceHandler<CreateSeries, void>({
		success: m.dialog_series_add_success(),
		invalidData: m.dialog_series_add_invalid_data(),
		error: m.dialog_series_add_error(),
		onSuccess: () => {
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
				<select class="select leading-6" {...createSeries.fields.status.as('select')}>
					{#each series.seriesStatusEnum.options as opt (opt)}
						<option value={opt}>{getSeriesStatusText(opt)}</option>
					{/each}
				</select>
				{#each createSeries.fields.status.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<button type="submit" class="preset-filled-gradient-primary-secondary btn w-full">
				{m.dialog_series_add_submit()}
			</button>
		</form>
	{/snippet}
</Dialog>
