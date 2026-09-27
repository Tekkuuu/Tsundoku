<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft, Plus, Trash2 } from '@lucide/svelte';
	import { series as seriesValidation } from '$lib/validation';
	import type { CreateSeriesBatch } from '$lib/validation/series';
	import { createSeriesBatch, getSeriesStatusText } from '$lib/components/forms/series';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { m } from '$lib/paraglide/messages';

	type BatchSeriesRow = {
		title?: string;
		author?: string;
		status?: (typeof seriesValidation.seriesStatusEnum.options)[number];
	};

	const statuses = seriesValidation.seriesStatusEnum.options;

	const rows = $derived((createSeriesBatch.fields.series.value() ?? []) as BatchSeriesRow[]);

	const fieldLabels: Record<string, () => string> = {
		title: m.series_batch_col_title,
		author: m.series_batch_col_author,
		status: m.series_batch_col_status
	};

	function issueLine(issue: { path: (string | number)[]; message: string }): string {
		const [, rowIndex, field] = issue.path;
		if (issue.path[0] === 'series' && typeof rowIndex === 'number' && typeof field === 'string') {
			const row = m.series_batch_error_row({ row: rowIndex + 1 });
			const label = fieldLabels[field]?.();
			return label ? `${row} · ${label}: ${issue.message}` : `${row}: ${issue.message}`;
		}
		return issue.message;
	}

	const errorLines = $derived((createSeriesBatch.fields.allIssues() ?? []).map(issueLine));

	function createRow(): BatchSeriesRow {
		return {
			title: '',
			author: '',
			status: statuses[0]
		};
	}

	let seeded = false;
	$effect(() => {
		if (seeded) return;
		seeded = true;
		createSeriesBatch.fields.series.set([createRow()]);
	});

	function addRow() {
		createSeriesBatch.fields.series.set([...rows, createRow()]);
	}

	function removeRow(index: number) {
		createSeriesBatch.fields.series.set(rows.filter((_, rowIndex) => rowIndex !== index));
	}

	const handleEnhance = createEnhanceHandler<CreateSeriesBatch, void>({
		success: m.dialog_series_batch_success(),
		invalidData: m.dialog_series_batch_invalid_data(),
		error: m.dialog_series_batch_error(),
		onSuccess: () => {
			void goto(resolve('/series'));
		}
	});
</script>

<main class="mx-auto max-w-full p-2">
	<div class="mb-2 flex items-center gap-2">
		<a
			href={resolve('/series')}
			class="btn preset-tonal"
			aria-label={m.common_cancel()}
			title={m.common_cancel()}
		>
			<ChevronLeft class="size-4" />
		</a>
		<div class="flex w-full items-center">
			<h1 class="text-2xl font-bold">{m.dialog_series_batch_title()}</h1>
		</div>
	</div>

	<div class="">
		<form
			{...createSeriesBatch.enhance(handleEnhance)}
			class="card preset-filled-surface-100-900 p-2"
		>
			<div class="overflow-x-auto rounded-base border border-surface-300-700">
				<table class="table min-w-2xl">
					<thead>
						<tr class="*:border-surface-300-700 [&>th:not(:last-child)]:border-r">
							<th>{m.series_batch_col_title()}</th>
							<th>{m.series_batch_col_author()}</th>
							<th class="w-36">{m.series_batch_col_status()}</th>
							<th class="w-12">
								<span class="sr-only">{m.series_batch_col_actions()}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, i (i)}
							<tr class="*:border-surface-300-700 *:p-0 [&>td:not(:last-child)]:border-r">
								<td>
									<input
										class="table-input"
										{...createSeriesBatch.fields.series[i].title.as('text')}
										placeholder={m.form_series_cu_title_placeholder()}
									/>
								</td>

								<td>
									<input
										class="table-input"
										{...createSeriesBatch.fields.series[i].author.as('text')}
										placeholder={m.form_series_cu_author_placeholder()}
									/>
								</td>

								<td>
									<select
										class="table-input"
										{...createSeriesBatch.fields.series[i].status.as(
											'select',
											row.status ?? statuses[0]
										)}
									>
										{#each statuses as opt (opt)}
											<option value={opt}>{getSeriesStatusText(opt)}</option>
										{/each}
									</select>
								</td>

								<td>
									<button
										type="button"
										class="btn btn-icon h-8 w-full rounded-none border-b border-surface-300-700 preset-tonal-error"
										onclick={() => removeRow(i)}
										aria-label={m.series_batch_removerow()}
										title={m.series_batch_removerow()}
									>
										<Trash2 class="size-4" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if errorLines.length > 0}
				<div class="alert mt-2 rounded-base preset-tonal-error p-2" role="alert">
					<h2 class="font-semibold">{m.series_batch_errors_title()}</h2>
					<ul class="mt-1 list-inside list-disc text-sm">
						{#each errorLines as line, index (index)}
							<li>{line}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="mt-2 flex items-center justify-between gap-2">
				<button type="button" class="btn preset-tonal" onclick={addRow}>
					<Plus class="size-4" />
					{m.series_batch_addrow()}
				</button>

				<div class="flex items-center gap-2">
					<a href={resolve('/series')} class="btn preset-tonal">
						{m.common_cancel()}
					</a>
					<button type="submit" class="btn preset-filled" disabled={rows.length === 0}>
						{m.dialog_series_batch_submit()}
					</button>
				</div>
			</div>
		</form>
	</div>
</main>
