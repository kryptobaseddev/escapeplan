# ID Generation Strategy

## crypto.randomUUID() - Best For:
- Database Primary Keys (users, posts, organizations)
- Foreign Keys and relational references
- Internal system IDs that users rarely see
- Audit logs and internal tracking

## nanoid - Best For:
- Public-facing URLs (/posts/V1StGXR8_Z5jdHi6B-myT)
- Invite codes (JOIN-x3kH9pL)
- API keys and tokens
- Short links and shareable references
- Session identifiers (non-auth)
- Rate limiting keys

## Implementation Guidelines

### Use UUIDs for:
- All database PKs/FKs (Drizzle schema, Better Auth user IDs)
- Internal references

### Use nanoid for:
- Public profile URLs (/u/${publicId})
- Invite/referral codes
- API keys (if generated)
- Short URLs or share links
- Temporary tokens (password reset, email verification)

## Why Both?

- **UUIDs**: Database integrity, Better Auth compatibility, standard format
- **nanoid**: URL-friendly, shorter, customizable alphabet, no hyphens
