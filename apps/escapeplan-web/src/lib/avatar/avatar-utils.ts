import type { BotttsAvatarConfig } from '@escapeplan/contracts';

export function randomSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

export function randomizeAvatarConfig(): BotttsAvatarConfig {
  const randomFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const backgroundTypes = ['solid', 'gradientLinear'];
  const backgroundColors = [
    'b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'ffe5e5',
    'a8e6cf', 'ffd3b6', 'ffaaa5', 'ff8b94', '88d8b0', 'c7ceea'
  ];
  const baseColors = [
    'ffb300', '1e88e5', '546e7a', '6d4c41', '00acc1',
    'f4511e', '5e35b1', '43a047', '757575'
  ];
  const eyesOptions = ['bulging', 'dizzy', 'eva', 'frame1', 'frame2', 'glow', 'happy', 'hearts', 'robocop', 'round', 'sensor'];
  const faceOptions = ['round01', 'round02', 'square01', 'square02', 'square03'];
  const mouthOptions = ['bite', 'diagram', 'grill01', 'grill02', 'smile01', 'smile02', 'square01'];
  const sidesOptions = ['antenna01', 'antenna02', 'cables01', 'round', 'square'];
  const textureOptions = ['camo01', 'circuits', 'dirty01', 'dots', 'grunge01'];
  const topOptions = ['antenna', 'bulb01', 'glowingBulb01', 'horns', 'lights', 'pyramid', 'radar'];

  return {
    seed: randomSeed(),
    backgroundType: [randomFrom(backgroundTypes)],
    backgroundColor: [randomFrom(backgroundColors)],
    baseColor: [randomFrom(baseColors)],
    eyes: [randomFrom(eyesOptions)],
    face: [randomFrom(faceOptions)],
    mouth: [randomFrom(mouthOptions)],
    sides: [randomFrom(sidesOptions)],
    texture: [randomFrom(textureOptions)],
    top: [randomFrom(topOptions)]
  };
}
