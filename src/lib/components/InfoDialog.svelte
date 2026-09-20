<script lang="ts">
	import { X } from '@lucide/svelte';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		onOpenChange?: (event: { open: boolean }) => void;
		onConfirm?: () => void;
	};

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel,
		onOpenChange,
		onConfirm
	}: Props = $props();

	function handleConfirm() {
		onConfirm?.();
		open = false;
	}
</script>

<Dialog
	{open}
	onOpenChange={(event) => {
		open = event.open;
		onOpenChange?.(event);
	}}
>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/75" />
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
		>
			<Dialog.Content
				class="max-h-[calc(100dvh-2rem)] w-full max-w-md space-y-4 overflow-y-auto card bg-surface-100-900 p-4 shadow-xl"
			>
				<header class="flex items-center justify-between">
					<Dialog.Title class="text-lg font-bold">{title}</Dialog.Title>
					<Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
						<X />
					</Dialog.CloseTrigger>
				</header>
				<p class="text-surface-500-500">{message}</p>
				<div class="flex justify-end">
					<button type="button" class="btn preset-filled-primary-500" onclick={handleConfirm}>
						{confirmLabel ?? m.common_ok()}
					</button>
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
