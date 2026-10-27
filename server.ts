import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const familyVaultHandler = require('./api/family-vault.js');
const bichitoGuidanceHandler = require('./api/bichito-guidance.js');
const analyzeClothingHandler = require('./api/analyze-clothing.js');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API endpoints
  app.all('/api/family-vault', (req, res) => {
    return familyVaultHandler(req, res);
  });

  app.all('/api/bichito-guidance', (req, res) => {
    return bichitoGuidanceHandler(req, res);
  });

  app.all('/api/analyze-clothing', (req, res) => {
    return analyzeClothingHandler(req, res);
  });

  // Serve static files from public
  app.use(express.static(path.resolve('.', 'public')));

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('.', 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('.', 'dist', 'index.html'));
    });
  } else {
    // Development mode with Vite middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
