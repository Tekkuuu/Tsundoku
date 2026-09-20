<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft, ChevronRight, Lock } from '@lucide/svelte';
	import { Portal, Steps, Tooltip } from '@skeletonlabs/skeleton-svelte';
	import { book as bookValidation } from '$lib/validation';
	import type { BookStatus, UpdateBook } from '$lib/validation/book';
	import { formatBoughtAtMonth } from '$lib/validation/book';
	import { updateBook, getBookStatusText, getReadStatusText } from '$lib/components/forms/book';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { m } from '$lib/paraglide/messages';
	import MonthInput from '$lib/components/MonthInput.svelte';
	import CurrencyCodeInput from '$lib/components/CurrencyCodeInput.svelte';
	import FileAttachment from '$lib/components/forms/FileAttachment.svelte';

	let { data } = $props();

	let step = $state(0);
	let boughtAtValue = $state(untrack(() => formatBoughtAtMonth(data.bookInfo.boughtAt) ?? ''));
	let coverFileId = $state(untrack(() => data.bookInfo.coverFileId ?? ''));
	let selectedStatus = $state<BookStatus>(untrack(() => data.bookInfo.status));

	$effect(() => {
		updateBook.fields.set({
			id: data.bookInfo.id,
			volumeNumber: data.bookInfo.volumeNumber,
			seriesId: data.seriesInfo.id,
			coverFileId: data.bookInfo.coverFileId ?? '',
			isbn: data.bookInfo.isbn ?? '',
			status: data.bookInfo.status,
			readStatus: data.bookInfo.readStatus,
			currencyCode: data.bookInfo.currencyCode ?? '',
			paidPrice: data.bookInfo.paidPrice ?? '',
			originalPrice: data.bookInfo.originalPrice ?? '',
			boughtAt: formatBoughtAtMonth(data.bookInfo.boughtAt) ?? ''
		});
	});

	$effect(() => {
		updateBook.fields.boughtAt.set(boughtAtValue);
	});

	$effect(() => {
		updateBook.fields.coverFileId.set(coverFileId);
	});

	const statusValue = $derived(
		updateBook.fields.status.value() ?? bookValidation.bookStatusEnum.options[0]
	);
	const readStatusValue = $derived(
		updateBook.fields.readStatus.value() ?? bookValidation.readStatusEnum.options[0]
	);
	const coverPreview = $derived(coverFileId ? `/files/${coverFileId}` : null);
	const paidDisplay = $derived.by(() => {
		const paid = updateBook.fields.paidPrice.value();
		if (!paid) return '—';
		const currency = updateBook.fields.currencyCode.value();
		return currency ? `${paid} ${currency}` : paid;
	});
	const originalDisplay = $derived.by(() => {
		const original = updateBook.fields.originalPrice.value();
		if (!original) return '—';
		const currency = updateBook.fields.currencyCode.value();
		return currency ? `${original} ${currency}` : original;
	});

	const issueStep: Record<string, number> = {
		volumeNumber: 0,
		isbn: 0,
		status: 0,
		readStatus: 0,
		coverFileId: 1,
		paidPrice: 2,
		originalPrice: 2,
		currencyCode: 2,
		boughtAt: 2
	};

	const handleEnhance = createEnhanceHandler<UpdateBook, void>({
		success: m.dialog_book_edit_success(),
		invalidData: m.dialog_book_edit_invalid_data(),
		error: m.dialog_book_edit_error(),
		reset: false,
		onInvalidData: () => {
			const issues = updateBook.fields.allIssues() ?? [];
			const stepIndexes = issues.map((issue) => issueStep[String(issue.path[0] ?? '')] ?? 0);
			if (stepIndexes.length > 0) {
				step = Math.min(...stepIndexes);
			}
		},
		onSuccess: () => {
			void goto(resolve(`/series/${data.seriesInfo.id}/${data.bookInfo.id}`));
		}
	});
</script>

