<script lang="ts">
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { getFileMetadata } from '#lib/remote/files.remote.js';

	type Props = {
		kind: 'cover' | 'receipt';
		/* File ID */
		value?: string;
	};

	let { kind, value = $bindable('') }: Props = $props();

	const accept = $derived(
		kind === 'cover'
			? 'image/jpeg,image/png,image/gif,image/webp'
			: 'image/jpeg,image/png,image/gif,image/webp,application/pdf'
	);
	const maxFileSize = $derived(kind === 'cover' ? 5 * 1024 * 1024 : 10 * 1024 * 1024);

	let busy = $state(false);
	let statusText = $state('');
	let errorText = $state('');
	let staged = new SvelteSet<string>();

	const metadata = $derived(value ? getFileMetadata(value) : null);

	function typeLabelOf(contentType: string): string {
		const [main, sub] = contentType.toLowerCase().split('/');
		if (main === 'application' && sub === 'pdf') return 'PDF';
		if (main === 'image' && sub) return sub.toUpperCase();
		return 'FILE';
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1024;
		let unit = 0;
		while (value >= 1024 && unit < units.length - 1) {
			value /= 1024;
			unit += 1;
		}
		return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
	}

	async function readError(res: Response, fallback: string): Promise<string> {
		try {
			const body = (await res.json()) as { message?: unknown };
			return typeof body.message === 'string' && body.message ? body.message : fallback;
		} catch {
			return fallback;
		}
	}

	async function uploadFile(upload: File) {
		busy = true;
		errorText = '';
		statusText = m.form_file_upload_uploading();
		try {
			const form = new FormData();
			form.set('kind', kind);
			form.set('file', upload);
			const res = await fetch('/api/files', { method: 'POST', body: form });
			if (!res.ok) {
				errorText = await readError(res, m.form_file_upload_error_upload());
				return;
			}
			const body = (await res.json()) as { id: string };
			staged.add(body.id);
			value = body.id;
		} catch {
			errorText = m.form_file_upload_error_upload();
		} finally {
			busy = false;
			statusText = '';
		}
	}

	async function remove() {
		if (busy) return;
		const id = value;
		value = '';
		errorText = '';
		// Discard staged-but-never-submitted bytes; a pre-existing linked file
		// is only unlinked here and deleted by the form submit handler.
		if (id && staged.has(id)) {
			staged.delete(id);
			try {
				await fetch(`/api/files/${id}`, { method: 'DELETE' });
			} catch {
				// Stale staged files are reaped by `pnpm files:prune` anyway.
			}
		}
	}
</script>

<div class="space-y-2">
	<span class="label-text">{m.form_file_upload_label()}</span>

	{#if value && metadata}
		<div class="flex items-center gap-2">
			<p class="rounded bg-surface-200-800 px-2 py-1 text-xs font-bold">
				{#await metadata}FILE{:then info}{typeLabelOf(info.contentType)} · {formatSize(
						info.size
					)}{:catch}FILE{/await}
			</p>
			<button type="button" class="btn preset-tonal-error btn-sm" onclick={remove} disabled={busy}>
				{m.form_file_upload_remove()}
			</button>
		</div>
	{:else}
		<FileUpload
			{accept}
			maxFiles={1}
			{maxFileSize}
			allowDrop
			disabled={busy}
			onFileAccept={(details) => {
				const [first] = details.files;
				if (!first) return;
				void uploadFile(first);
			}}
			onFileReject={(details) => {
				const reasons = new Set(details.files.flatMap((f) => f.errors));
				errorText = reasons.has('FILE_TOO_LARGE')
					? m.form_file_upload_error_too_large()
					: m.form_file_upload_error_type();
			}}
		>
			<FileUpload.Dropzone
				class="rounded border-2 border-dashed border-surface-300-700 p-4 text-center"
			>
				<span class="text-sm">{m.form_file_upload_drop()}</span>
				<FileUpload.Trigger class="ml-2 btn preset-tonal-primary btn-sm" disabled={busy}>
					{m.form_file_upload_browse()}
				</FileUpload.Trigger>
				<p class="mt-1 text-xs opacity-70">
					{kind === 'cover' ? m.form_file_upload_hint_cover() : m.form_file_upload_hint_receipt()}
				</p>
				<FileUpload.HiddenInput />
			</FileUpload.Dropzone>
		</FileUpload>
	{/if}

	{#if busy && statusText}
		<p class="text-xs opacity-70" role="status">{statusText}</p>
	{/if}
	{#if errorText}
		<p class="text-sm text-error-500" role="alert">{errorText}</p>
	{/if}
</div>
