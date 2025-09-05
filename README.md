# Trekk Tribe

A travel platform that connects travelers for group trips and adventures.

## Features

- **User Authentication**: Register as a traveler or organizer
- **Trip Creation**: Organizers can create and manage trips
- **Trip Discovery**: Browse and search for trips by category, destination, price
- **Trip Joining**: Travelers can join trips with available spots
- **User Profiles**: Manage your account and view your trips

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB
- **Authentication**: JWT
- **Containerization**: Docker

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)

### Running with Docker (Recommended)

1. Clone the repository
2. Run the application:
   ```bash
   npm run dev
   ```

3. Access the application:
   - **Web App**: http://localhost:3000
   - **API**: http://localhost:4000
   - **MongoDB**: localhost:27017

### Local Development

1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Start MongoDB (via Docker):
   ```bash
   docker run -d -p 27017:27017 --name trekk-mongo mongo:6
   ```

3. Start the API:
   ```bash
   npm run dev:api
   ```

4. Start the web app (in another terminal):
   ```bash
   npm run dev:web
   ```

## Available Scripts

- `npm run dev` - Start all services with Docker
- `npm run build` - Build all Docker images
- `npm run stop` - Stop all services
- `npm run clean` - Stop services and remove volumes
- `npm run dev:api` - Start API in development mode
- `npm run dev:web` - Start web app in development mode

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user info

### Trips
- `GET /trips` - Get all trips (with search/filter)
- `POST /trips` - Create a new trip (organizers only)
- `GET /trips/:id` - Get trip by ID
- `POST /trips/:id/join` - Join a trip
- `DELETE /trips/:id/leave` - Leave a trip

## Project Structure

```
├── services/
│   └── api/          # Node.js API
├── web/              # React frontend
├── docker-compose.yml
└── package.json      # Root package.json
```
