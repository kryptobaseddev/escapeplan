# MediaModal Component Documentation

## Overview

`MediaModal` is a versatile, reusable Svelte component for displaying images, audio, and video files in a modal overlay. It uses native HTML5 media elements for maximum browser compatibility and provides extensive customization options for layout, playback control, and asset metadata display.

**Location:** `/apps/escapeplan-web/src/lib/components/media/MediaModal.svelte`

## Features

- ✅ **Native HTML5** - No external dependencies (Vidstack removed)
- ✅ **Cross-Browser** - Works in Chrome, Safari, Edge, Amazon Silk
- ✅ **Responsive Scaling** - Control modal size with `windowScale` prop (10-100%)
- ✅ **Flexible Layout** - Position asset details top, bottom, left, or right
- ✅ **Headless Mode** - Hide controls for remote display scenarios
- ✅ **Sidebar-Aware** - Automatically constrains to main content area (no sidebar overlap)
- ✅ **Keyboard Support** - ESC key to close
- ✅ **Accessibility** - ARIA labels, semantic HTML, focus management

## Design Architecture

### Positioning System

The modal uses a **fixed positioning system** that respects the application's sidebar:

```css
/* Modal backdrop fills main content area only */
fixed inset-y-0 left-64 right-0

/* Sidebar width: 16rem (64 in Tailwind units) */
/* Modal appears only in the right-side content area */
```

This ensures:
- No overlap with the left sidebar
- Modal is centered in available viewport space
- Consistent positioning across all pages

### Layout System

The modal supports **four layout configurations** based on `assetDetailsPosition`:

| Position | Layout Direction | Asset Details Width |
|----------|-----------------|---------------------|
| `top`    | Vertical (column) | Full width |
| `bottom` | Vertical (column) | Full width |
| `left`   | Horizontal (row) | Fixed 16rem (w-64) |
| `right`  | Horizontal (row) | Fixed 16rem (w-64) |

### Scaling System

The `windowScale` prop controls modal size as a **percentage of viewport**:

```typescript
windowScale: 10-100 (default: 80)
```

- **Width:** `{scale}%` of viewport width
- **Max Height:** `{scale}vh` of viewport height
- Values are clamped between 10-100 for safety
- Media content scales within allocated space using `object-contain`

## Props Reference

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Controls modal visibility |
| `src` | `string` | URL/path to media file |
| `title` | `string` | Display title (shown in header) |
| `mediaType` | `'audio' \| 'video' \| 'image'` | Type of media to display |
| `onClose` | `() => void` | Callback when modal closes |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `windowScale` | `number` | `80` | Modal size as % of viewport (10-100) |
| `showControls` | `boolean` | `true` | Show/hide playback controls |
| `autoPlay` | `boolean` | `false` | Auto-play media on load |
| `mediaLoop` | `boolean` | `false` | Loop media playback |
| `assetDetails` | `AssetDetails \| null` | `null` | Optional metadata panel |
| `assetDetailsPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Where to position details panel |

### AssetDetails Interface

```typescript
interface AssetDetails {
  filename: string;        // Original filename
  size: string;           // Human-readable size (e.g., "15.3 MB")
  type: string;           // MIME type or description
  uploadedAt?: string;    // Upload timestamp (optional)
  [key: string]: any;     // Additional custom fields
}
```

## Usage Examples

### Basic Image Display

```svelte
<script>
  import MediaModal from '$lib/components/media/MediaModal.svelte';

  let showModal = $state(false);
</script>

<button onclick={() => showModal = true}>View Image</button>

<MediaModal
  isOpen={showModal}
  src="/assets/images/pirate.webp"
  title="Pirate Character"
  mediaType="image"
  windowScale={85}
  onClose={() => showModal = false}
/>
```

### Video with Asset Details (Right Side)

```svelte
<MediaModal
  isOpen={isOpen}
  src="/assets/videos/gameplay.mp4"
  title="Gameplay Recording"
  mediaType="video"
  windowScale={90}
  showControls={true}
  autoPlay={true}
  assetDetails={{
    filename: "gameplay.mp4",
    size: "15.3 MB",
    type: "video/mp4",
    uploadedAt: "2025-10-02 14:30:00"
  }}
  assetDetailsPosition="right"
  onClose={() => isOpen = false}
/>
```

### Audio Player with Details (Bottom)

```svelte
<MediaModal
  isOpen={isOpen}
  src="/assets/audio/intro.mp3"
  title="Intro Music"
  mediaType="audio"
  windowScale={70}
  showControls={true}
  autoPlay={false}
  mediaLoop={false}
  assetDetails={{
    filename: "intro.mp3",
    size: "4.2 MB",
    type: "audio/mpeg",
    uploadedAt: "2025-09-15"
  }}
  assetDetailsPosition="bottom"
  onClose={() => isOpen = false}
