const path = require('path');
const { auditProject } = require('../src/core/drift-detector');

describe('Drift Detector & Auditor', () => {
  const demoDir = path.join(__dirname, '../demo-fixtures');

  test('should detect missing variables in .env', () => {
    const audit = auditProject(demoDir);
    assert.ok(audit.summary.missingInEnvCount > 0, 'Should find missing vars in .env');

    const missingKeys = audit.missingInEnv.map(m => m.key);
    // STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL, etc.
    assert.ok(missingKeys.includes('STRIPE_SECRET_KEY'));
    assert.ok(missingKeys.includes('AUTH_PROVIDER'));
  });

  test('should detect dead variables in .env', () => {
    const audit = auditProject(demoDir);
    const deadKeys = audit.deadInEnv.map(d => d.key);
    assert.ok(deadKeys.includes('LEGACY_ANALYTICS_KEY'), 'Should detect unused LEGACY_ANALYTICS_KEY');
  });

  test('should build comprehensive environment comparison matrix', () => {
    const audit = auditProject(demoDir);
    assert.ok(audit.matrix.length > 0);
    const portRow = audit.matrix.find(r => r.key === 'PORT');
    assert.ok(portRow, 'Matrix should contain PORT');
    assert.ok(portRow.inCode);
    assert.ok(portRow.envPresence['.env.production'].present);
  });
});
