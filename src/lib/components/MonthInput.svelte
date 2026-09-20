<script lang="ts">
	import { X } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	type Props = {
		/** Month value in `YYYY-MM` format. Empty string means "no date". */
		value?: string;
		/** Base id — the two selects get `{id}-month` / `{id}-year`. */
		id?: string;
		disabled?: boolean;
		minYear?: number;
		maxYear?: number;
	};

	const currentYear = new Date().getFullYear();
	const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

	let {
		value = $bindable(''),
		id = 'month-input',
		disabled = false,
		minYear = currentYear - 60,
		maxYear = currentYear + 2
	}: Props = $props();

	const parsed = $derived(/^(\d{4})-(0[1-9]|1[0-2])$/.exec((value ?? '').trim()));
	const selectedMonth = $derived(parsed?.[2] ?? '');
	const selectedYear = $derived(parsed?.[1] ?? '');

	const locale = getLocale();
	const months = Array.from({ length: 12 }, (_, index) => ({
		value: String(index + 1).padStart(2, '0'),
		label: new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, index, 1))
	}));

	const years = $derived(
		Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, index) =>
			String(maxYear - index)
		)
	);

	function handleMonthChange(event: Event) {
		const nextMonth = (event.currentTarget as HTMLSelectElement).value;
		if (!nextMonth) {
			value = '';
			return;
		}
		value = `${selectedYear || String(currentYear)}-${nextMonth}`;
	}

	function handleYearChange(event: Event) {
		const nextYear = (event.currentTarget as HTMLSelectElement).value;
		if (!nextYear) {
			value = '';
			return;
		}
		value = `${nextYear}-${selectedMonth || currentMonth}`;
	}
</script>

<div class="grid grid-cols-[1fr_1fr_auto] gap-2">
	<select
		id="{id}-month"
		class="select leading-6"
		aria-label={m.month_input_month_placeholder()}
		{disabled}
		value={selectedMonth}
		onchange={handleMonthChange}
	>
		<option value="">{m.month_input_month_placeholder()}</option>
		{#each months as month (month.value)}
			<option value={month.value}>{month.label}</option>
		{/each}
	</select>
	<select
		id="{id}-year"
		class="select leading-6"
		aria-label={m.month_input_year_placeholder()}
		{disabled}
		value={selectedYear}
		onchange={handleYearChange}
	>
		<option value="">{m.month_input_year_placeholder()}</option>
		{#each years as year (year)}
			<option value={year}>{year}</option>
		{/each}
	</select>
	<button
		type="button"
		class="btn preset-tonal"
		aria-label={m.month_input_clear()}
		title={m.month_input_clear()}
		disabled={disabled || !value}
		onclick={() => (value = '')}
	>
		<X class="size-4" />
	</button>
</div>
