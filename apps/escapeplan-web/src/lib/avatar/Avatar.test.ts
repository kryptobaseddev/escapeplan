import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Avatar from './Avatar.svelte';
import type { BotttsAvatarConfig } from '@escapeplan/contracts';

describe('Avatar.svelte', () => {
  it('renders deterministic data URI with given config', () => {
    const config: BotttsAvatarConfig = {
      seed: 'test-seed',
      eyes: ['happy'],
      mouth: ['smile01']
    };

    const { container } = render(Avatar, { props: { config } });
    const img = container.querySelector('img');

    expect(img).toBeTruthy();
    expect(img?.src).toContain('data:image/svg+xml');
    expect(img?.alt).toBe('User avatar');
  });

  it('uses username as seed when no config provided', () => {
    const { container } = render(Avatar, { props: { username: 'admin' } });
    const img = container.querySelector('img');

    expect(img).toBeTruthy();
    expect(img?.src).toContain('data:image/svg+xml');
  });

  it('renders with custom size', () => {
    const config: BotttsAvatarConfig = { seed: 'test' };
    const size = 128;

    const { container } = render(Avatar, { props: { config, size } });
    const img = container.querySelector('img');

    expect(img?.style.width).toBe(`${size}px`);
    expect(img?.style.height).toBe(`${size}px`);
  });

  it('applies custom CSS class', () => {
    const config: BotttsAvatarConfig = { seed: 'test' };
    const customClass = 'my-custom-class';

    const { container } = render(Avatar, { props: { config, class: customClass } });
    const img = container.querySelector('img');

    expect(img?.className).toContain(customClass);
    expect(img?.className).toContain('avatar-container');
  });

  it('generates same data URI for same config (deterministic)', () => {
    const config: BotttsAvatarConfig = {
      seed: 'deterministic-test',
      eyes: ['happy'],
      mouth: ['smile01']
    };

    const { container: container1 } = render(Avatar, { props: { config } });
    const img1 = container1.querySelector('img');
    const dataUri1 = img1?.src;

    const { container: container2 } = render(Avatar, { props: { config } });
    const img2 = container2.querySelector('img');
    const dataUri2 = img2?.src;

    expect(dataUri1).toBe(dataUri2);
    expect(dataUri1).toBeTruthy();
  });

  it('generates different data URI for different seeds', () => {
    const config1: BotttsAvatarConfig = { seed: 'seed1' };
    const config2: BotttsAvatarConfig = { seed: 'seed2' };

    const { container: container1 } = render(Avatar, { props: { config: config1 } });
    const img1 = container1.querySelector('img');

    const { container: container2 } = render(Avatar, { props: { config: config2 } });
    const img2 = container2.querySelector('img');

    expect(img1?.src).not.toBe(img2?.src);
  });

  it('respects config options like eyes and mouth', () => {
    const config: BotttsAvatarConfig = {
      seed: 'options-test',
      eyes: ['happy'],
      mouth: ['smile01'],
      baseColor: ['red']
    };

    const { container } = render(Avatar, { props: { config } });
    const img = container.querySelector('img');

    // Avatar should render successfully with all options
    expect(img).toBeTruthy();
    expect(img?.src).toContain('data:image/svg+xml');
  });
});
