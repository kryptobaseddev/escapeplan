<script lang="ts">
  import { onMount } from 'svelte';
  
  // Props
  export let cameraId: string | null = null; // null = add new, string = edit existing
  export let gameId: string | null = null; // Associate with game
  export let onSave: (camera: any) => void;
  export let onCancel: () => void;
  
  // Camera templates and brands
  let templates: any[] = [];
  let brands: string[] = [];
  let selectedBrand = '';
  let selectedModel = '';
  let brandModels: any[] = [];
  
  // Camera data (matches 2-table schema)
  let camera = {
    id: '',
    name: '',
    brand: 'generic',
    model: '',
    game_id: gameId || '',
    host: '',
    port: 554,
    username: '',
    password: '',
    protocol: 'rtsp',
    main_stream_path: '',
    sub_stream_path: '',
    has_ptz: false,
    has_audio: false,
    has_ir_control: false,
    ir_mode: 'auto',
    audio_volume: 80,
    ptz_pan: 0,
    ptz_tilt: 0,
    ptz_zoom: 0
  };
  
  // Main stream config
  let mainStream = {
    stream_type: 'main',
    stream_path: '',
    resolution: '1920x1080',
    frame_rate: 15,
    codec: 'h264'
  };
  
  // Sub stream config
  let subStream = {
    stream_type: 'sub',
    stream_path: '',
    resolution: '640x480',
    frame_rate: 10,
    codec: 'h264'
  };
  
  // UI state
  let activeTab = 'basic'; // basic | streams | features
  let testResult: any = null;
  let testing = false;
  let saving = false;
  let showPassword = false;
  
  onMount(async () => {
    // Load templates
    const res = await fetch('/api/camera-templates');
    const data = await res.json();
    templates = data.templates || [];
    brands = [...new Set(templates.map((t: any) => t.brand))];
    
    // If editing, load existing camera
    if (cameraId) {
      const cameraRes = await fetch(`/api/cameras/${cameraId}`);
      const cameraData = await cameraRes.json();
      camera = { ...camera, ...cameraData };
      selectedBrand = camera.brand;
      selectedModel = camera.model || '';
      
      // Load stream configs
      const streamsRes = await fetch(`/api/cameras/${cameraId}/streams`);
      const streams = await streamsRes.json();
      const main = streams.find((s: any) => s.stream_type === 'main');
      const sub = streams.find((s: any) => s.stream_type === 'sub');
      if (main) mainStream = { ...mainStream, ...main };
      if (sub) subStream = { ...subStream, ...sub };
    }
  });
  
  // When brand changes, update models and auto-fill
  $: if (selectedBrand) {
    brandModels = templates.filter(t => t.brand === selectedBrand);
    if (!selectedModel && brandModels.length > 0) {
      // Auto-select first model if available
      selectedModel = brandModels[0].id;
    }
  }
  
  // When model changes, auto-fill from template
  $: if (selectedModel) {
    const template = templates.find(t => t.id === selectedModel);
    if (template) {
      camera.brand = template.brand;
      camera.model = template.model;
      camera.port = template.default_port;
      camera.protocol = template.protocol;
      camera.main_stream_path = template.main_stream_path;
      camera.sub_stream_path = template.sub_stream_path || '';
      camera.has_ptz = template.has_ptz || false;
      camera.has_audio = template.has_audio || false;
      camera.has_ir_control = template.has_ir || false;
      
      // Update stream configs from template
      if (template.recommended_settings) {
        mainStream.resolution = template.recommended_settings.main_resolution || '1920x1080';
        mainStream.frame_rate = template.recommended_settings.main_fps || 15;
        mainStream.codec = template.video_specs?.main_codec || 'h264';
        mainStream.stream_path = template.main_stream_path;
        
        if (template.sub_stream_path) {
          subStream.resolution = template.recommended_settings.sub_resolution || '640x480';
          subStream.frame_rate = template.recommended_settings.sub_fps || 10;
          subStream.codec = template.video_specs?.sub_codec || 'h264';
          subStream.stream_path = template.sub_stream_path;
        }
      }
    }
  }
  
  async function testConnection() {
    testing = true;
    testResult = null;
    
    try {
      const res = await fetch('/api/cameras/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: camera.host,
          port: camera.port,
          username: camera.username,
          password: camera.password,
          streamPath: camera.main_stream_path
        })
      });
      
      testResult = await res.json();
    } catch (err: any) {
      testResult = { valid: false, error: err.message };
    } finally {
      testing = false;
    }
  }
  
  async function handleSave() {
    saving = true;
    
    try {
      const payload = {
        camera: {
          ...camera,
          game_id: camera.game_id || null
        },
        streams: [
          { ...mainStream, camera_id: camera.id || undefined },
          camera.sub_stream_path ? { ...subStream, camera_id: camera.id || undefined } : null
        ].filter(Boolean)
      };
      
      if (cameraId) {
        // Update existing
        await fetch(`/api/cameras/${cameraId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new
        await fetch('/api/cameras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      onSave(camera);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save camera');
    } finally {
      saving = false;
    }
  }
</script>

<div class="camera-settings-form">
  <!-- Header -->
  <div class="form-header">
    <h2>{cameraId ? 'Edit Camera' : 'Add Camera'}</h2>
    <button class="btn btn-sm btn-ghost" on:click={onCancel}>✕</button>
  </div>
  
  <!-- Tabs -->
  <div class="tabs tabs-boxed mb-4">
    <button 
      class="tab" 
      class:tab-active={activeTab === 'basic'}
      on:click={() => activeTab = 'basic'}
    >
      Basic Settings
    </button>
    <button 
      class="tab" 
      class:tab-active={activeTab === 'streams'}
      on:click={() => activeTab = 'streams'}
    >
      Stream Config
    </button>
    <button 
      class="tab" 
      class:tab-active={activeTab === 'features'}
      on:click={() => activeTab = 'features'}
      disabled={!camera.has_ptz && !camera.has_audio && !camera.has_ir_control}
    >
      Features
    </button>
  </div>
  
  <!-- Tab Content -->
  <div class="tab-content">
    
    <!-- Basic Settings Tab -->
    {#if activeTab === 'basic'}
      <div class="form-section">
        <!-- Brand Selection -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Camera Brand</span>
          </label>
          <select class="select select-bordered" bind:value={selectedBrand}>
            <option value="">Select brand...</option>
            {#each brands as brand}
              <option value={brand}>{brand.charAt(0).toUpperCase() + brand.slice(1)}</option>
            {/each}
          </select>
        </div>
        
        <!-- Model Selection -->
        {#if brandModels.length > 0}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Model (Optional)</span>
            </label>
            <select class="select select-bordered" bind:value={selectedModel}>
              <option value="">Generic {selectedBrand}</option>
              {#each brandModels as model}
                <option value={model.id}>{model.display_name}</option>
              {/each}
            </select>
          </div>
        {/if}
        
        <!-- Camera Name -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Camera Name *</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered" 
            placeholder="Front Door Camera"
            bind:value={camera.name}
            required
          />
        </div>
        
        <!-- IP Address -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">IP Address *</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered" 
            placeholder="10.10.10.100"
            bind:value={camera.host}
            required
          />
        </div>
        
        <!-- Port -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Port</span>
          </label>
          <input 
            type="number" 
            class="input input-bordered" 
            bind:value={camera.port}
          />
        </div>
        
        <!-- Username -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Username *</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered" 
            placeholder="admin"
            bind:value={camera.username}
            required
          />
        </div>
        
        <!-- Password -->
        <div class="form-control">
          <label class="label">
            <span class="label-text">Password *</span>
          </label>
          <div class="input-group">
            <input 
              type={showPassword ? 'text' : 'password'}
              class="input input-bordered flex-1" 
              bind:value={camera.password}
              required
            />
            <button 
              class="btn btn-square" 
              on:click={() => showPassword = !showPassword}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        
        <!-- Test Connection -->
        <div class="form-control mt-4">
          <button 
            class="btn btn-primary" 
            on:click={testConnection}
            disabled={testing || !camera.host || !camera.username || !camera.password}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        
        <!-- Test Result -->
        {#if testResult}
          <div class="alert {testResult.valid ? 'alert-success' : 'alert-error'} mt-4">
            {#if testResult.valid}
              <div>
                <span class="font-bold">✓ Connection successful!</span>
                <div class="text-sm mt-1">
                  Resolution: {testResult.resolution} | FPS: {testResult.fps} | Codec: {testResult.codec}
                  {#if testResult.hasAudio}| Audio: Yes{/if}
                </div>
              </div>
            {:else}
              <div>
                <span class="font-bold">✗ Connection failed</span>
                <div class="text-sm mt-1">{testResult.error}</div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Stream Config Tab -->
    {#if activeTab === 'streams'}
      <div class="form-section">
        <h3 class="font-bold mb-4">Main Stream</h3>
        
        <div class="form-control">
          <label class="label">
            <span class="label-text">Stream Path</span>
          </label>
          <input 
            type="text" 
            class="input input-bordered" 
            bind:value={mainStream.stream_path}
            placeholder={camera.main_stream_path}
          />
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Resolution</span>
            </label>
            <select class="select select-bordered" bind:value={mainStream.resolution}>
              <option value="3840x2160">4K (3840x2160)</option>
              <option value="2560x1440">2K (2560x1440)</option>
              <option value="1920x1080">1080p (1920x1080)</option>
              <option value="1280x720">720p (1280x720)</option>
            </select>
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Frame Rate</span>
            </label>
            <select class="select select-bordered" bind:value={mainStream.frame_rate}>
              <option value={10}>10 FPS</option>
              <option value={15}>15 FPS</option>
              <option value={20}>20 FPS</option>
              <option value={25}>25 FPS</option>
              <option value={30}>30 FPS</option>
            </select>
          </div>
        </div>
        
        <div class="form-control">
          <label class="label">
            <span class="label-text">Codec</span>
          </label>
          <select class="select select-bordered" bind:value={mainStream.codec}>
            <option value="h264">H.264</option>
            <option value="h265">H.265</option>
            <option value="mjpeg">MJPEG</option>
          </select>
        </div>
        
        {#if camera.sub_stream_path}
          <div class="divider">Sub Stream</div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Stream Path</span>
            </label>
            <input 
              type="text" 
              class="input input-bordered" 
              bind:value={subStream.stream_path}
              placeholder={camera.sub_stream_path}
            />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Resolution</span>
              </label>
              <select class="select select-bordered" bind:value={subStream.resolution}>
                <option value="640x480">VGA (640x480)</option>
                <option value="640x360">360p (640x360)</option>
                <option value="704x480">D1 (704x480)</option>
              </select>
            </div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text">Frame Rate</span>
              </label>
              <select class="select select-bordered" bind:value={subStream.frame_rate}>
                <option value={5}>5 FPS</option>
                <option value={10}>10 FPS</option>
                <option value={15}>15 FPS</option>
              </select>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    
    <!-- Features Tab -->
    {#if activeTab === 'features'}
      <div class="form-section">
        
        <!-- IR Control -->
        {#if camera.has_ir_control}
          <div class="form-control">
            <label class="label">
              <span class="label-text">IR / Night Vision Mode</span>
            </label>
            <select class="select select-bordered" bind:value={camera.ir_mode}>
              <option value="auto">Auto (sensor-based)</option>
              <option value="on">Always On (night mode)</option>
              <option value="off">Always Off (day mode)</option>
            </select>
          </div>
        {/if}
        
        <!-- Audio Volume -->
        {#if camera.has_audio}
          <div class="form-control">
            <label class="label">
              <span class="label-text">Audio Volume: {camera.audio_volume}%</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              class="range range-primary" 
              bind:value={camera.audio_volume}
            />
          </div>
        {/if}
        
        <!-- PTZ Position -->
        {#if camera.has_ptz}
          <div class="divider">PTZ Position</div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Pan: {camera.ptz_pan}°</span>
            </label>
            <input 
              type="range" 
              min="-180" 
              max="180" 
              class="range range-primary" 
              bind:value={camera.ptz_pan}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Tilt: {camera.ptz_tilt}°</span>
            </label>
            <input 
              type="range" 
              min="-90" 
              max="90" 
              class="range range-primary" 
              bind:value={camera.ptz_tilt}
            />
          </div>
          
          <div class="form-control">
            <label class="label">
              <span class="label-text">Zoom: {camera.ptz_zoom}x</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="10" 
              step="0.1"
              class="range range-primary" 
              bind:value={camera.ptz_zoom}
            />
          </div>
        {/if}
      </div>
    {/if}
    
  </div>
  
  <!-- Actions -->
  <div class="form-actions mt-6 flex gap-2 justify-end">
    <button class="btn btn-ghost" on:click={onCancel}>
      Cancel
    </button>
    <button 
      class="btn btn-primary" 
      on:click={handleSave}
      disabled={saving || !camera.name || !camera.host || !camera.username || !camera.password}
    >
      {saving ? 'Saving...' : (cameraId ? 'Update Camera' : 'Add Camera')}
    </button>
  </div>
</div>

<style>
  .camera-settings-form {
    @apply bg-base-200 rounded-lg p-6 max-w-2xl mx-auto;
  }
  
  .form-header {
    @apply flex justify-between items-center mb-6;
  }
  
  .form-section {
    @apply space-y-4;
  }
  
  .tab-content {
    @apply min-h-96;
  }
  
  .form-actions {
    @apply border-t pt-4 mt-6;
  }
</style>
