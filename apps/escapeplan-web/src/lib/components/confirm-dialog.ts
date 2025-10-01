import type { Component } from 'svelte';

type Variant = 'info' | 'warning' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
  requiresTypedConfirm?: boolean;
  confirmWord?: string;
  customContent?: {
    component: Component;
    props?: Record<string, unknown>;
  };
  disableBackdropClose?: boolean;
}

interface ConfirmDialogRequest {
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

interface DialogState {
  current: ConfirmDialogRequest | null;
  queue: ConfirmDialogRequest[];
}

type DialogSubscriber = (state: DialogState) => void;

type Unsubscriber = () => void;

type Updater<T> = (value: T) => T;

function createDialogStore() {
  let state: DialogState = { current: null, queue: [] };
  const subscribers: Set<DialogSubscriber> = new Set();

  function notify() {
    subscribers.forEach((subscriber) => subscriber(state));
  }

  function update(updater: Updater<DialogState>) {
    state = updater(state);
    notify();
  }

  function subscribe(run: DialogSubscriber): Unsubscriber {
    run(state);
    subscribers.add(run);
    return () => subscribers.delete(run);
  }

  function open(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      update((current) => {
        const request: ConfirmDialogRequest = { options, resolve };
        if (!current.current) {
          return { current: request, queue: [] };
        }
        return { ...current, queue: [...current.queue, request] };
      });
    });
  }

  function close(result: boolean) {
    const { current } = state;
    if (!current) return;
    current.resolve(result);
    update((existing) => {
      const next = existing.queue[0];
      if (!next) {
        return { current: null, queue: [] };
      }
      return { current: next, queue: existing.queue.slice(1) };
    });
  }

  function reset() {
    update(() => ({ current: null, queue: [] }));
  }

  return {
    subscribe,
    open,
    close,
    reset
  };
}

export const confirmDialogStore = createDialogStore();

export function openConfirmDialog(options: ConfirmDialogOptions) {
  return confirmDialogStore.open(options);
}

export function closeConfirmDialog(result: boolean) {
  confirmDialogStore.close(result);
}

export function resetConfirmDialogs() {
  confirmDialogStore.reset();
}
