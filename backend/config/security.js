import 'dotenv/config';

const numberSetting = (env, name, fallback, min, max) => {
  const value = Number(env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid configuration: ${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
};

export const getSecurityConfig = (env = process.env) => {
  const production = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET;
  if (typeof secret !== 'string' || !secret.trim() || (production &&
      (Buffer.byteLength(secret) < 32 || new Set(secret).size < 8 || /^(change|your_|supersecret)/i.test(secret)))) {
    throw new Error('JWT_SECRET is required; production requires a strong random secret of at least 32 bytes.');
  }
  const originValue = env.CORS_ALLOWED_ORIGINS || env.CLIENT_URL ||
    (production ? '' : 'http://localhost:5173,http://127.0.0.1:5173');
  if (!originValue) throw new Error('Configure CORS_ALLOWED_ORIGINS or CLIENT_URL.');
  const origins = originValue.split(',').map((value) => value.trim()).filter(Boolean);
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('Allowed frontend origins must be valid HTTP(S) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin ||
        (production && url.protocol !== 'https:')) {
      throw new Error('Allowed frontend origins must be exact origins; production origins must use HTTPS.');
    }
  }
  if (production && !(env.MONGO_URI || env.MONGO_URL)) throw new Error('MONGO_URI or MONGO_URL is required.');
  if (env.SMTP_PORT) numberSetting(env, 'SMTP_PORT', 587, 1, 65535);
  if (env.SMTP_SECURE && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE must be true or false.');
  if (production && (!env.SMTP_HOST || !env.FROM_EMAIL)) throw new Error('SMTP_HOST and FROM_EMAIL are required in production.');
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASS)) throw new Error('Configure both SMTP_USER and SMTP_PASS, or neither for a local relay.');
  return {
    secret,
    jwtTtlSeconds: numberSetting(env, 'JWT_TTL_SECONDS', 86400, 900, 604800),
    issuer: env.JWT_ISSUER || 'eventra-api',
    audience: env.JWT_AUDIENCE || 'eventra-web',
    origins,
    trustProxyHops: numberSetting(env, 'TRUST_PROXY_HOPS', 0, 0, 3),
    otpTtlSeconds: numberSetting(env, 'AUTH_OTP_TTL_SECONDS', 600, 60, 1800),
    otpMaxAttempts: numberSetting(env, 'AUTH_OTP_MAX_ATTEMPTS', 5, 1, 10),
    otpCooldownSeconds: numberSetting(env, 'AUTH_OTP_COOLDOWN_SECONDS', 60, 30, 600),
    otpMaxSendsPerHour: numberSetting(env, 'AUTH_OTP_MAX_SENDS_PER_HOUR', 5, 1, 20),
    rateWindowSeconds: numberSetting(env, 'AUTH_RATE_WINDOW_SECONDS', 900, 60, 3600),
    loginMax: numberSetting(env, 'AUTH_RATE_LOGIN_MAX', 15, 3, 100),
    verifyMax: numberSetting(env, 'AUTH_RATE_VERIFY_MAX', 10, 3, 30),
    sendMax: numberSetting(env, 'AUTH_RATE_SEND_MAX', 3, 1, 10),
  };
};

export const createCorsOptions = (config = getSecurityConfig()) => ({
  origin(origin, callback) {
    if (!origin || config.origins.includes(origin)) return callback(null, true);
    const error = new Error('Origin not allowed.');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
  exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
});
