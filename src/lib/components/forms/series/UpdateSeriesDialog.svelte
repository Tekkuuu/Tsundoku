<script lang="ts">
	import { series as seriesValidation } from '$lib/validation';
	import { Dialog } from '$lib/components/composition';
	import { m } from '$lib/paraglide/messages';
	import { getSeriesStatusText } from './utils';
	import { updateSeries } from './updateSeries.remote';
	import { type UpdateSeries } from '$lib/validation/series';
	import { createEnhanceHandler } from '$lib/utils/formUtils';

	type Props = {
		series: UpdateSeries;
		open?: boolean;
	};

	let { series, open = $bindable(false) }: Props = $props();

	const handleEnhance = createEnhanceHandler<UpdateSeries, void>({
		success: m.dialog_series_edit_success(),
		invalidData: m.dialog_series_edit_invalid_data(),
		error: m.dialog_series_edit_error(),
		onSuccess: () => {
			open = false;
		}
	});

	$effect(() => {
		updateSeries.fields.set({
			id: series.id,
			title: series.title ?? '',
			author: series.author ?? '',
			status: series.status ?? seriesValidation.seriesStatusEnum.options[0]
		});
	});
</script>

<Dialog bind:open>
	{#snippet dialogTitle()}
		{m.dialog_series_edit_title()}
	{/snippet}
	{#snippet content()}
		<form {...updateSeries.enhance(handleEnhance)} class="space-y-2">
			<input {...updateSeries.fields.id.as('hidden', series.id)} />
			<label class="label">
				<span class="label-text">{m.form_series_cu_title_label()}</span>
				<input
					class="input"
					placeholder={m.form_series_cu_title_placeholder()}
					{...updateSeries.fields.title.as('text')}
				/>
				{#each updateSeries.fields.title.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_series_cu_author_label()}</span>
				<input
					class="input"
					placeholder={m.form_series_cu_author_placeholder()}
					{...updateSeries.fields.author.as('text')}
				/>
				{#each updateSeries.fields.author.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_series_cu_status_label()}</span>
				<select class="select leading-6" {...updateSeries.fields.status.as('select')}>
					{#each seriesValidation.seriesStatusEnum.options as opt (opt)}
						<option value={opt}>{getSeriesStatusText(opt)}</option>
					{/each}
				</select>
				{#each updateSeries.fields.status.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<button type="submit" class="preset-filled-gradient-primary-secondary btn w-full">
				{m.dialog_series_edit_submit()}
			</button>
		</form>
	{/snippet}
</Dialog>
