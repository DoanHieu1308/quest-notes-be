import express from 'express';
import cors from 'cors';
import { config } from '../src/config.js';
import { readState, writeState } from '../src/questState.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ success: true, data: { status: 'ok' } });
});

app.get('/api/quest/state', async (_request, response, next) => {
  try {
    const state = await readState();
    response.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

app.post('/api/quest/sync', async (request, response, next) => {
  try {
    const state = await writeState(request.body?.state ?? request.body);
    response.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : 'Internal server error',
  });
});

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Quest Notes API running at http://localhost:${config.port}/api`);
  });
}

export default app;
