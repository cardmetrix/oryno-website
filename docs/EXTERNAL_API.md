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

# Betting providers + demo IDs
curl -H "Authorization: Bearer $TOKEN" \
  https://orynoafrica.com/api/external/v1/services/betting/providers

# Verify betting account
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceID":"bet9ja","customerRef":"12345678"}' \
  https://orynoafrica.com/api/external/v1/services/betting/verify

# Fund betting wallet
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"serviceID":"bet9ja","customerRef":"12345678","amount":2000}' \
  https://orynoafrica.com/api/external/v1/services/betting/fund
```

Demo customer IDs (when the country’s rail keys are unset or `BETTING_DEMO=true`):

| ID | Result |
|---|---|
| `12345678` | Adaobi Okafor — verify + fund succeed |
| `87654321` | Chinedu Eze — verify + fund succeed |
| `10000001` | Sporty Demo User — verify + fund succeed |
| `00000000` | Verification fails |
| `99999999` | Verifies, then funding fails and wallet is refunded |

Rails: Nigeria uses ClubKonnect (`CLUBKONNECT_USER_ID` + `CLUBKONNECT_API_KEY`). Ghana, Kenya, and South Africa use VTU Africa (`VTU_AFRICA_API_KEY`).
