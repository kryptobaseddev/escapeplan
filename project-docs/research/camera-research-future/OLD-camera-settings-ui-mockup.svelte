<!-- 
EscapePlan Enhanced Camera Settings UI
DaisyUI + Svelte 5 Component Mockup
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import type { Camera, CameraTemplate } from '$lib/types';
  
  // Props
  let camera: Partial<Camera> = {
    name: '',
    brand: '',
    model: '',
    host: '',
    port: 554,
    username: '',
    password: '',
    protocol: 'rtsp',
    transport: 'tcp',
    game_id: null,
    // New fields
    main_stream_path: '',
    sub_stream_path: '',
    has_ptz: false,
    has_audio: false,
    has_two_way_audio: false,
    has_ir_control: false,
    ir_mode: 'auto',
    audio_enabled: true,
    audio_volume: 80
  };
  
  let templates: CameraTemplate[] = [];
  let selectedTemplate: CameraTemplate | null = null;
  let availableModels: CameraTemplate[] = [];
  let games = []; // Load from API
  let testingConnection = false;
  let testResult: any = null;
  
  // Reactive: Filter models when brand changes
  $: if (camera.brand) {
    availableModels = templates.filter(t => t.brand === camera.brand);
    // Auto-select if only one model
    if (availableModels.length === 1) {
      selectModel(availableModels[0]);
    }
  }
  
  function selectModel(template: CameraTemplate) {
    selectedTemplate = template;
    // Auto-fill from template
    camera.model = template.model;
    camera.port = template.default_port;
    camera.onvif_port = template.default_onvif_port;
    camera.protocol = template.protocol;
    camera.main_stream_path = template.main_stream_path;
    camera.sub_stream_path = template.sub_stream_path;
    camera.transport = template.recommended_settings.transport;
    camera.has_ptz = template.capabilities.ptz;
    camera.has_audio = template.capabilities.audio;
    camera.has_two_way_audio = template.capabilities.two_way_audio;
    camera.has_ir_control = template.capabilities.ir_control;
  }
  
  async function testConnection() {
    testingConnection = true;
    testResult = null;
    
    try {
      const res = await fetch('/api/cameras/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(camera)
      });
      testResult = await res.json();
    } catch (error) {
      testResult = { success: false, error: error.message };
    } finally {
      testingConnection = false;
    }
  }
  
  async function saveCamera() {
    // Encrypt password on backend
    const res = await fetch('/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(camera)
    });
    
    if (res.ok) {
      // Navigate to camera list
      window.location.href = '/cameras';
    }
  }
</script>