/>
```

### Headless Video (Remote Display)

For scenarios where you want video playback on a remote screen without controls:

```svelte
<MediaModal
  isOpen={isOpen}
  src="/assets/videos/hint-01.mp4"
  title="Hint Video"
  mediaType="video"
  windowScale={95}
  showControls={false}  <!-- Headless mode -->
  autoPlay={true}
  mediaLoop={true}
  onClose={() => isOpen = false}
/>
```

### Headless Audio (Background Playback)

For audio that plays without visible controls:

```svelte
<MediaModal
  isOpen={isOpen}
  src="/assets/audio/ambient.mp3"
  title="Ambient Sound"
  mediaType="audio"
  showControls={false}  <!-- Headless mode -->
  autoPlay={true}
  mediaLoop={true}
  onClose={() => isOpen = false}
/>
```

## Behavior Details

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ESC` | Close modal |

### Click Behavior

- **Backdrop Click** → Closes modal
- **Modal Content Click** → Prevents close (stops propagation)
- **Close Button Click** → Closes modal

### Media Loading

All media uses `preload="metadata"` for optimal performance:
- Loads metadata (duration, dimensions) immediately
- Defers full media download until needed
- Faster modal open times

### Mobile Considerations

Video elements include `playsinline` attribute to prevent fullscreen on mobile:

```html
<video playsinline>
```

This ensures videos play inline within the modal on iOS/Android devices.

## Browser Compatibility

### Supported Formats

| Media Type | Supported Formats | Browser Support |
|------------|------------------|-----------------|
| **Image** | JPEG, PNG, WebP, GIF, SVG | All modern browsers |
| **Video** | MP4 (H.264), WebM, OGG | Chrome, Safari, Edge, Silk |
| **Audio** | MP3, WAV, OGG, AAC | Chrome, Safari, Edge, Silk |

### Browser-Specific Notes

**Chrome/Edge (Chromium)**
- Full support for all formats
- Hardware acceleration for video

**Safari**
- Requires MP4/H.264 for video
- AAC/MP3 for audio
- WebP supported in Safari 14+

**Amazon Silk (Fire Tablets)**
- Full HTML5 media support
- Tested and working

### Feature Detection

The component includes fallback messages for unsupported browsers:

```html
<video>
  <track kind="captions" />
  Your browser does not support the video element.
</video>
```

## Styling and Theming

### DaisyUI Integration

The modal uses DaisyUI theme variables:

```css
/* Background colors */
bg-base-300  /* Modal container */
bg-base-200  /* Header and details panel */

/* Text colors */
text-base-content       /* Primary text */
text-base-content/70    /* Secondary text (70% opacity) */

/* Interactive elements */
btn btn-sm btn-circle btn-ghost hover:btn-error
```

### Custom Styling

The component includes scoped styles for media elements:

```css
/* Ensure media fills container properly */
video, audio {
  display: block;
}

/* DaisyUI-styled focus rings */
video:focus, audio:focus {
  outline: 2px solid hsl(var(--p));
  outline-offset: 2px;
}
```

### Z-Index Management

```css
z-[9999]  /* Modal overlay (highest priority) */
z-[9998]  /* Info popup (below media modal) */
```

## Performance Considerations

### Image Loading

- Uses `loading="eager"` for immediate display
- `object-contain` ensures proper aspect ratio
- No progressive loading (images load fully before display)

### Video/Audio Loading

- `preload="metadata"` loads minimal data upfront
- Full media loads on play
- Reduces initial page load time

### Memory Management

- Modal content only renders when `isOpen={true}`
- Media elements removed from DOM when modal closes
- No memory leaks from persistent media players

## Common Use Cases

### 1. Asset Library Browser

Display uploaded assets with metadata:

```svelte
<MediaModal
  isOpen={selectedAsset !== null}
  src={selectedAsset?.url}
  title={selectedAsset?.originalFilename}
  mediaType={selectedAsset?.mediaType}
  assetDetails={{
    filename: selectedAsset?.originalFilename,
    size: formatBytes(selectedAsset?.sizeBytes),
    type: selectedAsset?.mimeType,
    uploadedAt: formatDate(selectedAsset?.uploadedAt)
  }}
  assetDetailsPosition="right"
  onClose={() => selectedAsset = null}
/>
```

### 2. Game Hint System

Show hint videos with auto-play:

