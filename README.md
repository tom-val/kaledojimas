# 🎃 Knock Knock / Tuk tuk

Mark your house as open for trick-or-treaters, see every participating house on a map, and take
yourself off the map when the candy runs out. No sign-up — it's GPS based.

- **Mark my house**: uses your phone's location; the pin can be nudged up to 150 m to sit on your door.
- **Map**: all active houses within ~2 km, refreshed every 30 s, with an optional note ("Full-size bars!").
- **Out of candy**: removes your house. Houses also disappear by themselves after 6 hours.

Lithuanian by default, with a button on the map to switch to English.

## Stack

| Part | Tech |
|---|---|
| App | Expo SDK 58 (iOS, Android, Web), expo-router, react-native-maps / Leaflet + OpenStreetMap on web |
| API | Node 24 on AWS Lambda behind API Gateway (HTTP API) |
| Data | DynamoDB, geohash-partitioned, TTL-expired |
| Hosting | S3 + CloudFront (web and API on one origin) |
| Infra / CI | Terraform, GitHub Actions (OIDC to AWS), EAS for native builds |

## Run locally

```bash
make infra && make seed   # DynamoDB Local
make api                  # API on :3001
make web                  # app in the browser
```

On a phone, run `cd app && npm start` and open it in Expo Go — it finds the API on your computer
automatically. See [CLAUDE.md](CLAUDE.md) for the API, data model and deploy details.

## Deploy

1. `bash infra/bootstrap.sh` once with admin AWS credentials.
2. In GitHub, create environment `Prod` with secret `AWS_ROLE_ARN` (printed by the script).
3. Push to `main` — `deploy-prod.yml` applies Terraform, ships the Lambda and publishes the web app.
