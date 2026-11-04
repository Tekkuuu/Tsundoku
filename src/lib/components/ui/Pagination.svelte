<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Pagination, Select } from 'bits-ui';
	import { twMerge } from 'tailwind-merge';
	import { m } from '#lib/paraglide/messages.js';

	type Props = {
		class?: string;
		count: number;
		page?: number;
		perPage?: number;
		perPageOptions?: number[];
		siblingCount?: number;
	};

	let {
		class: className,
		count,
		page = $bindable(1),
		perPage = $bindable(24),
		perPageOptions = [24, 48, 96],
		siblingCount = 1
	}: Props = $props();

	const perPageValue = $derived(String(perPage));

	function handlePerPageChange(value: string) {
		perPage = Number(value);
		page = 1;
	}
</script>

<div class={twMerge('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
	<div class="flex items-center gap-2">
		<span class="text-sm opacity-70">{m.pagination_per_page()}</span>
		<Select.Root type="single" value={perPageValue} onValueChange={handlePerPageChange}>
			<Select.Trigger
				class="btn flex items-center gap-1 preset-tonal text-sm"
				aria-label={m.pagination_per_page()}
			>
				<Select.Value />
				<ChevronDown class="size-4 opacity-70" />
			</Select.Trigger>
			<Select.Portal>
				<Select.Content
					class="z-50 card border border-surface-200-800 bg-surface-50-950 p-1 shadow-xl"
				>
					<Select.Viewport>
						{#each perPageOptions as option (option)}
							<Select.Item
								value={String(option)}
								label={String(option)}
								class="flex cursor-pointer items-center rounded-base p-2 text-sm data-[highlighted]:preset-filled-primary-50-950"
							>
								{option}
							</Select.Item>
						{/each}
					</Select.Viewport>
				</Select.Content>
			</Select.Portal>
		</Select.Root>
	</div>

	<Pagination.Root
		{count}
		{perPage}
		{siblingCount}
		bind:page
		class="flex flex-wrap items-center justify-center gap-1"
	>
		{#snippet children({ pages })}
			<Pagination.PrevButton class="btn preset-tonal btn-sm" aria-label={m.common_back()}>
				<ChevronLeft class="size-4" />
			</Pagination.PrevButton>

			{#each pages as item (item.key)}
				{#if item.type === 'ellipsis'}
					<span class="px-2 text-surface-500" aria-hidden="true">…</span>
				{:else}
					<Pagination.Page
						page={item}
						aria-current={item.value === page ? 'page' : undefined}
						class={['btn btn-sm', item.value === page ? 'preset-filled' : 'preset-tonal']}
					/>
				{/if}
			{/each}

			<Pagination.NextButton class="btn preset-tonal btn-sm" aria-label={m.common_next()}>
				<ChevronRight class="size-4" />
			</Pagination.NextButton>
		{/snippet}
	</Pagination.Root>
</div>
