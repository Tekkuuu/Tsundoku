<script lang="ts">
	import {
		Combobox,
		Portal,
		useListCollection,
		type ComboboxRootProps
	} from '@skeletonlabs/skeleton-svelte';
	import type { ClassValue } from 'svelte/elements';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		rootClass?: ClassValue;
		triggerClass?: ClassValue;
		inputClass?: ClassValue;
		selected: string | null;
		disabled?: boolean;
	};

	let {
		rootClass,
		triggerClass,
		inputClass,
		selected = $bindable(),
		disabled = false
	}: Props = $props();

	const allItems = Intl.supportedValuesOf('currency');
	let items = $state(allItems);

	// The underlying combobox keeps its own input text: a one-way `value`
	// alone doesn't repaint it when `selected` arrives late (e.g. update
	// dialogs populate remote-form fields in $effect after mount). Control
	// `inputValue` and only resync it when `selected` itself changes, so
	// user filtering/typing isn't clobbered.
	let inputValue = $state(selected ?? '');
	let lastSelected = $state(selected);

	$effect(() => {
		if (selected !== lastSelected) {
			lastSelected = selected;
			inputValue = selected ?? '';
			items = allItems;
		}
	});

	const collection = $derived(
		useListCollection({
			items: items,
			itemToString: (item) => item,
			itemToValue: (item) => item
		})
	);

	const onOpenChange = () => {
		items = allItems;
	};

	const onInputValueChange: ComboboxRootProps['onInputValueChange'] = (event) => {
		inputValue = event.inputValue;
		const filtered = allItems.filter((item) =>
			item.toLowerCase().includes(event.inputValue.toLowerCase())
		);
		items = filtered;
	};
</script>

<Combobox
	class={rootClass}
	placeholder={m.common_search_placeholder()}
	{collection}
	value={selected ? [selected] : []}
	{inputValue}
	{onOpenChange}
	{onInputValueChange}
	onValueChange={(details) => {
		selected = details.value[0] ?? null;
		inputValue = details.value[0] ?? '';
	}}
	{disabled}
>
	<Combobox.Label>{m.form_order_cu_currency_label()}</Combobox.Label>
	<div class="field-group grid grid-cols-[1fr_auto]">
		<Combobox.Control>
			<Combobox.Input class={[inputClass, selected && 'rounded-r-none']} />
			<Combobox.Trigger class={triggerClass} />
		</Combobox.Control>
		<Combobox.ClearTrigger
			onclick={() => {
				selected = null;
				inputValue = '';
				items = allItems;
			}}
		>
			{m.common_clear_all()}
		</Combobox.ClearTrigger>
	</div>
	<Portal>
		<Combobox.Positioner>
			<Combobox.Content class="z-50 max-h-100 overflow-y-auto">
				{#each items as item (item)}
					<Combobox.Item {item}>
						<Combobox.ItemText>{item}</Combobox.ItemText>
						<Combobox.ItemIndicator />
					</Combobox.Item>
				{/each}
			</Combobox.Content>
		</Combobox.Positioner>
	</Portal>
</Combobox>
