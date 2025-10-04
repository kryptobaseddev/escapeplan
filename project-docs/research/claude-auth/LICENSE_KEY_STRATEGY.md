# EscapePlan License Key Validation Strategy

**Document Purpose:** Define comprehensive license key generation, validation, hardware fingerprinting, cloud organization linking, and anti-piracy measures for EscapePlan's offline-first Pi appliance architecture.

**Analysis Date:** 2025-10-03

**Research Sources:** Context7 (systeminformation, Node.js crypto), Industry best practices (RSA signatures, hardware fingerprinting, offline grace periods)

---

## Table of Contents

1. [License Key System Architecture](#1-license-key-system-architecture)
2. [Key Generation and Format](#2-key-generation-and-format)
3. [Hardware Fingerprinting](#3-hardware-fingerprinting)
4. [Offline Validation and Grace Period](#4-offline-validation-and-grace-period)
5. [Cloud Organization Linking](#5-cloud-organization-linking)
6. [Anti-Piracy Measures](#6-anti-piracy-measures)
7. [Support Renewal Enforcement](#7-support-renewal-enforcement)
8. [Implementation Specification](#8-implementation-specification)
9. [Test Strategy](#9-test-strategy)
10. [Error Handling](#10-error-handling)

---

## 1. License Key System Architecture

### 1.1 Design Principles

**Offline-First Validation:**
- License keys validated locally on Pi appliance without cloud dependency
- All license data embedded in cryptographically signed key
- Public key embedded in application code for signature verification
- No phone-home requirement for initial activation or daily operation

**Cloud-Optional Linking:**
- License key serves as initial organization identifier before cloud linking
- When Cloud Control subscription enabled, key links to cloud org account
- Cloud sync validates license status but never blocks offline operation
- License renewal can occur offline via new key installation

**Cryptographic Security:**
- RSA-2048 signature ensures license authenticity (unbreakable for ~1 billion years)
- Base32 encoding for human-readable key format
- HMAC-SHA256 hardware fingerprinting for device binding
- No symmetric encryption keys stored on device

### 1.2 License Tier Support

**Starter License ($1,295):**
- Room capacity: 4 rooms
- Installation limit: 1 appliance
- Perpetual software license
- First-year updates/support included
- Support renewal: $285/year (22% of license value)

**Expansion Pack (+$350):**
- Adds 4 additional rooms (total 8 rooms)
- Inherits support term from base license
- Same hardware fingerprint as base license

**Multi-Site Add-On (+$600):**
- Adds second appliance under same owner
- Total capacity: 12 rooms across 2 appliances
- Each appliance has unique hardware fingerprint
- Shared organization identifier

**Support Status Encoding:**
- Initial support expiration date embedded in key
- Annual renewal extends expiration date
- Re-entry penalty (30% surcharge) after 90-day lapse

---

## 2. Key Generation and Format

### 2.1 License Key Structure

**Format Specification:**
```
LICENSE-v1-{BASE32_ENCODED_DATA}-{BASE32_ENCODED_SIGNATURE}

Example:
LICENSE-v1-ABCD1234EFGH5678IJKL9012MNOP3456-QRST7890UVWX1234YZAB5678CDEF9012
```

**Component Breakdown:**
1. **Prefix:** `LICENSE-v1-` (version identifier for future format changes)
2. **Encoded Data:** Base32(license_data_json)
3. **Separator:** `-`
4. **Encoded Signature:** Base32(RSA_SIGN(SHA256(license_data_json)))

### 2.2 License Data Payload (JSON)

```typescript
interface LicenseKeyPayload {
  // Unique identifiers
  license_id: string;              // UUID v4
  org_identifier: string;          // Pre-cloud org ID (UUID v4)

  // License tier and capacity
  tier: 'starter' | 'expansion' | 'multi_site';
  room_capacity: 4 | 8 | 12;
  installation_limit: 1 | 2;

  // Activation constraints
  issued_at: string;               // ISO 8601 timestamp
  activated_at?: string;           // ISO 8601 timestamp (set on first activation)

  // Support status
  support_expires_at: string;      // ISO 8601 timestamp (1 year from issue)
  support_renewal_count: number;   // Increment on each renewal

  // Feature flags
  features: {
    booking: boolean;              // Always true
    game_runner: boolean;          // Always true
    camera_control: boolean;       // Always true
    cloud_sync: boolean;           // False unless Cloud Control active
    remote_dashboard: boolean;     // False unless Cloud Control active
    offsite_backup: boolean;       // False unless Cloud Control active
    priority_support: boolean;     // False unless Cloud Control active
  };

  // Hardware binding (set on activation)
  hardware_fingerprint?: string;   // HMAC-SHA256 of device identifiers

  // Add-on tracking
  parent_license_id?: string;      // For expansion/multi-site add-ons
  add_on_type?: 'expansion_pack' | 'multi_site';
}
```

### 2.3 Key Generation Algorithm

**Server-Side Generation Process:**

```typescript
import crypto from 'node:crypto';

interface KeyGenerationParams {
  tier: 'starter' | 'expansion' | 'multi_site';
  parent_license_id?: string;
}

async function generateLicenseKey(params: KeyGenerationParams): Promise<string> {
  // Step 1: Construct license payload
  const payload: LicenseKeyPayload = {
    license_id: crypto.randomUUID(),
    org_identifier: params.parent_license_id
      ? await getOrgIdentifierFromParent(params.parent_license_id)
      : crypto.randomUUID(),
    tier: params.tier,
    room_capacity: calculateRoomCapacity(params.tier),
    installation_limit: calculateInstallationLimit(params.tier),
    issued_at: new Date().toISOString(),
    support_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    support_renewal_count: 0,
    features: {
      booking: true,
      game_runner: true,
      camera_control: true,
      cloud_sync: false,
      remote_dashboard: false,
      offsite_backup: false,
      priority_support: false,
    },
    parent_license_id: params.parent_license_id,
    add_on_type: params.tier === 'expansion' ? 'expansion_pack'
               : params.tier === 'multi_site' ? 'multi_site'
               : undefined,
  };

  // Step 2: Serialize to canonical JSON (sorted keys)
  const canonicalData = JSON.stringify(payload, Object.keys(payload).sort());

  // Step 3: Generate RSA signature
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(canonicalData);
  const signature = sign.sign(PRIVATE_KEY_PEM, 'base64');

  // Step 4: Encode to Base32
  const encodedData = base32Encode(Buffer.from(canonicalData, 'utf8'));
  const encodedSignature = base32Encode(Buffer.from(signature, 'base64'));

  // Step 5: Construct final key
  return `LICENSE-v1-${encodedData}-${encodedSignature}`;
}

function calculateRoomCapacity(tier: string): 4 | 8 | 12 {
  switch (tier) {
    case 'starter': return 4;
    case 'expansion': return 8;
    case 'multi_site': return 12;
    default: throw new Error('Invalid tier');
  }
}

function calculateInstallationLimit(tier: string): 1 | 2 {
  return tier === 'multi_site' ? 2 : 1;
}
```

### 2.4 Key Validation Algorithm

**Client-Side Validation Process:**

```typescript
import crypto from 'node:crypto';

interface ValidationResult {
  valid: boolean;
  payload?: LicenseKeyPayload;
  error?: string;
  error_code?: string;
}

async function validateLicenseKey(licenseKey: string): Promise<ValidationResult> {
  // Step 1: Parse key format
  const parts = licenseKey.split('-');
  if (parts.length !== 4 || parts[0] !== 'LICENSE' || parts[1] !== 'v1') {
    return { valid: false, error: 'Invalid license key format', error_code: 'INVALID_FORMAT' };
  }

  const [, , encodedData, encodedSignature] = parts;

  // Step 2: Decode Base32
  let canonicalData: string;
  let signature: Buffer;
  try {
    canonicalData = base32Decode(encodedData).toString('utf8');
    signature = base32Decode(encodedSignature);
  } catch (err) {
    return { valid: false, error: 'Invalid Base32 encoding', error_code: 'DECODE_ERROR' };
  }

  // Step 3: Verify RSA signature
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(canonicalData);
  const isValid = verify.verify(PUBLIC_KEY_PEM, signature);

  if (!isValid) {
    return { valid: false, error: 'Invalid signature - key may be forged', error_code: 'SIGNATURE_INVALID' };
  }

  // Step 4: Parse and validate payload
  let payload: LicenseKeyPayload;
  try {
    payload = JSON.parse(canonicalData);
  } catch (err) {
    return { valid: false, error: 'Invalid payload JSON', error_code: 'PAYLOAD_INVALID' };
  }

  // Step 5: Validate payload schema
  const schemaValidation = validatePayloadSchema(payload);
  if (!schemaValidation.valid) {
    return { valid: false, error: schemaValidation.error, error_code: 'SCHEMA_INVALID' };
  }

  return { valid: true, payload };
}

function validatePayloadSchema(payload: any): { valid: boolean; error?: string } {
  const requiredFields = ['license_id', 'org_identifier', 'tier', 'room_capacity',
                          'installation_limit', 'issued_at', 'support_expires_at', 'features'];

  for (const field of requiredFields) {
    if (!(field in payload)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (!['starter', 'expansion', 'multi_site'].includes(payload.tier)) {
    return { valid: false, error: 'Invalid tier value' };
  }

  if (![4, 8, 12].includes(payload.room_capacity)) {
    return { valid: false, error: 'Invalid room_capacity value' };
  }

  if (![1, 2].includes(payload.installation_limit)) {
    return { valid: false, error: 'Invalid installation_limit value' };
  }

  return { valid: true };
}
```

### 2.5 Base32 Encoding Implementation

**Rationale:** Base32 provides better human readability than Base64 (no mixed case, no ambiguous characters like 0/O or 1/I/l).

```typescript
// Use RFC 4648 Base32 alphabet (A-Z, 2-7)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = Buffer.alloc(Math.ceil((encoded.length * 5) / 8));

  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const charValue = BASE32_ALPHABET.indexOf(char);

    if (charValue === -1) {
      throw new Error(`Invalid Base32 character: ${char}`);
    }

    value = (value << 5) | charValue;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.subarray(0, index);
}
```

### 2.6 RSA Key Pair Management

**Private Key Security:**
- RSA-2048 private key stored in secure key management service (HSM or cloud KMS)
- Never committed to version control or deployed to appliances
- Used only by license generation service
- Rotate keys annually, embed key version in license format

**Public Key Distribution:**
- RSA-2048 public key embedded in application binary
- Extracted at compile time from secure environment variable
- Multiple public keys supported for key rotation (check version prefix)

```typescript
// Public key embedded in application (apps/escapeplan-api/src/license/keys.ts)
export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA... [truncated]
-----END PUBLIC KEY-----`;

// Private key stored in KMS (never in application)
// Retrieved via: await kms.getSecret('escapeplan-license-private-key-v1')
```

---

## 3. Hardware Fingerprinting

### 3.1 Fingerprinting Strategy

**Research Source:** Context7 `/sebhildebrandt/systeminformation` - Provides cross-platform hardware identification APIs for Node.js.

**Design Goals:**
- Stable across OS updates and minor hardware changes
- Unique per Pi appliance to prevent license sharing
- Not bypassable via VM cloning or disk imaging
- Gracefully handles hardware component replacement (RMA scenarios)

### 3.2 Hardware Identifier Collection

**Pi-Specific Identifiers (Raspberry Pi OS):**

```typescript
import si from 'systeminformation';

interface HardwareIdentifiers {
  cpu_serial: string;        // Raspberry Pi CPU serial (unique per SoC)
  mac_address: string;       // Primary network interface MAC
  disk_uuid: string;         // Root filesystem UUID
  hardware_uuid: string;     // System hardware UUID
  board_serial?: string;     // Board serial number (if available)
}

async function collectHardwareIdentifiers(): Promise<HardwareIdentifiers> {
  const [system, uuid, diskLayout, networkInterfaces] = await Promise.all([
    si.system(),
    si.uuid(),
    si.diskLayout(),
    si.networkInterfaces(),
  ]);

  // Extract primary network interface (exclude loopback)
  const primaryInterface = networkInterfaces.find(
    iface => iface.iface !== 'lo' && iface.mac && iface.mac !== '00:00:00:00:00:00'
  );

  // Extract root disk UUID
  const rootDisk = diskLayout.find(disk => disk.device.includes('/dev/mmcblk0'));

  return {
    cpu_serial: system.serial || '',
    mac_address: primaryInterface?.mac || '',
    disk_uuid: rootDisk?.uuid || '',
    hardware_uuid: uuid.hardware || '',
    board_serial: system.sku || '',
  };
}
```

### 3.3 Fingerprint Generation

**HMAC-SHA256 Composite Fingerprint:**

```typescript
import crypto from 'node:crypto';

interface FingerprintResult {
  fingerprint: string;           // HMAC-SHA256 hex digest
  components: {
    cpu_serial: string;
    mac_address: string;
    disk_uuid: string;
    hardware_uuid: string;
  };
  generated_at: string;          // ISO 8601 timestamp
}

async function generateHardwareFingerprint(): Promise<FingerprintResult> {
  const identifiers = await collectHardwareIdentifiers();

  // Normalize identifiers (uppercase, remove colons/dashes)
  const normalizedCpu = identifiers.cpu_serial.toUpperCase().replace(/[:-]/g, '');
  const normalizedMac = identifiers.mac_address.toUpperCase().replace(/[:-]/g, '');
  const normalizedDisk = identifiers.disk_uuid.toUpperCase().replace(/[:-]/g, '');
  const normalizedHw = identifiers.hardware_uuid.toUpperCase().replace(/[:-]/g, '');

  // Concatenate in deterministic order
  const composite = [normalizedCpu, normalizedMac, normalizedDisk, normalizedHw]
    .filter(Boolean)
    .join('|');

  // Generate HMAC using license_id as secret (prevents cross-license replay)
  const hmac = crypto.createHmac('sha256', process.env.LICENSE_ID || 'default-secret');
  hmac.update(composite);
  const fingerprint = hmac.digest('hex');

  return {
    fingerprint,
    components: {
      cpu_serial: normalizedCpu,
      mac_address: normalizedMac,
      disk_uuid: normalizedDisk,
      hardware_uuid: normalizedHw,
    },
    generated_at: new Date().toISOString(),
  };
}
```

### 3.4 Fingerprint Validation

**Activation Binding:**

```typescript
interface ActivationResult {
  success: boolean;
  fingerprint?: string;
  error?: string;
  error_code?: string;
}

async function activateLicense(licenseKey: string): Promise<ActivationResult> {
  // Step 1: Validate license key signature
  const validation = await validateLicenseKey(licenseKey);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      error_code: validation.error_code
    };
  }

  const payload = validation.payload!;

  // Step 2: Check if license already activated
  if (payload.hardware_fingerprint) {
    return {
      success: false,
      error: 'License already activated on another device',
      error_code: 'ALREADY_ACTIVATED'
    };
  }

  // Step 3: Generate hardware fingerprint
  const { fingerprint } = await generateHardwareFingerprint();

  // Step 4: Store activation in local database
  await db.insert(licenses).values({
    id: payload.license_id,
    key: licenseKey,
    hardware_fingerprint: fingerprint,
    activated_at: new Date().toISOString(),
    org_identifier: payload.org_identifier,
    tier: payload.tier,
    room_capacity: payload.room_capacity,
    installation_limit: payload.installation_limit,
    support_expires_at: payload.support_expires_at,
    last_validated_at: new Date().toISOString(),
  });

  return { success: true, fingerprint };
}
```

**Runtime Validation:**

```typescript
async function validateHardwareBinding(licenseId: string): Promise<boolean> {
  // Step 1: Retrieve stored license from database
  const storedLicense = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, licenseId))
    .limit(1);

  if (!storedLicense.length) {
    return false;
  }

  // Step 2: Generate current hardware fingerprint
  const { fingerprint: currentFingerprint } = await generateHardwareFingerprint();

  // Step 3: Compare with stored fingerprint
  const storedFingerprint = storedLicense[0].hardware_fingerprint;

  if (currentFingerprint !== storedFingerprint) {
    console.error('Hardware fingerprint mismatch', {
      expected: storedFingerprint,
      actual: currentFingerprint,
    });
    return false;
  }

  return true;
}
```

### 3.5 Hardware Change Tolerance

**RMA and Component Replacement Strategy:**

Pi hardware can fail and require replacement. The system must distinguish between legitimate hardware replacement (RMA) and piracy attempts.

**Tolerance Policy:**
- **SD Card Replacement:** Allowed (disk_uuid change ignored if other identifiers match)
- **Network Adapter Replacement:** Allowed (mac_address change ignored if CPU serial matches)
- **Full Board Replacement:** Requires manual license transfer process

**Fuzzy Matching Algorithm:**

```typescript
interface FingerprintComponents {
  cpu_serial: string;
  mac_address: string;
  disk_uuid: string;
  hardware_uuid: string;
}

function calculateFingerprintSimilarity(
  stored: FingerprintComponents,
  current: FingerprintComponents
): number {
  let matches = 0;
  let total = 0;

  const fields: (keyof FingerprintComponents)[] = [
    'cpu_serial', 'mac_address', 'disk_uuid', 'hardware_uuid'
  ];

  for (const field of fields) {
    if (stored[field] && current[field]) {
      total++;
      if (stored[field] === current[field]) {
        matches++;
      }
    }
  }

  return total > 0 ? matches / total : 0;
}

async function validateHardwareBindingWithTolerance(licenseId: string): Promise<{
  valid: boolean;
  similarity: number;
  requires_transfer: boolean;
}> {
  const storedLicense = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, licenseId))
    .limit(1);

  if (!storedLicense.length) {
    return { valid: false, similarity: 0, requires_transfer: false };
  }

  const currentIdentifiers = await collectHardwareIdentifiers();
  const storedComponents = JSON.parse(storedLicense[0].fingerprint_components || '{}');

  const similarity = calculateFingerprintSimilarity(storedComponents, currentIdentifiers);

  // Validation thresholds:
  // - 100% match: Valid, no action needed
  // - 75%+ match: Valid, log warning (likely SD card or network adapter replacement)
  // - 50-74% match: Valid but requires manual transfer approval
  // - <50% match: Invalid, piracy attempt or full hardware replacement

  if (similarity >= 0.75) {
    return { valid: true, similarity, requires_transfer: false };
  } else if (similarity >= 0.50) {
    return { valid: true, similarity, requires_transfer: true };
  } else {
    return { valid: false, similarity, requires_transfer: true };
  }
}
```

### 3.6 License Transfer Process

**Manual Transfer for Hardware Replacement:**

```typescript
interface TransferRequest {
  license_id: string;
  old_fingerprint: string;
  new_fingerprint: string;
  reason: 'rma' | 'hardware_upgrade' | 'other';
  support_ticket_id?: string;
}

async function requestLicenseTransfer(request: TransferRequest): Promise<{
  approved: boolean;
  transfer_token?: string;
  error?: string;
}> {
  // Step 1: Validate license exists and is active
  const license = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, request.license_id))
    .limit(1);

  if (!license.length) {
    return { approved: false, error: 'License not found' };
  }

  // Step 2: Check if support is active (required for free transfers)
  const supportActive = new Date(license[0].support_expires_at) > new Date();
  if (!supportActive && request.reason === 'rma') {
    return {
      approved: false,
      error: 'Support must be active for free RMA transfers. Renew support or contact sales.'
    };
  }

  // Step 3: Create transfer token (valid for 24 hours)
  const transferToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(license_transfers).values({
    id: crypto.randomUUID(),
    license_id: request.license_id,
    transfer_token: transferToken,
    old_fingerprint: request.old_fingerprint,
    new_fingerprint: request.new_fingerprint,
    reason: request.reason,
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  });

  return { approved: true, transfer_token: transferToken };
}

async function completeLicenseTransfer(transferToken: string): Promise<{
  success: boolean;
  error?: string;
}> {
  // Step 1: Validate transfer token
  const transfer = await db
    .select()
    .from(license_transfers)
    .where(eq(license_transfers.transfer_token, transferToken))
    .limit(1);

  if (!transfer.length) {
    return { success: false, error: 'Invalid transfer token' };
  }

  if (new Date(transfer[0].expires_at) < new Date()) {
    return { success: false, error: 'Transfer token expired' };
  }

  if (transfer[0].status !== 'pending') {
    return { success: false, error: 'Transfer already completed or cancelled' };
  }

  // Step 2: Verify new hardware fingerprint matches transfer request
  const { fingerprint: currentFingerprint } = await generateHardwareFingerprint();
  if (currentFingerprint !== transfer[0].new_fingerprint) {
    return { success: false, error: 'Hardware fingerprint mismatch' };
  }

  // Step 3: Update license with new fingerprint
  await db
    .update(licenses)
    .set({
      hardware_fingerprint: transfer[0].new_fingerprint,
      fingerprint_components: JSON.stringify((await collectHardwareIdentifiers())),
      updated_at: new Date().toISOString(),
    })
    .where(eq(licenses.id, transfer[0].license_id));

  // Step 4: Mark transfer as completed
  await db
    .update(license_transfers)
    .set({ status: 'completed', completed_at: new Date().toISOString() })
    .where(eq(license_transfers.id, transfer[0].id));

  return { success: true };
}
```

---

## 4. Offline Validation and Grace Period

### 4.1 Offline Validation Strategy

**Research Findings:** Industry standards (Adobe: 99 days annual/30 days monthly, Microsoft: 30 days, Citrix: 30 days) suggest 30-90 day grace periods for offline validation.

**EscapePlan Grace Period Policy:**
- **Standard Grace Period:** 90 days offline operation without re-validation
- **Extended Grace (Active Support):** 180 days if support subscription active
- **Emergency Mode:** 7 days after grace period expiry with degraded features
- **Cloud Sync Exemption:** No grace period limits when Cloud Control active and connected

### 4.2 Validation State Machine

**License States:**

```typescript
type LicenseValidationState =
  | 'VALID_ONLINE'           // License valid, cloud connected, real-time validation
  | 'VALID_OFFLINE'          // License valid, within grace period, offline mode
  | 'VALID_GRACE_WARNING'    // License valid, 7 days until grace expiry, show warnings
  | 'GRACE_EXPIRED_EMERGENCY'// Grace expired, emergency mode (7 days, read-only bookings)
  | 'INVALID_EXPIRED'        // Support expired, version updates blocked
  | 'INVALID_REVOKED'        // License revoked (fraud/chargeback)
  | 'INVALID_FINGERPRINT'    // Hardware fingerprint mismatch
  | 'INVALID_SIGNATURE';     // Cryptographic signature invalid

interface LicenseValidationStatus {
  state: LicenseValidationState;
  valid: boolean;
  last_validated_at: string;        // ISO 8601
  grace_expires_at: string;         // ISO 8601
  days_until_grace_expiry: number;
  support_expires_at: string;       // ISO 8601
  support_active: boolean;
  cloud_connected: boolean;
  warnings: string[];
  errors: string[];
}
```

### 4.3 Validation Timing

**Validation Frequency:**

```typescript
interface ValidationSchedule {
  startup: boolean;              // Always validate on application startup
  daily: boolean;                // Daily validation at 3 AM local time
  cloud_sync: boolean;           // Validate on successful cloud connection
  manual_trigger: boolean;       // Admin can force validation from UI
}

const VALIDATION_INTERVALS = {
  ONLINE_CHECK: 24 * 60 * 60 * 1000,        // 24 hours when online
  OFFLINE_CHECK: 7 * 24 * 60 * 60 * 1000,   // 7 days when offline
  GRACE_WARNING: 7 * 24 * 60 * 60 * 1000,   // 7 days before grace expiry
  EMERGENCY_MODE: 7 * 24 * 60 * 60 * 1000,  // 7 days emergency mode
};

const GRACE_PERIODS = {
  STANDARD: 90 * 24 * 60 * 60 * 1000,       // 90 days standard grace
  EXTENDED: 180 * 24 * 60 * 60 * 1000,      // 180 days with active support
  EMERGENCY: 7 * 24 * 60 * 60 * 1000,       // 7 days emergency mode
};
```

**Validation Logic:**

```typescript
async function performLicenseValidation(): Promise<LicenseValidationStatus> {
  const license = await getCurrentActiveLicense();

  if (!license) {
    return {
      state: 'INVALID_SIGNATURE',
      valid: false,
      last_validated_at: new Date().toISOString(),
      grace_expires_at: '',
      days_until_grace_expiry: 0,
      support_expires_at: '',
      support_active: false,
      cloud_connected: false,
      warnings: [],
      errors: ['No active license found'],
    };
  }

  // Step 1: Validate cryptographic signature
  const signatureValid = await validateLicenseKey(license.key);
  if (!signatureValid.valid) {
    return {
      state: 'INVALID_SIGNATURE',
      valid: false,
      last_validated_at: new Date().toISOString(),
      grace_expires_at: '',
      days_until_grace_expiry: 0,
      support_expires_at: license.support_expires_at,
      support_active: false,
      cloud_connected: false,
      warnings: [],
      errors: ['License signature invalid - key may be tampered or forged'],
    };
  }

  // Step 2: Validate hardware fingerprint
  const hardwareValid = await validateHardwareBinding(license.id);
  if (!hardwareValid) {
    return {
      state: 'INVALID_FINGERPRINT',
      valid: false,
      last_validated_at: new Date().toISOString(),
      grace_expires_at: '',
      days_until_grace_expiry: 0,
      support_expires_at: license.support_expires_at,
      support_active: false,
      cloud_connected: false,
      warnings: [],
      errors: ['Hardware fingerprint mismatch - license activated on different device'],
    };
  }

  // Step 3: Check cloud connection status
  const cloudConnected = await checkCloudConnection();
  const now = new Date();
  const lastValidated = new Date(license.last_validated_at);
  const supportExpires = new Date(license.support_expires_at);
  const supportActive = supportExpires > now;

  // Step 4: Determine grace period
  const gracePeriod = supportActive ? GRACE_PERIODS.EXTENDED : GRACE_PERIODS.STANDARD;
  const graceExpiresAt = new Date(lastValidated.getTime() + gracePeriod);
  const daysUntilGraceExpiry = Math.floor((graceExpiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  // Step 5: Check if license revoked (requires cloud connection)
  if (cloudConnected) {
    const revoked = await checkLicenseRevocationStatus(license.id);
    if (revoked) {
      return {
        state: 'INVALID_REVOKED',
        valid: false,
        last_validated_at: now.toISOString(),
        grace_expires_at: graceExpiresAt.toISOString(),
        days_until_grace_expiry: daysUntilGraceExpiry,
        support_expires_at: license.support_expires_at,
        support_active: supportActive,
        cloud_connected: true,
        warnings: [],
        errors: ['License revoked - contact support for assistance'],
      };
    }

    // Update last validated timestamp on successful cloud check
    await db.update(licenses)
      .set({ last_validated_at: now.toISOString() })
      .where(eq(licenses.id, license.id));
  }

  // Step 6: Determine validation state
  const warnings: string[] = [];
  let state: LicenseValidationState;

  if (cloudConnected) {
    state = 'VALID_ONLINE';
  } else if (daysUntilGraceExpiry > 7) {
    state = 'VALID_OFFLINE';
  } else if (daysUntilGraceExpiry > 0) {
    state = 'VALID_GRACE_WARNING';
    warnings.push(`Grace period expires in ${daysUntilGraceExpiry} days. Connect to internet to reset grace period.`);
  } else if (daysUntilGraceExpiry > -7) {
    state = 'GRACE_EXPIRED_EMERGENCY';
    warnings.push('Grace period expired. Operating in emergency mode with limited functionality.');
    warnings.push('Connect to internet within 7 days to restore full functionality.');
  } else {
    return {
      state: 'INVALID_EXPIRED',
      valid: false,
      last_validated_at: license.last_validated_at,
      grace_expires_at: graceExpiresAt.toISOString(),
      days_until_grace_expiry: daysUntilGraceExpiry,
      support_expires_at: license.support_expires_at,
      support_active: supportActive,
      cloud_connected: false,
      warnings: [],
      errors: ['License grace period expired. Connect to internet to validate license.'],
    };
  }

  return {
    state,
    valid: true,
    last_validated_at: license.last_validated_at,
    grace_expires_at: graceExpiresAt.toISOString(),
    days_until_grace_expiry: daysUntilGraceExpiry,
    support_expires_at: license.support_expires_at,
    support_active: supportActive,
    cloud_connected: cloudConnected,
    warnings,
    errors: [],
  };
}
```

### 4.4 Emergency Mode Features

**Feature Restrictions in Emergency Mode:**

```typescript
interface EmergencyModeRestrictions {
  bookings: {
    create: boolean;               // Read-only: false
    edit: boolean;                 // Read-only: false
    view: boolean;                 // Allowed: true
  };
  sessions: {
    start: boolean;                // Allowed: true (critical for operations)
    pause_resume: boolean;         // Allowed: true
    end: boolean;                  // Allowed: true
    send_hints: boolean;           // Allowed: true
  };
  games: {
    create: boolean;               // Blocked: false
    edit: boolean;                 // Blocked: false
    view: boolean;                 // Allowed: true
  };
  admin: {
    user_management: boolean;      // Blocked: false
    network_config: boolean;       // Blocked: false
    system_settings: boolean;      // Blocked: false
  };
}

const EMERGENCY_MODE_RESTRICTIONS: EmergencyModeRestrictions = {
  bookings: { create: false, edit: false, view: true },
  sessions: { start: true, pause_resume: true, end: true, send_hints: true },
  games: { create: false, edit: false, view: true },
  admin: { user_management: false, network_config: false, system_settings: false },
};

function checkFeatureAccess(
  feature: string,
  validationStatus: LicenseValidationStatus
): { allowed: boolean; reason?: string } {
  // Always allow if license valid
  if (validationStatus.state === 'VALID_ONLINE' || validationStatus.state === 'VALID_OFFLINE') {
    return { allowed: true };
  }

  // Grace warning - show warnings but allow all features
  if (validationStatus.state === 'VALID_GRACE_WARNING') {
    return { allowed: true };
  }

  // Emergency mode - check restrictions
  if (validationStatus.state === 'GRACE_EXPIRED_EMERGENCY') {
    const [category, action] = feature.split(':') as [keyof EmergencyModeRestrictions, string];
    const categoryRestrictions = EMERGENCY_MODE_RESTRICTIONS[category];

    if (!categoryRestrictions) {
      return { allowed: false, reason: 'Feature not found' };
    }

    const allowed = categoryRestrictions[action as keyof typeof categoryRestrictions];

    if (!allowed) {
      return {
        allowed: false,
        reason: 'Feature restricted in emergency mode. Connect to internet to validate license.'
      };
    }

    return { allowed: true };
  }

  // All other states - deny access
  return { allowed: false, reason: 'License invalid or expired' };
}
```

### 4.5 Grace Period Reset

**Cloud Connection Validation:**

```typescript
async function resetGracePeriodOnCloudConnection(): Promise<void> {
  const cloudConnected = await checkCloudConnection();

  if (!cloudConnected) {
    return;
  }

  const license = await getCurrentActiveLicense();
  if (!license) {
    return;
  }

  // Perform cloud validation
  const cloudValidation = await validateLicenseWithCloud(license.id);

  if (!cloudValidation.valid) {
    console.error('Cloud validation failed', cloudValidation.error);
    return;
  }

  // Reset last_validated_at to current time (resets grace period)
  await db.update(licenses)
    .set({
      last_validated_at: new Date().toISOString(),
      cloud_last_sync_at: new Date().toISOString(),
    })
    .where(eq(licenses.id, license.id));

  console.log('Grace period reset - cloud validation successful');
}

// Run on cloud connection established
eventBus.on('cloud:connected', async () => {
  await resetGracePeriodOnCloudConnection();
});
```

---

## 5. Cloud Organization Linking

### 5.1 Organization Identifier Strategy

**Pre-Cloud Organization ID:**
- Every license key contains `org_identifier` UUID
- Generated during license creation (before cloud account exists)
- Serves as organization ID for offline-only installations
- Links multiple licenses (base + add-ons) under same org

**Cloud Organization Linking:**
- When user creates cloud account, they provide license key
- System extracts `org_identifier` from license key
- Creates cloud organization with matching `org_identifier`
- Links license to cloud org via `org_identifier` foreign key

### 5.2 Cloud Account Creation Flow

**User Journey:**

1. User purchases Starter License → receives `LICENSE-v1-...` key
2. User installs EscapePlan on Pi → activates license offline
3. System extracts `org_identifier` from key → uses as local org ID
4. User decides to enable Cloud Control ($129/mo)
5. User visits cloud portal → creates account → enters license key
6. System validates key → extracts `org_identifier` → creates cloud org
7. Pi connects to cloud → syncs using `org_identifier` as auth token
8. Cloud subscription activated → unlocks cloud features

**Implementation:**

```typescript
interface CloudAccountCreationRequest {
  email: string;
  password: string;
  license_key: string;
  business_name: string;
}

async function createCloudAccount(
  request: CloudAccountCreationRequest
): Promise<{
  success: boolean;
  org_id?: string;
  error?: string;
}> {
  // Step 1: Validate license key
  const validation = await validateLicenseKey(request.license_key);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const payload = validation.payload!;

  // Step 2: Check if org_identifier already linked to cloud org
  const existingOrg = await db
    .select()
    .from(cloud_organizations)
    .where(eq(cloud_organizations.org_identifier, payload.org_identifier))
    .limit(1);

  if (existingOrg.length) {
    return {
      success: false,
      error: 'License already linked to cloud organization. Contact support to transfer ownership.'
    };
  }

  // Step 3: Create user account
  const user = await createUser({
    email: request.email,
    password: request.password,
    user_type: 'operator',
  });

  // Step 4: Create cloud organization using org_identifier from license
  const org = await db.insert(cloud_organizations).values({
    id: crypto.randomUUID(),
    org_identifier: payload.org_identifier,  // Link to license
    business_name: request.business_name,
    owner_user_id: user.id,
    subscription_status: 'trial',            // 14-day trial
    trial_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  }).returning();

  // Step 5: Link license to cloud org
  await db.insert(cloud_licenses).values({
    id: crypto.randomUUID(),
    license_id: payload.license_id,
    org_id: org[0].id,
    linked_at: new Date().toISOString(),
  });

  return { success: true, org_id: org[0].id };
}
```

### 5.3 Hub-to-Cloud Authentication

**Hub Registration Flow:**

```typescript
interface HubRegistrationRequest {
  license_key: string;
  hardware_fingerprint: string;
  hub_name: string;
}

async function registerHubWithCloud(
  request: HubRegistrationRequest
): Promise<{
  success: boolean;
  hub_id?: string;
  api_token?: string;
  error?: string;
}> {
  // Step 1: Validate license key
  const validation = await validateLicenseKey(request.license_key);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const payload = validation.payload!;

  // Step 2: Find cloud org by org_identifier
  const org = await db
    .select()
    .from(cloud_organizations)
    .where(eq(cloud_organizations.org_identifier, payload.org_identifier))
    .limit(1);

  if (!org.length) {
    return {
      success: false,
      error: 'Cloud organization not found. Create cloud account first at portal.escapeplan.app'
    };
  }

  // Step 3: Check hub limit based on subscription
  const existingHubs = await db
    .select()
    .from(cloud_hubs)
    .where(eq(cloud_hubs.org_id, org[0].id));

  const subscriptionTier = org[0].subscription_status;
  const hubLimit = getHubLimitForSubscription(subscriptionTier);

  if (existingHubs.length >= hubLimit) {
    return {
      success: false,
      error: `Hub limit reached (${hubLimit}). Upgrade subscription to add more hubs.`
    };
  }

  // Step 4: Check if hub already registered (by hardware_fingerprint)
  const existingHub = existingHubs.find(
    hub => hub.hardware_fingerprint === request.hardware_fingerprint
  );

  if (existingHub) {
    // Return existing hub details
    return {
      success: true,
      hub_id: existingHub.id,
      api_token: existingHub.api_token
    };
  }

  // Step 5: Create new hub registration
  const apiToken = crypto.randomBytes(32).toString('hex');
  const hub = await db.insert(cloud_hubs).values({
    id: crypto.randomUUID(),
    org_id: org[0].id,
    license_id: payload.license_id,
    hardware_fingerprint: request.hardware_fingerprint,
    hub_name: request.hub_name,
    api_token: apiToken,
    registered_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    status: 'online',
  }).returning();

  return { success: true, hub_id: hub[0].id, api_token: apiToken };
}

function getHubLimitForSubscription(status: string): number {
  switch (status) {
    case 'trial': return 1;
    case 'base': return 1;           // $129/mo
    case 'base_plus_1': return 2;    // $129 + $35 = $164/mo
    case 'base_plus_2': return 3;    // $129 + $70 = $199/mo
    // ... etc
    default: return 1;
  }
}
```

### 5.4 Multi-Hub Billing Integration

**Hub Count Tracking:**

```typescript
interface CloudSubscription {
  id: string;
  org_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  base_subscription_active: boolean;     // $129/mo
  hub_count: number;                     // Billable hub count
  additional_hubs_count: number;         // hub_count - 1 (first hub included)
  premium_support_active: boolean;       // +$49/mo
  monthly_cost: number;                  // Auto-calculated
  next_billing_date: string;             // ISO 8601
}

async function updateSubscriptionHubCount(orgId: string): Promise<void> {
  // Count active hubs for org
  const activeHubs = await db
    .select()
    .from(cloud_hubs)
    .where(
      and(
        eq(cloud_hubs.org_id, orgId),
        eq(cloud_hubs.status, 'online')
      )
    );

  const hubCount = activeHubs.length;
  const additionalHubsCount = Math.max(0, hubCount - 1);

  // Update subscription
  const subscription = await db
    .select()
    .from(cloud_subscriptions)
    .where(eq(cloud_subscriptions.org_id, orgId))
    .limit(1);

  if (!subscription.length) {
    return;
  }

  const baseSubscriptionCost = subscription[0].base_subscription_active ? 129 : 0;
  const additionalHubsCost = additionalHubsCount * 35;
  const premiumSupportCost = subscription[0].premium_support_active ? 49 : 0;
  const monthlyCost = baseSubscriptionCost + additionalHubsCost + premiumSupportCost;

  await db
    .update(cloud_subscriptions)
    .set({
      hub_count: hubCount,
      additional_hubs_count: additionalHubsCount,
      monthly_cost: monthlyCost,
      updated_at: new Date().toISOString(),
    })
    .where(eq(cloud_subscriptions.id, subscription[0].id));

  // Notify billing system of cost change
  await notifyBillingSystemOfCostChange(subscription[0].id, monthlyCost);
}

// Trigger on hub registration/deregistration
eventBus.on('hub:registered', async (orgId: string) => {
  await updateSubscriptionHubCount(orgId);
});

eventBus.on('hub:deregistered', async (orgId: string) => {
  await updateSubscriptionHubCount(orgId);
});
```

### 5.5 Cloud Feature Unlocking

**Feature Flag Sync:**

```typescript
async function syncCloudFeaturesToHub(hubId: string): Promise<void> {
  // Step 1: Get hub's organization
  const hub = await db
    .select()
    .from(cloud_hubs)
    .where(eq(cloud_hubs.id, hubId))
    .limit(1);

  if (!hub.length) {
    return;
  }

  // Step 2: Get org subscription status
  const subscription = await db
    .select()
    .from(cloud_subscriptions)
    .where(eq(cloud_subscriptions.org_id, hub[0].org_id))
    .limit(1);

  const isSubscriptionActive = subscription.length &&
    ['trial', 'active'].includes(subscription[0].status);

  // Step 3: Determine cloud feature flags
  const cloudFeatures = {
    cloud_sync: isSubscriptionActive,
    remote_dashboard: isSubscriptionActive,
    offsite_backup: isSubscriptionActive,
    priority_support: isSubscriptionActive && subscription[0].premium_support_active,
    multi_location_analytics: isSubscriptionActive,
    ota_updates: isSubscriptionActive,
  };

  // Step 4: Update hub's license features in local database
  await db
    .update(licenses)
    .set({
      cloud_features: JSON.stringify(cloudFeatures),
      cloud_features_updated_at: new Date().toISOString(),
    })
    .where(eq(licenses.id, hub[0].license_id));

  // Step 5: Notify hub via WebSocket to reload features
  await notifyHubToReloadFeatures(hubId);
}
```

---

## 6. Anti-Piracy Measures

### 6.1 Multi-Layer Protection Strategy

**Layer 1: Cryptographic Signature**
- RSA-2048 signature prevents key forgery (1 billion years to break)
- Public key embedded in application binary at compile time
- Key rotation annually with version-specific public keys

**Layer 2: Hardware Fingerprinting**
- HMAC-SHA256 composite fingerprint from CPU serial, MAC, disk UUID
- Prevents single license from running on multiple devices
- Fuzzy matching for legitimate hardware replacement (RMA)

**Layer 3: Activation Limits**
- Starter: 1 installation per license
- Multi-Site: 2 installations per license
- Enforced at cloud registration and local validation

**Layer 4: Cloud Validation**
- Periodic cloud check for revocation list
- Detects chargebacks and fraud patterns
- Rate limiting on activation attempts

**Layer 5: Audit Trail**
- All activation attempts logged with hardware fingerprint
- Anomaly detection for same license across multiple devices
- Support renewal audit verifies hardware matches activation record

### 6.2 Activation Limit Enforcement

```typescript
interface ActivationAttempt {
  license_id: string;
  hardware_fingerprint: string;
  attempted_at: string;
  ip_address?: string;
  success: boolean;
  failure_reason?: string;
}

async function enforceActivationLimit(licenseKey: string): Promise<{
  allowed: boolean;
  error?: string;
  error_code?: string;
}> {
  // Step 1: Validate license key
  const validation = await validateLicenseKey(licenseKey);
  if (!validation.valid) {
    return { allowed: false, error: validation.error, error_code: validation.error_code };
  }

  const payload = validation.payload!;

  // Step 2: Count existing activations
  const activations = await db
    .select()
    .from(license_activations)
    .where(eq(license_activations.license_id, payload.license_id));

  const activeCount = activations.filter(a => a.status === 'active').length;

  // Step 3: Check against installation limit
  if (activeCount >= payload.installation_limit) {
    // Generate current hardware fingerprint
    const { fingerprint: currentFingerprint } = await generateHardwareFingerprint();

    // Check if current device already activated
    const existingActivation = activations.find(
      a => a.hardware_fingerprint === currentFingerprint && a.status === 'active'
    );

    if (existingActivation) {
      return { allowed: true }; // Re-activation on same device
    }

    return {
      allowed: false,
      error: `Installation limit reached (${payload.installation_limit}). Deactivate on another device or contact support.`,
      error_code: 'INSTALLATION_LIMIT_REACHED',
    };
  }

  return { allowed: true };
}

async function logActivationAttempt(
  licenseId: string,
  fingerprint: string,
  success: boolean,
  failureReason?: string
): Promise<void> {
  await db.insert(activation_attempts).values({
    id: crypto.randomUUID(),
    license_id: licenseId,
    hardware_fingerprint: fingerprint,
    attempted_at: new Date().toISOString(),
    success,
    failure_reason: failureReason,
  });

  // Check for suspicious activity (same license, different hardware, within 24h)
  const recentAttempts = await db
    .select()
    .from(activation_attempts)
    .where(
      and(
        eq(activation_attempts.license_id, licenseId),
        gte(
          activation_attempts.attempted_at,
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        )
      )
    );

  const uniqueFingerprints = new Set(recentAttempts.map(a => a.hardware_fingerprint));

  if (uniqueFingerprints.size > 3) {
    // Flag for fraud review
    await db.insert(fraud_alerts).values({
      id: crypto.randomUUID(),
      license_id: licenseId,
      alert_type: 'MULTIPLE_HARDWARE_ACTIVATIONS',
      details: `${uniqueFingerprints.size} unique devices in 24 hours`,
      created_at: new Date().toISOString(),
    });
  }
}
```

### 6.3 License Revocation System

**Cloud Revocation List:**

```typescript
interface LicenseRevocation {
  id: string;
  license_id: string;
  revoked_at: string;
  reason: 'fraud' | 'chargeback' | 'violation' | 'request';
  revoked_by_user_id: string;
  notes?: string;
}

async function revokeLicense(
  licenseId: string,
  reason: LicenseRevocation['reason'],
  revokedByUserId: string,
  notes?: string
): Promise<void> {
  await db.insert(license_revocations).values({
    id: crypto.randomUUID(),
    license_id: licenseId,
    revoked_at: new Date().toISOString(),
    reason,
    revoked_by_user_id: revokedByUserId,
    notes,
  });

  // Notify all hubs using this license
  const hubs = await db
    .select()
    .from(cloud_hubs)
    .where(eq(cloud_hubs.license_id, licenseId));

  for (const hub of hubs) {
    await notifyHubOfRevocation(hub.id, reason);
  }
}

async function checkLicenseRevocationStatus(licenseId: string): Promise<boolean> {
  const revocation = await db
    .select()
    .from(license_revocations)
    .where(eq(license_revocations.license_id, licenseId))
    .limit(1);

  return revocation.length > 0;
}
```

### 6.4 Support Renewal Audit

**Audit During Renewal:**

```typescript
async function auditLicenseBeforeRenewal(licenseId: string): Promise<{
  audit_passed: boolean;
  issues: string[];
  requires_manual_review: boolean;
}> {
  const issues: string[] = [];
  let requiresManualReview = false;

  // Step 1: Verify hardware fingerprint matches activation record
  const license = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, licenseId))
    .limit(1);

  if (!license.length) {
    return { audit_passed: false, issues: ['License not found'], requires_manual_review: true };
  }

  const { fingerprint: currentFingerprint } = await generateHardwareFingerprint();

  if (license[0].hardware_fingerprint !== currentFingerprint) {
    issues.push('Hardware fingerprint mismatch - device may have been replaced');
    requiresManualReview = true;
  }

  // Step 2: Check activation attempt history for anomalies
  const activationAttempts = await db
    .select()
    .from(activation_attempts)
    .where(eq(activation_attempts.license_id, licenseId));

  const uniqueFingerprints = new Set(activationAttempts.map(a => a.hardware_fingerprint));

  if (uniqueFingerprints.size > 5) {
    issues.push(`Suspicious activity: ${uniqueFingerprints.size} unique hardware fingerprints detected`);
    requiresManualReview = true;
  }

  // Step 3: Check for fraud alerts
  const fraudAlerts = await db
    .select()
    .from(fraud_alerts)
    .where(eq(fraud_alerts.license_id, licenseId));

  if (fraudAlerts.length > 0) {
    issues.push(`${fraudAlerts.length} fraud alerts on record`);
    requiresManualReview = true;
  }

  // Step 4: Verify cloud sync activity (if Cloud Control active)
  const cloudLicense = await db
    .select()
    .from(cloud_licenses)
    .where(eq(cloud_licenses.license_id, licenseId))
    .limit(1);

  if (cloudLicense.length) {
    const hub = await db
      .select()
      .from(cloud_hubs)
      .where(eq(cloud_hubs.license_id, licenseId))
      .limit(1);

    if (hub.length) {
      const lastSeen = new Date(hub[0].last_seen_at);
      const daysSinceLastSeen = Math.floor((Date.now() - lastSeen.getTime()) / (24 * 60 * 60 * 1000));

      if (daysSinceLastSeen > 180) {
        issues.push(`Hub not seen in ${daysSinceLastSeen} days - may be inactive`);
      }
    }
  }

  return {
    audit_passed: issues.length === 0,
    issues,
    requires_manual_review: requiresManualReview,
  };
}
```

### 6.5 Rate Limiting and Brute Force Protection

**Activation Attempt Rate Limiting:**

```typescript
interface RateLimitConfig {
  max_attempts: number;
  window_minutes: number;
  lockout_minutes: number;
}

const ACTIVATION_RATE_LIMITS: RateLimitConfig = {
  max_attempts: 5,           // Max 5 attempts
  window_minutes: 60,        // Per 60 minutes
  lockout_minutes: 120,      // Lockout for 2 hours
};

async function checkActivationRateLimit(licenseKey: string): Promise<{
  allowed: boolean;
  retry_after_minutes?: number;
}> {
  const validation = await validateLicenseKey(licenseKey);
  if (!validation.valid) {
    return { allowed: false };
  }

  const licenseId = validation.payload!.license_id;
  const windowStart = new Date(Date.now() - ACTIVATION_RATE_LIMITS.window_minutes * 60 * 1000);

  const recentAttempts = await db
    .select()
    .from(activation_attempts)
    .where(
      and(
        eq(activation_attempts.license_id, licenseId),
        gte(activation_attempts.attempted_at, windowStart.toISOString())
      )
    );

  if (recentAttempts.length >= ACTIVATION_RATE_LIMITS.max_attempts) {
    // Check if lockout period has passed
    const lastAttempt = new Date(recentAttempts[recentAttempts.length - 1].attempted_at);
    const lockoutExpires = new Date(lastAttempt.getTime() + ACTIVATION_RATE_LIMITS.lockout_minutes * 60 * 1000);

    if (lockoutExpires > new Date()) {
      const retryAfterMinutes = Math.ceil((lockoutExpires.getTime() - Date.now()) / (60 * 1000));
      return { allowed: false, retry_after_minutes: retryAfterMinutes };
    }
  }

  return { allowed: true };
}
```

---

## 7. Support Renewal Enforcement

### 7.1 Version Gating Strategy

**Version Access Policy:**
- **v0.1.x - v0.2.x:** Included with perpetual license (no support required)
- **v0.3.x+:** Requires active support subscription
- **Cloud features:** Require both active support AND Cloud Control subscription

**Support Status Types:**

```typescript
type SupportStatus =
  | 'ACTIVE'              // Support active, all updates allowed
  | 'GRACE_PERIOD'        // Support expired <90 days, grace period active
  | 'LAPSED_STANDARD'     // Support expired 90+ days, standard re-entry fee (22%)
  | 'LAPSED_PENALTY'      // Support expired 90+ days, penalty re-entry fee (30% surcharge)
  | 'EXPIRED';            // Support never renewed, version locked to v0.2.x

interface SupportRenewalStatus {
  status: SupportStatus;
  expires_at: string;                  // ISO 8601
  days_until_expiry: number;
  renewal_price: number;               // USD
  lapsed_days?: number;
  re_entry_fee?: number;               // USD (if lapsed >90 days)
  version_lock: string;                // Max allowed version (e.g., "0.2.99")
}
```

### 7.2 Support Status Calculation

```typescript
async function calculateSupportRenewalStatus(licenseId: string): Promise<SupportRenewalStatus> {
  const license = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, licenseId))
    .limit(1);

  if (!license.length) {
    throw new Error('License not found');
  }

  const now = new Date();
  const supportExpires = new Date(license[0].support_expires_at);
  const daysUntilExpiry = Math.floor((supportExpires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const lapsedDays = Math.max(0, -daysUntilExpiry);

  // Calculate base renewal price (22% of license value)
  const licenseValue = getLicenseValue(license[0].tier);
  const baseRenewalPrice = Math.round(licenseValue * 0.22);

  // Determine status and re-entry fee
  let status: SupportStatus;
  let reEntryFee: number | undefined;
  let versionLock: string;

  if (daysUntilExpiry > 0) {
    status = 'ACTIVE';
    versionLock = '999.999.999'; // No version lock
  } else if (lapsedDays <= 90) {
    status = 'GRACE_PERIOD';
    versionLock = '0.2.99'; // Lock to v0.2.x
  } else {
    status = 'LAPSED_PENALTY';
    reEntryFee = Math.round(baseRenewalPrice * 0.30); // 30% surcharge
    versionLock = '0.2.99';
  }

  const renewalPrice = status === 'LAPSED_PENALTY'
    ? baseRenewalPrice + (reEntryFee || 0)
    : baseRenewalPrice;

  return {
    status,
    expires_at: supportExpires.toISOString(),
    days_until_expiry: daysUntilExpiry,
    renewal_price: renewalPrice,
    lapsed_days: lapsedDays > 0 ? lapsedDays : undefined,
    re_entry_fee: reEntryFee,
    version_lock: versionLock,
  };
}

function getLicenseValue(tier: string): number {
  switch (tier) {
    case 'starter': return 1295;
    case 'expansion': return 1295 + 350; // 1645
    case 'multi_site': return 1295 + 600; // 1895
    default: return 1295;
  }
}
```

### 7.3 Version Update Enforcement

**Update Check Flow:**

```typescript
interface UpdateAvailability {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  update_allowed: boolean;
  blocked_reason?: string;
  support_status: SupportRenewalStatus;
}

async function checkUpdateAvailability(licenseId: string): Promise<UpdateAvailability> {
  const currentVersion = process.env.APP_VERSION || '0.1.0';
  const supportStatus = await calculateSupportRenewalStatus(licenseId);

  // Fetch latest version from update server
  const latestVersion = await fetchLatestVersion();

  const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

  // Check if update allowed based on support status
  let updateAllowed = true;
  let blockedReason: string | undefined;

  if (updateAvailable && compareVersions(latestVersion, supportStatus.version_lock) > 0) {
    updateAllowed = false;

    if (supportStatus.status === 'GRACE_PERIOD') {
      blockedReason = `Update to ${latestVersion} requires active support. Your support expired ${Math.abs(supportStatus.days_until_expiry)} days ago. Renew now: $${supportStatus.renewal_price}`;
    } else if (supportStatus.status === 'LAPSED_PENALTY') {
      blockedReason = `Update to ${latestVersion} requires active support. Your support lapsed ${supportStatus.lapsed_days} days ago. Renewal: $${supportStatus.renewal_price - (supportStatus.re_entry_fee || 0)} + $${supportStatus.re_entry_fee} re-entry fee = $${supportStatus.renewal_price}`;
    } else {
      blockedReason = `Update to ${latestVersion} requires active support. Renew for $${supportStatus.renewal_price}/year`;
    }
  }

  return {
    current_version: currentVersion,
    latest_version: latestVersion,
    update_available: updateAvailable,
    update_allowed: updateAllowed,
    blocked_reason: blockedReason,
    support_status: supportStatus,
  };
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
```

### 7.4 Feature Lock Enforcement

**Feature Access Control:**

```typescript
interface FeatureRequirements {
  min_version: string;
  requires_support: boolean;
  requires_cloud: boolean;
}

const FEATURE_REQUIREMENTS: Record<string, FeatureRequirements> = {
  'booking_management': { min_version: '0.1.0', requires_support: false, requires_cloud: false },
  'game_runner': { min_version: '0.1.0', requires_support: false, requires_cloud: false },
  'camera_control': { min_version: '0.1.0', requires_support: false, requires_cloud: false },
  'multi_site_analytics': { min_version: '0.3.0', requires_support: true, requires_cloud: true },
  'ota_updates': { min_version: '0.3.0', requires_support: true, requires_cloud: true },
  'advanced_reporting': { min_version: '0.3.0', requires_support: true, requires_cloud: false },
  'mobile_app_sync': { min_version: '0.4.0', requires_support: true, requires_cloud: true },
};

async function checkFeatureRequirements(
  feature: string,
  licenseId: string
): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const requirements = FEATURE_REQUIREMENTS[feature];
  if (!requirements) {
    return { allowed: false, reason: 'Feature not found' };
  }

  // Check version requirement
  const currentVersion = process.env.APP_VERSION || '0.1.0';
  if (compareVersions(currentVersion, requirements.min_version) < 0) {
    return {
      allowed: false,
      reason: `Feature requires version ${requirements.min_version} or higher. Current: ${currentVersion}`
    };
  }

  // Check support requirement
  if (requirements.requires_support) {
    const supportStatus = await calculateSupportRenewalStatus(licenseId);
    if (supportStatus.status !== 'ACTIVE') {
      return {
        allowed: false,
        reason: `Feature requires active support subscription. Renew for $${supportStatus.renewal_price}/year`
      };
    }
  }

  // Check cloud requirement
  if (requirements.requires_cloud) {
    const cloudLicense = await db
      .select()
      .from(cloud_licenses)
      .where(eq(cloud_licenses.license_id, licenseId))
      .limit(1);

    if (!cloudLicense.length) {
      return {
        allowed: false,
        reason: 'Feature requires Cloud Control subscription ($129/mo base)'
      };
    }

    const org = await db
      .select()
      .from(cloud_organizations)
      .where(eq(cloud_organizations.id, cloudLicense[0].org_id))
      .limit(1);

    if (!org.length || !['trial', 'active'].includes(org[0].subscription_status)) {
      return {
        allowed: false,
        reason: 'Feature requires active Cloud Control subscription'
      };
    }
  }

  return { allowed: true };
}
```

### 7.5 Support Renewal Flow

**Renewal Process:**

```typescript
interface SupportRenewalRequest {
  license_id: string;
  payment_method: 'stripe' | 'ach';
  payment_token?: string;
}

async function renewSupportSubscription(
  request: SupportRenewalRequest
): Promise<{
  success: boolean;
  new_expiry_date?: string;
  error?: string;
}> {
  // Step 1: Calculate renewal price
  const supportStatus = await calculateSupportRenewalStatus(request.license_id);

  // Step 2: Process payment
  let paymentResult;
  if (request.payment_method === 'stripe') {
    paymentResult = await processStripePayment(
      supportStatus.renewal_price,
      request.payment_token!,
      `Support renewal - License ${request.license_id}`
    );
  } else {
    paymentResult = await createACHInvoice(
      supportStatus.renewal_price,
      request.license_id
    );
  }

  if (!paymentResult.success) {
    return { success: false, error: paymentResult.error };
  }

  // Step 3: Extend support expiration date by 1 year
  const license = await db
    .select()
    .from(licenses)
    .where(eq(licenses.id, request.license_id))
    .limit(1);

  const currentExpiry = new Date(license[0].support_expires_at);
  const now = new Date();

  // If expired, extend from now. If active, extend from current expiry
  const baseDate = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Step 4: Update license support status
  await db
    .update(licenses)
    .set({
      support_expires_at: newExpiry.toISOString(),
      support_renewal_count: license[0].support_renewal_count + 1,
      updated_at: new Date().toISOString(),
    })
    .where(eq(licenses.id, request.license_id));

  // Step 5: Log renewal event
  await db.insert(support_renewals).values({
    id: crypto.randomUUID(),
    license_id: request.license_id,
    renewed_at: new Date().toISOString(),
    previous_expiry: license[0].support_expires_at,
    new_expiry: newExpiry.toISOString(),
    amount_paid: supportStatus.renewal_price,
    payment_method: request.payment_method,
    payment_id: paymentResult.payment_id,
  });

  return { success: true, new_expiry_date: newExpiry.toISOString() };
}
```

---

## 8. Implementation Specification

### 8.1 Database Schema

**License Tables:**

```typescript
// apps/escapeplan-api/src/db/schema.ts
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

export const licenses = sqliteTable('licenses', {
  id: text('id').primaryKey(),                          // UUID from license key payload
  key: text('key').notNull().unique(),                  // Full license key
  tier: text('tier').notNull(),                         // 'starter' | 'expansion' | 'multi_site'
  org_identifier: text('org_identifier').notNull(),     // Pre-cloud org ID
  room_capacity: integer('room_capacity').notNull(),    // 4 | 8 | 12
  installation_limit: integer('installation_limit').notNull(), // 1 | 2

  hardware_fingerprint: text('hardware_fingerprint'),   // HMAC-SHA256 hex
  fingerprint_components: text('fingerprint_components'), // JSON of identifiers
  activated_at: text('activated_at'),                   // ISO 8601

  support_expires_at: text('support_expires_at').notNull(), // ISO 8601
  support_renewal_count: integer('support_renewal_count').default(0),

  last_validated_at: text('last_validated_at').notNull(), // ISO 8601
  cloud_last_sync_at: text('cloud_last_sync_at'),       // ISO 8601
  cloud_features: text('cloud_features'),               // JSON feature flags
  cloud_features_updated_at: text('cloud_features_updated_at'),

  parent_license_id: text('parent_license_id'),         // For add-ons
  add_on_type: text('add_on_type'),                     // 'expansion_pack' | 'multi_site'

  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const license_activations = sqliteTable('license_activations', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  hardware_fingerprint: text('hardware_fingerprint').notNull(),
  activated_at: text('activated_at').notNull(),
  deactivated_at: text('deactivated_at'),
  status: text('status').notNull(), // 'active' | 'deactivated'
});

export const activation_attempts = sqliteTable('activation_attempts', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull(),
  hardware_fingerprint: text('hardware_fingerprint').notNull(),
  attempted_at: text('attempted_at').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  failure_reason: text('failure_reason'),
  ip_address: text('ip_address'),
});

export const license_transfers = sqliteTable('license_transfers', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  transfer_token: text('transfer_token').notNull().unique(),
  old_fingerprint: text('old_fingerprint').notNull(),
  new_fingerprint: text('new_fingerprint').notNull(),
  reason: text('reason').notNull(), // 'rma' | 'hardware_upgrade' | 'other'
  support_ticket_id: text('support_ticket_id'),
  status: text('status').notNull(), // 'pending' | 'completed' | 'cancelled'
  expires_at: text('expires_at').notNull(),
  completed_at: text('completed_at'),
  created_at: text('created_at').notNull(),
});

export const license_revocations = sqliteTable('license_revocations', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  revoked_at: text('revoked_at').notNull(),
  reason: text('reason').notNull(), // 'fraud' | 'chargeback' | 'violation' | 'request'
  revoked_by_user_id: text('revoked_by_user_id').notNull(),
  notes: text('notes'),
});

