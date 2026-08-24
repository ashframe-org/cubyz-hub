# Cubyz Addon Marketplace

A self-hosted web application for browsing, publishing, and downloading Cubyz
add-ons.

## Run locally

```sh
npm ci
cp .env.example .env
npm start
```

Set a strong, unique `SESSION_SECRET` in `.env` before using the application.

## Docker

```sh
cp .env.example .env
# Set SESSION_SECRET in .env
docker compose up --build -d
```

Runtime databases, uploads, avatars, and banners are deliberately excluded
from Git. Back them up separately.

## Licence and branding

The source code is available under the [MIT License](LICENSE). The Ashframe
name and brand assets are excluded from that licence; see [BRAND.md](BRAND.md).
