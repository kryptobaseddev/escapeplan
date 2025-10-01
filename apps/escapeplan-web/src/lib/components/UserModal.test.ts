import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserModal from './UserModal.svelte';
import type { OperatorSummary, BotttsAvatarConfig } from '@escapeplan/contracts';

// Mock crypto.randomUUID for deterministic tests
const mockRandomUUID = vi.fn(() => '12345678-1234-1234-1234-123456789abc');
global.crypto = { randomUUID: mockRandomUUID } as any;

describe('UserModal.svelte', () => {
  beforeEach(() => {
    mockRandomUUID.mockClear();
  });

  describe('Create Mode', () => {
    it('opens modal when open prop is true', () => {
      render(UserModal, { props: { open: true, mode: 'create' } });
      const dialog = document.querySelector('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog?.hasAttribute('open')).toBe(true);
    });

    it('generates username-based seed when username is entered', () => {
      const { container } = render(UserModal, { props: { open: true, mode: 'create' } });

      const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
      expect(usernameInput).toBeTruthy();

      // Type username - seed should update via hashSeed
      if (usernameInput) {
        usernameInput.value = 'testuser';
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Avatar config should use deterministic seed
      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      expect(avatarConfigInput).toBeTruthy();

      if (avatarConfigInput) {
        const config = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
        expect(config.seed).toContain('testuser');
      }
    });

    it('has randomize avatar button', () => {
      render(UserModal, { props: { open: true, mode: 'create' } });
      const randomizeButton = screen.queryByText(/Randomize/i);
      expect(randomizeButton).toBeTruthy();
    });

    it('randomize button changes avatar seed', async () => {
      const { container } = render(UserModal, { props: { open: true, mode: 'create' } });

      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      const initialConfig = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      const initialSeed = initialConfig.seed;

      const randomizeButton = screen.getByText(/Randomize/i);
      await fireEvent.click(randomizeButton);

      const updatedConfig = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      expect(updatedConfig.seed).not.toBe(initialSeed);
    });

    it('serializes avatarConfig as JSON in hidden input', () => {
      const { container } = render(UserModal, { props: { open: true, mode: 'create' } });

      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      expect(avatarConfigInput).toBeTruthy();
      expect(avatarConfigInput.type).toBe('hidden');

      const parsed = JSON.parse(avatarConfigInput.value);
      expect(parsed).toHaveProperty('seed');
      expect(typeof parsed.seed).toBe('string');
    });
  });

  describe('Edit Mode', () => {
    const mockUser: OperatorSummary = {
      id: 'user-123',
      username: 'existing.user',
      name: 'Existing User',
      email: 'existing@test.com',
      role: 'manager',
      permissions: ['view_dashboard', 'manage_users'],
      mustResetPassword: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      avatarConfig: {
        seed: 'existing-seed',
        eyes: ['happy'],
        mouth: ['smile01']
      }
    };

    it('loads existing avatarConfig in edit mode', () => {
      const { container } = render(UserModal, {
        props: {
          open: true,
          mode: 'edit',
          user: mockUser
        }
      });

      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      expect(avatarConfigInput).toBeTruthy();

      const config = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      expect(config.seed).toBe('existing-seed');
      expect(config.eyes).toEqual(['happy']);
      expect(config.mouth).toEqual(['smile01']);
    });

    it('has reset avatar button in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          mode: 'edit',
          user: mockUser
        }
      });

      const resetButton = screen.queryByText(/Reset/i);
      expect(resetButton).toBeTruthy();
    });

    it('reset button restores original avatar config', async () => {
      const { container } = render(UserModal, {
        props: {
          open: true,
          mode: 'edit',
          user: mockUser
        }
      });

      // First randomize the avatar
      const randomizeButton = screen.getByText(/Randomize/i);
      await fireEvent.click(randomizeButton);

      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      const randomizedConfig = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      expect(randomizedConfig.seed).not.toBe('existing-seed');

      // Then reset to original
      const resetButton = screen.getByText(/Reset/i);
      await fireEvent.click(resetButton);

      const restoredConfig = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      expect(restoredConfig.seed).toBe('existing-seed');
      expect(restoredConfig.eyes).toEqual(['happy']);
      expect(restoredConfig.mouth).toEqual(['smile01']);
    });

    it('preserves avatarConfig when editing other fields', () => {
      const { container } = render(UserModal, {
        props: {
          open: true,
          mode: 'edit',
          user: mockUser
        }
      });

      // Change name field
      const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement;
      if (nameInput) {
        nameInput.value = 'Updated Name';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Avatar config should remain unchanged
      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      const config = JSON.parse(avatarConfigInput.value) as BotttsAvatarConfig;
      expect(config.seed).toBe('existing-seed');
    });

    it('displays user role correctly in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          mode: 'edit',
          user: mockUser
        }
      });

      const roleSelect = document.querySelector('select[name="role"]') as HTMLSelectElement;
      expect(roleSelect).toBeTruthy();
      expect(roleSelect.value).toBe('manager');
    });
  });

  describe('Avatar Customization Tracking', () => {
    it('marks avatar as customized after randomize', async () => {
      const { container } = render(UserModal, { props: { open: true, mode: 'create' } });

      // Enter username first
      const usernameInput = container.querySelector('input[name="username"]') as HTMLInputElement;
      if (usernameInput) {
        usernameInput.value = 'newuser';
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const avatarConfigBefore = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      const seedBefore = JSON.parse(avatarConfigBefore.value).seed;

      // Randomize avatar
      const randomizeButton = screen.getByText(/Randomize/i);
      await fireEvent.click(randomizeButton);

      const avatarConfigAfter = container.querySelector('input[name="avatarConfig"]') as HTMLInputElement;
      const seedAfter = JSON.parse(avatarConfigAfter.value).seed;

      expect(seedAfter).not.toBe(seedBefore);
    });
  });

  describe('Form Submission', () => {
    it('includes avatarConfig in form data', () => {
      const { container } = render(UserModal, {
        props: {
          open: true,
          mode: 'create',
          action: '/api/admin/users'
        }
      });

      const form = container.querySelector('form');
      expect(form).toBeTruthy();
      expect(form?.action).toContain('/api/admin/users');

      const avatarConfigInput = container.querySelector('input[name="avatarConfig"]');
      expect(avatarConfigInput).toBeTruthy();
      expect((avatarConfigInput as HTMLInputElement).type).toBe('hidden');
    });
  });

  describe('Modal Controls', () => {
    it('calls onclose when dialog is cancelled', () => {
      const onclose = vi.fn();
      render(UserModal, { props: { open: true, mode: 'create', onclose } });

      const dialog = document.querySelector('dialog');
      dialog?.dispatchEvent(new Event('cancel', { cancelable: true }));

      expect(onclose).toHaveBeenCalled();
    });

    it('does not render when open is false', () => {
      render(UserModal, { props: { open: false, mode: 'create' } });
      const dialog = document.querySelector('dialog');
      expect(dialog).toBeFalsy();
    });
  });
});
