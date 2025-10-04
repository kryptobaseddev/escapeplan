<script lang="ts">
  interface Props {
    status: string;
    variant?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    status,
    variant = 'neutral',
    size = 'md',
    class: className = ''
  }: Props = $props();

  const sizeClasses = {
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg'
  };

  const variantClasses = {
    neutral: 'badge-neutral',
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error'
  };
</script>

<span class="badge {variantClasses[variant as keyof typeof variantClasses]} {sizeClasses[size as keyof typeof sizeClasses]} {className}">
  {status}
</span>
