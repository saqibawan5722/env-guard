const { parseEnv, serializeEnv } = require('../src/core/env-parser');

describe('Env Parser & Serializer', () => {
  test('should parse basic KEY=VALUE and comments', () => {
    const raw = `
# Server Configuration
PORT=3000
HOST="127.0.0.1" # local address
EMPTY_VAL=
`;
    const parsed = parseEnv(raw);
    assert.strictEqual(parsed.values.PORT, '3000');
    assert.strictEqual(parsed.values.HOST, '127.0.0.1');
    assert.strictEqual(parsed.values.EMPTY_VAL, '');
  });

  test('should handle export keyword and quoted strings with spaces', () => {
    const raw = `export APP_TITLE="My Cool App"
export DEBUG='false'
`;
    const parsed = parseEnv(raw);
    assert.strictEqual(parsed.values.APP_TITLE, 'My Cool App');
    assert.strictEqual(parsed.values.DEBUG, 'false');
  });

  test('should serialize key-value object to clean .env string', () => {
    const data = {
      PORT: '8080',
      DB_NAME: 'test db with space'
    };
    const out = serializeEnv(data);
    assert.ok(out.includes('PORT=8080'));
    assert.ok(out.includes('DB_NAME="test db with space"'));
  });
});
