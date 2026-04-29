'use strict';

const { redact } = require('../lib/logger');

describe('redact', () => {
  test('redact les clés sensibles', () => {
    const out = redact({
      user: 'alice',
      password: 'p@ss',
      apiKey: 'K',
      nested: { token: 'T', authorization: 'Bearer x', cookie: 'c' },
    });
    expect(out.user).toBe('alice');
    expect(out.password).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.nested.token).toBe('[REDACTED]');
    expect(out.nested.authorization).toBe('[REDACTED]');
    expect(out.nested.cookie).toBe('[REDACTED]');
  });
  test('valeurs primitives passent inchangées', () => {
    expect(redact(42)).toBe(42);
    expect(redact('hello')).toBe('hello');
    expect(redact(null)).toBe(null);
  });
  test('arrays sont récursifs', () => {
    expect(redact([{ token: 't' }])).toEqual([{ token: '[REDACTED]' }]);
  });
});

describe('logger file output redacts top-level secrets', () => {
  test('aucun secret top-level dans les logs fichier', async () => {
    const fs = require('fs');
    const path = require('path');
    const { logger } = require('../lib/logger');
    const marker = 'PROBE_' + Date.now();
    logger.info(marker, { token: 'SECRET_TOKEN_XYZ', apiKey: 'KEY_ABC' });
    await new Promise((r) => setTimeout(r, 200));
    const logsDir = path.join(__dirname, '..', 'logs');
    const candidates = fs.readdirSync(logsDir)
      .filter((name) => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(name))
      .map((name) => path.join(logsDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    expect(candidates.length).toBeGreaterThan(0);
    const content = fs.readFileSync(candidates[0], 'utf8');
    const line = content.split('\n').find((l) => l.includes(marker));
    expect(line).toBeDefined();
    expect(line).not.toContain('SECRET_TOKEN_XYZ');
    expect(line).not.toContain('KEY_ABC');
    expect(line).toContain('[REDACTED]');
  });
});
