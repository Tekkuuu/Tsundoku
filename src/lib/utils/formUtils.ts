import type { RemoteFormEnhanceCallback, RemoteFormInput } from '@sveltejs/kit';
import { toaster } from '../components/toaster';
import { m } from '$lib/paraglide/messages';

export type EnhanceHandlerOptions = {
	success: string;
	invalidData?: string;
	error?: string;
	reset?: boolean;
	onSuccess?: () => void;
	onInvalidData?: () => void;
	onError?: () => void;
};

/**
 * Standard `enhance` wiring for remote forms: submit, optional reset,
 * toast with a paraglide-translated title and a per-instance description.
 * The three outcomes are success, invalid data and error.
 */
export function createEnhanceHandler<Input extends RemoteFormInput | void, Output = void>(
	options: EnhanceHandlerOptions
): RemoteFormEnhanceCallback<Input, Output> {
	const { success, invalidData, error, reset = true, onSuccess, onInvalidData, onError } = options;

	return async (form) => {
		try {
			if (await form.submit()) {
				if (reset) {
					form.element.reset();
				}
				toaster.success({
					title: m.toast_title_success(),
					description: success
				});
				onSuccess?.();
			} else {
				toaster.error({
					title: m.toast_title_invalid_data(),
					description: invalidData ?? m.toast_description_invalid_data()
				});
				onInvalidData?.();
			}
		} catch (err) {
			console.error('[form] error', err);
			toaster.error({
				title: m.toast_title_error(),
				description: error ?? m.toast_description_error()
			});
			onError?.();
		}
	};
}

export type RemoteActionOptions = {
	success: string;
	error?: string;
	run: () => Promise<unknown>;
	onSuccess?: () => void | Promise<void>;
	onError?: (error: unknown) => void | Promise<void>;
};

/**
 * Standard wiring for one-shot remote commands fired from a button:
 * run the command, do the follow-up work (refresh/invalidate), then toast.
 * The two outcomes are success and error.
 */
export function createRemoteActionHandler(options: RemoteActionOptions): () => Promise<void> {
	const { success, error, run, onSuccess, onError } = options;

	return async () => {
		try {
			await run();
			await onSuccess?.();
			toaster.success({
				title: m.toast_title_success(),
				description: success
			});
		} catch (err) {
			console.error('[remote] error', err);
			toaster.error({
				title: m.toast_title_error(),
				description: error ?? m.toast_description_error()
			});
			await onError?.(err);
		}
	};
}
