# Deployment Guide

## Local Production Run

1. Install dependencies in the project root and `server/`.
2. Build the client and server:

```sh
npm run build
```

3. Start the unified server:

```sh
npm run start
```

4. Read the LAN URLs printed by the server console.
5. Open `http://<server-ip>:3001` from other devices on the same network.

Example:

```text
LAN URLs:
  http://192.168.1.23:3001
  http://10.0.0.42:3001
```

Players should use one of those LAN URLs, not `localhost`.

The Express server serves:

- `GET /api/*` for multiplayer/session/instructor endpoints
- the built React client from `dist/`

## Docker Deployment

Build and run on one VPS:

```sh
docker build -t beer-game .
docker run -d --name beer-game -p 3001:3001 -e PORT=3001 -e ADMIN_TOKEN=change-me beer-game
```

## Recommended VPS Setup

1. Provision one Linux VPS with a public IP.
2. Install Docker.
3. Deploy the container above.
4. Put Nginx or Caddy in front for HTTPS.
5. Point a domain/subdomain to the VPS.
6. Keep port `3001` private if using a reverse proxy.

## Runbook

- Start: `docker run ...` or `npm run start`
- LAN start on your own PC: `npm run start`
- Restart: `docker restart beer-game`
- Logs: `docker logs -f beer-game`
- Health check: `GET /api/health`
- Data persistence: `server/data/store.json`
- LAN smoke test: `npm run smoke:lan`

## Notes

- Rooms are server authoritative and persist to disk on the server.
- Instructor-created rooms can be managed from `/instructor`.
- Player reconnects reuse the existing browser session token.

## Same-Network Classroom Hosting

1. Connect all devices to the same Wi-Fi or Ethernet network.
2. On the host PC, run:

```sh
npm run build
npm run start
```

3. In Windows Firewall, allow Node.js or allow inbound TCP on port `3001`.
4. Share the printed LAN URL with players.
5. The instructor should open `/instructor` on that same LAN URL.

Checklist before class:

- Host PC sleep mode disabled
- Same network for all devices
- Firewall exception for port `3001`
- One player joins from a phone
- One player joins from a laptop
- Instructor can create rooms and copy room IDs
