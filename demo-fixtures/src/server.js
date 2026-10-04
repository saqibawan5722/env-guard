const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const DB_URL = process.env.DATABASE_URL;
const REDIS = process.env.REDIS_URL;
const JWT = process.env.JWT_SECRET;
const STRIPE = process.env.STRIPE_SECRET_KEY;

// Destructuring test
const { STRIPE_WEBHOOK_SECRET, FRONTEND_URL } = process.env;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    db: DB_URL ? 'configured' : 'missing',
    redis: REDIS ? 'configured' : 'missing'
  });
});

module.exports = app;
