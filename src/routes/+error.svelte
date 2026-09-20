<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { House, RotateCcw, TriangleAlert } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<main class="mx-auto max-w-2xl min-w-0 p-3 sm:p-4">
	<section class="space-y-3 card preset-filled-surface-100-900 p-6 text-center">
		<div class="flex justify-center">
			<TriangleAlert class="size-10 text-warning-500" />
		</div>
		<div>
			<p class="text-sm text-surface-500 tabular-nums">{page.status}</p>
			<h1 class="text-2xl font-bold">{m.error_title()}</h1>
		</div>
		{#if page.error?.message}
			<p class="text-sm break-words text-surface-500">{page.error.message}</p>
		{/if}
		<p class="text-sm text-surface-500">{m.error_description()}</p>
		<div class="flex flex-wrap justify-center gap-2">
			<button
				type="button"
				class="btn preset-filled-primary-500 btn-sm"
				onclick={() => invalidateAll()}
			>
				<RotateCcw class="size-4" />
				{m.error_retry()}
			</button>
			<a href={resolve('/')} class="btn preset-tonal btn-sm">
				<House class="size-4" />
				{m.error_home()}
			</a>
		</div>
	</section>
</main>
