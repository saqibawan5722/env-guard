const http = require('http');
const { createApp } = require('../src/server/app');

function makeRequest(app, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          server.close();
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe('Express Server API Endpoints', () => {
  const app = createApp();

  test('GET /api/audit should return full audit result', async () => {
    const res = await makeRequest(app, '/api/audit?dir=demo-fixtures');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.summary.codeKeysCount > 0);
  });

  test('GET /api/environments should list all env files', async () => {
    const res = await makeRequest(app, '/api/environments?dir=demo-fixtures');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  test('GET /api/export?format=markdown should return markdown report', async () => {
    const res = await makeRequest(app, '/api/export?dir=demo-fixtures&format=markdown');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('# 🛡️ Env-Guard Audit Report'));
  });
});
