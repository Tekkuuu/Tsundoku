<script lang="ts">
	import type { Pathname } from '$app/types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { AppBar, Navigation, Toast, Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { goto } from '$app/navigation';
	import {
		BookOpen,
		ChevronDown,
		CircleUser,
		Ellipsis,
		House,
		LogOut,
		Settings,
		ShoppingCart,
		ChartPie
	} from '@lucide/svelte';
	import { authClient } from '$lib/auth-client';
	import { invalidateAll } from '$app/navigation';
	import { toaster } from '$lib/components/toaster';
	import { m } from '$lib/paraglide/messages';

	let { children } = $props();
	let session = authClient.useSession();

	const navLinks = [
		{ label: () => m.nav_series(), href: resolve('/series') },
		{ label: () => m.nav_orders(), href: resolve('/orders') },
		{ label: () => m.nav_stats(), href: resolve('/stats') }
	];

	const dockLinks = [
		{ label: () => m.nav_home(), href: resolve('/'), icon: House, home: true },
		{ label: () => m.nav_series(), href: resolve('/series'), icon: BookOpen, home: false },
		{ label: () => m.nav_orders(), href: resolve('/orders'), icon: ShoppingCart, home: false },
		{ label: () => m.nav_stats(), href: resolve('/stats'), icon: ChartPie, home: false }
	];

	function isActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	function dockActive(item: (typeof dockLinks)[number]) {
		return item.home ? page.url.pathname === item.href : isActive(item.href);
	}

	async function handleLogout() {
		await authClient.signOut();
		invalidateAll();
	}

	function handleAccountSelect(event: { value: string }) {
		if (event.value === 'settings') goto(resolve('/user/settings'));
		else if (event.value === 'login') goto(resolve('/login'));
		else if (event.value === 'logout') handleLogout();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- App Bar (desktop/tablet) -->
<AppBar class="hidden md:block">
	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto] gap-4 md:grid-cols-[1fr_auto_1fr]">
		<AppBar.Lead>
			<a href={resolve('/')} class="text-2xl font-black text-primary-950-50">Tsundoku</a>
		</AppBar.Lead>
		<AppBar.Headline class="flex justify-center">
			<nav class="flex items-center gap-1">
				{#each navLinks as link (link.href)}
					<a
						href={link.href}
						class="btn {isActive(link.href) ? 'preset-filled-primary-500' : 'preset-tonal'}"
					>
						{link.label()}
					</a>
				{/each}
			</nav>
		</AppBar.Headline>
		<AppBar.Trail class="justify-end">
			{#if $session.data}
				<Menu onSelect={handleAccountSelect}>
					<Menu.Trigger class="btn flex items-center gap-2 preset-tonal">
						<CircleUser class="size-5" />
						<span class="hidden sm:inline">{m.nav_account()}</span>
						<ChevronDown class="size-4" />
					</Menu.Trigger>
					<Portal>
						<Menu.Positioner>
							<Menu.Content
								class="z-50 min-w-56 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
							>
								<div class="px-3 py-2">
									<p class="truncate text-sm font-medium">
										{$session.data.user.name ?? $session.data.user.email}
									</p>
									<p class="truncate text-xs opacity-70">{$session.data.user.email}</p>
								</div>
								<Menu.Separator class="my-1 h-px border-0 bg-surface-200-800" />
								<Menu.Item value="settings" class="btn w-full justify-start gap-2">
									<Settings class="size-4" />
									{m.settings_title()}
								</Menu.Item>
								<Menu.Item
									value="preferences"
									disabled
									class="btn w-full justify-start gap-2 opacity-50 data-disabled:pointer-events-none"
								>
									{m.nav_preferences()}
								</Menu.Item>
								<Menu.Separator class="my-1 h-px border-0 bg-surface-200-800" />
								<Menu.Item value="logout" class="btn w-full justify-start gap-2 text-error-600-400">
									<LogOut class="size-4" />
									{m.nav_logout()}
								</Menu.Item>
							</Menu.Content>
						</Menu.Positioner>
					</Portal>
				</Menu>
			{:else}
				<a href={resolve('/login')} class="btn preset-filled-primary-500">{m.nav_login()}</a>
			{/if}
		</AppBar.Trail>
	</AppBar.Toolbar>
</AppBar>

<main class="pb-20 md:pb-0">
	{@render children()}
</main>

<!-- Mobile dock navigation -->
<Navigation
	layout="bar"
	class="fixed inset-x-0 bottom-0 z-50 border-t border-surface-200-800 bg-surface-50-950 pb-[env(safe-area-inset-bottom)] md:hidden"
>
	<Navigation.Menu class="flex items-stretch justify-around">
		{#each dockLinks as link (link.href)}
			<Navigation.TriggerAnchor
				href={link.href}
				class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium {dockActive(
					link
				)
					? 'text-primary-500'
					: 'text-surface-950-50/60'}"
			>
				{@const Icon = link.icon}
				<Icon class="size-5" />
				<Navigation.TriggerText>{link.label()}</Navigation.TriggerText>
			</Navigation.TriggerAnchor>
		{/each}

		<Menu onSelect={handleAccountSelect} positioning={{ placement: 'top' }}>
			<Menu.Trigger
				class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium text-surface-950-50/60"
			>
				<Ellipsis class="size-5" />
				<span>{m.nav_more()}</span>
			</Menu.Trigger>
			<Portal>
				<Menu.Positioner>
					<Menu.Content
						class="z-50 min-w-56 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
					>
						{#if $session.data}
							<div class="px-3 py-2">
								<p class="truncate text-sm font-medium">
									{$session.data.user.name ?? $session.data.user.email}
								</p>
								<p class="truncate text-xs opacity-70">{$session.data.user.email}</p>
							</div>
							<Menu.Separator class="my-1 h-px border-0 bg-surface-200-800" />
						{/if}
						<Menu.Item value="settings" class="btn w-full justify-start gap-2">
							<Settings class="size-4" />
							{m.settings_title()}
						</Menu.Item>
						<Menu.Item
							value="preferences"
							disabled
							class="btn w-full justify-start gap-2 opacity-50 data-disabled:pointer-events-none"
						>
							{m.nav_preferences()}
						</Menu.Item>
						{#if $session.data}
							<Menu.Separator class="my-1 h-px border-0 bg-surface-200-800" />
							<Menu.Item value="logout" class="btn w-full justify-start gap-2 text-error-600-400">
								<LogOut class="size-4" />
								{m.nav_logout()}
							</Menu.Item>
						{:else}
							<Menu.Separator class="my-1 h-px border-0 bg-surface-200-800" />
							<Menu.Item value="login" class="btn w-full justify-start gap-2">
								{m.nav_login()}
							</Menu.Item>
						{/if}
					</Menu.Content>
				</Menu.Positioner>
			</Portal>
		</Menu>
	</Navigation.Menu>
</Navigation>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={resolve(localizeHref(page.url.pathname, { locale }) as Pathname)}>{locale}</a>
	{/each}
</div>

<!-- Toast notifications -->
<Toast.Group {toaster}>
	{#snippet children(toast)}
		<Toast {toast}>
			<Toast.Message>
				<Toast.Title>{toast.title}</Toast.Title>
				<Toast.Description>{toast.description}</Toast.Description>
			</Toast.Message>
			<Toast.CloseTrigger />
		</Toast>
	{/snippet}
</Toast.Group>
