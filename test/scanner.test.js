const path = require('path');
const { scanDirectory, scanFile } = require('../src/core/scanner');

describe('Code AST Scanner', () => {
  const demoDir = path.join(__dirname, '../demo-fixtures');

  test('should detect JavaScript process.env and destructuring', () => {
    const serverFile = path.join(demoDir, 'src/server.js');
    const occs = scanFile(serverFile, demoDir);

    const keys = occs.map(o => o.key);
    assert.ok(keys.includes('PORT'), 'Should detect PORT');
    assert.ok(keys.includes('DATABASE_URL'), 'Should detect DATABASE_URL');
    assert.ok(keys.includes('STRIPE_WEBHOOK_SECRET'), 'Should detect destructured STRIPE_WEBHOOK_SECRET');
    assert.ok(keys.includes('FRONTEND_URL'), 'Should detect destructured FRONTEND_URL');
  });

  test('should detect TypeScript bracket indexing and props', () => {
    const authFile = path.join(demoDir, 'src/auth.ts');
    const occs = scanFile(authFile, demoDir);

    const keys = occs.map(o => o.key);
    assert.ok(keys.includes('AUTH_PROVIDER'), 'Should detect AUTH_PROVIDER');
    assert.ok(keys.includes('SESSION_COOKIE_SECRET'), 'Should detect SESSION_COOKIE_SECRET');
  });

  test('should detect Python os.environ and os.getenv', () => {
    const pyFile = path.join(demoDir, 'scripts/worker.py');
    const occs = scanFile(pyFile, demoDir);

    const keys = occs.map(o => o.key);
    assert.ok(keys.includes('QUEUE_NAME'), 'Should detect QUEUE_NAME');
    assert.ok(keys.includes('WORKER_CONCURRENCY'), 'Should detect WORKER_CONCURRENCY');
    assert.ok(keys.includes('EXTERNAL_PAYMENT_API_KEY'), 'Should detect EXTERNAL_PAYMENT_API_KEY');
  });

  test('should scan entire demo directory recursively', () => {
    const scan = scanDirectory(demoDir);
    assert.ok(scan.totalFilesScanned > 0);
    assert.ok(scan.uniqueKeys.includes('PORT'));
    assert.ok(scan.uniqueKeys.includes('JWT_SECRET'));
  });
});
