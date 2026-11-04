<script lang="ts">
	import { getFilePreview } from '#lib/remote/files.remote.js';
	import { m } from '#lib/paraglide/messages.js';

	/**
	 * @property {string | null} [fileId] Owned file id to preview; null/empty renders nothing.
	 * @property {string} [class] Extra classes for the rendered element.
	 */
	type Props = {
		fileId?: string | null;
		class?: string;
	};

	let { fileId = null, class: cls = '' }: Props = $props();

	const preview = $derived(fileId ? getFilePreview(fileId) : null);
</script>

{#if preview}
	<div class="min-w-0">
		{#await preview}
			<p
				role="status"
				class="flex h-[50vh] w-full items-center justify-center rounded border border-dashed border-surface-300-700 text-sm opacity-70 lg:h-[60vh] {cls}"
			>
				{m.form_file_upload_fetching()}
			</p>
		{:then file}
			{#if file.contentType === 'application/pdf'}
				<iframe
					src={file.dataUrl}
					title={m.form_file_upload_preview_alt()}
					class="h-[50vh] w-full rounded border border-surface-300-700 bg-white lg:h-[60vh] {cls}"
				></iframe>
			{:else}
				<img
					src={file.dataUrl}
					alt={m.form_file_upload_preview_alt()}
					class="max-h-[50vh] w-full rounded object-contain lg:max-h-[70vh] {cls}"
				/>
			{/if}
		{/await}
	</div>
{/if}
