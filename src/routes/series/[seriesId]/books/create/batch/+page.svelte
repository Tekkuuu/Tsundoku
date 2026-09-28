<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronLeft, Dot, Plus, Trash2 } from '@lucide/svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { book } from '$lib/validation';
	import type { BookStatus, CreateBooksBatch, ReadStatus } from '$lib/validation/book';
	import {
		createBooksBatch,
		getBookStatusText,
		getReadStatusText
	} from '$lib/components/forms/book';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { toaster } from '$lib/components/toaster';
	import { m } from '$lib/paraglide/messages';
	import BatchCoverField from './BatchCoverField.svelte';
	import BatchBulkMenu, { type BulkMenuField, type BulkTarget } from './BatchBulkMenu.svelte';

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

	const statuses = book.bookStatusEnum.options;
	const readStatuses = book.readStatusEnum.options;

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

	function issueLine(issue: { path: (string | number)[]; message: string }): string {
		const [, rowIndex, field] = issue.path;
		if (issue.path[0] === 'books' && typeof rowIndex === 'number' && typeof field === 'string') {
			const row = m.book_batch_error_row({ row: rowIndex + 1 });
			const label = fieldLabels[field]?.();
			return label ? `${row} · ${label}: ${issue.message}` : `${row}: ${issue.message}`;
		}
		return issue.message;
	}

	const errorLines = $derived.by(() => [
		...(createBooksBatch.fields.allIssues() ?? []).map(issueLine),
		...Object.entries(coverErrors).map(
			([index, message]) =>
				`${m.book_batch_error_row({ row: Number(index) + 1 })} · ${m.book_batch_col_cover()}: ${message}`
		)
	]);

	function setCoverError(index: number, message: string) {
		if ((coverErrors[index] ?? '') === message) return;
		const next = { ...coverErrors };
		if (message) next[index] = message;
		else delete next[index];
		coverErrors = next;
	}

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

	const selected = new SvelteSet<number>();
	const selectedCount = $derived(selected.size);
	const allSelected = $derived(books.length > 0 && selected.size === books.length);
	const someSelected = $derived(selected.size > 0 && !allSelected);

	let selectAllEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		if (selectAllEl) selectAllEl.indeterminate = someSelected;
	});

	function toggleRow(index: number) {
		if (selected.has(index)) selected.delete(index);
		else selected.add(index);
	}

	function replaceSelection(indices: Iterable<number>) {
		selected.clear();
		for (const index of indices) selected.add(index);
	}

	function setAllSelected(checked: boolean) {
		replaceSelection(checked ? books.map((_, index) => index) : []);
	}

	function clearSelection() {
		selected.clear();
	}

	function shiftSelectionOnRemove(index: number) {
		const next: number[] = [];
		for (const i of selected) {
			if (i === index) continue;
			next.push(i > index ? i - 1 : i);
		}
		replaceSelection(next);
	}

	function shiftSelectionOnInsert(index: number) {
		const next: number[] = [];
		for (const i of selected) next.push(i >= index ? i + 1 : i);
		replaceSelection(next);
	}

	// Read progress only exists on owned books.
	function patchRow(row: BatchRow, field: BulkMenuField, raw: string): BatchRow {
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

	function applyValue(field: BulkMenuField, value: string, target: BulkTarget) {
		if (target === 'selected' && selectedCount === 0) return;
		coverErrors = {};
		createBooksBatch.fields.books.set(
			books.map((row, index) => {
				if (target === 'selected' && !selected.has(index)) return row;
				return patchRow(row, field, value);
			})
		);
	}

	function setCellValue(index: number, field: BulkMenuField, value: string) {
		coverErrors = {};
		createBooksBatch.fields.books.set(
			books.map((row, rowIndex) => (rowIndex === index ? patchRow(row, field, value) : row))
		);
	}

	type CellMenuState = { rowIndex: number; field: BulkMenuField | null };
	let activeCell = $state<CellMenuState | null>(null);

	function captureCellMenu(event: MouseEvent) {
		const element = event.target as HTMLElement | null;
		const rowEl = element?.closest<HTMLElement>('[data-row]');
		if (!rowEl) {
			activeCell = null;
			return;
		}
		const field = element?.closest<HTMLElement>('[data-field]')?.dataset.field as
			BulkMenuField | undefined;
		activeCell = { rowIndex: Number(rowEl.dataset.row), field: field ?? null };
	}

	const cellValue = $derived.by(() => {
		const cell = activeCell;
		if (!cell?.field) return '';
		const row = books[cell.rowIndex];
		if (!row) return '';
		const value = row[cell.field];
		return value == null ? '' : String(value);
	});

	function handleCellMenuSelect(event: { value: string }) {
		const cell = activeCell;
		if (!cell) return;
		switch (event.value) {
			case 'apply-selected':
				if (cell.field) applyValue(cell.field, cellValue, 'selected');
				break;
			case 'apply-all':
				if (cell.field) applyValue(cell.field, cellValue, 'all');
				break;
			case 'copy':
				void copyCellValue();
				break;
			case 'paste':
				void pasteCellValue();
				break;
			case 'insert':
				insertRowBelow(cell.rowIndex);
				break;
			case 'delete':
				removeRow(cell.rowIndex);
				break;
		}
	}

	async function copyCellValue() {
		try {
			await navigator.clipboard.writeText(cellValue);
		} catch {
			toaster.error({ title: m.toast_title_error(), description: m.book_batch_clipboard_error() });
		}
	}

	async function pasteCellValue() {
		const cell = activeCell;
		if (!cell?.field) return;
		try {
			const text = await navigator.clipboard.readText();
			if (text) setCellValue(cell.rowIndex, cell.field, text.replace(/[\r\n]+/g, ' ').trim());
		} catch {
			toaster.error({ title: m.toast_title_error(), description: m.book_batch_clipboard_error() });
		}
	}

	function insertRowBelow(index: number) {
		coverErrors = {};
		createBooksBatch.fields.books.set([
			...books.slice(0, index + 1),
			createRow(books[index]),
			...books.slice(index + 1)
		]);
		shiftSelectionOnInsert(index + 1);
	}

	function deleteSelected() {
		coverErrors = {};
		createBooksBatch.fields.books.set(books.filter((_, index) => !selected.has(index)));
		selected.clear();
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

	function removeRow(index: number) {
		coverErrors = {};
		createBooksBatch.fields.books.set(books.filter((_, rowIndex) => rowIndex !== index));
		shiftSelectionOnRemove(index);
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

{#snippet batchRows(attrs: SvelteHTMLElements['button'])}
	<tbody {...attrs as SvelteHTMLElements['tbody']}>
		{#each books as row, i (i)}
			{@const owned = row.status === 'Owned'}
			<tr data-row={i} class="*:border-surface-300-700 *:p-0 [&>td:not(:last-child)]:border-r">
				<td>
					<div class="flex items-center justify-center p-1">
						<input
							type="checkbox"
							class="checkbox"
							checked={selected.has(i)}
							onchange={() => toggleRow(i)}
							aria-label={m.book_batch_select_row()}
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
						{...createBooksBatch.fields.books[i].coverFileId.as('hidden', row.coverFileId ?? '')}
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
					<input class="table-input" {...createBooksBatch.fields.books[i].boughtAt.as('month')} />
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
	</tbody>
{/snippet}

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
				<span class="font-semibold">{m.book_batch_selected_count({ count: selectedCount })}</span>
				<button
					type="button"
					class="btn preset-tonal"
					disabled={selectedCount === 0}
					onclick={clearSelection}
				>
					{m.book_batch_clear_selection()}
				</button>
				<button
					type="button"
					class="btn preset-tonal-error"
					disabled={selectedCount === 0}
					onclick={deleteSelected}
				>
					<Trash2 class="size-4" />
					{m.book_batch_delete_selected()}
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
										aria-label={m.book_batch_select_all()}
										title={m.book_batch_select_all()}
									/>
								</div>
							</th>
							<th class="w-24">{m.book_batch_col_volume()}</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_isbn()}</span>
									<BatchBulkMenu
										field="isbn"
										label={m.book_batch_col_isbn()}
										{selectedCount}
										onapply={(value, target) => applyValue('isbn', value, target)}
									/>
								</div>
							</th>
							<th class="w-36">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_status()}</span>
									<BatchBulkMenu
										field="status"
										label={m.book_batch_col_status()}
										{selectedCount}
										onapply={(value, target) => applyValue('status', value, target)}
									/>
								</div>
							</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_readstatus()}</span>
									<BatchBulkMenu
										field="readStatus"
										label={m.book_batch_col_readstatus()}
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
										field="paidPrice"
										label={m.book_batch_col_paid()}
										{selectedCount}
										onapply={(value, target) => applyValue('paidPrice', value, target)}
									/>
								</div>
							</th>
							<th class="w-28">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_original()}</span>
									<BatchBulkMenu
										field="originalPrice"
										label={m.book_batch_col_original()}
										{selectedCount}
										onapply={(value, target) => applyValue('originalPrice', value, target)}
									/>
								</div>
							</th>
							<th class="w-24">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_currency()}</span>
									<BatchBulkMenu
										field="currencyCode"
										label={m.book_batch_col_currency()}
										{selectedCount}
										onapply={(value, target) => applyValue('currencyCode', value, target)}
									/>
								</div>
							</th>
							<th class="w-40">
								<div class="flex items-center justify-between gap-1">
									<span>{m.book_batch_col_boughtat()}</span>
									<BatchBulkMenu
										field="boughtAt"
										label={m.book_batch_col_boughtat()}
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

					<Menu positioning={{ placement: 'bottom-start' }} onSelect={handleCellMenuSelect}>
						<Menu.ContextTrigger element={batchRows} oncontextmenu={captureCellMenu} />
						<Portal>
							<Menu.Positioner>
								<Menu.Content
									class="z-50 space-y-1 card border border-surface-300-700 bg-surface-50-950 p-2 shadow-xl"
								>
									{#if activeCell}
										<p class="p-2 text-xs font-semibold text-surface-500 uppercase">
											{activeCell.field ? fieldLabels[activeCell.field]?.() : ''}
											· {m.book_batch_error_row({ row: activeCell.rowIndex + 1 })}
										</p>

										{#if activeCell.field}
											<Menu.Item
												value="apply-selected"
												disabled={selectedCount === 0}
												class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950 disabled:opacity-50"
											>
												<Menu.ItemText>
													{m.book_batch_apply_selected()}
													{#if selectedCount > 0}<span class="text-surface-500"
															>({selectedCount})</span
														>{/if}
												</Menu.ItemText>
											</Menu.Item>
											<Menu.Item
												value="apply-all"
												class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
											>
												<Menu.ItemText>{m.book_batch_apply_all()}</Menu.ItemText>
											</Menu.Item>
											<Menu.Item
												value="copy"
												class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
											>
												<Menu.ItemText>{m.book_batch_copy_value()}</Menu.ItemText>
											</Menu.Item>
											<Menu.Item
												value="paste"
												class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
											>
												<Menu.ItemText>{m.book_batch_paste_value()}</Menu.ItemText>
											</Menu.Item>
											<Menu.Separator class="border-surface-300-700" />
										{/if}

										<Menu.Item
											value="insert"
											class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
										>
											<Menu.ItemText>{m.book_batch_insert_below()}</Menu.ItemText>
										</Menu.Item>
										<Menu.Item
											value="delete"
											class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
										>
											<Menu.ItemText>{m.book_batch_delete_row()}</Menu.ItemText>
										</Menu.Item>
									{/if}
								</Menu.Content>
							</Menu.Positioner>
						</Portal>
					</Menu>
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