<!-- Camera Settings Form -->
<div class="container mx-auto p-6 max-w-6xl">
  
  <!-- Header -->
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-3xl font-bold">Add Network Camera</h1>
      <p class="text-base-content/60 mt-1">Configure IP camera for your escape room</p>
    </div>
    
    <a href="/cameras" class="btn btn-ghost btn-sm">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      Cancel
    </a>
  </div>
  
  <!-- Progress Steps -->
  <div class="steps mb-8">
    <div class="step step-primary">Brand & Model</div>
    <div class="step {camera.brand ? 'step-primary' : ''}">Connection</div>
    <div class="step {testResult?.success ? 'step-primary' : ''}">Test</div>
    <div class="step">Configure</div>
  </div>
  
  <form on:submit|preventDefault={saveCamera}>
    
    <!-- Brand & Model Selection -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          Brand & Model Selection
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          
          <!-- Brand Selection -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Camera Brand *</span>
              <div class="tooltip tooltip-left" data-tip="Select your camera manufacturer">
                <svg class="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </label>
            <select class="select select-bordered select-primary" bind:value={camera.brand} required>
              <option value="">Choose brand...</option>
              <option value="reolink">Reolink</option>
              <option value="hikvision">Hikvision</option>
              <option value="dahua">Dahua</option>
              <option value="amcrest">Amcrest</option>
              <option value="axis">Axis</option>
              <option value="tapo">TP-Link Tapo</option>
              <option value="tplink">TP-Link VIGI</option>
              <option value="foscam">Foscam</option>
              <option value="generic">Generic ONVIF</option>
            </select>
          </div>
          
          <!-- Model Selection -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Camera Model (Optional)</span>
              <div class="tooltip tooltip-left" data-tip="Select for optimized settings">
                <svg class="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </label>
            <select 
              class="select select-bordered" 
              bind:value={camera.model}
              disabled={!camera.brand || availableModels.length === 0}
              on:change={() => {
                const template = availableModels.find(t => t.model === camera.model);
                if (template) selectModel(template);
              }}
            >
              <option value="">Auto-detect / Generic</option>
              {#each availableModels as model}
                <option value={model.model}>{model.display_name}</option>
              {/each}
            </select>
            {#if camera.brand && availableModels.length === 0}
              <label class="label">
                <span class="label-text-alt text-warning">No specific models found, using generic settings</span>
              </label>
            {/if}
          </div>
          
        </div>
        
        <!-- Model Info Alert (if selected) -->
        {#if selectedTemplate}
          <div class="alert alert-info mt-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <div>
              <h3 class="font-bold">{selectedTemplate.display_name}</h3>
              <div class="text-xs">
                {selectedTemplate.notes}
              </div>
              <!-- Capabilities badges -->
              <div class="flex gap-2 mt-2">
                {#if selectedTemplate.capabilities.ptz}
                  <div class="badge badge-success badge-sm">PTZ</div>
                {/if}
                {#if selectedTemplate.capabilities.audio}
                  <div class="badge badge-success badge-sm">Audio</div>
                {/if}
                {#if selectedTemplate.capabilities.two_way_audio}
                  <div class="badge badge-success badge-sm">2-Way Audio</div>
                {/if}
                {#if selectedTemplate.capabilities.ir_control}
                  <div class="badge badge-success badge-sm">IR Control</div>
                {/if}
                {#if selectedTemplate.capabilities.onvif}
                  <div class="badge badge-primary badge-sm">ONVIF</div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
        
      </div>
    </div>
    
    <!-- Basic Configuration -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Basic Configuration
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          
          <!-- Camera Name -->
          <div class="form-control md:col-span-2">
            <label class="label">
              <span class="label-text font-semibold">Camera Name *</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., Front Door Camera" 
              class="input input-bordered input-primary" 
              bind:value={camera.name}
              required
            />
            <label class="label">
              <span class="label-text-alt">Give your camera a descriptive name</span>
            </label>
          </div>
          
          <!-- IP Address -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">IP Address *</span>
              <div class="tooltip tooltip-left" data-tip="Local network IP address of camera">
                <svg class="w-4 h-4 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </label>
            <input 
              type="text" 
              placeholder="192.168.1.100" 
              class="input input-bordered" 
              bind:value={camera.host}
              pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
              required
            />
          </div>
          
          <!-- Port -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">RTSP Port</span>
              <div class="badge badge-sm">{selectedTemplate ? 'Auto' : 'Manual'}</div>
            </label>
            <input 
              type="number" 
              placeholder="554" 
              class="input input-bordered" 
              bind:value={camera.port}
              required
            />
            <label class="label">
              <span class="label-text-alt">Usually 554 (Foscam: 88)</span>
            </label>
          </div>
          
        </div>
      </div>
    </div>
    
    <!-- Authentication -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          Authentication
        </h2>
        
        {#if camera.brand === 'tapo'}
          <div class="alert alert-warning mb-4">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span>For Tapo cameras: Create a Camera Account in the Tapo app (Advanced Settings > Camera Account) before entering credentials here.</span>
          </div>
        {/if}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- Username -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Username *</span>
            </label>
            <input 
              type="text" 
              placeholder="admin" 
              class="input input-bordered" 
              bind:value={camera.username}
              autocomplete="off"
              required
            />
          </div>
          
          <!-- Password -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Password *</span>
              <div class="tooltip tooltip-left" data-tip="Encrypted before storage">
                <svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              class="input input-bordered" 
              bind:value={camera.password}
              autocomplete="new-password"
              required
            />
            <label class="label">
              <span class="label-text-alt text-success">🔒 Encrypted with military-grade security</span>
            </label>
          </div>
          
        </div>
      </div>
    </div>
    
    <!-- Network Settings -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
          </svg>
          Network Settings
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          
          <!-- Protocol -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Protocol</span>
            </label>
            <select class="select select-bordered" bind:value={camera.protocol}>
              <option value="rtsp">RTSP (Recommended)</option>
              <option value="onvif">ONVIF (Auto-discover)</option>
              <option value="mjpeg">MJPEG (Fallback)</option>
            </select>
          </div>
          
          <!-- Transport -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Transport</span>
            </label>
            <select class="select select-bordered" bind:value={camera.transport}>
              <option value="tcp">TCP (Reliable)</option>
              <option value="udp">UDP (Low Latency)</option>
            </select>
          </div>
          
          <!-- Resolution -->
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Resolution</span>
            </label>
            <select class="select select-bordered" bind:value={camera.default_resolution}>
              <option value="3840x2160">4K (3840x2160)</option>
              <option value="2560x1440">2K (2560x1440)</option>
              <option value="1920x1080" selected>1080p (1920x1080)</option>
              <option value="1280x720">720p (1280x720)</option>
              <option value="640x480">VGA (640x480)</option>
            </select>
          </div>
          
        </div>
      </div>
    </div>
    
    <!-- Advanced Features (PTZ, Audio, IR) -->
    {#if camera.has_ptz || camera.has_audio || camera.has_ir_control}
      <div class="card bg-base-200 shadow-xl mb-6">
        <div class="card-body">
          <h2 class="card-title">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Advanced Features
          </h2>
          
          <!-- PTZ Controls -->
          {#if camera.has_ptz}
            <div class="alert alert-success">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 class="font-bold">PTZ Control Enabled</h3>
                <div class="text-xs">Pan, Tilt, Zoom controls will be available after setup. You can save preset positions and create auto-patrol routes.</div>
              </div>
            </div>
          {/if}
          
          <!-- Audio Settings -->
          {#if camera.has_audio}
            <div class="divider">Audio Settings</div>
            
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text font-semibold">Enable Audio Input</span>
                <input type="checkbox" class="toggle toggle-primary" bind:checked={camera.audio_enabled} />
              </label>
            </div>
            
            {#if camera.audio_enabled}
              <div class="form-control">
                <label class="label">
                  <span class="label-text font-semibold">Audio Volume</span>
                  <span class="label-text-alt">{camera.audio_volume}%</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  bind:value={camera.audio_volume} 
                  class="range range-primary" 
                  step="10" 
                />
                <div class="w-full flex justify-between text-xs px-2">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            {/if}
            
            {#if camera.has_two_way_audio}
              <div class="alert alert-info">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Two-way audio supported - you can speak through camera's speaker</span>
              </div>
            {/if}
          {/if}
          
          <!-- IR/Night Vision -->
          {#if camera.has_ir_control}
            <div class="divider">Night Vision Control</div>
            
            <div class="form-control">
              <label class="label">
                <span class="label-text font-semibold">IR Mode</span>
              </label>
              <div class="btn-group w-full">
                <button 
                  type="button"
                  class="btn btn-sm flex-1" 
                  class:btn-active={camera.ir_mode === 'auto'}
                  on:click={() => camera.ir_mode = 'auto'}
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  Auto
                </button>
                <button 
                  type="button"
                  class="btn btn-sm flex-1" 
                  class:btn-active={camera.ir_mode === 'on'}
                  on:click={() => camera.ir_mode = 'on'}
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                  </svg>
                  Night
                </button>
                <button 
                  type="button"
                  class="btn btn-sm flex-1" 
                  class:btn-active={camera.ir_mode === 'off'}
                  on:click={() => camera.ir_mode = 'off'}
                >
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                  Day
                </button>
              </div>
              <label class="label">
                <span class="label-text-alt">
                  {#if camera.ir_mode === 'auto'}
                    Automatically switch based on light sensor
                  {:else if camera.ir_mode === 'on'}
                    Force night vision (IR LEDs always on)
                  {:else}
                    Force day mode (IR LEDs disabled, color only)
                  {/if}
                </span>
              </label>
            </div>
          {/if}
          
        </div>
      </div>
    {/if}
    
    <!-- Game Association -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"/>
          </svg>
          Associated Game (Optional)
        </h2>
        
        <div class="form-control">
          <label class="label">
            <span class="label-text">Link to Escape Room Game</span>
          </label>
          <select class="select select-bordered" bind:value={camera.game_id}>
            <option value={null}>No game association</option>
            {#each games as game}
              <option value={game.id}>{game.name}</option>
            {/each}
          </select>
          <label class="label">
            <span class="label-text-alt">Enables game-triggered recording and event correlation</span>
          </label>
        </div>
      </div>
    </div>
    
    <!-- Test Connection -->
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Test Connection
        </h2>
        
        <p class="text-base-content/70">Verify camera connectivity and stream access before saving</p>
        
        <button 
          type="button"
          class="btn btn-primary btn-block mt-4" 
          on:click={testConnection}
          disabled={!camera.brand || !camera.host || !camera.username || !camera.password || testingConnection}
        >
          {#if testingConnection}
            <span class="loading loading-spinner"></span>
            Testing Connection...
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Test Connection
          {/if}
        </button>
        
        {#if testResult}
          <div class="alert mt-4" class:alert-success={testResult.success} class:alert-error={!testResult.success}>
            {#if testResult.success}
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 class="font-bold">Connection Successful!</h3>
                <div class="text-sm">
                  <p>Resolution: {testResult.resolution}</p>
                  <p>Codec: {testResult.codec?.toUpperCase()}</p>
                  <p>FPS: {testResult.fps}</p>
                  {#if testResult.has_audio}
                    <p class="text-success">✓ Audio detected</p>
                  {/if}
                </div>
              </div>
            {:else}
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <h3 class="font-bold">Connection Failed</h3>
                <div class="text-sm">{testResult.error}</div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="flex gap-4">
      <button 
        type="submit" 
        class="btn btn-success flex-1"
        disabled={!testResult?.success}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Add Camera
      </button>
      
      <a href="/cameras" class="btn btn-ghost flex-1">
        Cancel
      </a>
    </div>
    
  </form>
  
</div>

<!-- Styles for better visual hierarchy -->
<style>
  .card {
    @apply transition-all hover:shadow-2xl;
  }
  
  .steps .step::before {
    @apply transition-all duration-300;
  }
  
  .btn-group .btn {
    @apply transition-all;
  }
  
  .alert {
    @apply animate-in fade-in slide-in-from-top-2 duration-300;
  }
</style>
