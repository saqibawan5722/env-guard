/**
 * Infers variable type and generates intelligent default placeholder values.
 */

function inferVariableType(key, sampleValue = '') {
  const k = key.toUpperCase();

  if (k.endsWith('_PORT') || k === 'PORT') {
    return { type: 'PORT', default: '3000', example: '3000', description: 'Network Port' };
  }

  if (k.includes('DATABASE_URL') || k.includes('DB_URI') || k.includes('MONGODB_URI')) {
    return { 
      type: 'DATABASE_URL', 
      default: 'postgresql://user:password@localhost:5432/myapp_dev', 
      example: 'postgresql://postgres:postgres@localhost:5432/my_db',
      description: 'Database Connection String' 
    };
  }

  if (k.includes('REDIS_URL') || k.includes('REDIS_URI')) {
    return { type: 'REDIS_URL', default: 'redis://localhost:6379', example: 'redis://localhost:6379', description: 'Redis Connection String' };
  }

  if (k.endsWith('_URL') || k.endsWith('_URI') || k.includes('ENDPOINT') || k.includes('HOST')) {
    return { type: 'URL', default: 'http://localhost:3000', example: 'https://api.example.com', description: 'Endpoint URL / Host' };
  }

  if (k.startsWith('ENABLE_') || k.startsWith('DISABLE_') || k.startsWith('IS_') || k.startsWith('HAS_') || k.includes('DEBUG') || k.includes('VERBOSE')) {
    return { type: 'BOOLEAN', default: 'true', example: 'true|false', description: 'Boolean Flag' };
  }

  if (k.includes('EMAIL') || k.includes('MAIL_TO') || k.includes('SMTP_USER')) {
    return { type: 'EMAIL', default: 'admin@example.com', example: 'dev@example.com', description: 'Email Address' };
  }

  if (k.includes('STRIPE_') || k.includes('PAYPAL_') || k.includes('PAYMENT_')) {
    return { type: 'PAYMENT_KEY', default: 'sk_test_your_stripe_key_here', example: 'sk_test_...', description: 'Payment Gateway Key' };
  }

  if (k.includes('JWT_') || k.includes('SECRET') || k.includes('AUTH_KEY') || k.includes('SESSION_KEY') || k.includes('ENCRYPTION_KEY')) {
    return { type: 'SECRET', default: 'your_super_secret_key_change_me', example: 'replace_with_random_32_chars', description: 'Secret Token / Key' };
  }

  if (k.includes('API_KEY') || k.includes('TOKEN') || k.includes('CLIENT_ID')) {
    return { type: 'API_KEY', default: 'your_api_key_here', example: 'your_api_key_here', description: 'API Key or Access Token' };
  }

  if (k.includes('TIMEOUT') || k.includes('TTL') || k.includes('LIMIT') || k.includes('MAX_') || k.includes('MIN_') || k.includes('COUNT')) {
    return { type: 'NUMBER', default: '100', example: '60000', description: 'Numeric Threshold' };
  }

  if (k === 'NODE_ENV') {
    return { type: 'ENUM', default: 'development', example: 'development|staging|production', description: 'Runtime Environment' };
  }

  // Fallback generic string
  return {
    type: 'STRING',
    default: 'change_me',
    example: 'value',
    description: 'Configuration Value'
  };
}

module.exports = {
  inferVariableType
};
