<script lang="ts">
	import { format } from 'date-fns';
	import { Check, LoaderCircle, Plus } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import {
		scheduleReading,
		type CalendarRemainingVolume
	} from '#lib/remote/reading-plan.remote.js';

	type Props = {
		open?: boolean;
		date: Date;
		volumes: CalendarRemainingVolume[];
		scheduledBookIds: string[];
		onScheduled?: () => void | Promise<void>;
	};

	let { open = $bindable(false), date, volumes, scheduledBookIds, onScheduled }: Props = $props();

	const locale = getLocale();
	const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
	const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });

	let search = $state('');
	let schedulingId = $state<string | null>(null);

	const scheduled = $derived(new SvelteSet(scheduledBookIds));

	const filtered = $derived.by(() => {
		const query = search.trim().toLocaleLowerCase(locale);
		const matches = query
			? volumes.filter(
					(volume) =>
						volume.seriesTitle.toLocaleLowerCase(locale).includes(query) ||
						(volume.author ?? '').toLocaleLowerCase(locale).includes(query)
				)
			: volumes;

		return matches.toSorted(
			(a, b) => collator.compare(a.seriesTitle, b.seriesTitle) || a.volumeNumber - b.volumeNumber
		);
	});

	async function schedule(volume: CalendarRemainingVolume) {
		if (scheduled.has(volume.bookId) || schedulingId !== null) return;

		schedulingId = volume.bookId;
		await createRemoteActionHandler({
			success: m.dashboard_calendar_schedule_success(),
			error: m.dashboard_calendar_schedule_error(),
			run: () =>
				scheduleReading({
					bookId: volume.bookId,
					plannedDate: format(date, 'yyyy-MM-dd')
				}),
			onSuccess: async () => {
				await onScheduled?.();
				open = false;
			}
		})();
		schedulingId = null;
	}
</script>

<Dialog bind:open size="md">
	{#snippet dialogTitle()}
		{m.dashboard_calendar_schedule_title()}
	{/snippet}

	{#snippet content()}
		<div class="space-y-2">
			<p class="text-sm text-surface-500">
				{m.dashboard_calendar_schedule_for({ date: dateFormatter.format(date) })}
			</p>

			<input
				class="input"
				bind:value={search}
				placeholder={m.dashboard_calendar_schedule_search()}
				aria-label={m.dashboard_calendar_schedule_search()}
			/>

			<ul class="space-y-1">
				{#each filtered as volume (volume.bookId)}
					{@const isScheduled = scheduled.has(volume.bookId)}
					{@const isBusy = schedulingId === volume.bookId}
					<li>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-base border border-surface-200-800 bg-surface-50-950 p-2 text-left transition-colors hover:border-primary-500 hover:bg-primary-500/10 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isScheduled || schedulingId !== null}
							onclick={() => schedule(volume)}
						>
							<span class="min-w-0">
								<span class="block truncate font-medium">{volume.seriesTitle}</span>
								<span class="block truncate text-xs text-surface-500">
									{#if volume.author}{volume.author} ·
									{/if}
									{m.dashboard_widget_reading_volume({
										volumeNumber: volume.volumeNumber
									})}
								</span>
							</span>
							<span class="shrink-0 text-xs font-medium text-surface-500">
								{#if isScheduled}
									<span class="inline-flex items-center gap-1 text-success-500">
										<Check class="size-3.5" />
										{m.dashboard_calendar_schedule_already()}
									</span>
								{:else if isBusy}
									<LoaderCircle class="size-3.5 animate-spin" />
								{:else}
									<Plus class="size-4" />
								{/if}
							</span>
						</button>
					</li>
				{:else}
					<li class="p-2 text-sm text-surface-500">
						{volumes.length === 0
							? m.dashboard_calendar_schedule_no_volumes()
							: m.dashboard_calendar_schedule_empty()}
					</li>
				{/each}
			</ul>
		</div>
	{/snippet}
</Dialog>
