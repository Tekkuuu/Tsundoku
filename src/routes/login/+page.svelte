<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let pending = $state(false);
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center">
	<div class="flex w-full flex-col gap-4 card preset-filled-surface-100-900 p-4">
		<h1 class="w-full text-center text-5xl font-bold">{m.login_title()}</h1>
		<hr class="hr" />
		{#if form?.message}
			<p role="alert" class="card preset-filled-error-500 p-2 text-center font-semibold">
				{form.message}
			</p>
		{/if}
		<form
			method="post"
			action="?/signInEmail"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
			class="w-full space-y-4 p-4"
		>
			<fieldset class="space-y-4" disabled={pending}>
				<label class="label">
					<span class="label-text">{m.login_email_label()}</span>
					<input
						class="input"
						class:input-error={!!form?.message}
						type="email"
						name="email"
						placeholder={m.login_email_placeholder()}
						autocomplete="email"
						required
						value={form?.email ?? ''}
					/>
				</label>
				<label class="label">
					<span class="label-text">{m.login_password_label()}</span>
					<input
						class="input"
						class:input-error={!!form?.message}
						type="password"
						name="password"
						placeholder={m.login_password_placeholder()}
						autocomplete="current-password"
						required
					/>
				</label>
			</fieldset>
			<button class="btn w-full preset-filled-primary-500 font-bold" disabled={pending}>
				{pending ? m.login_submit_pending() : m.login_submit()}
			</button>
			<a href={resolve('/login/register')} class="btn w-full preset-filled-secondary-500 font-bold">
				{m.login_register_link()}
			</a>
		</form>
	</div>
</main>
