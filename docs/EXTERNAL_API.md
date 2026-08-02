# ORYNO External API (v1)

Stable HTTP surface for the ORYNO mobile app (`oryno-africa`) and other clients.

## Base URL

```
https://orynoafrica.com/api/external/v1
```

Local:

```
http://localhost:3000/api/external/v1
```

## Auth

Send a Clerk session JWT on every protected call:

```
Authorization: Bearer <clerk_session_jwt>
```

Native Expo obtains this via `getToken()` from `@clerk/clerk-expo`.

## Discovery

```
GET /api/external/v1
```

Returns catalog, auth notes, and path aliases.

## Path rules

1. Prefer friendly service paths (aliases), e.g.  
   `POST /api/external/v1/services/airtime/purchase`
2. Or call the same relative paths as the website under `/api/...`  
   with the `/api` prefix replaced by `/api/external/v1`, e.g.  
   `GET /api/wallet` → `GET /api/external/v1/wallet`
3. Admin and webhook routes are **not** exposed.

## CORS

Configured for native apps (no `Origin`) and allowlisted browser origins.

Optional env:

```
EXTERNAL_API_ALLOWED_ORIGINS=https://app.example.com,http://localhost:8081
```

## Examples

```bash
# Health / catalog
curl https://orynoafrica.com/api/external/v1

# Wallet (requires Bearer)
curl -H "Authorization: Bearer $TOKEN" \
  https://orynoafrica.com/api/external/v1/wallet

# Buy airtime (alias)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceID":"mtn","phone":"08012345678","amount":100}' \
  https://orynoafrica.com/api/external/v1/services/airtime/purchase
```
