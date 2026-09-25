<script lang="ts">
	import { Link2, LoaderCircle, Upload, X } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		value?: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
		onerror?: (message: string) => void;
	};

	let { value = '', disabled = false, onchange, onerror }: Props = $props();

	const accept = 'image/jpeg,image/png,image/gif,image/webp';
	const maxFileSize = 5 * 1024 * 1024;

	let mode = $state<'url' | 'file'>('url');
	let url = $state('');
	let busy = $state(false);
	let error = $state('');

	function setError(message: string) {
		error = message;
		onerror?.(message);
	}

	async function readError(res: Response, fallback: string): Promise<string> {
		try {
			const body = (await res.json()) as { message?: unknown };
			return typeof body.message === 'string' && body.message ? body.message : fallback;
		} catch {
			return fallback;
		}
	}

	async function uploadFile(file: File) {
		if (file.size > maxFileSize) {
			setError(m.form_file_upload_error_too_large());
			return;
		}
		busy = true;
		setError('');
		try {
			const body = new FormData();
			body.set('kind', 'cover');
			body.set('file', file);
			const res = await fetch('/api/files', { method: 'POST', body });
			if (!res.ok) {
				setError(await readError(res, m.form_file_upload_error_upload()));
				return;
			}
			const { id } = (await res.json()) as { id: string };
			onchange?.(id);
		} catch {
			setError(m.form_file_upload_error_upload());
		} finally {
			busy = false;
		}
	}

	async function importFromUrl() {
		const trimmed = url.trim();
		if (!trimmed || busy) return;
		busy = true;
		setError('');
		try {
			const res = await fetch('/api/files/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'cover', url: trimmed })
			});
			if (!res.ok) {
				setError(await readError(res, m.form_file_upload_error_import()));
				return;
			}
			const { id } = (await res.json()) as { id: string };
			url = '';
			onchange?.(id);
		} catch {
			setError(m.form_file_upload_error_import());
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (busy) return;
		const id = value;
		onchange?.('');
		if (!id) return;
		await fetch(`/api/files/${id}`, { method: 'DELETE' }).catch(() => undefined);
	}

	function handleUrlKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void importFromUrl();
		}
	}
</script>

{#if value}
	<div class="flex items-center">
		<img
			src={`/files/${value}`}
			alt={m.form_file_upload_preview_alt()}
			class="aspect-square h-8 border-b border-surface-300-700 object-cover"
		/>
		<button
			type="button"
			class="btn btn-icon h-8 w-full rounded-none border-b border-surface-300-700 preset-tonal-error"
			onclick={remove}
			disabled={busy || disabled}
			aria-label={m.book_batch_cover_remove()}
			title={m.book_batch_cover_remove()}
		>
			<X class="size-4" />
		</button>
	</div>
{:else}
	<div class="flex min-w-48">
		<div class="flex items-center">
			{#if mode === 'url'}
				<input
					type="url"
					class="text table-input min-w-0 flex-1"
					bind:value={url}
					placeholder={m.form_file_upload_url_placeholder()}
					disabled={busy || disabled}
					aria-invalid={error ? 'true' : undefined}
					onkeydown={handleUrlKeydown}
				/>
				<button
					type="button"
					class="btn h-8 rounded-none border-b border-surface-300-700 preset-tonal"
					onclick={importFromUrl}
					disabled={busy || disabled || !url.trim()}
				>
					{#if busy}
						<LoaderCircle class="size-4 animate-spin" />
						<span class="sr-only">{m.form_file_upload_fetching()}</span>
					{:else}
						{m.form_file_upload_fetch()}
					{/if}
				</button>
			{:else}
				<input
					type="file"
					class="table-input min-w-0 flex-1"
					{accept}
					disabled={busy || disabled}
					aria-invalid={error ? 'true' : undefined}
					onchange={(event) => {
						const file = event.currentTarget.files?.[0];
						if (file) void uploadFile(file);
						event.currentTarget.value = '';
					}}
				/>
				{#if busy}
					<LoaderCircle class="size-4 shrink-0 animate-spin" />
					<span class="sr-only">{m.form_file_upload_uploading()}</span>
				{/if}
			{/if}
			<button
				type="button"
				class="btn btn-icon h-8 shrink-0 rounded-none border-b border-surface-300-700 preset-tonal"
				onclick={() => (mode = mode === 'url' ? 'file' : 'url')}
				disabled={busy || disabled}
				aria-label={mode === 'url'
					? m.book_batch_cover_toggle_file()
					: m.book_batch_cover_toggle_url()}
				title={mode === 'url' ? m.book_batch_cover_toggle_file() : m.book_batch_cover_toggle_url()}
			>
				{#if mode === 'url'}
					<Upload class="size-4" />
				{:else}
					<Link2 class="size-4" />
				{/if}
			</button>
		</div>
	</div>
{/if}