```svelte
<MediaModal
  isOpen={showingHint}
  src={currentHint.videoUrl}
  title={`Hint ${currentHint.order}`}
  mediaType="video"
  windowScale={75}
  showControls={true}
  autoPlay={true}
  onClose={() => showingHint = false}
/>
```

### 3. Remote Display (Headless)

Control playback on a separate screen:

```svelte
<MediaModal
  isOpen={remotePlayback.active}
  src={remotePlayback.src}
  title={remotePlayback.title}
  mediaType={remotePlayback.type}
  windowScale={100}
  showControls={false}   <!-- No UI -->
  autoPlay={true}
  mediaLoop={remotePlayback.loop}
  onClose={() => stopRemotePlayback()}
/>
```

### 4. Audio Ambience

Background audio with controls:

```svelte
<MediaModal
  isOpen={playingAudio}
  src="/assets/audio/room-ambience.mp3"
  title="Room Ambience"
  mediaType="audio"
  windowScale={60}
  showControls={true}
  autoPlay={true}
  mediaLoop={true}
  onClose={() => playingAudio = false}
/>
```

## Integration with AssetBrowser

The `AssetBrowser` component demonstrates full integration:

```svelte
<script>
  import MediaModal from '../media/MediaModal.svelte';

  let mediaModalOpen = $state(false);
  let currentMediaSrc = $state('');
  let currentMediaTitle = $state('');
  let currentMediaType = $state<'image' | 'audio' | 'video'>('image');

  function openMedia(asset: AssetRecord) {
    currentMediaSrc = asset.url;
    currentMediaTitle = asset.originalFilename;
    currentMediaType = asset.mediaType === 'video' ? 'video'
                     : asset.mediaType === 'audio' ? 'audio'
                     : 'image';
    mediaModalOpen = true;
  }
</script>

<MediaModal
  isOpen={mediaModalOpen}
  src={currentMediaSrc}
  title={currentMediaTitle}
  mediaType={currentMediaType}
  windowScale={85}
  showControls={true}
  autoPlay={true}
  mediaLoop={false}
  onClose={() => mediaModalOpen = false}
/>
```

## Accessibility Features

### ARIA Attributes

```html
<div role="dialog" aria-modal="true" aria-labelledby="media-modal-title">
  <h2 id="media-modal-title">{title}</h2>
  <button aria-label="Close modal">X</button>
</div>
```

### Keyboard Navigation

- **ESC key** closes modal
- Focus management (traps focus within modal when open)
- Close button is keyboard accessible

### Screen Reader Support

- Semantic HTML (`<dialog>` behavior)
- Descriptive ARIA labels
- Alt text for images (uses `title` prop)

## Troubleshooting

### Issue: Video not playing on iOS

**Solution:** Ensure `playsinline` is set (it is by default):
```html
<video playsinline>
```

### Issue: Modal too large/small

**Solution:** Adjust `windowScale` prop:
```svelte
<MediaModal windowScale={70} />  <!-- Smaller -->
<MediaModal windowScale={95} />  <!-- Larger -->
```

### Issue: Controls not showing

**Solution:** Check `showControls` prop:
```svelte
<MediaModal showControls={true} />
```

### Issue: Audio not auto-playing

**Solution:** Modern browsers block auto-play without user interaction. This is expected behavior. Either:
1. Require user interaction before opening modal
2. Mute audio for auto-play: `<audio muted autoplay>`

### Issue: Modal overlapping sidebar

**Solution:** Ensure modal is used in main content area. The modal automatically constrains to `left-64` (sidebar width). If sidebar width changes, update the modal's backdrop class.

## Future Enhancements

Potential features for future versions:

- [ ] Playlist support (multiple media files)
- [ ] Thumbnail preview scrubbing (video)
- [ ] Picture-in-picture mode
- [ ] Fullscreen toggle
- [ ] Download button
- [ ] Playback speed control
- [ ] Volume presets
- [ ] Custom keyboard shortcuts
- [ ] Captions/subtitles support

## Related Documentation

- [Asset Management System](./ASSET_MANAGEMENT.md)
- [API Contracts - Asset Schema](./API_CONTRACTS_SCHEMA_MANAGEMENT.md)
- [DaisyUI Component Guide](https://daisyui.com/components/)
- [HTML5 Media Elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-02 | Initial release with full feature set |
|       |            | - Removed Vidstack dependency |
|       |            | - Added native HTML5 media support |
|       |            | - Added windowScale prop |
|       |            | - Added assetDetails panel |
|       |            | - Added headless mode |

---

**Last Updated:** 2025-10-02
**Maintained By:** EscapePlan Development Team
