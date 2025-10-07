<svelte:options runes={true} />

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageData } from './$types';
  import { getSocket } from '$lib/realtime/socket';
  import type { TimerBroadcast, RoomDisplayMediaEvent, RoomDisplayStatusEvent } from '@escapeplan/contracts';

  import RoomBackground from './components/RoomBackground.svelte';
  import RoomTimer from './components/RoomTimer.svelte';
  import RoomTextHint from './components/RoomTextHint.svelte';
  import RoomAudio from './components/RoomAudio.svelte';
  import RoomImage from './components/RoomImage.svelte';
  import RoomVideo from './components/RoomVideo.svelte';

  let { data, params }: { data: PageData; params: { slug: string } } = $props();

  let timer = $state<TimerBroadcast | null>(data.timer);
  let errorMessage = $state<string | null>(data.timerError ?? null);
  let currentMedia = $state<RoomDisplayMediaEvent | null>(null);
  let mediaKey = $state<string>('');
  let textHintDisplay = $state<RoomDisplayMediaEvent | null>(null);
  let backgroundAudio = $state<string | null>(null);
  let textHintTimer: ReturnType<typeof setTimeout> | null = null;
  let unsub: (() => void) | null = null;

  /**
   * Emit playback status to API via WebSocket
   */
  function emitPlaybackStatus(
    sessionId: string,
    mediaType: 'text' | 'image' | 'audio' | 'video',
    source: 'hint' | 'milestone',
    status: 'playing' | 'finished' | 'dismissed',
    triggeredAt: string
  ) {
    const socket = getSocket();
    if (socket) {
      const statusEvent: RoomDisplayStatusEvent = {
        slug: params.slug,
        sessionId,
        mediaType,
        source,
        status,
        triggeredAt,
        statusUpdatedAt: new Date().toISOString()
      };
      socket.emit('room-display:status', statusEvent);
    }
  }

  // WebSocket handlers
  onMount(() => {
    const socket = getSocket();
    if (socket) {
      // Timer updates
      socket.on('timer:update', (broadcast: TimerBroadcast) => {
        if (broadcast.slug === params.slug) {
          timer = broadcast;
          errorMessage = null;
        }
      });

      // Media events
      socket.on('room-display:media', (event: RoomDisplayMediaEvent) => {
        if (event.slug === params.slug) {
          // Handle text hints separately from regular media
          if (event.mediaType === 'text') {
            // Clear any existing text hint timer
            if (textHintTimer) {
              clearTimeout(textHintTimer);
              textHintTimer = null;
            }

            // Set text hint display immediately (replaces previous text)
            textHintDisplay = event;

            // Start background audio if present
            if (event.textHintSoundAssetUrl) {
              backgroundAudio = event.textHintSoundAssetUrl;
            }

            // Emit 'playing' status
            emitPlaybackStatus(
              event.sessionId,
              event.mediaType,
              event.source,
              'playing',
              event.triggeredAt
            );

            // Get text hint duration from timer broadcast or default to 60 seconds
            const textHintDurationMs = (timer?.roomConfig?.textHintDurationSeconds ?? 60) * 1000;

            // Auto-dismiss text after configured duration
            textHintTimer = setTimeout(() => {
              if (textHintDisplay?.sessionId === event.sessionId && textHintDisplay?.triggeredAt === event.triggeredAt) {
                // Emit 'finished' status before clearing
                emitPlaybackStatus(
                  event.sessionId,
                  event.mediaType,
                  event.source,
                  'finished',
                  event.triggeredAt
                );
                textHintDisplay = null;
              }
              textHintTimer = null;
            }, textHintDurationMs);
          } else {
            // Regular media (audio, video, image)
            // Force cleanup of previous media by clearing state first
            if (currentMedia) {
              currentMedia = null;
              // Allow cleanup cycle to complete before mounting new media
              setTimeout(() => {
                currentMedia = event;
                // Unique key forces component to fully remount
                mediaKey = `${event.mediaType}-${event.triggeredAt}`;

                // Emit 'playing' status when media starts
                emitPlaybackStatus(
                  event.sessionId,
                  event.mediaType,
                  event.source,
                  'playing',
                  event.triggeredAt
                );
              }, 50);
            } else {
              currentMedia = event;
              mediaKey = `${event.mediaType}-${event.triggeredAt}`;

              // Emit 'playing' status when media starts
              emitPlaybackStatus(
                event.sessionId,
                event.mediaType,
                event.source,
                'playing',
                event.triggeredAt
              );
            }
          }
        }
      });

      unsub = () => {
        socket.off('timer:update');
        socket.off('room-display:media');
      };
    }
  });

  onDestroy(() => {
    if (textHintTimer) {
      clearTimeout(textHintTimer);
      textHintTimer = null;
    }
    unsub?.();
  });

  function clearMedia(): void {
    // Emit 'finished' status before clearing
    if (currentMedia) {
      emitPlaybackStatus(
        currentMedia.sessionId,
        currentMedia.mediaType,
        currentMedia.source,
        'finished',
        currentMedia.triggeredAt
      );
    }

    currentMedia = null;
    mediaKey = '';
  }
