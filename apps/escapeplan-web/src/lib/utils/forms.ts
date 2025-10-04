import type { SubmitFunction } from '@sveltejs/kit';

interface FormHandlerOptions {
	onSubmit?: () => void;
	onSuccess?: (result: any) => void | Promise<void>;
	onError?: (result: any) => void;
	onFinally?: () => void;
}

export function createFormHandler(options: FormHandlerOptions = {}): SubmitFunction {
	return () => {
		// Call onSubmit before the form is submitted
		options.onSubmit?.();

		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') {
					options.onError?.(result);
					return;
				}

				if (result.type === 'success') {
					await update({ invalidateAll: false });
					await options.onSuccess?.(result);
					return;
				}

				// For other result types, just update normally
				await update();
			} finally {
				options.onFinally?.();
			}
		};
	};
}
