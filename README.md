# Quest Notes API

Node.js + Express API shared by the Flutter app and the static web client.

## Local run

```bash
npm install
npm run dev
```

The server reads MongoDB credentials from these locations, in order:

1. `quest_notes_api/.env`
2. `../atlas-credentials.env`
3. `../connect_database.txt` plus `../username_password_database.txt`

Local API URL:

```text
http://localhost:3000/api
```

## Endpoints

- `GET /api/health`
- `GET /api/quest/state`
- `POST /api/quest/sync`

## Vercel deploy

Create a Vercel project from this folder and set Environment Variables:

```text
MONGODB_URI=<your MongoDB Atlas connection string>
MONGODB_DB=quest_notes
QUEST_USER_ID=default
```

After deploy, use the Vercel API URL as:

```text
https://your-project.vercel.app/api
```