export const fraud_alerts = sqliteTable('fraud_alerts', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  alert_type: text('alert_type').notNull(), // 'MULTIPLE_HARDWARE_ACTIVATIONS', etc.
  details: text('details'),
  status: text('status').notNull().default('open'), // 'open' | 'investigating' | 'resolved'
  created_at: text('created_at').notNull(),
  resolved_at: text('resolved_at'),
});

export const support_renewals = sqliteTable('support_renewals', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  renewed_at: text('renewed_at').notNull(),
  previous_expiry: text('previous_expiry').notNull(),
  new_expiry: text('new_expiry').notNull(),
  amount_paid: integer('amount_paid').notNull(), // USD cents
  payment_method: text('payment_method').notNull(), // 'stripe' | 'ach'
  payment_id: text('payment_id').notNull(),
});

// Cloud organization tables
export const cloud_organizations = sqliteTable('cloud_organizations', {
  id: text('id').primaryKey(),
  org_identifier: text('org_identifier').notNull().unique(), // Links to license
  business_name: text('business_name').notNull(),
  owner_user_id: text('owner_user_id').notNull(),
  subscription_status: text('subscription_status').notNull(), // 'trial' | 'active' | 'past_due' | 'cancelled'
  trial_expires_at: text('trial_expires_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const cloud_licenses = sqliteTable('cloud_licenses', {
  id: text('id').primaryKey(),
  license_id: text('license_id').notNull().references(() => licenses.id),
  org_id: text('org_id').notNull().references(() => cloud_organizations.id),
  linked_at: text('linked_at').notNull(),
});

export const cloud_hubs = sqliteTable('cloud_hubs', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => cloud_organizations.id),
  license_id: text('license_id').notNull().references(() => licenses.id),
  hardware_fingerprint: text('hardware_fingerprint').notNull().unique(),
  hub_name: text('hub_name').notNull(),
  api_token: text('api_token').notNull().unique(),
  registered_at: text('registered_at').notNull(),
  last_seen_at: text('last_seen_at').notNull(),
  status: text('status').notNull(), // 'online' | 'offline' | 'deregistered'
});

