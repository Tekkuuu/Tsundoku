<script lang="ts">
	import { resolve } from '$app/paths';
	import { refreshAll } from '$app/navigation';
	import { ArrowUpRight, Check } from '@lucide/svelte';
	import MonthInput from '#lib/components/form/MonthInput.svelte';
	import { updateBoughtAt } from '#lib/remote/books.remote.js';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { m } from '#lib/paraglide/messages.js';

	type UndatedRow = {
		id: string;
		seriesId: string;
		seriesTitle: string;
		volumeNumber: number;
		paidPrice: string | null;
		currencyCode: string | null;
	};

	let {
		row,
		formatPaid
	}: {
		row: UndatedRow;
		formatPaid: (currency: string | null, paid: string | null) => string;
	} = $props();

	let draft = $state('');
	let saving = $state(false);

	function saveBoughtAt() {
		if (!draft.trim() || saving) return;
		saving = true;
		const boughtAt = draft;
		const save = createRemoteActionHandler({
			success: m.books_undated_success(),
			error: m.books_undated_error(),
			run: () => updateBoughtAt({ id: row.id, boughtAt }),
			onSuccess: () => refreshAll()
		});
		save().finally(() => {
			saving = false;
		});
	}
</script>

<tr>
	<td class="max-w-60 truncate font-medium">{row.seriesTitle}</td>
	<td class="text-right whitespace-nowrap">{row.volumeNumber}</td>
	<td class="text-right whitespace-nowrap">{formatPaid(row.currencyCode, row.paidPrice)}</td>
	<td class="min-w-64">
		<div class="flex items-center gap-1">
			<MonthInput bind:value={draft} id="bought-at-{row.id}" disabled={saving} />
			<button
				type="button"
				class="btn shrink-0 self-stretch preset-filled-primary-500"
				aria-label={m.books_undated_save()}
				disabled={!draft.trim() || saving}
				onclick={saveBoughtAt}
			>
				<Check class="size-4" />
			</button>
		</div>
	</td>
	<td class="text-right whitespace-nowrap">
		<a
			href={resolve(`series/${row.seriesId}/${row.id}`)}
			class="btn h-10 preset-tonal"
			aria-label={m.books_undated_open_volume({
				title: row.seriesTitle,
				volumeNumber: row.volumeNumber
			})}
		>
			<ArrowUpRight class="size-4" />
		</a>
	</td>
</tr>
