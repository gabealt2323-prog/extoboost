const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
  JWT_SECRET: process.env.JWT_SECRET || 'extoboost-default-jwt-secret-2024',
  SESSION_SECRET: process.env.SESSION_SECRET || 'extoboost-default-session-secret-2024',
  LINKVERTISE_PUBLISHER_ID: process.env.LINKVERTISE_PUBLISHER_ID || '',
  LOOTLABS_API_KEY: process.env.LOOTLABS_API_KEY || '',
  WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:3000',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@extoboost.com',
};

const pool = new Pool({ connectionString: ENV.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const mailer = nodemailer.createTransport({
  host: ENV.SMTP_HOST, port: ENV.SMTP_PORT, secure: ENV.SMTP_PORT === 465,
  auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASS } : undefined,
  tls: { rejectUnauthorized: false },
});

if (ENV.SMTP_USER) {
  mailer.verify().then(() => console.log('SMTP connection OK')).catch(err => console.error('SMTP connection FAILED:', err.message));
}

function adaptSql(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`).replace(/datetime\('now'\)/g, 'NOW()').replace(/(\w+) > NOW\(\)/g, 'CAST($1 AS TIMESTAMP) > NOW()');
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(adaptSql(sql), params);
    if (sql.trim().toUpperCase().startsWith('SELECT')) return result.rows;
    return { changes: result.rowCount };
  } finally { client.release(); }
}

async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function getAll(sql, params = []) {
  return query(sql, params);
}

async function run(sql, params = []) {
  await query(sql, params);
}

function generateOneTimeCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(16);
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateToken(userId) {
  return jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: '7d' });
}

async function runMigrations() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, google_id TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL, api_key TEXT UNIQUE NOT NULL, unlocked_until TEXT,
    verified BOOLEAN NOT NULL DEFAULT FALSE, created_at TEXT NOT NULL DEFAULT NOW()
  )`);
  try { await query("ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE"); } catch {}
  try { await query("ALTER TABLE users ADD COLUMN profile_icon TEXT NOT NULL DEFAULT 'default'"); } catch {}
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL, expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS one_time_codes (
    id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','expired')),
    expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT NOW()
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
  await query('CREATE INDEX IF NOT EXISTS idx_one_time_codes_code ON one_time_codes(code)');
  await query('CREATE INDEX IF NOT EXISTS idx_one_time_codes_user_id ON one_time_codes(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_one_time_codes_status ON one_time_codes(status)');
  await query(`CREATE TABLE IF NOT EXISTS email_verification_codes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, expires_at TIMESTAMP NOT NULL, used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON email_verification_codes(user_id)');
  await query(`CREATE TABLE IF NOT EXISTS gateway_tokens (
    id TEXT PRIMARY KEY, player_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('linkvertise','lootlabs')),
    admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','expired')),
    code TEXT, created_at TEXT NOT NULL DEFAULT NOW(), completed_at TEXT, ad_url TEXT
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_gateway_tokens_status ON gateway_tokens(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_gateway_tokens_admin ON gateway_tokens(admin_user_id)');
  console.log('Database migrations applied');
}

const app = express();

passport.use(new GoogleStrategy({
  clientID: ENV.GOOGLE_CLIENT_ID,
  clientSecret: ENV.GOOGLE_CLIENT_SECRET,
  callbackURL: ENV.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value || '';
    const name = profile.displayName || '';
    const existing = await getOne('SELECT * FROM users WHERE google_id = $1', [googleId]);

    if (!existing) {
      const id = crypto.randomUUID();
      const apiKey = crypto.randomUUID();
      await run('INSERT INTO users (id, google_id, email, name, api_key, created_at) VALUES ($1, $2, $3, $4, $5, NOW())', [id, googleId, email, name, apiKey]);
      const user = { id, google_id: googleId, email, name, api_key: apiKey, unlocked_until: null };
      return done(null, { user, isNew: true });
    }
    return done(null, { user: existing, isNew: false });
  } catch (err) {
    return done(err, null);
  }
}));

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: [ENV.WEB_APP_URL, '*'], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: ENV.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { secure: false, httpOnly: true, maxAge: 86400000 } }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((data, done) => done(null, JSON.stringify({ id: data.user.id, isNew: data.isNew })));
passport.deserializeUser(async (raw, done) => {
  try {
    const { id } = JSON.parse(raw);
    done(null, (await getOne('SELECT * FROM users WHERE id = $1', [id])) || null);
  } catch (err) { done(err, null); }
});

async function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), ENV.JWT_SECRET);
    const user = await getOne('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

app.get('/api/v1/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
app.get('/api/v1/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${ENV.WEB_APP_URL}/login?error=failed` }), (req, res) => {
  const data = req.user;
  if (!data?.user) return res.redirect(`${ENV.WEB_APP_URL}/login?error=no_user`);
  const token = generateToken(data.user.id);
  res.redirect(data.isNew
    ? `${ENV.WEB_APP_URL}/dashboard?token=${token}&showApiKey=true&userName=${encodeURIComponent(data.user.name)}&apiKey=${data.user.api_key}`
    : `${ENV.WEB_APP_URL}/dashboard?token=${token}`);
});

app.get('/api/v1/auth/me', requireAuth, async (req, res) => {
  res.json(await getOne('SELECT id, google_id, email, name, api_key, unlocked_until, verified, profile_icon, created_at FROM users WHERE id = $1', [req.user.id]));
});

app.post('/api/v1/ads/generate', requireAuth, async (req, res) => {
  try {
    const sessionId = crypto.randomUUID();
    const callbackId = crypto.randomBytes(8).toString('hex');
    const targetUrl = `${req.protocol}://${req.get('host')}/api/v1/ad-callback?cb=${callbackId}&uid=${req.user.id}`;

    const linkvertiseUrl = ENV.LINKVERTISE_PUBLISHER_ID
      ? `https://link-to.net/${ENV.LINKVERTISE_PUBLISHER_ID}/${(Math.random() * 1000).toFixed(10)}/dynamic?r=${Buffer.from(targetUrl).toString('base64')}`
      : null;

    const lootlabsUrl = ENV.LOOTLABS_API_KEY
      ? `https://loot-link.com/s?api=${ENV.LOOTLABS_API_KEY}&url=${encodeURIComponent(targetUrl)}`
      : null;

    await run('INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
      [sessionId, req.user.id, callbackId, new Date(Date.now() + 3600000).toISOString()]);
    res.json({ sessionId, callbackId, links: { linkvertise: linkvertiseUrl, lootlabs: lootlabsUrl }, expiresAt: new Date(Date.now() + 3600000).toISOString() });
  } catch (err) {
    console.error('Ad generation error:', err);
    res.status(500).json({ error: 'Failed to generate ad links' });
  }
});

function generateLinkvertiseUrl(targetUrl) {
  return ENV.LINKVERTISE_PUBLISHER_ID
    ? `https://link-to.net/${ENV.LINKVERTISE_PUBLISHER_ID}/${(Math.random() * 1000).toFixed(10)}/dynamic?r=${Buffer.from(targetUrl).toString('base64')}`
    : null;
}

function createLootLabsUrl(targetUrl) {
  return new Promise((resolve) => {
    const apiUrl = new URL('https://creators.lootlabs.gg/api/public/content_locker');
    apiUrl.searchParams.set('api_token', ENV.LOOTLABS_API_KEY);
    apiUrl.searchParams.set('url', targetUrl);
    apiUrl.searchParams.set('title', 'Extoboost Verification');
    apiUrl.searchParams.set('tier_id', '1');
    apiUrl.searchParams.set('number_of_tasks', '1');
    apiUrl.searchParams.set('theme', '1');

    https.get(apiUrl.toString(), (resp) => {
      let data = '';
      resp.on('data', (chunk) => data += chunk);
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          const lootUrl = json?.message?.loot_url;
          resolve(lootUrl || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

app.post('/api/v1/generate-token', requireAuth, async (req, res) => {
  try {
    const { playerId, provider } = req.body;
    if (!playerId || !provider) return res.status(400).json({ error: 'playerId and provider are required' });
    if (!['linkvertise', 'lootlabs'].includes(provider)) return res.status(400).json({ error: 'provider must be linkvertise or lootlabs' });
    const count = await getOne('SELECT COUNT(*) as count FROM gateway_tokens WHERE admin_user_id = $1', [req.user.id]);
    if (count && count.count >= 10) return res.status(400).json({ error: 'Limit reached. You can only create up to 10 gateway links.' });
    const token = crypto.randomBytes(16).toString('hex');
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/v1/ad-callback?token=${token}`;

    let adUrl = null;
    if (provider === 'linkvertise') {
      adUrl = generateLinkvertiseUrl(callbackUrl);
    } else {
      adUrl = await createLootLabsUrl(callbackUrl);
    }

    await run('INSERT INTO gateway_tokens (id, player_id, provider, admin_user_id, status, ad_url) VALUES ($1, $2, $3, $4, $5, $6)',
      [token, playerId, provider, req.user.id, 'pending', adUrl || '']);
    const verifyApiUrl = `${req.protocol}://${req.get('host')}/api/v1/verify-api-key/${token}`;
    res.json({ token, gatewayUrl: `${ENV.WEB_APP_URL}/gateway/${token}`, verifyApiUrl });
  } catch (err) {
    console.error('Generate token error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.get('/api/v1/gateway-tokens', requireAuth, async (req, res) => {
  try {
    const tokens = await getAll('SELECT * FROM gateway_tokens WHERE admin_user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(tokens);
  } catch (err) {
    console.error('List tokens error:', err);
    res.status(500).json({ error: 'Failed to fetch tokens' });
  }
});

app.get('/api/v1/gateway-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const gt = await getOne('SELECT * FROM gateway_tokens WHERE id = $1', [token]);
    if (!gt) return res.status(404).json({ error: 'Token not found' });
    if (!gt.ad_url) return res.status(500).json({ error: 'Ad URL not configured for this token' });
    res.json({ provider: gt.provider, playerId: gt.player_id, adUrl: gt.ad_url, status: gt.status });
  } catch (err) {
    console.error('Gateway token lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/gateway-token/:token/status', async (req, res) => {
  try {
    const { token } = req.params;
    const gt = await getOne('SELECT * FROM gateway_tokens WHERE id = $1', [token]);
    if (!gt) return res.status(404).json({ error: 'Token not found' });
    if (gt.status !== 'completed') return res.json({ status: gt.status, code: null, playerId: gt.player_id });
    const admin = await getOne('SELECT id, name, api_key FROM users WHERE id = $1', [gt.admin_user_id]);
    res.json({ status: gt.status, code: gt.code, playerId: gt.player_id, adminName: admin?.name || 'User', apiKey: admin?.api_key || '' });
  } catch (err) {
    console.error('Gateway token status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/ad-callback', async (req, res) => {
  try {
    const { cb, uid, token } = req.query;
    if (token) {
      const gt = await getOne("SELECT * FROM gateway_tokens WHERE id = $1 AND status = 'pending'", [token]);
      if (!gt) return res.status(404).json({ error: 'Invalid or expired token' });
      const code = generateOneTimeCode();
      await run('UPDATE gateway_tokens SET status = $1, code = $2, completed_at = NOW() WHERE id = $3', ['completed', code, token]);
      await run('UPDATE users SET unlocked_until = $1 WHERE id = $2', [new Date(Date.now() + 86400000).toISOString(), gt.admin_user_id]);
      const admin = await getOne('SELECT id, name, api_key FROM users WHERE id = $1', [gt.admin_user_id]);
      return res.redirect(`${ENV.WEB_APP_URL}/gateway/${token}/success?name=${encodeURIComponent(admin?.name || 'User')}&key=${admin?.api_key || ''}&code=${code}`);
    }
    if (!cb || !uid) return res.status(400).json({ error: 'Missing parameters' });
    const session = await getOne("SELECT * FROM sessions WHERE token = $1 AND user_id = $2 AND expires_at > NOW()", [cb, uid]);
    if (!session) return res.status(404).json({ error: 'Invalid or expired session' });
    const code = generateOneTimeCode();
    await run("INSERT INTO one_time_codes (id, code, user_id, session_id, status, expires_at, created_at) VALUES ($1, $2, $3, $4, 'completed', $5, NOW())",
      [crypto.randomUUID(), code, uid, session.id, new Date(Date.now() + 86400000).toISOString()]);
    await run('UPDATE users SET unlocked_until = $1 WHERE id = $2', [new Date(Date.now() + 86400000).toISOString(), uid]);
    res.json({ success: true, code, message: 'Ad verification completed. Your code is ready.' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/validation/check', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    const codeResult = await getOne("SELECT * FROM one_time_codes WHERE code = $1 AND user_id = $2 AND status = 'completed' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [code.toUpperCase(), req.user.id]);
    if (!codeResult) return res.status(404).json({ error: 'Invalid, expired, or already used code' });
    res.json({ valid: true, unlockedUntil: req.user.unlocked_until, message: 'Key is valid. Account unlocked for 24 hours.' });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/validation/status', requireAuth, async (req, res) => {
  const isUnlocked = req.user.unlocked_until && new Date(req.user.unlocked_until) > new Date();
  if (isUnlocked) {
    const validCode = await getOne("SELECT code FROM one_time_codes WHERE user_id = $1 AND status = 'completed' AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    res.json({ unlocked: true, unlockedUntil: req.user.unlocked_until, code: validCode?.code || null });
  } else {
    res.json({ unlocked: false, unlockedUntil: null, code: null });
  }
});

app.get('/api/v1/verify-key', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const { player_id, key } = req.query;
  if (!player_id || !key) return res.json({ success: false, error: 'Missing player_id or key parameter' });
  try {
    const codeResult = await getOne("SELECT * FROM one_time_codes WHERE code = $1 AND status = 'completed' AND expires_at > NOW()", [key.toUpperCase()]);
    if (codeResult) {
      await run("UPDATE one_time_codes SET status = 'expired' WHERE id = $1", [codeResult.id]);
      res.json({ success: true, message: 'Key is valid — consumed', playerId: player_id });
    } else {
      res.json({ success: false, error: 'Incorrect or Expired Key!' });
    }
  } catch { res.json({ success: false, error: 'Server error' }); }
});

app.get('/api/v1/verify-api-key/:token', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { token } = req.params;
  const { key } = req.query;
  if (!key) return res.json({ success: false, error: 'Missing key parameter' });
  try {
    const gt = await getOne("SELECT gt.*, u.unlocked_until FROM gateway_tokens gt JOIN users u ON u.id = gt.admin_user_id WHERE gt.id = $1 AND gt.code = $2 AND gt.status = 'completed' AND u.unlocked_until > NOW()", [token, key.toUpperCase()]);
    if (gt) {
      return res.json({ success: true, valid: true, message: 'Key is valid', expiresAt: gt.unlocked_until });
    }
    res.json({ success: false, valid: false, error: 'Invalid key' });
  } catch { res.json({ success: false, error: 'Server error' }); }
});

app.options('/api/v1/verify-api-key/:token', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.options('/api/v1/verify-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/api/v1/send-verification', requireAuth, async (req, res) => {
  try {
    if (req.user.verified) return res.json({ sent: false, error: 'Already verified' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    await run('INSERT INTO email_verification_codes (id, user_id, code, expires_at) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), req.user.id, code, expiresAt]);
    if (ENV.SMTP_USER) {
      console.log('Attempting to send email to', req.user.email, 'via', ENV.SMTP_HOST);
      mailer.sendMail({
        from: ENV.SMTP_USER, to: req.user.email,
        subject: 'Extoboost - Email Verification Code',
        text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
      }).then(() => console.log('Email sent successfully to', req.user.email))
        .catch(err => console.error('Mail send error - full:', err.message || err));
      res.json({ sent: true, debug: 'smtp_attempted' });
    } else {
      console.warn('SMTP_USER not configured — email not sent to', req.user.email);
      res.json({ sent: false, error: 'SMTP not configured on server' });
    }
  } catch (err) { console.error('Send verification error:', err); res.status(500).json({ sent: false, error: 'Failed to send verification email' }); }
});

app.post('/api/v1/verify-email', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    const row = await getOne("SELECT * FROM email_verification_codes WHERE user_id = $1 AND code = $2 AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1", [req.user.id, code]);
    if (!row) return res.status(400).json({ error: 'Invalid or expired code' });
    await run("UPDATE email_verification_codes SET used = TRUE WHERE id = $1", [row.id]);
    await run('UPDATE users SET verified = TRUE WHERE id = $1', [req.user.id]);
    res.json({ verified: true });
  } catch { res.status(500).json({ error: 'Verification failed' }); }
});

app.put('/api/v1/auth/me', requireAuth, async (req, res) => {
  try {
    const { name, profile_icon } = req.body;
    if (name) await run('UPDATE users SET name = $1 WHERE id = $2', [name, req.user.id]);
    if (profile_icon) await run('UPDATE users SET profile_icon = $1 WHERE id = $2', [profile_icon, req.user.id]);
    res.json(await getOne('SELECT id, google_id, email, name, api_key, unlocked_until, verified, profile_icon, created_at FROM users WHERE id = $1', [req.user.id]));
  } catch { res.status(500).json({ error: 'Failed to update profile' }); }
});

app.post('/api/v1/auth/regenerate-api-key', requireAuth, async (req, res) => {
  try {
    const newKey = crypto.randomUUID();
    await run('UPDATE users SET api_key = $1 WHERE id = $2', [newKey, req.user.id]);
    const user = await getOne('SELECT id, google_id, email, name, api_key, unlocked_until, verified, profile_icon, created_at FROM users WHERE id = $1', [req.user.id]);
    res.json({ api_key: user.api_key });
  } catch { res.status(500).json({ error: 'Failed to regenerate API key' }); }
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', app: 'Extoboost', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await runMigrations();
  app.listen(ENV.PORT, () => {
    console.log(`Extoboost backend running on port ${ENV.PORT}`);
    console.log(`Database: PostgreSQL`);
  });
}

start().catch(err => { console.error('Failed to start server:', err); process.exit(1); });

module.exports = app;
