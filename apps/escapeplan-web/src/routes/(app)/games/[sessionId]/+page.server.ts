import { fail, redirect, error as kitError } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeServerFetcher } from '$lib/api/server';
import type { CommandResponse, GameSessionDetails } from '$lib/api/types';

type CommandName = 'start_timer' | 'pause_timer' | 'resume_timer' | 'reset_timer' | 'send_hint' | 'mark_puzzle';

const commandEndpoint = (id: string) => `/sessions/${id}/commands` as const;

const sendCommand = async (
  event: Parameters<Actions['startTimer']>[0],
  command: CommandName,
  payload: Record<string, unknown> = {}
) => {
  const fetcher = makeServerFetcher(event);
  const sessionId = event.params.sessionId;

  await fetcher<CommandResponse>(commandEndpoint(sessionId), {
    method: 'POST',
    body: JSON.stringify({ command, payload })
  });
};

export const load: PageServerLoad = async (event) => {
  const fetcher = makeServerFetcher(event);
  const { sessionId } = event.params;

  try {
    const session = await fetcher<GameSessionDetails>(`/sessions/${sessionId}`);
    return { session };
  } catch (err) {
    console.error('Failed to load game session', err);
    throw kitError(503, 'Unable to load session details');
  }
};

export const actions: Actions = {
  startTimer: async (event) => {
    await sendCommand(event, 'start_timer');
    throw redirect(303, event.url.pathname);
  },
  pauseTimer: async (event) => {
    await sendCommand(event, 'pause_timer');
    throw redirect(303, event.url.pathname);
  },
  resumeTimer: async (event) => {
    await sendCommand(event, 'resume_timer');
    throw redirect(303, event.url.pathname);
  },
  resetTimer: async (event) => {
    await sendCommand(event, 'reset_timer');
    throw redirect(303, event.url.pathname);
  },
  sendHint: async (event) => {
    const formData = await event.request.formData();
    const message = formData.get('message');
    const medium = formData.get('medium') ?? 'text';

    if (typeof message !== 'string' || message.trim().length === 0) {
      return fail(400, { hintError: 'Hint message required.' });
    }

    await sendCommand(event, 'send_hint', { message: message.trim(), medium });
    throw redirect(303, event.url.pathname + '#hint-log');
  },
  markPuzzle: async (event) => {
    const formData = await event.request.formData();
    const puzzleId = formData.get('puzzleId');
    const status = formData.get('status');

    if (typeof puzzleId !== 'string' || typeof status !== 'string') {
      return fail(400, { puzzleError: 'Puzzle and status required.' });
    }

    await sendCommand(event, 'mark_puzzle', { puzzleId, status });
    throw redirect(303, event.url.pathname + '#puzzles');
  }
};
