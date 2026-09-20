<script lang="ts">
	import { Info } from '@lucide/svelte';
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';

	type Props = {
		value?: string;
		placeholder: string;
		title: string;
		description: string;
		fieldsTitle: string;
		fields: string[];
		examplesTitle: string;
		examples: string[];
		operators: string;
	};

	let {
		value = $bindable(''),
		placeholder,
		title,
		description,
		fieldsTitle,
		fields,
		examplesTitle,
		examples,
		operators
	}: Props = $props();
</script>

<Popover>
	<Popover.Anchor>
		<div class="field-group grid w-full grid-cols-[1fr_auto]">
			<input type="search" bind:value {placeholder} class="input w-full" />
			<Popover.Trigger class="btn aspect-square preset-tonal" aria-label={title}>
				<Info class="size-4" />
			</Popover.Trigger>
		</div>
	</Popover.Anchor>
	<Portal>
		<Popover.Positioner>
			<Popover.Content class="card bg-surface-200-800 p-4 shadow-xl">
				<Popover.Arrow
					class="[--arrow-background:var(--color-surface-200-800)] [--arrow-size:--spacing(2)]"
				>
					<Popover.ArrowTip />
				</Popover.Arrow>
				<div class="max-w-sm space-y-3 text-sm">
					<h2 class="font-semibold">{title}</h2>
					<p>{description}</p>
					<div>
						<p class="mb-1 font-medium">{fieldsTitle}</p>
						<p class="text-surface-500-500">
							{#each fields as field, index (field)}
								<code>{field}:</code>{index < fields.length - 1 ? ', ' : ''}
							{/each}
						</p>
					</div>
					<div>
						<p class="mb-1 font-medium">{examplesTitle}</p>
						<ul class="text-surface-500-500 list-inside list-disc space-y-1">
							{#each examples as example (example)}
								<li><code>{example}</code></li>
							{/each}
						</ul>
					</div>
					<p class="text-surface-500-500">{operators}</p>
				</div>
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>
