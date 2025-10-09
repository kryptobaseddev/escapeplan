import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	compilerOptions: {
		// Disable all accessibility warnings globally
		// Warning codes use underscores (e.g., a11y_click_events_have_key_events)
		warningFilter: (warning) => {
			if (warning.code.startsWith('a11y_')) return false;
			return true;
		}
	},

	kit: {
		adapter: adapter({
			// Build output directory
			out: 'build',
			// Pre-compress assets with gzip/brotli for nginx gzip_static
			precompress: true,
			// No custom environment variable prefix
			envPrefix: ''
		}),
		// CSRF protection configuration
		csrf: {
			checkOrigin: true
		}
	}
};

export default config;