<main class="mx-auto max-w-4xl p-4">
	<div class="mb-4 flex items-center gap-3">
		<a
			href={resolve(`/series/${data.seriesInfo.id}/${data.bookInfo.id}`)}
			class="btn preset-tonal btn-sm"
			aria-label={m.common_cancel()}
			title={m.common_cancel()}
		>
			<ChevronLeft class="size-4" />
		</a>
		<h1 class="text-2xl font-bold">{m.dialog_book_edit_title()}</h1>
	</div>

	<form {...updateBook.enhance(handleEnhance)} class="card preset-filled-surface-100-900 p-4">
		<input {...updateBook.fields.id.as('hidden', data.bookInfo.id)} />
		<input {...updateBook.fields.seriesId.as('hidden', data.seriesInfo.id)} />

		<Steps {step} onStepChange={(details) => (step = details.step)} count={3} class="w-full">
			<Steps.List>
				<Steps.Item index={0}>
					<Steps.Trigger type="button">
						<Steps.Indicator>1</Steps.Indicator>
						<span class="hidden sm:inline">{m.book_form_step_details()}</span>
					</Steps.Trigger>
					<Steps.Separator />
				</Steps.Item>
				<Steps.Item index={1}>
					<Steps.Trigger type="button">
						<Steps.Indicator>2</Steps.Indicator>
						<span class="hidden sm:inline">{m.book_form_step_cover()}</span>
					</Steps.Trigger>
					<Steps.Separator />
				</Steps.Item>
				<Steps.Item index={2}>
					<Steps.Trigger type="button">
						<Steps.Indicator>3</Steps.Indicator>
						<span class="hidden sm:inline">{m.book_form_step_purchase()}</span>
					</Steps.Trigger>
				</Steps.Item>
			</Steps.List>

			<Steps.Content index={0} class="pt-4">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<label class="label">
						<span class="label-text">{m.form_book_cu_volume_label()}</span>
						<input
							class="input"
							placeholder={m.form_book_cu_volume_placeholder()}
							{...updateBook.fields.volumeNumber.as('number')}
						/>
						{#each updateBook.fields.volumeNumber.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>

					<label class="label">
						<span class="label-text">{m.form_book_cu_isbn_label()}</span>
						<input
							class="input"
							placeholder={m.form_book_cu_isbn_placeholder()}
							{...updateBook.fields.isbn.as('text')}
						/>
						{#each updateBook.fields.isbn.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>

					<label class="label">
						<span class="label-text">{m.form_book_cu_status_label()}</span>
						<select
							class="select leading-6"
							{...updateBook.fields.status.as('select')}
							onchange={(e) => (selectedStatus = e.currentTarget.value as BookStatus)}
						>
							{#each bookValidation.bookStatusEnum.options as opt (opt)}
								<option value={opt}>{getBookStatusText(opt)}</option>
							{/each}
						</select>
						{#each updateBook.fields.status.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>

					<label class="label">
						<span class="label-text">{m.form_book_cu_readstatus_label()}</span>
						<select class="select leading-6" {...updateBook.fields.readStatus.as('select')}>
							{#each bookValidation.readStatusEnum.options as opt (opt)}
								<option value={opt} disabled={selectedStatus !== 'Owned' && opt !== 'Not Read'}
									>{getReadStatusText(opt)}</option
								>
							{/each}
						</select>
						{#each updateBook.fields.readStatus.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>
				</div>
			</Steps.Content>

			<Steps.Content index={1} class="pt-4">
				<div class="space-y-3">
					<FileAttachment kind="cover" bind:value={coverFileId} />
					<input {...updateBook.fields.coverFileId.as('hidden', coverFileId)} />
					{#each updateBook.fields.coverFileId.issues() ?? [] as issue (issue.message)}
						<p class="text-sm text-error-500">{issue.message}</p>
					{/each}
				</div>
			</Steps.Content>

			<Steps.Content index={2} class="pt-4">
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<label class="label">
						<span class="label-text">{m.form_book_cu_paid_label()}</span>
						<input
							class="input"
							inputmode="decimal"
							step="0.01"
							{...updateBook.fields.paidPrice.as('text')}
							placeholder={m.form_book_cu_paid_placeholder()}
						/>
						{#each updateBook.fields.paidPrice.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>

					<label class="label">
						<span class="label-text">{m.form_book_cu_original_label()}</span>
						<input
							class="input"
							inputmode="decimal"
							step="0.01"
							{...updateBook.fields.originalPrice.as('text')}
							placeholder={m.form_book_cu_original_placeholder()}
						/>
						{#each updateBook.fields.originalPrice.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>

					<div class={[data.bookOrder && 'grid grid-cols-[auto_1fr] gap-2']}>
						{#if data.bookOrder}
							<Tooltip>
								<div class="flex flex-col justify-end">
									<Tooltip.Trigger
										type="button"
										class="btn aspect-square preset-tonal"
										aria-label={m.common_currency_locked_aria()}
									>
										<Lock class="size-4" />
									</Tooltip.Trigger>
								</div>
								<Portal>
									<Tooltip.Positioner>
										<Tooltip.Content
											class="z-100 max-w-60 card border border-surface-200-800 preset-filled-surface-50-950 p-2 text-sm shadow-xl"
										>
											{m.form_book_cu_currency_locked_tooltip()}
										</Tooltip.Content>
									</Tooltip.Positioner>
								</Portal>
							</Tooltip>
						{/if}
						<CurrencyCodeInput
							disabled={data.bookOrder !== null}
							bind:selected={
								() => updateBook.fields.currencyCode.value() || null,
								(v) => updateBook.fields.currencyCode.set(v ?? undefined)
							}
						/>
						<input
							{...updateBook.fields.currencyCode.as(
								'hidden',
								updateBook.fields.currencyCode.value() ?? ''
							)}
						/>
						{#each updateBook.fields.currencyCode.issues() as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</div>

					<label class="label">
						<span class="label-text">{m.form_book_cu_boughtat_label()}</span>
						<MonthInput bind:value={boughtAtValue} id="update-book-boughtAt" />
						<input {...updateBook.fields.boughtAt.as('hidden', boughtAtValue)} />
						<span class="text-xs text-surface-500">{m.form_book_cu_boughtat_help()}</span>
						{#each updateBook.fields.boughtAt.issues() ?? [] as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</label>
				</div>
			</Steps.Content>

			<Steps.Content index={3} class="pt-4">
				<h2 class="text-lg font-semibold">{m.book_form_step_review()}</h2>
				<p class="mb-3 text-sm opacity-70">{m.book_form_review_hint()}</p>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr]">
					<div class="mx-auto w-32 shrink-0 sm:mx-0">
						{#if coverPreview}
							<img
								src={coverPreview}
								alt={m.form_file_upload_preview_alt()}
								class="aspect-2/3 w-full rounded object-cover shadow-md"
							/>
						{:else}
							<div
								class="flex aspect-2/3 w-full items-center justify-center card p-2 text-center text-xs opacity-60"
							>
								{m.book_form_review_no_cover()}
							</div>
						{/if}
					</div>

					<dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_series_label()}</dt>
							<dd class="font-medium">{data.seriesInfo.title}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_volume_label()}</dt>
							<dd class="font-medium">{updateBook.fields.volumeNumber.value() ?? '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_isbn_label()}</dt>
							<dd class="font-medium">{updateBook.fields.isbn.value() || '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_status_label()}</dt>
							<dd class="font-medium">{getBookStatusText(statusValue)}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_readstatus_label()}</dt>
							<dd class="font-medium">{getReadStatusText(readStatusValue)}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_boughtat_label()}</dt>
							<dd class="font-medium">{boughtAtValue || '—'}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_paid_label()}</dt>
							<dd class="font-medium">{paidDisplay}</dd>
						</div>
						<div>
							<dt class="text-sm text-surface-500">{m.form_book_cu_original_label()}</dt>
							<dd class="font-medium">{originalDisplay}</dd>
						</div>
					</dl>
				</div>
			</Steps.Content>

			<div class="mt-4 flex items-center justify-between gap-2">
				<Steps.PrevTrigger class="btn preset-tonal">
					<ChevronLeft class="size-4" />
					{m.common_back()}
				</Steps.PrevTrigger>
				{#if step < 3}
					<Steps.NextTrigger class="btn preset-filled">
						{m.common_next()}
						<ChevronRight class="size-4" />
					</Steps.NextTrigger>
				{:else}
					<button type="submit" class="btn preset-filled">
						{m.dialog_book_edit_submit()}
					</button>
				{/if}
			</div>
		</Steps>
	</form>
</main>
