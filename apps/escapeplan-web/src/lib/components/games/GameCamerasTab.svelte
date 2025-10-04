<script lang="ts">
  import Alert from '$lib/components/ui/Alert.svelte';

  interface CameraSummary {
    id: string;
    name: string;
    location?: string;
  }

  let {
    availableCameras,
    assignedCameraIds = $bindable(),
    onCamerasChange
  }: {
    availableCameras: CameraSummary[];
    assignedCameraIds: string[];
    onCamerasChange: (cameraIds: string[]) => void;
  } = $props();

  function toggleCamera(cameraId: string) {
    const newIds = assignedCameraIds.includes(cameraId)
      ? assignedCameraIds.filter(id => id !== cameraId)
      : [...assignedCameraIds, cameraId];
    onCamerasChange(newIds);
  }
</script>

<div class="space-y-4">
  <div class="rounded-lg border border-white/10 bg-base-100/70 p-4">
    <h3 class="text-sm font-semibold text-base-content mb-2">Associated Cameras</h3>
    <p class="text-sm text-base-content/60 mb-4">
      Select cameras to display during this game's sessions
    </p>

    <div class="space-y-2">
      {#if availableCameras.length === 0}
        <Alert type="info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5 inline-block mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>No cameras available. Add cameras in the camera management section.</span>
        </Alert>
      {:else}
        <div class="space-y-2">
          {#each availableCameras as camera (camera.id)}
            <label class="flex items-center gap-3 rounded-lg border border-white/10 bg-base-200/50 p-3 cursor-pointer hover:bg-base-200/70 transition-colors">
              <input
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm"
                checked={assignedCameraIds.includes(camera.id)}
                onchange={() => toggleCamera(camera.id)}
              />
              <div class="flex-1">
                <div class="font-medium text-sm">{camera.name}</div>
                {#if camera.location}
                  <div class="text-xs text-base-content/60">{camera.location}</div>
                {/if}
              </div>
            </label>
          {/each}
        </div>

        {#if assignedCameraIds.length > 0}
          <Alert type="success" class="mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5 inline-block mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>{assignedCameraIds.length} camera(s) selected</span>
          </Alert>
        {:else}
          <Alert type="warning" class="mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5 inline-block mr-2">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span>No cameras selected. Sessions will not have camera feeds.</span>
          </Alert>
        {/if}
      {/if}
    </div>
  </div>
</div>