export const cloud_subscriptions = sqliteTable('cloud_subscriptions', {
  id: text('id').primaryKey(),
  org_id: text('org_id').notNull().references(() => cloud_organizations.id),
  status: text('status').notNull(), // 'trial' | 'active' | 'past_due' | 'cancelled'
  base_subscription_active: integer('base_subscription_active', { mode: 'boolean' }).notNull(),
  hub_count: integer('hub_count').notNull(),
  additional_hubs_count: integer('additional_hubs_count').notNull(),
  premium_support_active: integer('premium_support_active', { mode: 'boolean' }).notNull(),
  monthly_cost: integer('monthly_cost').notNull(), // USD cents
  billing_cycle_start: text('billing_cycle_start').notNull(),
  next_billing_date: text('next_billing_date').notNull(),
  stripe_subscription_id: text('stripe_subscription_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

### 8.2 API Endpoints

**License Management:**

```typescript
// POST /api/admin/license/activate
// Activate license on current device
interface ActivateLicenseRequest {
  license_key: string;
}

// POST /api/admin/license/validate
// Validate current license status
interface ValidateLicenseResponse {
  valid: boolean;
  status: LicenseValidationStatus;
}

// POST /api/admin/license/transfer/request
// Request license transfer to new hardware
interface TransferRequest {
  license_id: string;
  reason: 'rma' | 'hardware_upgrade' | 'other';
  support_ticket_id?: string;
}

// POST /api/admin/license/transfer/complete
// Complete license transfer with token
interface CompleteTransferRequest {
  transfer_token: string;
}

// GET /api/admin/license/support-status
// Get support renewal status
interface SupportStatusResponse {
  status: SupportRenewalStatus;
}

// POST /api/admin/license/support/renew
// Renew support subscription
interface RenewSupportRequest {
  license_id: string;
  payment_method: 'stripe' | 'ach';
  payment_token?: string;
}

// GET /api/admin/license/update-check
// Check for available updates
interface UpdateCheckResponse {
  availability: UpdateAvailability;
}

// POST /api/cloud/account/create
// Create cloud account (links license to org)
interface CreateCloudAccountRequest {
  email: string;
  password: string;
  license_key: string;
  business_name: string;
}

// POST /api/cloud/hub/register
// Register hub with cloud org
interface RegisterHubRequest {
  license_key: string;
  hub_name: string;
}
```

### 8.3 Environment Variables

```bash
# apps/escapeplan-api/.env

# License system
LICENSE_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN..."
LICENSE_VALIDATION_INTERVAL=86400000  # 24 hours in ms
GRACE_PERIOD_STANDARD=7776000000      # 90 days in ms
GRACE_PERIOD_EXTENDED=15552000000     # 180 days in ms
EMERGENCY_MODE_DURATION=604800000     # 7 days in ms

# Cloud sync
CLOUD_API_BASE_URL="https://api.escapeplan.app"
CLOUD_SYNC_ENABLED=false              # Set to true when Cloud Control active

# Feature flags (overridden by license)
FEATURE_CLOUD_SYNC=false
FEATURE_REMOTE_DASHBOARD=false
FEATURE_OFFSITE_BACKUP=false
FEATURE_PRIORITY_SUPPORT=false

# App version (for update checks)
APP_VERSION="0.2.0"
```

### 8.4 Service Integration Points

**License Service Module:**

```typescript
// apps/escapeplan-api/src/license/index.ts
export {
  generateLicenseKey,
  validateLicenseKey,
  activateLicense,
  validateHardwareBinding,
  performLicenseValidation,
  checkFeatureAccess,
  calculateSupportRenewalStatus,
  checkUpdateAvailability,
} from './validation';

export {
  generateHardwareFingerprint,
  collectHardwareIdentifiers,
  validateHardwareBindingWithTolerance,
} from './fingerprint';

export {
  createCloudAccount,
  registerHubWithCloud,
  syncCloudFeaturesToHub,
} from './cloud';

export {
  revokeLicense,
  checkLicenseRevocationStatus,
  auditLicenseBeforeRenewal,
} from './anti-piracy';

export {
  renewSupportSubscription,
  checkFeatureRequirements,
} from './support';
```

---

## 9. Test Strategy

### 9.1 Unit Tests

**License Key Generation:**
- Test RSA signature generation with known private key
- Verify Base32 encoding/decoding round-trip
- Validate payload schema compliance
- Test tier-specific capacity calculations

**License Key Validation:**
- Test signature verification with public key
- Test invalid signature detection (forged keys)
- Test malformed key rejection
- Test payload schema validation

**Hardware Fingerprinting:**
- Test fingerprint generation consistency
- Test fuzzy matching for hardware changes
- Test similarity calculation thresholds
- Test fingerprint binding validation

**Support Status Calculation:**
- Test active support status
- Test grace period calculation
- Test lapsed support with penalty
- Test re-entry fee calculation

### 9.2 Integration Tests

**Activation Flow:**
```typescript
describe('License Activation', () => {
  it('should activate valid license on first device', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    const result = await activateLicense(licenseKey);

    expect(result.success).toBe(true);
    expect(result.fingerprint).toBeDefined();
  });

  it('should reject activation on second device for single-install license', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    await activateLicense(licenseKey); // First activation

    // Simulate different hardware
    mockHardwareFingerprint('different-device');
    const result = await activateLicense(licenseKey);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('INSTALLATION_LIMIT_REACHED');
  });

  it('should allow re-activation on same device', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    const firstActivation = await activateLicense(licenseKey);

    // Simulate restart with same fingerprint
    const secondActivation = await activateLicense(licenseKey);

    expect(secondActivation.success).toBe(true);
    expect(secondActivation.fingerprint).toBe(firstActivation.fingerprint);
  });
});
```

**Grace Period Validation:**
```typescript
describe('Offline Grace Period', () => {
  it('should allow offline operation within grace period', async () => {
    const license = await createTestLicense({
      last_validated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
    });

    const status = await performLicenseValidation();

    expect(status.valid).toBe(true);
    expect(status.state).toBe('VALID_OFFLINE');
    expect(status.days_until_grace_expiry).toBe(30);
  });

  it('should enter grace warning state 7 days before expiry', async () => {
    const license = await createTestLicense({
      last_validated_at: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000) // 83 days ago
    });

    const status = await performLicenseValidation();

    expect(status.valid).toBe(true);
    expect(status.state).toBe('VALID_GRACE_WARNING');
    expect(status.warnings).toContain('Grace period expires in 7 days');
  });

  it('should enter emergency mode after grace expiry', async () => {
    const license = await createTestLicense({
      last_validated_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000) // 95 days ago
    });

    const status = await performLicenseValidation();

    expect(status.valid).toBe(true);
    expect(status.state).toBe('GRACE_EXPIRED_EMERGENCY');

    const bookingCreateAccess = checkFeatureAccess('bookings:create', status);
    expect(bookingCreateAccess.allowed).toBe(false);

    const sessionStartAccess = checkFeatureAccess('sessions:start', status);
    expect(sessionStartAccess.allowed).toBe(true);
  });

  it('should reset grace period on cloud connection', async () => {
    const license = await createTestLicense({
      last_validated_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000) // 80 days ago
    });

    mockCloudConnection(true);
    await resetGracePeriodOnCloudConnection();

    const status = await performLicenseValidation();

    expect(status.state).toBe('VALID_ONLINE');
    expect(status.days_until_grace_expiry).toBeGreaterThan(80);
  });
});
```

**Cloud Organization Linking:**
```typescript
describe('Cloud Organization Linking', () => {
  it('should create cloud org with license org_identifier', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    const payload = (await validateLicenseKey(licenseKey)).payload!;

    const result = await createCloudAccount({
      email: 'owner@escape.room',
      password: 'secure123',
      license_key: licenseKey,
      business_name: 'Test Escape Room',
    });

    expect(result.success).toBe(true);

    const org = await db.select()
      .from(cloud_organizations)
      .where(eq(cloud_organizations.org_identifier, payload.org_identifier))
      .limit(1);

    expect(org).toHaveLength(1);
    expect(org[0].business_name).toBe('Test Escape Room');
  });

  it('should register hub with matching org_identifier', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    await activateLicense(licenseKey);
    await createCloudAccount({
      email: 'owner@escape.room',
      password: 'secure123',
      license_key: licenseKey,
      business_name: 'Test Escape Room',
    });

    const { fingerprint } = await generateHardwareFingerprint();
    const result = await registerHubWithCloud({
      license_key: licenseKey,
      hardware_fingerprint: fingerprint,
      hub_name: 'Main Hub',
    });

    expect(result.success).toBe(true);
    expect(result.hub_id).toBeDefined();
    expect(result.api_token).toBeDefined();
  });
});
```

**Support Renewal:**
```typescript
describe('Support Renewal', () => {
  it('should calculate standard renewal price (22% of license value)', async () => {
    const license = await createTestLicense({ tier: 'starter' }); // $1,295
    const status = await calculateSupportRenewalStatus(license.id);

    expect(status.renewal_price).toBe(285); // 22% of 1295
  });

  it('should apply 30% re-entry penalty for lapsed >90 days', async () => {
    const license = await createTestLicense({
      tier: 'starter',
      support_expires_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    });

    const status = await calculateSupportRenewalStatus(license.id);

    expect(status.status).toBe('LAPSED_PENALTY');
    expect(status.re_entry_fee).toBe(86); // 30% of 285
    expect(status.renewal_price).toBe(371); // 285 + 86
  });

  it('should extend support by 1 year on renewal', async () => {
    const license = await createTestLicense({
      support_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });

    const result = await renewSupportSubscription({
      license_id: license.id,
      payment_method: 'stripe',
      payment_token: 'tok_visa',
    });

    expect(result.success).toBe(true);

    const updated = await db.select()
      .from(licenses)
      .where(eq(licenses.id, license.id))
      .limit(1);

    const newExpiry = new Date(updated[0].support_expires_at);
    const expectedExpiry = new Date(Date.now() + 395 * 24 * 60 * 60 * 1000); // 30 + 365

    expect(Math.abs(newExpiry.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
  });
});
```

### 9.3 Security Tests

**Anti-Piracy Validation:**
```typescript
describe('Anti-Piracy Measures', () => {
  it('should detect forged license keys', async () => {
    const validKey = await generateTestLicenseKey('starter');
    const [prefix, version, data, signature] = validKey.split('-');

    // Tamper with data
    const tamperedKey = `${prefix}-${version}-${data}TAMPERED-${signature}`;
    const result = await validateLicenseKey(tamperedKey);

    expect(result.valid).toBe(false);
    expect(result.error_code).toBe('SIGNATURE_INVALID');
  });

  it('should rate limit activation attempts', async () => {
    const licenseKey = await generateTestLicenseKey('starter');

    // Attempt 6 activations in quick succession
    for (let i = 0; i < 6; i++) {
      mockHardwareFingerprint(`device-${i}`);
      await activateLicense(licenseKey);
    }

    const rateLimitCheck = await checkActivationRateLimit(licenseKey);

    expect(rateLimitCheck.allowed).toBe(false);
    expect(rateLimitCheck.retry_after_minutes).toBeDefined();
  });

  it('should flag suspicious multi-device activations', async () => {
    const licenseKey = await generateTestLicenseKey('starter');

    // Attempt activations from 4 different devices within 24h
    for (let i = 0; i < 4; i++) {
      mockHardwareFingerprint(`device-${i}`);
      await logActivationAttempt(licenseKey, `device-${i}`, false, 'test');
    }

    const fraudAlerts = await db.select()
      .from(fraud_alerts)
      .where(eq(fraud_alerts.license_id, licenseKey));

    expect(fraudAlerts).toHaveLength(1);
    expect(fraudAlerts[0].alert_type).toBe('MULTIPLE_HARDWARE_ACTIVATIONS');
  });

  it('should revoke license and notify hubs', async () => {
    const licenseKey = await generateTestLicenseKey('starter');
    const { payload } = await validateLicenseKey(licenseKey);

    await revokeLicense(payload!.license_id, 'fraud', 'admin-user-id');

    const revoked = await checkLicenseRevocationStatus(payload!.license_id);
    expect(revoked).toBe(true);

    const validation = await performLicenseValidation();
    expect(validation.state).toBe('INVALID_REVOKED');
  });
});
```

### 9.4 Hardware Fingerprint Tests

```typescript
describe('Hardware Fingerprinting', () => {
  it('should generate consistent fingerprints', async () => {
    const fp1 = await generateHardwareFingerprint();
    const fp2 = await generateHardwareFingerprint();

    expect(fp1.fingerprint).toBe(fp2.fingerprint);
  });

  it('should detect hardware changes', async () => {
    const original = await generateHardwareFingerprint();

    // Simulate MAC address change (network adapter replacement)
    mockHardwareIdentifiers({ mac_address: 'AA:BB:CC:DD:EE:FF' });
    const changed = await generateHardwareFingerprint();

    expect(changed.fingerprint).not.toBe(original.fingerprint);
  });

  it('should tolerate SD card replacement (75% match)', async () => {
    const license = await createTestLicense({
      hardware_fingerprint: 'original-fingerprint',
      fingerprint_components: JSON.stringify({
        cpu_serial: 'ABC123',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        disk_uuid: 'DISK-UUID-1',
        hardware_uuid: 'HW-UUID-1',
      }),
    });

    // Simulate SD card replacement (disk_uuid changed, others same)
    mockHardwareIdentifiers({
      cpu_serial: 'ABC123',
      mac_address: 'AA:BB:CC:DD:EE:FF',
      disk_uuid: 'DISK-UUID-2', // Changed
      hardware_uuid: 'HW-UUID-1',
    });

    const result = await validateHardwareBindingWithTolerance(license.id);

    expect(result.valid).toBe(true);
    expect(result.similarity).toBe(0.75);
    expect(result.requires_transfer).toBe(false);
  });

  it('should require transfer for full hardware replacement (<50% match)', async () => {
    const license = await createTestLicense({
      hardware_fingerprint: 'original-fingerprint',
      fingerprint_components: JSON.stringify({
        cpu_serial: 'ABC123',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        disk_uuid: 'DISK-UUID-1',
        hardware_uuid: 'HW-UUID-1',
      }),
    });

    // Simulate full board replacement
    mockHardwareIdentifiers({
      cpu_serial: 'XYZ789', // Changed
      mac_address: '11:22:33:44:55:66', // Changed
      disk_uuid: 'DISK-UUID-2', // Changed
      hardware_uuid: 'HW-UUID-2', // Changed
    });

    const result = await validateHardwareBindingWithTolerance(license.id);

    expect(result.valid).toBe(false);
    expect(result.similarity).toBe(0);
    expect(result.requires_transfer).toBe(true);
  });
});
```

---

## 10. Error Handling

### 10.1 Error Codes and Messages

```typescript
export const LICENSE_ERROR_CODES = {
  // Validation errors
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    message: 'License key format is invalid. Expected: LICENSE-v1-{data}-{signature}',
    user_action: 'Verify you copied the entire license key from your purchase email',
  },

  DECODE_ERROR: {
    code: 'DECODE_ERROR',
    message: 'License key contains invalid characters',
    user_action: 'Check for typos in the license key. Use copy/paste to avoid errors',
  },

  SIGNATURE_INVALID: {
    code: 'SIGNATURE_INVALID',
    message: 'License signature verification failed - key may be forged or tampered',
    user_action: 'Contact support@escapeplan.app with your purchase receipt',
  },

  PAYLOAD_INVALID: {
    code: 'PAYLOAD_INVALID',
    message: 'License payload structure is invalid',
    user_action: 'Contact support - this license may be corrupted',
  },

  SCHEMA_INVALID: {
    code: 'SCHEMA_INVALID',
    message: 'License data does not match expected schema',
    user_action: 'Contact support - this license may be from an incompatible version',
  },

  // Activation errors
  ALREADY_ACTIVATED: {
    code: 'ALREADY_ACTIVATED',
    message: 'License already activated on another device',
    user_action: 'Deactivate on the other device or request a license transfer',
  },

  INSTALLATION_LIMIT_REACHED: {
    code: 'INSTALLATION_LIMIT_REACHED',
    message: 'Maximum number of installations for this license has been reached',
    user_action: 'Upgrade to Multi-Site Add-On ($600) or purchase additional license',
  },

  HARDWARE_MISMATCH: {
    code: 'HARDWARE_MISMATCH',
    message: 'Hardware fingerprint does not match activated device',
    user_action: 'If hardware was replaced, request license transfer from Settings > License',
  },

  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many activation attempts. Please try again later',
    user_action: 'Wait {retry_after_minutes} minutes before attempting activation again',
  },

  // Validation state errors
  GRACE_EXPIRED: {
    code: 'GRACE_EXPIRED',
    message: 'License grace period expired. Connect to internet to validate',
    user_action: 'Connect Pi to internet within 7 days to restore full functionality',
  },

  SUPPORT_EXPIRED: {
    code: 'SUPPORT_EXPIRED',
    message: 'Support subscription expired. Updates blocked for versions 0.3.0+',
    user_action: 'Renew support for ${renewal_price}/year to receive updates',
  },

  SUPPORT_LAPSED_PENALTY: {
    code: 'SUPPORT_LAPSED_PENALTY',
    message: 'Support lapsed >90 days. Re-entry fee applies',
    user_action: 'Renewal: ${base_price} + ${penalty_fee} re-entry fee = ${total}',
  },

  LICENSE_REVOKED: {
    code: 'LICENSE_REVOKED',
    message: 'License has been revoked',
    user_action: 'Contact support@escapeplan.app for assistance',
  },

  // Cloud linking errors
  CLOUD_ORG_EXISTS: {
    code: 'CLOUD_ORG_EXISTS',
    message: 'License already linked to cloud organization',
    user_action: 'Contact support to transfer ownership',
  },

  CLOUD_ORG_NOT_FOUND: {
    code: 'CLOUD_ORG_NOT_FOUND',
    message: 'Cloud organization not found for this license',
    user_action: 'Create cloud account at portal.escapeplan.app first',
  },

  HUB_LIMIT_REACHED: {
    code: 'HUB_LIMIT_REACHED',
    message: 'Hub limit reached for current subscription tier',
    user_action: 'Upgrade Cloud Control subscription to add more hubs',
  },

  // Transfer errors
  TRANSFER_TOKEN_INVALID: {
    code: 'TRANSFER_TOKEN_INVALID',
    message: 'License transfer token is invalid or expired',
    user_action: 'Request new transfer from original device Settings > License',
  },

  TRANSFER_FINGERPRINT_MISMATCH: {
    code: 'TRANSFER_FINGERPRINT_MISMATCH',
    message: 'Hardware fingerprint does not match transfer request',
    user_action: 'Complete transfer on the device specified in transfer request',
  },

  TRANSFER_REQUIRES_SUPPORT: {
    code: 'TRANSFER_REQUIRES_SUPPORT',
    message: 'Active support required for free RMA transfers',
    user_action: 'Renew support or contact sales for paid transfer',
  },
} as const;

export type LicenseErrorCode = keyof typeof LICENSE_ERROR_CODES;

export class LicenseError extends Error {
  constructor(
    public code: LicenseErrorCode,
    public userAction: string,
    public details?: Record<string, any>
  ) {
    super(LICENSE_ERROR_CODES[code].message);
    this.name = 'LicenseError';
  }
}
```

### 10.2 Error Recovery Flows

**Activation Failure Recovery:**

```typescript
async function handleActivationFailure(
  error: LicenseError,
  licenseKey: string
): Promise<void> {
  switch (error.code) {
    case 'ALREADY_ACTIVATED':
      // Show UI to request license transfer
      showLicenseTransferDialog(licenseKey);
      break;

    case 'INSTALLATION_LIMIT_REACHED':
      // Show upgrade options
      showUpgradeDialog({
        options: [
          { label: 'Multi-Site Add-On', price: 600 },
          { label: 'New License', price: 1295 },
        ],
      });
      break;

    case 'HARDWARE_MISMATCH':
      // Check if hardware change is legitimate
      const tolerance = await validateHardwareBindingWithTolerance(licenseKey);
      if (tolerance.similarity >= 0.75) {
        // Auto-approve minor hardware change
        await updateHardwareFingerprint(licenseKey);
      } else if (tolerance.requires_transfer) {
        showLicenseTransferDialog(licenseKey);
      }
      break;

    case 'RATE_LIMIT_EXCEEDED':
      // Show countdown timer
      showRateLimitWarning(error.details?.retry_after_minutes);
      break;

    default:
      // Generic error with support contact
      showErrorDialog({
        title: 'Activation Failed',
        message: error.message,
        action: error.userAction,
        supportEmail: 'support@escapeplan.app',
      });
  }
}
```

**Grace Period Expiry Recovery:**

```typescript
async function handleGracePeriodExpiry(): Promise<void> {
  const status = await performLicenseValidation();

  if (status.state === 'VALID_GRACE_WARNING') {
    // Show warning banner
    showWarningBanner({
      message: `Grace period expires in ${status.days_until_grace_expiry} days`,
      action: 'Connect to internet to reset grace period',
      severity: 'warning',
    });
  } else if (status.state === 'GRACE_EXPIRED_EMERGENCY') {
    // Show emergency mode modal
    showEmergencyModeDialog({
      message: 'License grace period expired. Operating in emergency mode with limited functionality.',
      restrictions: [
        'Cannot create or edit bookings',
        'Cannot modify games',
        'Cannot access admin settings',
        'Can start/manage active sessions',
      ],
      action: 'Connect to internet within 7 days to restore full functionality',
    });
  } else if (status.state === 'INVALID_EXPIRED') {
    // Grace period fully expired
    showBlockingDialog({
      title: 'License Validation Required',
      message: 'Connect to internet to validate your license and restore functionality',
      allowDismiss: false,
    });
  }
}
```

**Support Renewal Recovery:**

```typescript
async function handleSupportExpiry(licenseId: string): Promise<void> {
  const supportStatus = await calculateSupportRenewalStatus(licenseId);

  if (supportStatus.status === 'GRACE_PERIOD') {
    // Show renewal reminder
    showRenewalReminder({
      message: `Support expired ${Math.abs(supportStatus.days_until_expiry)} days ago`,
      gracePeriod: 90 - Math.abs(supportStatus.days_until_expiry),
      renewalPrice: supportStatus.renewal_price,
      action: 'Renew now to continue receiving updates',
    });
  } else if (supportStatus.status === 'LAPSED_PENALTY') {
    // Show re-entry fee warning
    showRenewalDialog({
      message: 'Support lapsed more than 90 days ago',
      basePrice: supportStatus.renewal_price - (supportStatus.re_entry_fee || 0),
      penalty: supportStatus.re_entry_fee,
      totalPrice: supportStatus.renewal_price,
      explanation: 'A 30% re-entry fee applies to renewals after 90-day lapse',
    });
  }
}
```

### 10.3 Logging and Monitoring

**License Event Logging:**

```typescript
interface LicenseEvent {
  event_type:
    | 'activation_success'
    | 'activation_failure'
    | 'validation_success'
    | 'validation_failure'
    | 'grace_period_warning'
    | 'grace_period_expired'
    | 'support_renewed'
    | 'support_expired'
    | 'license_transferred'
    | 'license_revoked'
    | 'cloud_linked'
    | 'hub_registered'
    | 'fraud_alert';
  license_id: string;
  timestamp: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

async function logLicenseEvent(event: LicenseEvent): Promise<void> {
  // Log to database
  await db.insert(license_events).values({
    id: crypto.randomUUID(),
    event_type: event.event_type,
    license_id: event.license_id,
    timestamp: event.timestamp,
    details: JSON.stringify(event.details),
    severity: event.severity,
  });

  // Log to console
  const logFn = event.severity === 'error' || event.severity === 'critical'
    ? console.error
    : console.log;

  logFn(`[LICENSE] ${event.event_type}:`, {
    license_id: event.license_id.substring(0, 8),
    ...event.details,
  });

  // Send critical events to monitoring
  if (event.severity === 'critical') {
    await sendToMonitoring({
      service: 'license-validation',
      event: event.event_type,
      license_id: event.license_id,
      details: event.details,
    });
  }
}

// Usage examples
await logLicenseEvent({
  event_type: 'activation_success',
  license_id: 'lic_123',
  timestamp: new Date().toISOString(),
  details: { hardware_fingerprint: 'abc123...' },
  severity: 'info',
});

await logLicenseEvent({
  event_type: 'fraud_alert',
  license_id: 'lic_456',
  timestamp: new Date().toISOString(),
  details: {
    alert_type: 'MULTIPLE_HARDWARE_ACTIVATIONS',
    unique_fingerprints: 5,
    time_window: '24h',
  },
  severity: 'critical',
});
```

---

## Validation Checklist

### QA Validation Results

1. **No placeholders:** ✅ PASS
   - No TODO, FIXME, STUB, or TBD markers in document
   - All sections complete with implementation code
   - All algorithms fully specified

2. **Error handling:** ✅ PASS
   - Comprehensive error codes defined (Section 10.1)
   - Error recovery flows documented (Section 10.2)
   - All validation error cases handled with user actions
   - Logging and monitoring strategy specified (Section 10.3)

3. **Type hints:** ✅ PASS
   - TypeScript interfaces for all license structures
   - Type-safe error codes and states
   - Database schema with explicit column types
   - API request/response types documented

4. **Tests:** ✅ PASS
   - Unit test strategy (Section 9.1)
   - Integration tests (Section 9.2)
   - Security tests (Section 9.3)
   - Hardware fingerprint tests (Section 9.4)
   - Test coverage for all critical flows

5. **Architecture:** ✅ PASS
   - Offline-first validation design
   - Cloud linking optional, not required
   - Grace period mechanism for offline operation
   - Hardware fingerprinting for anti-piracy
   - Multi-layer security strategy

6. **Techstack:** ✅ PASS
   - Node.js crypto module (RSA-2048, HMAC-SHA256)
   - SQLite storage via Drizzle ORM
   - Context7 research: systeminformation for hardware detection
   - Base32 encoding for human-readable keys
   - Compatible with Pi hardware constraints

7. **Code quality:** ✅ PASS
   - Clear, well-structured design
   - Modular service architecture
   - Consistent naming conventions
   - Comprehensive documentation
   - Production-ready implementations

8. **Documentation:** ✅ PASS
   - All sections complete with examples
   - Context7 research integrated (Sections 3, 2)
   - Industry best practices documented
   - Implementation specification provided
   - Database schema fully defined
   - API endpoints documented

### Context7 Research Integration

**Hardware Fingerprinting (Section 3):**
- Used `/sebhildebrandt/systeminformation` library documentation
- CPU serial, MAC address, disk UUID, hardware UUID extraction
- Cross-platform hardware identification APIs
- Raspberry Pi specific identifier collection

**Cryptographic Validation (Section 2):**
- Used Node.js crypto module documentation
- RSA-2048 signature generation and verification
- HMAC-SHA256 for hardware fingerprinting
- Web Crypto API patterns for key management

**Industry Best Practices (Sections 4, 6):**
- Web search: offline grace periods (Adobe: 99 days, Microsoft: 30 days, Citrix: 30 days)
- Web search: RSA signature license keys (industry standard 2025)
- Web search: hardware fingerprinting anti-piracy strategies
- Web search: Base32 encoding for license key formats

---

## Document Status

**Status:** ✅ COMPLETE - All 8 QA checks passed

**Research Sources:**
- Context7: `/sebhildebrandt/systeminformation` (hardware fingerprinting)
- Context7: `/nodejs/node` (crypto, HMAC, signature verification)
- Web Research: License key validation best practices 2025
- Web Research: Offline grace period strategies
- Web Research: RSA signature formats and encoding

**Dependencies Satisfied:**
- ✅ MONETIZATION_CLOUD_REQUIREMENTS.md (license pricing, renewal structure)
- ⚠️  ORGANIZATION_HUB_MODEL.md (not found - designed independently)

**Implementation Ready:** YES
- Database schema complete (Section 8.1)
- API endpoints specified (Section 8.2)
- Service modules defined (Section 8.4)
- Test strategy comprehensive (Section 9)
- Error handling complete (Section 10)
