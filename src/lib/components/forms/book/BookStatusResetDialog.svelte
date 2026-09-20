<script lang="ts">
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { m } from '$lib/paraglide/messages';
	import type { BookStatus, ReadStatus } from '$lib/validation/book';
	import { getBookStatusText, getReadStatusText } from './utils';

	type Props = {
		pending: { readStatus: ReadStatus; status: BookStatus } | null;
		onConfirm: () => void;
		onCancel: () => void;
	};

	let { pending, onConfirm, onCancel }: Props = $props();
</script>

<ConfirmDialog
	open={pending !== null}
	title={m.series_detail_confirm_readreset_title()}
	message={m.series_detail_confirm_readreset_message({
		readStatus: pending ? getReadStatusText(pending.readStatus) : '',
		status: pending ? getBookStatusText(pending.status) : ''
	})}
	confirmLabel={m.series_detail_confirm_readreset_confirm()}
	onOpenChange={(event) => {
		if (!event.open) onCancel();
	}}
	{onConfirm}
/>
