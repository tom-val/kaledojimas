# Knock Knock / Tuk tuk (kaledojimas)

Halloween map: households mark their house as "giving out candy", trick-or-treaters see those houses
on a map, and the household ends participation when the candy runs out. No accounts: the device that
marked a house holds a secret token, and only that token can remove it. One Expo client
(iOS / Android / Web) + one Node Lambda over DynamoDB. Layout and conventions follow
../how-is-my-coffee (same author).

## Quick start

```bash
make infra   # DynamoDB Local :8000  (DYNAMODB_PORT=8010 if another project holds :8000 — pass it to every target)
make seed    # creates table KnockKnock
make api     # http://localhost:3001 (listens on all interfaces, so a phone on the LAN reaches it)
make web     # Expo web            (cd app && npm run ios | android — Expo Go works, no native extras)
make test    # backend unit tests
make api-memory  # API with an in-memory store, no Docker
```

## Layout

```
app/                    Expo SDK 58 app (expo-router). src/app = routes, src/screens = screen bodies,
                        src/components/house-map = map (react-native-maps native, Leaflet + OSM on web),
                        src/utils/api.ts = the only place that calls the API, src/i18n.ts = en + lt
backend/src/app.ts      All routing + validation (framework-free, used by both entry points)
backend/src/handler.ts  Lambda entry (API Gateway HTTP API, payload v2)
backend/src/dev-server.ts  Local node:http entry
backend/src/store.ts    DynamoDB + in-memory stores; geo.ts = geohash + distance
infra/modules/{dynamodb,lambda,api-gateway,s3-web,cloudfront}, infra/environments/prod
.github/workflows/      pr-checks.yml, deploy.yml (reusable), deploy-prod.yml, eas-build.yml + eas-update.yml (manual)
```

## API (all JSON; errors are `{ "error": "<message>" }`)

| Route | Notes |
|---|---|
| `GET /health` | `{ ok: true }` |
| `GET /v1/houses?lat=&lng=[&radius=]` | Active houses within `radius` m (default 2000, clamped to what 3x3 geohash cells cover — ~2.8 km at Vilnius' latitude) |
| `POST /v1/houses` | `{ lat, lng, deviceLat, deviceLng, note? }` → 201 `{ house, token }`. Pin must be ≤ 150 m from the device (422 otherwise). Note ≤ 80 chars. |
| `DELETE /v1/houses/{id}` | Header `x-house-token`. 204, or 404 for both "missing" and "wrong token". |

Houses expire 6 h after creation (`expiresAt`, DynamoDB TTL + a query filter, since TTL is lazy).
`MAX_PIN_DISTANCE_M` exists in both `backend/src/app.ts` and `app/src/utils/geo.ts` — keep them equal.

## DynamoDB table `KnockKnock` (PK + SK, PAY_PER_REQUEST, TTL on `expiresAt`)

| Entity | PK | SK |
|---|---|---|
| House | `CELL#<geohash-5>` | `HOUSE#<cell>_<uuid>` |

House ids start with their cell, so DELETE finds the item without an index. Listing = 9 Queries
(cell + neighbours). The token is stored only as a SHA-256 hash.

## App rules

- The app is always dark (`userInterfaceStyle: dark`); colours only through `@/constants/theme`.
- Strings through `t` from `@/i18n` (`en` is the source, keep `lt` in step — Lithuanian plurals via `namai()`).
- The house token lives in AsyncStorage (`knock-knock/my-house`); it is the only proof of ownership.
- Buttons and the note field are `@expo/ui` universal components inside a `Host`.
- App icons, splash and favicon are drawn by `app/scripts/generate-icons.mjs`; edit that, not the PNGs. Native builds pick them up, OTA updates don't.
- Before pushing app changes: `cd app && npm run typecheck && npm run lint && npm run export:web`.

## Infra / deploy

- Lambda code is shipped by CI (`update-function-code` with the esbuild bundle); Terraform holds a
  placeholder zip with `ignore_changes`, so `terraform apply` never reverts the running code.
- `@aws-sdk/*` is external in the bundle — the `nodejs24.x` runtime provides it.
- CloudFront serves the web export and routes `/v1/*` + `/health` to API Gateway on the same origin.
- No auth at all, so the API Gateway stage throttle (50 rps / burst 100) is the abuse brake.
- One-time setup: `bash infra/bootstrap.sh` (state bucket, GitHub OIDC, deploy role), then GitHub
  environment `Prod` with secret `AWS_ROLE_ARN`. Optional: `EXPO_TOKEN` + variable `EAS_ENABLED=true`,
  variables `APP_CUSTOM_DOMAIN` + `APP_ACM_CERTIFICATE_ARN`.
