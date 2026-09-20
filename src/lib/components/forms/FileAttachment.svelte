<script lang="ts">
	import { FileUpload } from '@skeletonlabs/skeleton-svelte';
	import { onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		/** 'cover' (images) or 'receipt' (images + PDF). */
		kind: 'cover' | 'receipt';
		/** Staged/linked file id. Parent resets it when the dialog closes. */
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
	let importUrl = $state('');
	let objectUrl = $state<string | null>(null);
	/** Ids uploaded through this instance: safe to discard server-side on remove. */
	let staged = new SvelteSet<string>();

	const preview = $derived(objectUrl ?? (value ? `/files/${value}` : null));

	function revokeObjectUrl() {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}
	}

	onDestroy(revokeObjectUrl);

	// Parent-driven reset (dialog close): drop transient state.
	$effect(() => {
		if (!value) {
			staged.clear();
			revokeObjectUrl();
			importUrl = '';
			errorText = '';
			statusText = '';
		}
	});

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
			const { id } = (await res.json()) as { id: string };
			staged.add(id);
			value = id;
		} catch {
			errorText = m.form_file_upload_error_upload();
		} finally {
			busy = false;
			statusText = '';
		}
	}

	async function importFromUrl() {
		const url = importUrl.trim();
		if (!url || busy) return;
		busy = true;
		errorText = '';
		statusText = m.form_file_upload_fetching();
		try {
			const res = await fetch('/api/files/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind, url })
			});
			if (!res.ok) {
				errorText = await readError(res, m.form_file_upload_error_import());
				return;
			}
			const { id } = (await res.json()) as { id: string };
			staged.add(id);
			revokeObjectUrl();
			value = id;
		} catch {
			errorText = m.form_file_upload_error_import();
		} finally {
			busy = false;
			statusText = '';
		}
	}

	async function remove() {
		if (busy) return;
		const id = value;
		value = '';
		revokeObjectUrl();
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

	{#if preview}
		<div class="flex items-start gap-2">
			<img
				src={preview}
				alt={m.form_file_upload_preview_alt()}
				class="max-h-32 rounded object-contain"
			/>
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
				revokeObjectUrl();
				objectUrl = URL.createObjectURL(first);
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
			</FileUpload.Dropzone>
			<FileUpload.HiddenInput />
		</FileUpload>

		<div class="flex items-center gap-2">
			<span class="text-xs opacity-70">{m.form_file_upload_or_url()}</span>
		</div>
		<div class="flex gap-2">
			<input
				class="input-sm input"
				type="url"
				bind:value={importUrl}
				placeholder={m.form_file_upload_url_placeholder()}
				disabled={busy}
			/>
			<button
				type="button"
				class="btn preset-tonal-secondary btn-sm"
				onclick={importFromUrl}
				disabled={busy || !importUrl.trim()}
			>
				{m.form_file_upload_fetch()}
			</button>
		</div>
	{/if}

	{#if busy && statusText}
		<p class="text-xs opacity-70" role="status">{statusText}</p>
	{/if}
	{#if errorText}
		<p class="text-sm text-error-500" role="alert">{errorText}</p>
	{/if}
</div>
