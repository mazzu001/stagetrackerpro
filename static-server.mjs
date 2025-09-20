#!/usr/bin/env node

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

// Serve static files from dist/public
app.use(express.static(path.join(__dirname, 'dist/public')));

// SPA fallback - serve index.html for all non-file requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Static server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'dist/public')}`);
});