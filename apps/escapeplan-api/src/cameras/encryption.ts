/**
 * Camera credential encryption utilities using libsodium
 * Encrypts camera passwords before storing in database
 */

import sodium from 'sodium-native';
import { loadSecrets } from '../secrets.js';

// Load secrets on module initialization
const secrets = loadSecrets();
const ENCRYPTION_KEY_HEX = secrets.cameraEncryptionKey;

// Validate key length
const encryptionKey = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
if (encryptionKey.length !== sodium.crypto_secretbox_KEYBYTES) {
  throw new Error(`Camera encryption key must be ${sodium.crypto_secretbox_KEYBYTES} bytes (${sodium.crypto_secretbox_KEYBYTES * 2} hex chars)`);
}

/**
 * Encrypt camera password for storage
 * Returns hex-encoded nonce + ciphertext
 */
export function encryptPassword(plainPassword: string): string {
  if (!plainPassword) return '';

  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);

  const message = Buffer.from(plainPassword, 'utf8');
  const ciphertext = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);

  sodium.crypto_secretbox_easy(ciphertext, message, nonce, encryptionKey);

  // Return nonce + ciphertext as single hex string
  return Buffer.concat([nonce, ciphertext]).toString('hex');
}

/**
 * Decrypt camera password from storage
 * Accepts hex-encoded nonce + ciphertext
 */
export function decryptPassword(encrypted: string): string {
  if (!encrypted) return '';

  try {
    const data = Buffer.from(encrypted, 'hex');

    const nonce = data.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = data.slice(sodium.crypto_secretbox_NONCEBYTES);

    const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);

    const result = sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, encryptionKey);

    if (!result) {
      throw new Error('Decryption failed');
    }

    return plaintext.toString('utf8');
  } catch (error) {
    console.error('Failed to decrypt password:', error);
    return '';
  }
}

/**
 * Build camera URL with decrypted credentials
 */
export function buildCameraUrl(camera: {
  protocol: string;
  host: string;
  port: number;
  username?: string | null;
  password_encrypted?: string | null;
  stream_path?: string | null;
}): string {
  const { protocol, host, port, username, password_encrypted, stream_path } = camera;

  let url = '';

  if (protocol === 'rtsp') {
    url = 'rtsp://';
    if (username && password_encrypted) {
      const password = decryptPassword(password_encrypted);
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${stream_path || '/'}`;
  } else if (protocol === 'mjpeg') {
    url = 'http://';
    if (username && password_encrypted) {
      const password = decryptPassword(password_encrypted);
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${stream_path || '/video.mjpg'}`;
  } else if (protocol === 'onvif') {
    // ONVIF uses RTSP for streams
    url = 'rtsp://';
    if (username && password_encrypted) {
      const password = decryptPassword(password_encrypted);
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}${stream_path || '/onvif1'}`;
  }

  return url;
}

/**
 * Mask URL credentials for display
 */
export function maskCameraUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}
