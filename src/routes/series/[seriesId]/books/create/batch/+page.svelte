<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft, Dot, Plus, Trash2 } from '@lucide/svelte';
	import { book } from '$lib/validation';
	import type { BookStatus, CreateBooksBatch, ReadStatus } from '$lib/validation/book';
	import {
		createBooksBatch,
		getBookStatusText,
		getReadStatusText
	} from '$lib/components/forms/book';
	import BatchBulkMenu, { type BulkTarget } from '$lib/components/BatchBulkMenu.svelte';
	import BatchRowMenu, { type BatchCell } from '$lib/components/BatchRowMenu.svelte';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { applyToRows, createRowSelection, formatIssueLines } from '$lib/utils/table';
	import { m } from '$lib/paraglide/messages';
	import BatchCoverField from './BatchCoverField.svelte';

	let { data } = $props();

	type BatchRow = {
		volumeNumber?: number;
		isbn?: string;
		status?: BookStatus;
		readStatus?: ReadStatus;
		coverFileId?: string;
		paidPrice?: string;
		originalPrice?: string;
		currencyCode?: string;
		boughtAt?: string;
	};

	type BookField =
		'isbn' | 'status' | 'readStatus' | 'paidPrice' | 'originalPrice' | 'currencyCode' | 'boughtAt';

	const statuses = book.bookStatusEnum.options;
	const readStatuses = book.readStatusEnum.options;
	const statusOptions = statuses.map((value) => ({ value, label: getBookStatusText(value) }));
	const readStatusOptions = readStatuses.map((value) => ({
		value,
		label: getReadStatusText(value)
	}));

	const books = $derived((createBooksBatch.fields.books.value() ?? []) as BatchRow[]);

	let coverErrors = $state<Record<number, string>>({});

	const fieldLabels: Record<string, () => string> = {
		volumeNumber: m.book_batch_col_volume,
		isbn: m.book_batch_col_isbn,
		status: m.book_batch_col_status,
		readStatus: m.book_batch_col_readstatus,
		coverFileId: m.book_batch_col_cover,
		paidPrice: m.book_batch_col_paid,
		originalPrice: m.book_batch_col_original,
		currencyCode: m.book_batch_col_currency,
		boughtAt: m.book_batch_col_boughtat
	};

	const selection = createRowSelection();
	const selectedCount = $derived(selection.indices.size);
	const allSelected = $derived(books.length > 0 && selection.indices.size === books.length);
	const someSelected = $derived(selection.indices.size > 0 && !allSelected);

	let selectAllEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (selectAllEl) selectAllEl.indeterminate = someSelected;
	});

	function setAllSelected(checked: boolean) {
		selection.replace(checked ? books.map((_, index) => index) : []);
	}

	function setCoverError(index: number, message: string) {
		if ((coverErrors[index] ?? '') === message) return;
		const next = { ...coverErrors };
		if (message) next[index] = message;
		else delete next[index];
		coverErrors = next;
	}

	const errorLines = $derived.by(() => [
		...formatIssueLines(createBooksBatch.fields.allIssues(), 'books', fieldLabels, (row) =>
			m.table_row_number({ row })
		),
		...Object.entries(coverErrors).map(
			([index, message]) =>
				`${m.table_row_number({ row: Number(index) + 1 })} · ${m.book_batch_col_cover()}: ${message}`
		)
	]);

	function createRow(previous?: BatchRow): BatchRow {
		const previousVolume = previous?.volumeNumber;
		return {
			volumeNumber:
				typeof previousVolume === 'number' ? previousVolume + 1 : (data.nextVolume ?? 1),
			isbn: '',
			status: previous?.status ?? statuses[0],
			readStatus: previous?.readStatus ?? readStatuses[0],
			coverFileId: '',
			paidPrice: previous?.paidPrice ?? '',
			originalPrice: previous?.originalPrice ?? '',
			currencyCode: previous?.currencyCode ?? '',
			boughtAt: ''
		};
	}

	// Read progress only exists on owned books.
	function patchRow(row: BatchRow, field: BookField, raw: string): BatchRow {
		switch (field) {
			case 'status': {
				const status = raw as BookStatus;
				return { ...row, status, readStatus: status === 'Owned' ? row.readStatus : 'Not Read' };
			}
			case 'readStatus': {
				if (row.status !== 'Owned') return { ...row, readStatus: 'Not Read' };
				return { ...row, readStatus: raw as ReadStatus };
			}
			case 'currencyCode':
				return { ...row, currencyCode: raw.toUpperCase() };
			default:
				return { ...row, [field]: raw };
		}
	}

	function applyValue(field: BookField, value: string, target: BulkTarget) {
		if (target === 'selected' && selectedCount === 0) return;
		coverErrors = {};
		createBooksBatch.fields.books.set(
			applyToRows(books, selection.indices, target, (row) => patchRow(row, field, value))
		);
	}

	function setCellValue(index: number, field: BookField, value: string) {
		coverErrors = {};
		createBooksBatch.fields.books.set(
			books.map((row, rowIndex) => (rowIndex === index ? patchRow(row, field, value) : row))
		);
	}

	function cellValue(cell: BatchCell): string {
		if (!cell.field) return '';
		const value = books[cell.rowIndex]?.[cell.field as keyof BatchRow];
		return value == null ? '' : String(value);
	}

	function deleteSelected() {
		coverErrors = {};
		createBooksBatch.fields.books.set(books.filter((_, index) => !selection.has(index)));
		selection.clear();
	}

	let seeded = false;
	$effect(() => {
		if (seeded) return;
		seeded = true;
		createBooksBatch.fields.books.set([createRow()]);
	});

	function addRow() {
		coverErrors = {};
		createBooksBatch.fields.books.set([...books, createRow(books.at(-1))]);
	}

	function insertRowBelow(index: number) {
		coverErrors = {};
		createBooksBatch.fields.books.set([
			...books.slice(0, index + 1),
			createRow(books[index]),
			...books.slice(index + 1)
		]);
		selection.afterInsert(index + 1);
	}

	function removeRow(index: number) {
		coverErrors = {};
		createBooksBatch.fields.books.set(books.filter((_, rowIndex) => rowIndex !== index));
		selection.afterRemove(index);
	}

	const handleEnhance = createEnhanceHandler<CreateBooksBatch, void>({
		success: m.dialog_book_batch_success(),
		invalidData: m.dialog_book_batch_invalid_data(),
		error: m.dialog_book_batch_error(),
		onSuccess: () => {
			void goto(resolve(`/series/${data.seriesInfo.id}`));
		}
	});
