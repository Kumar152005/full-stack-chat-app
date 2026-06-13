# Kouventa Chat App

A full-stack chat app built with React, Express, MongoDB, Socket.IO, and Cloudinary.

## Local setup

Requirements:

- Node.js 20.19 or newer
- MongoDB running locally, or a MongoDB Atlas connection string
- A Cloudinary account if you want image messages and profile photo uploads

Install dependencies:

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

At minimum, set `MONGODB_URI` and `JWT_SECRET` in `backend/.env`. Add the
Cloudinary values to enable image uploads.

Start the frontend and backend together:

```bash
npm run dev
```

Open `http://localhost:5173`. The API and Socket.IO server run on port `5001`.

## Production

Set `NODE_ENV=production`, provide the required backend environment variables,
then run:

```bash
npm run build
npm start
```

The Express server serves the built React app and API from the same origin.
