<script lang="ts">
	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		color?: 'neutral' | 'primary' | 'info';
		class?: string;
	}

	let { text, position = 'top', color = 'info', class: className = '' }: Props = $props();

	const positionClass = {
		top: 'tooltip-top',
		bottom: 'tooltip-bottom',
		left: 'tooltip-left',
		right: 'tooltip-right'
	}[position];

	const colorClass = {
		neutral: 'tooltip-neutral',
		primary: 'tooltip-primary',
		info: 'tooltip-info'
	}[color];
</script>

<div class="tooltip {positionClass} {colorClass} {className}" data-tip={text}>
	<button type="button" class="btn btn-circle btn-ghost btn-xs text-info" tabindex="-1">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			stroke-width="1.5"
			stroke="currentColor"
			class="h-4 w-4"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
			/>
		</svg>
	</button>
</div>
