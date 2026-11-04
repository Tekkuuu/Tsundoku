<script lang="ts">
	import { X } from '@lucide/svelte';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';

	type Size = 'sm' | 'md' | 'lg' | 'xl';

	const sizeClasses: Record<Size, string> = {
		sm: 'max-w-md',
		md: 'max-w-xl',
		lg: 'max-w-3xl',
		xl: 'max-w-6xl'
	};

	type Props = {
		open?: boolean;
		trigger?: Snippet;
		triggerClass?: string;
		content?: Snippet;
		size?: Size;
		maxWidthClass?: string;
		onTriggerClick?: MouseEventHandler<HTMLButtonElement>;
		onCloseClick?: MouseEventHandler<HTMLButtonElement>;
		onOpenChange?: (details: { open: boolean }) => void;
		dialogTitle?: Snippet;
	};

	let {
		open = $bindable(),
		triggerClass = 'btn preset-filled',
		size = 'sm',
		maxWidthClass,
		trigger,
		onTriggerClick,
		onCloseClick,
		onOpenChange,
		content,
		dialogTitle
	}: Props = $props();
</script>

<Dialog
	{open}
	onOpenChange={(details) => {
		open = details.open;
		onOpenChange?.(details);
	}}
>
	{#if trigger}
		<Dialog.Trigger class={triggerClass} onclick={onTriggerClick}>
			{@render trigger()}
		</Dialog.Trigger>
	{/if}
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/75" />
		<Dialog.Positioner
			class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
		>
			<Dialog.Content
				class="card bg-surface-100-900 {maxWidthClass ??
					sizeClasses[
						size
					]} flex max-h-[calc(100dvh-2rem)] w-full flex-1 flex-col space-y-2 overflow-hidden p-4"
			>
				<header class="flex shrink-0 items-center justify-between">
					<Dialog.Title class="text-lg font-bold">{@render dialogTitle?.()}</Dialog.Title>
					<Dialog.CloseTrigger class="btn-icon hover:preset-tonal" onclick={onCloseClick}>
						<X />
					</Dialog.CloseTrigger>
				</header>
				<div class="min-h-0 flex-1 overflow-y-auto">
					{@render content?.()}
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
