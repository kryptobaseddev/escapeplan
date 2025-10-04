<script lang="ts">
  interface Crumb {
    label: string;
    href?: string;
  }

  interface Props {
    crumbs: Crumb[];
    class?: string;
  }

  let {
    crumbs,
    class: className = ''
  } = $props();
</script>

<div class="breadcrumbs text-sm {className}">
  <ul>
    {#each crumbs as crumb}
      <li>
        {#if crumb.href}
          <a href={crumb.href}>{crumb.label}</a>
        {:else}
          {crumb.label}
        {/if}
      </li>
    {/each}
  </ul>
</div>
