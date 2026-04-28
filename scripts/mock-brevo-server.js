'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

const port = process.env.MOCK_BREVO_PORT || 4001;

app.get('/v3/account', (req, res) => {
  // Simulate a valid account response
  res.json({ message: 'ok', account: { name: 'mock-brevo', status: 'active' } });
});

app.post('/v3/transactionalSMS/sms', (req, res) => {
  console.log('[mock-brevo] SMS payload:', JSON.stringify(req.body).slice(0, 500));
  res.json({ messageId: 'mock-sms-' + Date.now(), status: 'queued' });
});

app.post('/v3/smtp/email', (req, res) => {
  console.log('[mock-brevo] Email payload:', JSON.stringify(req.body).slice(0, 1000));
  res.json({ messageId: 'mock-email-' + Date.now(), status: 'queued' });
});

app.get('/v3/smtp/statistics/events', (req, res) => {
  const email = req.query.email || 'unknown@example.com';
  res.json({ events: [{ event: 'delivered', email, ts: Date.now() }] });
});

app.listen(port, () => {
  console.log(`[mock-brevo] Mock Brevo server listening on http://localhost:${port}`);
});
