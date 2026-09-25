<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft, Dot, Monitor, Plus, Trash2 } from '@lucide/svelte';
	import { book } from '$lib/validation';
	import type { BookStatus, CreateBooksBatch, ReadStatus } from '$lib/validation/book';
	import {
		createBooksBatch,
		getBookStatusText,
		getReadStatusText
	} from '$lib/components/forms/book';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
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

			<div class="overflow-x-auto rounded-base border border-surface-300-700">
				<table class="table min-w-6xl">
					<thead>
						<tr class="*:border-surface-300-700 [&>th:not(:last-child)]:border-r">
							<th class="w-24">{m.book_batch_col_volume()}</th>
							<th class="w-40">{m.book_batch_col_isbn()}</th>
							<th class="w-36">{m.book_batch_col_status()}</th>
							<th class="w-40">{m.book_batch_col_readstatus()}</th>
							<th class="w-64">{m.book_batch_col_cover()}</th>
							<th class="w-28">{m.book_batch_col_paid()}</th>
							<th class="w-28">{m.book_batch_col_original()}</th>
							<th class="w-24">{m.book_batch_col_currency()}</th>
							<th class="w-40">{m.book_batch_col_boughtat()}</th>
							<th class="w-12">
								<span class="sr-only">{m.book_batch_col_actions()}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each books as row, i (i)}
							{@const owned = row.status === 'Owned'}
							<tr class="*:border-surface-300-700 *:p-0 [&>td:not(:last-child)]:border-r">
								<td>
									<input
										class="table-input"
										{...createBooksBatch.fields.books[i].volumeNumber.as('number')}
										placeholder={m.form_book_cu_volume_placeholder()}
									/>
								</td>

								<td>
									<input
										class="table-input"
										{...createBooksBatch.fields.books[i].isbn.as('text')}
										placeholder={m.form_book_cu_isbn_placeholder()}
									/>
								</td>

								<td>
									<select
										class="table-input"
										{...createBooksBatch.fields.books[i].status.as('select', statuses[0])}
									>
										{#each statuses as opt (opt)}
											<option value={opt}>{getBookStatusText(opt)}</option>
										{/each}
									</select>
								</td>

								<td>
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

								<td>
									<input
										class="table-input"
										inputmode="decimal"
										{...createBooksBatch.fields.books[i].paidPrice.as('text')}
										placeholder={m.form_book_cu_paid_placeholder()}
									/>
								</td>

								<td>
									<input
										class="table-input"
										inputmode="decimal"
										{...createBooksBatch.fields.books[i].originalPrice.as('text')}
										placeholder={m.form_book_cu_original_placeholder()}
									/>
								</td>

								<td>
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

								<td>
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
					</tbody>
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