</script>

{#if errorMessage}
  <div class="flex min-h-screen items-center justify-center bg-base-100">
    <div class="text-center">
      <h1 class="text-3xl font-display font-semibold text-error">Room Display Unavailable</h1>
      <p class="mt-2 text-sm text-base-content/60">{errorMessage}</p>
    </div>
  </div>
{:else if timer}
  <section class="relative min-h-screen overflow-hidden">

    <!-- Z-index 0: Background -->
    <RoomBackground
      background={timer.background}
      config={timer.roomConfig}
    />

    <!-- Z-index 10: Timer -->
    {#if timer.roomConfig?.showTimer !== false}
      <RoomTimer
        timer={timer.timer}
        gameName={timer.gameName}
        sessionId={timer.sessionId}
        position={timer.roomConfig?.timerPosition ?? 'center'}
        textColor={timer.roomConfig?.timerTextColor ?? '#FFFFFF'}
        backgroundColor={timer.roomConfig?.timerBackgroundColor ?? '#000000'}
        opacity={timer.roomConfig?.timerOpacity ?? 80}
      />
    {/if}

    <!-- Z-index 20+: Media Overlays -->

    <!-- Text hints with separate lifecycle -->
    {#if textHintDisplay}
      <RoomTextHint
        content={textHintDisplay.content}
        colors={textHintDisplay.textHintColors}
      />
    {/if}

    <!-- Background audio for text hints (plays independently) -->
    {#if backgroundAudio}
      <RoomAudio
        src={backgroundAudio}
        volumeLevel={80}
        loop={false}
        autoDismiss={true}
        onFinish={() => { backgroundAudio = null; }}
      />
    {/if}

    <!-- Regular media (audio, video, image) -->
    {#if currentMedia}
      {#key mediaKey}
        {#if currentMedia.mediaType === 'audio'}
          <RoomAudio
            src={currentMedia.content}
            volumeLevel={currentMedia.volumeLevel}
            loop={currentMedia.loop}
            loopCount={currentMedia.loopCount}
            autoDismiss={currentMedia.autoDismiss}
            onFinish={clearMedia}
          />
        {:else if currentMedia.mediaType === 'image'}
          <RoomImage
            src={currentMedia.content}
            displayDuration={currentMedia.displayDurationSeconds}
            autoDismiss={currentMedia.autoDismiss}
            scale={timer.roomConfig?.defaultMediaScale ?? 90}
            onDismiss={clearMedia}
          />
        {:else if currentMedia.mediaType === 'video'}
          <RoomVideo
            src={currentMedia.content}
            volumeLevel={currentMedia.volumeLevel}
            loop={currentMedia.loop}
            loopCount={currentMedia.loopCount}
            autoDismiss={currentMedia.autoDismiss}
            scale={timer.roomConfig?.defaultMediaScale ?? 90}
            onFinish={clearMedia}
          />
        {/if}
      {/key}
    {/if}

  </section>
{/if}
