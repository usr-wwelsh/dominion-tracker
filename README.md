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

Points scale with the number of players using the formula:

`LP = 100 × (n − p) / (n − 1)`

Where `n` = total players and `p` = placement. First place always gets 100, last place always gets 0, and everyone else is evenly distributed in between.

Example (4 players): 1st = 100, 2nd = 66.67, 3rd = 33.33, 4th = 0

Ties: tied players receive the average of the points slots they occupy.

## API Endpoints

### Players
- `GET /api/players` - List all players
- `POST /api/players` - Create a player
- `GET /api/players/:id` - Get player details
- `DELETE /api/players/:id` - Delete a player
- `GET /api/players/:id/stats` - Get player statistics
- `GET /api/players/:id/h2h` - Get head-to-head stats
- `PATCH /api/players/:id/color` - Update player color

### Builds
- `GET /api/builds` - List all builds
- `POST /api/builds` - Create a build
- `GET /api/builds/:id` - Get build details
- `PUT /api/builds/:id` - Update a build
- `DELETE /api/builds/:id` - Delete a build
- `GET /api/builds/:id/comments` - List comments on a build
- `POST /api/builds/:id/comments` - Add a comment to a build
- `DELETE /api/builds/:buildId/comments/:commentId` - Delete a comment

### Games
- `GET /api/games` - List all games
- `POST /api/games` - Create a game
- `GET /api/games/:id` - Get game details
- `PUT /api/games/:id/start` - Start a game
- `PUT /api/games/:id/end` - End a game
- `DELETE /api/games/:id/cancel` - Cancel an in-progress game
- `DELETE /api/games/:id` - Delete a game
- `POST /api/games/:id/scores` - Update a player score
- `GET /api/games/:id/scores` - Get score history

### Statistics
- `GET /api/leaderboard` - Get player leaderboard
- `GET /api/stats/extras` - Get extra stats

### Other
- `GET /api/auth/check` - Check auth status
- `GET /health` - Health check

## License

[MIT](LICENSE) © usr-wwelsh
