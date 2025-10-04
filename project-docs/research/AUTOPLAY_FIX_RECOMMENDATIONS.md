# Autoplay Fix Recommendations

**Date:** 2025-10-04
**Priority:** HIGH - Current implementation is broken in all modern browsers
**Components Affected:** RoomAudio.svelte, RoomVideo.svelte

---

## Problem Summary

**Current State:**
- RoomAudio and RoomVideo components attempt to autoplay media in `onMount()`
- No user interaction is captured before playback
- **Result:** Autoplay ALWAYS FAILS in Chrome, Safari, Firefox, Edge

**User Impact:**
- Audio hints never play on Room Display screens
- Video hints never play on Room Display screens
- Silent failures with only console errors
- Poor user experience

---

## Root Cause

Browser autoplay policies (enforced since 2018) block media playback without user interaction:

1. ❌ **Audio:** Cannot autoplay, even when muted
2. ❌ **Video (unmuted):** Cannot autoplay without user gesture
3. ✅ **Video (muted):** CAN autoplay without user gesture

**Current Code Pattern (BROKEN):**
```javascript
onMount(() => {
  audioElement.play(); // NO user interaction = BLOCKED
});
```

---

## Solution Options

### Option 1: Full-Screen Play Button (Recommended for Room Display)

**Use Case:** Room Display screen where operator sends hint to players

**Rationale:**
- Room Display is a dedicated screen (no competing UI)
- Players expect media to appear when operator sends it
- Large, obvious play button is acceptable UX
- Guarantees playback works

**Implementation:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  interface AudioProps {
    src: string;
    volumeLevel?: number;
    loop?: boolean;
    loopCount?: number;
    autoDismiss?: boolean;
    onFinish?: () => void;
  }

  let { src, volumeLevel = 80, loop = false, loopCount, autoDismiss = true, onFinish }: AudioProps = $props();

  let audioElement: HTMLAudioElement | null = $state(null);
  let playCount = $state(0);
  let waitingForInteraction = $state(true);

  function handlePlayClick() {
    if (audioElement) {
      audioElement.volume = volumeLevel / 100;
      audioElement.play().catch((err) => {
        console.error('[RoomAudio] Play failed even after user click:', err);
      });
      waitingForInteraction = false;
    }
  }

  function handleEnded(): void {
    playCount++;

    if (loop) {
      if (loopCount && playCount >= loopCount) {
        if (autoDismiss && onFinish) {
          onFinish();
        }
      } else {
        audioElement?.play();
      }
    } else {
      if (autoDismiss && onFinish) {
        onFinish();
      }
    }
  }
</script>

