<script lang="ts" module>
	export type BatchCell = { rowIndex: number; field: string | null };
</script>

<script lang="ts">
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { toaster } from '$lib/components/toaster';
	import { m } from '$lib/paraglide/messages';
	import { readClipboard, writeClipboard } from '$lib/utils/table';

	type Props = {
		fieldLabels: Record<string, () => string>;
		getCellValue: (cell: BatchCell) => string;
		oninsert: (rowIndex: number) => void;
		ondelete: (rowIndex: number) => void;
		onpaste: (cell: BatchCell, text: string) => void;
		body: Snippet;
	};

	let { fieldLabels, getCellValue, oninsert, ondelete, onpaste, body }: Props = $props();

	let activeCell = $state<BatchCell | null>(null);

	const value = $derived(activeCell ? getCellValue(activeCell) : '');

	function capture(event: MouseEvent) {
		const element = event.target as HTMLElement | null;
		const rowEl = element?.closest<HTMLElement>('[data-row]');
		if (!rowEl) {
			activeCell = null;
			return;
		}
		const field = element?.closest<HTMLElement>('[data-field]')?.dataset.field ?? null;
		activeCell = { rowIndex: Number(rowEl.dataset.row), field };
	}

	function handleSelect(event: { value: string }) {
		const cell = activeCell;
		if (!cell) return;
		switch (event.value) {
			case 'copy':
				void copy();
				break;
			case 'paste':
				void paste();
				break;
			case 'insert':
				oninsert(cell.rowIndex);
				break;
			case 'delete':
				ondelete(cell.rowIndex);
				break;
		}
	}

	async function copy() {
		if (!(await writeClipboard(value))) {
			toaster.error({ title: m.toast_title_error(), description: m.table_clipboard_error() });
		}
	}

	async function paste() {
		const cell = activeCell;
		if (!cell?.field) return;
		const text = await readClipboard();
		if (text === null) {
			toaster.error({ title: m.toast_title_error(), description: m.table_clipboard_error() });
			return;
		}
		onpaste(cell, text.replace(/[\r\n]+/g, ' ').trim());
	}
</script>

<Menu positioning={{ placement: 'bottom-start' }} onSelect={handleSelect}>
	<Menu.ContextTrigger element={tbody} oncontextmenu={capture} />
	<Portal>
		<Menu.Positioner>
			<Menu.Content
				class="z-50 space-y-1 card border border-surface-300-700 bg-surface-50-950 p-2 shadow-xl"
			>
				{#if activeCell}
					<p class="p-2 text-xs font-semibold text-surface-500 uppercase">
						{activeCell.field ? fieldLabels[activeCell.field]?.() : ''}
						· {m.table_row_number({ row: activeCell.rowIndex + 1 })}
					</p>

					{#if activeCell.field}
						<Menu.Item
							value="copy"
							class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
						>
							<Menu.ItemText>{m.table_copy_value()}</Menu.ItemText>
						</Menu.Item>
						<Menu.Item
							value="paste"
							class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
						>
							<Menu.ItemText>{m.table_paste_value()}</Menu.ItemText>
						</Menu.Item>
						<Menu.Separator class="border-surface-300-700" />
					{/if}

					<Menu.Item
						value="insert"
						class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
					>
						<Menu.ItemText>{m.table_insert_below()}</Menu.ItemText>
					</Menu.Item>
					<Menu.Item
						value="delete"
						class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
					>
						<Menu.ItemText>{m.table_delete_row()}</Menu.ItemText>
					</Menu.Item>
				{/if}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu>

{#snippet tbody(attrs: SvelteHTMLElements['button'])}
	<tbody {...attrs as SvelteHTMLElements['tbody']}>
		{@render body()}
	</tbody>
{/snippet}
