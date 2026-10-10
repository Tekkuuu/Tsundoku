<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft, Plus, Trash2 } from '@lucide/svelte';
	import { series as seriesValidation } from '$lib/validation';
	import type { CreateSeriesBatch } from '$lib/validation/series';
	import { createSeriesBatch, getSeriesStatusText } from '$lib/components/forms/series';
	import BatchBulkMenu, { type BulkTarget } from '$lib/components/BatchBulkMenu.svelte';
	import BatchRowMenu, { type BatchCell } from '$lib/components/BatchRowMenu.svelte';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { applyToRows, createRowSelection, formatIssueLines } from '$lib/utils/table';
	import { m } from '$lib/paraglide/messages';

	type SeriesRow = {
		title?: string;
		author?: string;
		status?: (typeof seriesValidation.seriesStatusEnum.options)[number];
	};

	type SeriesField = 'title' | 'author' | 'status';

	const statuses = seriesValidation.seriesStatusEnum.options;
	const statusOptions = statuses.map((value) => ({ value, label: getSeriesStatusText(value) }));

	const rows = $derived((createSeriesBatch.fields.series.value() ?? []) as SeriesRow[]);

	const fieldLabels: Record<string, () => string> = {
		title: m.series_batch_col_title,
		author: m.series_batch_col_author,
		status: m.series_batch_col_status
	};

	const selection = createRowSelection();
	const selectedCount = $derived(selection.indices.size);
	const allSelected = $derived(rows.length > 0 && selection.indices.size === rows.length);
	const someSelected = $derived(selection.indices.size > 0 && !allSelected);

	let selectAllEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (selectAllEl) selectAllEl.indeterminate = someSelected;
	});

	function setAllSelected(checked: boolean) {
		selection.replace(checked ? rows.map((_, index) => index) : []);
	}

	const errorLines = $derived(
		formatIssueLines(createSeriesBatch.fields.allIssues(), 'series', fieldLabels, (row) =>
			m.table_row_number({ row })
		)
	);

	function createRow(): SeriesRow {
		return {
			title: '',
			author: '',
			status: statuses[0]
		};
	}

	function applyValue(field: SeriesField, value: string, target: BulkTarget) {
		if (target === 'selected' && selectedCount === 0) return;
		createSeriesBatch.fields.series.set(
			applyToRows(rows, selection.indices, target, (row) => ({ ...row, [field]: value }))
		);
	}

	function setCellValue(index: number, field: SeriesField, value: string) {
		createSeriesBatch.fields.series.set(
			rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
		);
	}

	function cellValue(cell: BatchCell): string {
		if (!cell.field) return '';
		const value = rows[cell.rowIndex]?.[cell.field as keyof SeriesRow];
		return value == null ? '' : String(value);
	}

	function deleteSelected() {
		createSeriesBatch.fields.series.set(rows.filter((_, index) => !selection.has(index)));
		selection.clear();
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

	function insertRowBelow(index: number) {
		createSeriesBatch.fields.series.set([
			...rows.slice(0, index + 1),
			createRow(),
			...rows.slice(index + 1)
		]);
		selection.afterInsert(index + 1);
	}

	function removeRow(index: number) {
		createSeriesBatch.fields.series.set(rows.filter((_, rowIndex) => rowIndex !== index));
		selection.afterRemove(index);
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
			<div class="mb-2 flex flex-wrap items-center gap-2 rounded-base preset-tonal p-2 text-sm">
				<span class="font-semibold">{m.table_selected_count({ count: selectedCount })}</span>
				<button
					type="button"
					class="btn preset-tonal"
					disabled={selectedCount === 0}
					onclick={() => selection.clear()}
				>
					{m.table_clear_selection()}
				</button>
				<button
					type="button"
					class="btn preset-tonal-error"
					disabled={selectedCount === 0}
					onclick={deleteSelected}
				>
					<Trash2 class="size-4" />
					{m.table_delete_selected()}
				</button>
			</div>

			<div class="overflow-x-auto rounded-base border border-surface-300-700">
				<table class="table min-w-2xl">
					<thead>
						<tr class="*:border-surface-300-700 [&>th:not(:last-child)]:border-r">
							<th class="w-10">
								<div class="flex items-center justify-center">
									<input
										bind:this={selectAllEl}
										type="checkbox"
										class="checkbox"
										checked={allSelected}
										onchange={(event) => setAllSelected(event.currentTarget.checked)}
										aria-label={m.table_select_all()}
										title={m.table_select_all()}
									/>
								</div>
							</th>
							<th>{m.series_batch_col_title()}</th>
							<th class="w-64">
								<div class="flex items-center justify-between gap-1">
									<span>{m.series_batch_col_author()}</span>
									<BatchBulkMenu
										label={m.series_batch_col_author()}
										kind="text"
										{selectedCount}
										onapply={(value, target) => applyValue('author', value, target)}
									/>
								</div>
							</th>
							<th class="w-36">
								<div class="flex items-center justify-between gap-1">
									<span>{m.series_batch_col_status()}</span>
									<BatchBulkMenu
										label={m.series_batch_col_status()}
										kind="select"
										options={statusOptions}
										{selectedCount}
										onapply={(value, target) => applyValue('status', value, target)}
									/>
								</div>
							</th>
							<th class="w-12">
								<span class="sr-only">{m.series_batch_col_actions()}</span>
							</th>
						</tr>
					</thead>

					<BatchRowMenu
						{fieldLabels}
						getCellValue={cellValue}
						oninsert={insertRowBelow}
						ondelete={removeRow}
						onpaste={(cell, text) => {
							if (cell.field) setCellValue(cell.rowIndex, cell.field as SeriesField, text);
						}}
					>
						{#snippet body()}
							{#each rows as row, i (i)}
								<tr
									data-row={i}
									class="*:border-surface-300-700 *:p-0 [&>td:not(:last-child)]:border-r"
								>
									<td>
										<div class="flex items-center justify-center p-1">
											<input
												type="checkbox"
												class="checkbox"
												checked={selection.has(i)}
												onchange={() => selection.toggle(i)}
												aria-label={m.table_select_row()}
											/>
										</div>
									</td>

									<td data-field="title">
										<input
											class="table-input"
											{...createSeriesBatch.fields.series[i].title.as('text')}
											placeholder={m.form_series_cu_title_placeholder()}
										/>
									</td>

									<td data-field="author">
										<input
											class="table-input"
											{...createSeriesBatch.fields.series[i].author.as('text')}
											placeholder={m.form_series_cu_author_placeholder()}
										/>
									</td>

									<td data-field="status">
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
						{/snippet}
					</BatchRowMenu>
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