</script>

<main class="mx-auto max-w-full p-2">
	<div class="mb-2 flex items-center gap-2">
		<a
			href={resolve(`/series/${data.seriesInfo.id}`)}
			class="btn preset-tonal"
			aria-label={m.common_cancel()}
			title={m.common_cancel()}
		>
			<ChevronLeft class="size-4" />
		</a>
		<div class="flex w-full items-center">
			<h1 class="text-2xl font-bold">{m.dialog_book_batch_title()}</h1>
			<Dot />
			<p class="text-2xl font-bold">{data.seriesInfo.title}</p>
		</div>
	</div>

	<div class="">
		<form
			{...createBooksBatch.enhance(handleEnhance)}
			class="card preset-filled-surface-100-900 p-2"
		>
			<input {...createBooksBatch.fields.seriesId.as('hidden', data.seriesInfo.id)} />

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
				<table class="table min-w-6xl">
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
							<th class="w-24">{m.book_batch_col_volume()}</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_isbn()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_isbn()}
										kind="text"
										{selectedCount}
										onapply={(value, target) => applyValue('isbn', value, target)}
									/>
								</div>
							</th>
							<th class="w-36">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_status()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_status()}
										kind="select"
										options={statusOptions}
										{selectedCount}
										onapply={(value, target) => applyValue('status', value, target)}
									/>
								</div>
							</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_readstatus()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_readstatus()}
										kind="select"
										options={readStatusOptions}
										{selectedCount}
										onapply={(value, target) => applyValue('readStatus', value, target)}
									/>
								</div>
							</th>
							<th class="w-64">{m.book_batch_col_cover()}</th>
							<th class="w-28">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_paid()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_paid()}
										kind="text"
										{selectedCount}
										onapply={(value, target) => applyValue('paidPrice', value, target)}
									/>
								</div>
							</th>
							<th class="w-28">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_original()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_original()}
										kind="text"
										{selectedCount}
										onapply={(value, target) => applyValue('originalPrice', value, target)}
									/>
								</div>
							</th>
							<th class="w-24">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_currency()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_currency()}
										kind="text"
										{selectedCount}
										onapply={(value, target) => applyValue('currencyCode', value, target)}
									/>
								</div>
							</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_boughtat()}</span>
									<BatchBulkMenu
										label={m.book_batch_col_boughtat()}
										kind="month"
										{selectedCount}
										onapply={(value, target) => applyValue('boughtAt', value, target)}
									/>
								</div>
							</th>
							<th class="w-12">
								<span class="sr-only">{m.book_batch_col_actions()}</span>
							</th>
						</tr>
					</thead>

					<BatchRowMenu
						{fieldLabels}
						getCellValue={cellValue}
						oninsert={insertRowBelow}
						ondelete={removeRow}
						onpaste={(cell, text) => {
							if (cell.field) setCellValue(cell.rowIndex, cell.field as BookField, text);
						}}
					>
						{#snippet body()}
							{#each books as row, i (i)}
								{@const owned = row.status === 'Owned'}
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

									<td>
										<input
											class="table-input"
											{...createBooksBatch.fields.books[i].volumeNumber.as('number')}
											placeholder={m.form_book_cu_volume_placeholder()}
										/>
									</td>

									<td data-field="isbn">
										<input
											class="table-input"
											{...createBooksBatch.fields.books[i].isbn.as('text')}
											placeholder={m.form_book_cu_isbn_placeholder()}
										/>
									</td>

									<td data-field="status">
										<select
											class="table-input"
											{...createBooksBatch.fields.books[i].status.as('select', statuses[0])}
										>
											{#each statuses as opt (opt)}
												<option value={opt}>{getBookStatusText(opt)}</option>
											{/each}
										</select>
									</td>

									<td data-field="readStatus">
										<select
											class="table-input"
											{...createBooksBatch.fields.books[i].readStatus.as('select', readStatuses[0])}
										>
											{#each readStatuses as opt (opt)}
												<option value={opt} disabled={!owned && opt !== 'Not Read'}>
													{getReadStatusText(opt)}
												</option>
											{/each}
										</select>
									</td>

									<td>
										<BatchCoverField
											value={row.coverFileId ?? ''}
											onchange={(id) => createBooksBatch.fields.books[i].coverFileId.set(id)}
											onerror={(message) => setCoverError(i, message)}
										/>
										<input
											{...createBooksBatch.fields.books[i].coverFileId.as(
												'hidden',
												row.coverFileId ?? ''
											)}
										/>
									</td>

									<td data-field="paidPrice">
										<input
											class="table-input"
											inputmode="decimal"
											{...createBooksBatch.fields.books[i].paidPrice.as('text')}
											placeholder={m.form_book_cu_paid_placeholder()}
										/>
									</td>

									<td data-field="originalPrice">
										<input
											class="table-input"
											inputmode="decimal"
											{...createBooksBatch.fields.books[i].originalPrice.as('text')}
											placeholder={m.form_book_cu_original_placeholder()}
										/>
									</td>

									<td data-field="currencyCode">
										<input
											class="table-input uppercase"
											maxlength="3"
											{...createBooksBatch.fields.books[i].currencyCode.as('text')}
											placeholder={m.form_order_cu_currency_placeholder()}
											oninput={(event) => {
												event.currentTarget.value = event.currentTarget.value.toUpperCase();
											}}
										/>
									</td>

									<td data-field="boughtAt">
										<input
											class="table-input"
											{...createBooksBatch.fields.books[i].boughtAt.as('month')}
										/>
									</td>

									<td>
										<button
											type="button"
											class="btn btn-icon h-8 w-full rounded-none border-b border-surface-300-700 preset-tonal-error"
											onclick={() => removeRow(i)}
											aria-label={m.book_batch_removerow()}
											title={m.book_batch_removerow()}
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
					<h2 class="font-semibold">{m.book_batch_errors_title()}</h2>
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
					{m.book_batch_addrow()}
				</button>

				<div class="flex items-center gap-2">
					<a href={resolve(`/series/${data.seriesInfo.id}`)} class="btn preset-tonal">
						{m.common_cancel()}
					</a>
					<button type="submit" class="btn preset-filled" disabled={books.length === 0}>
						{m.dialog_book_batch_submit()}
					</button>
				</div>
			</div>
		</form>
	</div>
</main>