{#if waitingForInteraction}
  <!-- Full-screen overlay with play button -->
  <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90">
    <svg class="w-32 h-32 mb-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
    <button class="btn btn-lg btn-primary gap-2" onclick={handlePlayClick}>
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
      Play Audio
    </button>
    <p class="text-sm text-white/60 mt-4">Tap to start playback</p>
  </div>
{:else}
  <!-- Playing state indicator -->
  <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90">
    <svg class="w-32 h-32 mb-8 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
    <p class="text-lg text-white">Playing audio...</p>
    <p class="text-sm text-white/60 mt-2">
      {loop && !loopCount ? 'Looping' : `Play ${playCount + 1}${loopCount ? `/${loopCount}` : ''}`}
    </p>
    {#if autoDismiss}
      <button class="btn btn-sm btn-ghost mt-4" onclick={() => onFinish?.()}>
        Stop
      </button>
    {/if}
  </div>
{/if}

<audio
  bind:this={audioElement}
  {src}
  style="display: none;"
  onended={handleEnded}
  playsinline
>
  <track kind="captions" />
</audio>
```

**For RoomVideo.svelte:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  interface VideoProps {
    src: string;
    volumeLevel?: number;
    loop?: boolean;
    loopCount?: number;
    autoDismiss?: boolean;
    scale?: number;
    onFinish?: () => void;
  }

  let { src, volumeLevel = 80, loop = false, loopCount, autoDismiss = true, scale = 90, onFinish }: VideoProps = $props();

  let videoElement: HTMLVideoElement | null = $state(null);
  let playCount = $state(0);
  let error = $state<string | null>(null);
  let waitingForInteraction = $state(true);

  function handlePlayClick() {
    if (videoElement) {
      videoElement.volume = volumeLevel / 100;
      videoElement.play().catch((err) => {
        console.error('[RoomVideo] Play failed even after user click:', err);
        error = 'Failed to play video';
      });
      waitingForInteraction = false;
    }
  }

  function handleEnded(): void {
    playCount++;

    if (loop) {
      if (loopCount && playCount >= loopCount) {
        if (autoDismiss && onFinish) {
          onFinish();
        }
      } else {
        videoElement?.play();
      }
    } else {
      if (autoDismiss && onFinish) {
        onFinish();
      }
    }
  }

  function handleVideoError(e: Event): void {
    console.error('[RoomVideo] Load error:', e);
    error = 'Failed to load video file';
  }

  function handleClick(): void {
    if (!waitingForInteraction && onFinish) {
      onFinish();
    }
  }
</script>

<div
  class="absolute inset-0 z-30 flex items-center justify-center bg-black/90"
  role="dialog"
  aria-label="Video display"
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Escape' && handleClick()}
>
  {#if waitingForInteraction}
    <!-- Play button overlay -->
    <div class="text-center">
      <button class="btn btn-lg btn-primary gap-2" onclick={handlePlayClick}>
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
        Play Video
      </button>
      <p class="text-sm text-white/60 mt-4">Tap to start playback</p>
    </div>

  {:else if error}
    <!-- Error state -->
    <div class="text-center p-8 bg-error/20 rounded-lg border border-error/40">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 text-error" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
      </svg>
      <p class="text-white text-lg font-semibold">{error}</p>
    </div>

  {:else}
    <!-- Video playing -->
    <div class="relative" style="width: {scale}%; height: {scale}%;">
      <video
        bind:this={videoElement}
        {src}
        class="h-full w-full object-contain"
        onended={handleEnded}
        onerror={handleVideoError}
        playsinline
      >
        <track kind="captions" />
      </video>

      <!-- Dismiss hint at bottom -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p class="text-xs text-white/60">
          {autoDismiss ? (loop && !loopCount ? 'Looping - Click to dismiss' : `Playing ${playCount + 1}${loopCount ? `/${loopCount}` : ''}`) : 'Click anywhere to dismiss'}
        </p>
      </div>
    </div>
  {/if}
</div>
```

---

### Option 2: Auto-Capture First Interaction (Alternative)

**Use Case:** If you want media to play "automatically" after user's first interaction with the page

**Trade-offs:**
- More "automatic" feeling
- But requires user to click SOMEWHERE first
- Could be confusing if user doesn't know they need to click

**Implementation:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let hasUserGesture = $state(false);
  let audioElement: HTMLAudioElement | null = $state(null);

  function captureUserGesture() {
    if (!hasUserGesture && audioElement) {
      hasUserGesture = true;
      audioElement.volume = volumeLevel / 100;
      audioElement.play().catch(console.error);
    }
  }

  onMount(() => {
    // Wait for first click anywhere on page
    document.addEventListener('click', captureUserGesture, { once: true });

    return () => {
      document.removeEventListener('click', captureUserGesture);
    };
  });
</script>

<div class="absolute inset-0 z-30 flex items-center justify-center bg-black/90">
  {#if !hasUserGesture}
    <div class="text-center">
      <p class="text-lg text-white mb-4">Audio ready</p>
      <p class="text-sm text-white/60">Tap anywhere to play</p>
    </div>
  {:else}
    <!-- Playing indicator -->
    <p class="text-white">Playing audio...</p>
  {/if}
</div>

<audio bind:this={audioElement} {src} style="display: none;" />
```

**Not Recommended:** This feels less explicit and could confuse users. Option 1 is clearer.

---

### Option 3: Muted Autoplay for Video Only (Background Videos)

**Use Case:** ONLY for background videos that don't need sound

**When to Use:**
- Room Display background video (RoomBackground.svelte) ✅ Already implemented correctly
- Decorative looping videos
- Visual-only content

**Implementation:**

```svelte
<video
  src={src}
  autoplay
  muted  <!-- Critical: must be muted -->
  loop
  playsinline
  class="h-full w-full object-cover"
/>
```

**NOT Suitable For:**
- Audio hints (no such thing as "muted audio")
- Video hints with important audio
- Any media where sound is essential

---

## Migration Plan

### Phase 1: Fix RoomAudio.svelte

**File:** `/apps/escapeplan-web/src/routes/(public)/room/[slug]/components/RoomAudio.svelte`

**Changes:**
1. Add `waitingForInteraction` state
2. Add full-screen play button overlay
3. Only call `.play()` after user clicks button
4. Show playing indicator after playback starts

**Estimated Time:** 30 minutes

**Testing:**
1. Send audio hint from Game Runner
2. RoomAudio component should show play button
3. Click play button
4. Audio should play at correct volume
5. Verify auto-dismiss works after playback

### Phase 2: Fix RoomVideo.svelte

**File:** `/apps/escapeplan-web/src/routes/(public)/room/[slug]/components/RoomVideo.svelte`

**Changes:**
1. Add `waitingForInteraction` state
2. Replace error-only state with play button state
3. Only call `.play()` after user clicks button
4. Improve error handling

**Estimated Time:** 30 minutes

**Testing:**
1. Send video hint from Game Runner
2. RoomVideo component should show play button
3. Click play button
4. Video should play at correct volume
5. Verify loop settings work
6. Test dismiss on click

### Phase 3: Verify MediaModal.svelte (No Changes Needed)

**File:** `/apps/escapeplan-web/src/lib/components/media/MediaModal.svelte`

**Status:** ✅ Already works correctly because:
- Modal opens on user click (provides gesture)
- autoplay prop works due to modal opening being user-initiated

**Testing:**
1. Open asset browser
2. Click on audio asset
3. MediaModal opens and plays (should work)
4. Verify video playback
5. Test headless mode

### Phase 4: Update Documentation

**Files to Update:**
1. `/apps/DOCS/MEDIA_MODAL.md` - Add autoplay policy notes
2. `/project-docs/research/ROOM_DISPLAY_MEDIA_RESEARCH.md` - Reference new findings

**Content:**
- Explain autoplay restrictions
- Document play button requirement
- Link to MUTED_UNMUTED_AUTOPLAY_RESEARCH.md

---

## Testing Checklist

### Before Deployment

- [ ] RoomAudio shows play button before playback
- [ ] RoomAudio plays audio after clicking play button
- [ ] RoomAudio respects volume level setting
- [ ] RoomAudio loops correctly (if configured)
- [ ] RoomAudio auto-dismisses after playback ends
- [ ] RoomVideo shows play button before playback
- [ ] RoomVideo plays video after clicking play button
- [ ] RoomVideo respects volume level setting
- [ ] RoomVideo loops correctly (if configured)
- [ ] RoomVideo dismisses on click
- [ ] MediaModal audio autoplay works (after modal opens)
- [ ] MediaModal video autoplay works (after modal opens)
- [ ] RoomBackground video autoplays muted (no change needed)

### Cross-Browser Testing

- [ ] Chrome (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (desktop)
- [ ] Safari (iOS)
- [ ] Edge
- [ ] Firefox

### Edge Cases

- [ ] Multiple rapid hint sends (don't stack play buttons)
- [ ] User clicks away before playback starts
- [ ] Network slow/offline - file fails to load
- [ ] Very short audio clips (< 1 second)
- [ ] Very long video files (> 5 minutes)

---

## Backward Compatibility

**Breaking Changes:** None - components will work BETTER after fix

**User Experience Changes:**
- **Before:** Media silently fails to play (bad UX)
- **After:** User sees play button and can start playback (good UX)

**API Compatibility:** All props remain the same, no contract changes needed

---

## Performance Considerations

**Impact:** Minimal

**Pros:**
- No media loading until user clicks (saves bandwidth)
- No failed play attempts cluttering console
- Clearer user intent

**Cons:**
- Slight delay between hint send and playback (human reaction time to click)
- Additional UI rendering (play button state)

**Mitigation:**
- Keep play button UI minimal and fast
- Pre-load media on hover (optional enhancement)

---

## Alternative: Muted→Unmute Button (NOT Recommended)

Some developers try this pattern:

```svelte
<video src={src} muted autoplay />
<button onclick={() => video.muted = false}>Unmute</button>
```

**Why NOT Recommended:**
1. Players won't see the unmute button (focused on gameplay)
2. Audio might be critical (hint instructions)
3. Extra step for users (annoying)
4. Doesn't work for audio (audio can't be "muted and playing")

**When It COULD Work:**
- Background music (optional)
- Ambient sounds (non-essential)
- Purely decorative audio

**For This Project:** Stick with Option 1 (play button)

---

## Security & Privacy Notes

**Why Browsers Block Autoplay:**
1. **User Annoyance:** Unexpected sound is jarring
2. **Data Usage:** Mobile users pay for bandwidth
3. **Battery Life:** Media playback drains battery
4. **Malware/Ads:** Prevent malicious autoplay ads
5. **Accessibility:** Users with sensory issues need control

**Respecting Policies:**
- Our fix complies with browser policies
- User explicitly chooses to play media
- No circumvention or deception
- Better overall user experience

---

## References

- [MUTED_UNMUTED_AUTOPLAY_RESEARCH.md](./MUTED_UNMUTED_AUTOPLAY_RESEARCH.md) - Full research findings
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay)
- [MDN Autoplay Guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- [Test Suite](http://localhost:5173/test-muted-unmute-pattern.html)

---

## Summary

**Problem:** RoomAudio and RoomVideo can't autoplay due to browser policies
**Solution:** Add play button that requires user click before playback
**Impact:** Better UX, guaranteed playback, policy-compliant
**Effort:** ~1 hour for both components + testing

**Recommended Action:** Implement Option 1 (Full-Screen Play Button) immediately

---

**Last Updated:** 2025-10-04
**Priority:** HIGH
**Status:** Ready for Implementation
