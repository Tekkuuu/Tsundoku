<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let pending = $state(false);
</script>

<main class="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center">
	<div class="flex w-full flex-col gap-4 card preset-filled-surface-100-900 p-4">
		<h1 class="text-center text-5xl font-bold">{m.register_title()}</h1>
		<hr class="hr" />
		{#if data.registrationClosed}
			<p role="alert" class="card preset-filled-error-500 p-2 text-center font-semibold">
				{m.register_closed()}
			</p>
			<a href={resolve('/login')} class="btn w-full preset-filled-secondary-500 font-bold"
				>{m.register_login_link()}</a
			>
		{:else}
			{#if form?.message}
				<p role="alert" class="card preset-filled-error-500 px-4 py-2 text-center font-semibold">
					{form.message}
				</p>
			{/if}
			<form
				method="post"
				action="?/signUpEmail"
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
						<span class="label-text">{m.register_username_label()}</span>
						<input
							class="input"
							class:input-error={!!form?.message}
							type="text"
							name="name"
							placeholder={m.register_username_placeholder()}
							autocomplete="username"
							required
							value={form?.name ?? ''}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.register_email_label()}</span>
						<input
							class="input"
							class:input-error={!!form?.message}
							type="email"
							name="email"
							placeholder={m.register_email_placeholder()}
							autocomplete="email"
							required
							value={form?.email ?? ''}
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.register_password_label()}</span>
						<input
							class="input"
							class:input-error={!!form?.message}
							type="password"
							name="password"
							placeholder={m.register_password_placeholder()}
							autocomplete="new-password"
							required
						/>
					</label>
					<label class="label">
						<span class="label-text">{m.register_confirm_password_label()}</span>
						<input
							class="input"
							class:input-error={!!form?.message}
							type="password"
							name="password_confirm"
							placeholder={m.register_confirm_password_placeholder()}
							autocomplete="new-password"
							required
						/>
					</label>
				</fieldset>
				<button class="btn w-full preset-filled-primary-500 font-bold" disabled={pending}>
					{pending ? m.register_submit_pending() : m.register_submit()}
				</button>
				<a href={resolve('/login')} class="btn w-full preset-filled-secondary-500 font-bold"
					>{m.register_login_link()}</a
				>
			</form>
		{/if}
	</div>
</main>
