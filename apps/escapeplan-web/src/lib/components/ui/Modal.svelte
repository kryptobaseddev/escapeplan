<!-- Modal.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		description?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
		onClose: () => void;
		children: Snippet;
		actions?: Snippet;
	}

	let {
		open,
		title,
		description,
		size = '2xl',
		onClose,
		children,
		actions
	}: Props = $props();

	// Derived size class
	const sizes = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		'4xl': 'max-w-4xl'
	};
	let sizeClass = $derived(sizes[size as keyof typeof sizes] || sizes.lg);

	// Effect: Handle ESC key
	$effect(() => {
		if (!open) return;

		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};

		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<dialog
		class="modal modal-bottom sm:modal-middle"
		open
		oncancel={(e) => {
			e.preventDefault();
			onClose();
		}}
	>
		<div class="modal-box max-h-[92vh] w-full {sizeClass} overflow-y-auto px-6 py-6">
			<header class="mb-6 space-y-2">
				<h2 class="text-lg font-semibold text-base-content">{title}</h2>
				{#if description}
					<p class="text-sm text-base-content/70">{description}</p>
				{/if}
			</header>

			{@render children()}

			{#if actions}
				<footer class="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					{@render actions()}
				</footer>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop" onsubmit={onClose}>
			<button type="submit">close</button>
		</form>
	</dialog>
{/if}
