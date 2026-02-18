# Dominion Game Tracker

A full-stack web application to track Dominion card game sessions, player statistics, and leaderboards.

## Features

- **Live Scoreboard**: Track scores in real-time during games
- **Player Leaderboard**: View player rankings based on league points
- **Game History**: Browse past games with score progression charts
- **Build Management**: Create and manage card builds with statistics

## Technical Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL

## Setup Instructions

### Option A — Docker (recommended, works locally and on any VPS)

The easiest way to run the full stack. Requires [Docker](https://docs.docker.com/get-docker/) with Compose.

1. Clone the repo and enter the directory:
```bash
git clone https://github.com/usr-wwelsh/dominion-tracker.git
cd dominion-tracker
```

2. Set your database password (or skip to use the default `changeme`):
```bash
cp .env.example .env
# edit .env and set DB_PASSWORD
```

3. Build and start all services:
```bash
docker compose up -d
```

4. Open `http://localhost` in your browser.

To stop: `docker compose down`
To wipe the database and start fresh: `docker compose down -v`

---

### Option B — Manual (local development)

#### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)

#### Database Setup

1. Create a PostgreSQL database:
```bash
createdb dominion_tracker
```

2. Initialize the schema:
```bash
psql -U postgres -d dominion_tracker -f backend/schema.sql
```

#### Backend Setup

1. Install dependencies:
```bash
cd backend && npm install
```

2. Create `backend/.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dominion_tracker
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
```

3. Start the server:
```bash
npm start
```

The API will be available at `http://localhost:3000`.

#### Frontend Setup

Serve the `frontend/` directory with any static file server:
```bash
python3 -m http.server 8000 --directory frontend
```

Navigate to `http://localhost:8000`.

---

### Deploying to a VPS (Hostinger, etc.)

1. Install Docker on the server
2. Copy the project folder to the server (e.g. via `scp` or `git clone`)
3. Set `DB_PASSWORD` and optionally `APP_PORT` in `.env`
4. Run `docker compose up -d`
5. The app is live on port 80 (or whichever `APP_PORT` you set)

## Usage

1. **Create Players**: Players are created automatically when added to a game
2. **Create a Build**: Go to the Builds page and select cards for your game
3. **Start a Game**: Use the Scoreboard page to set up a game with players
4. **Track Scores**: Update scores during the game using +/- buttons
5. **End Game**: Finish the game to record final scores and calculate league points
6. **View Stats**: Check the Leaderboard and Games pages for statistics

## League Points System

- 1st place: 5 points
- 2nd place: 3 points
- 3rd place: 1 point
- 4th+ place: 0 points

Ties: Points are averaged (e.g., two players tied for 1st each get 4 points)

## API Endpoints

### Players
- `GET /api/players` - List all players
- `POST /api/players` - Create a new player
- `GET /api/players/:id/stats` - Get player statistics

### Builds
- `GET /api/builds` - List all builds
- `POST /api/builds` - Create a new build
- `GET /api/builds/:id` - Get build details

### Games
- `GET /api/games` - List all games
- `POST /api/games` - Create a new game
- `PUT /api/games/:id/start` - Start a game
- `PUT /api/games/:id/end` - End a game
- `POST /api/games/:id/scores` - Update player score
- `GET /api/games/:id/scores` - Get score history

### Statistics
- `GET /api/leaderboard` - Get player leaderboard

## License

[MIT](LICENSE) © usr-wwelsh
