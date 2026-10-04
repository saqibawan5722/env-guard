const { checkSecret, calculateEntropy, isPlaceholder } = require('../src/core/secret-checker');

describe('Secrets & Security Analyzer', () => {
  test('should detect AWS Access Key pattern', () => {
    const res = checkSecret('AWS_KEY', 'AKIAIOSFODNN7EXAMPLE');
    assert.ok(res, 'Should flag AWS key');
    assert.strictEqual(res.severity, 'CRITICAL');
  });

  test('should detect Stripe Live Secret Key pattern', () => {
    const res = checkSecret('STRIPE_KEY', 'sk_live_1234567890abcdef12345678');
    assert.ok(res, 'Should flag Stripe key');
    assert.strictEqual(res.severity, 'CRITICAL');
  });

  test('should ignore obvious placeholders', () => {
    assert.ok(isPlaceholder('your_secret_key_here'));
    assert.ok(isPlaceholder('<change-me>'));
    const res = checkSecret('JWT_SECRET', 'your_jwt_secret_placeholder');
    assert.strictEqual(res, null, 'Should not flag placeholder values');
  });

  test('should calculate high entropy for random secret strings', () => {
    const entropy = calculateEntropy('c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2');
    assert.ok(entropy > 3.5, 'Entropy should be high for cryptographic hash');
  });
});
