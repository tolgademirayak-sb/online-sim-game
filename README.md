# Online Sim Game

This project is a multiplayer beer game simulation with:

- a React + Vite frontend
- an Express backend
- room/session management for players
- an instructor dashboard

## Requirements

Install these first on a new computer:

- Node.js 18+ recommended
- npm

To verify installation:

```sh
node -v
npm -v
```

## Quick Start

After cloning the repo, only these two commands are needed:

```sh
npm install
npm run app
```

What they do:

- `npm install` installs the main app dependencies and automatically installs the backend dependencies inside `server/`
- `npm run app` builds the frontend and backend, then starts the app on port `3001`

## Full Setup From Scratch

```sh
git clone https://github.com/tolgademirayak-sb/online-sim-game.git
cd online-sim-game
npm install
npm run app
```

## How To Open The App

Once the server starts, open:

```text
http://localhost:3001
```

If other people on the same network will join, the terminal also prints LAN addresses such as:

```text
http://192.168.x.x:3001
```

They should open the LAN address, not `localhost`.

## Instructor Use

The instructor dashboard is available at:

```text
http://localhost:3001/instructor
```

Or on the same LAN URL:

```text
http://<host-ip>:3001/instructor
```

## Useful Commands

- `npm run app`: build everything and start the app
- `npm run build`: build frontend and backend
- `npm run start`: start the built backend server
- `npm run dev`: run the frontend in Vite dev mode
- `npm run dev:server`: run the backend in watch mode

## Classroom / LAN Notes

If this will be hosted from one laptop for a class:

- all devices must be on the same Wi-Fi or local network
- the host machine should stay awake during the session
- Windows Firewall may need to allow Node.js or TCP port `3001`
- students should use the LAN URL shown in the terminal

## Tech Stack

- React
- TypeScript
- Vite
- Express
- Tailwind CSS
- shadcn-ui
