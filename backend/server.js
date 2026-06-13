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
const initSqlJs = require('sql.js');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_PATH: process.env.DATABASE_PATH || path.resolve(__dirname, 'data/extoboost.db'),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
  JWT_SECRET: process.env.JWT_SECRET || 'extoboost-default-jwt-secret-2024',
  SESSION_SECRET: process.env.SESSION_SECRET || 'extoboost-default-session-secret-2024',
  LINKVERTISE_PUBLISHER_ID: process.env.LINKVERTISE_PUBLISHER_ID || '',
  LOOTLABS_API_KEY: process.env.LOOTLABS_API_KEY || '',
  WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:3000',
};

let db;

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  const dbDir = path.dirname(ENV.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  fs.writeFileSync(ENV.DATABASE_PATH, buffer);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
  if (isSelect) {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }
  stmt.run(params);
  stmt.free();
  saveDb();
  return [];
}

function getOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  query(sql, params);
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

function runMigrations() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      unlocked_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS one_time_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','expired')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
  db.run('CREATE INDEX IF NOT EXISTS idx_one_time_codes_code ON one_time_codes(code)');
  db.run('CREATE INDEX IF NOT EXISTS idx_one_time_codes_user_id ON one_time_codes(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_one_time_codes_status ON one_time_codes(status)');
  db.run(`
    CREATE TABLE IF NOT EXISTS gateway_tokens (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('linkvertise','lootlabs')),
      admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','expired')),
      code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_gateway_tokens_status ON gateway_tokens(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_gateway_tokens_admin ON gateway_tokens(admin_user_id)');
  try { db.run('ALTER TABLE gateway_tokens ADD COLUMN ad_url TEXT'); } catch {}
  saveDb();
  console.log('Database migrations applied');
}

const app = express();

passport.use(new GoogleStrategy({
  clientID: ENV.GOOGLE_CLIENT_ID,
  clientSecret: ENV.GOOGLE_CLIENT_SECRET,
  callbackURL: ENV.GOOGLE_CALLBACK_URL,
}, (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value || '';
    const name = profile.displayName || '';
    const existing = getOne('SELECT * FROM users WHERE google_id = ?', [googleId]);

    if (!existing) {
      const id = crypto.randomUUID();
      const apiKey = crypto.randomUUID();
      run('INSERT INTO users (id, google_id, email, name, api_key, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, googleId, email, name, apiKey, new Date().toISOString()]);
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
passport.deserializeUser((raw, done) => {
  try {
    const { id } = JSON.parse(raw);
    done(null, getOne('SELECT * FROM users WHERE id = ?', [id]) || null);
  } catch (err) { done(err, null); }
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.slice(7), ENV.JWT_SECRET);
    const user = getOne('SELECT * FROM users WHERE id = ?', [payload.userId]);
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

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  res.json(getOne('SELECT id, google_id, email, name, api_key, unlocked_until, created_at FROM users WHERE id = ?', [req.user.id]));
});

app.post('/api/v1/ads/generate', requireAuth, (req, res) => {
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

    run('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)', [sessionId, req.user.id, callbackId, new Date(Date.now() + 3600000).toISOString()]);
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
    const token = crypto.randomBytes(16).toString('hex');
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/v1/ad-callback?token=${token}`;

    let adUrl = null;
    if (provider === 'linkvertise') {
      adUrl = generateLinkvertiseUrl(callbackUrl);
    } else {
      adUrl = await createLootLabsUrl(callbackUrl);
    }

    run('INSERT INTO gateway_tokens (id, player_id, provider, admin_user_id, status, ad_url) VALUES (?, ?, ?, ?, ?, ?)',
      [token, playerId, provider, req.user.id, 'pending', adUrl || '']);
    res.json({ token, gatewayUrl: `${ENV.WEB_APP_URL}/gateway/${token}` });
  } catch (err) {
    console.error('Generate token error:', err);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.get('/api/v1/gateway-token/:token', (req, res) => {
  try {
    const { token } = req.params;
    const gt = getOne('SELECT * FROM gateway_tokens WHERE id = ?', [token]);
    if (!gt) return res.status(404).json({ error: 'Token not found' });
    if (!gt.ad_url) return res.status(500).json({ error: 'Ad URL not configured for this token' });
    res.json({ provider: gt.provider, playerId: gt.player_id, adUrl: gt.ad_url, status: gt.status });
  } catch (err) {
    console.error('Gateway token lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/gateway-token/:token/status', (req, res) => {
  try {
    const { token } = req.params;
    const gt = getOne('SELECT * FROM gateway_tokens WHERE id = ?', [token]);
    if (!gt) return res.status(404).json({ error: 'Token not found' });
    if (gt.status !== 'completed') return res.json({ status: gt.status, code: null, playerId: gt.player_id });
    const admin = getOne('SELECT id, name, api_key FROM users WHERE id = ?', [gt.admin_user_id]);
    res.json({ status: gt.status, code: gt.code, playerId: gt.player_id, adminName: admin?.name || 'User', apiKey: admin?.api_key || '' });
  } catch (err) {
    console.error('Gateway token status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/ad-callback', (req, res) => {
  try {
    const { cb, uid, token } = req.query;
    if (token) {
      const gt = getOne("SELECT * FROM gateway_tokens WHERE id = ? AND status = 'pending'", [token]);
      if (!gt) return res.status(404).json({ error: 'Invalid or expired token' });
      const code = generateOneTimeCode();
      run('UPDATE gateway_tokens SET status = ?, code = ?, completed_at = ? WHERE id = ?', ['completed', code, new Date().toISOString(), token]);
      run('UPDATE users SET unlocked_until = ? WHERE id = ?', [new Date(Date.now() + 86400000).toISOString(), gt.admin_user_id]);
      const admin = getOne('SELECT id, name, api_key FROM users WHERE id = ?', [gt.admin_user_id]);
      return res.redirect(`${ENV.WEB_APP_URL}/gateway/${token}/success?name=${encodeURIComponent(admin?.name || 'User')}&key=${admin?.api_key || ''}&code=${code}`);
    }
    if (!cb || !uid) return res.status(400).json({ error: 'Missing parameters' });
    const session = getOne("SELECT * FROM sessions WHERE token = ? AND user_id = ? AND expires_at > datetime('now')", [cb, uid]);
    if (!session) return res.status(404).json({ error: 'Invalid or expired session' });
    const code = generateOneTimeCode();
    run("INSERT INTO one_time_codes (id, code, user_id, session_id, status, expires_at, created_at) VALUES (?, ?, ?, ?, 'completed', ?, ?)", [crypto.randomUUID(), code, uid, session.id, new Date(Date.now() + 86400000).toISOString(), new Date().toISOString()]);
    run('UPDATE users SET unlocked_until = ? WHERE id = ?', [new Date(Date.now() + 86400000).toISOString(), uid]);
    res.json({ success: true, code, message: 'Ad verification completed. Your code is ready.' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/validation/check', requireAuth, (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    const codeResult = getOne("SELECT * FROM one_time_codes WHERE code = ? AND user_id = ? AND status = 'completed' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1", [code.toUpperCase(), req.user.id]);
    if (!codeResult) return res.status(404).json({ error: 'Invalid, expired, or already used code' });
    res.json({ valid: true, unlockedUntil: req.user.unlocked_until, message: 'Key is valid. Account unlocked for 24 hours.' });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/validation/status', requireAuth, (req, res) => {
  const isUnlocked = req.user.unlocked_until && new Date(req.user.unlocked_until) > new Date();
  if (isUnlocked) {
    const validCode = getOne("SELECT code FROM one_time_codes WHERE user_id = ? AND status = 'completed' AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    res.json({ unlocked: true, unlockedUntil: req.user.unlocked_until, code: validCode?.code || null });
  } else {
    res.json({ unlocked: false, unlockedUntil: null, code: null });
  }
});

app.get('/api/v1/verify-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const { player_id, key } = req.query;
  if (!player_id || !key) return res.json({ success: false, error: 'Missing player_id or key parameter' });
  try {
    const codeResult = getOne("SELECT * FROM one_time_codes WHERE code = ? AND status = 'completed' AND expires_at > datetime('now')", [key.toUpperCase()]);
    if (codeResult) {
      run("UPDATE one_time_codes SET status = 'expired' WHERE id = ?", [codeResult.id]);
      res.json({ success: true, message: 'Key is valid — consumed', playerId: player_id });
    } else {
      res.json({ success: false, error: 'Incorrect or Expired Key!' });
    }
  } catch { res.json({ success: false, error: 'Server error' }); }
});

app.options('/api/v1/verify-key', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', app: 'Extoboost', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  const SQL = await initSqlJs();
  const dbDir = path.dirname(ENV.DATABASE_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (fs.existsSync(ENV.DATABASE_PATH)) {
    const fileBuffer = fs.readFileSync(ENV.DATABASE_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  runMigrations();
  app.listen(ENV.PORT, () => {
    console.log(`Extoboost backend running on port ${ENV.PORT}`);
    console.log(`Database: ${ENV.DATABASE_PATH}`);
  });
}

start();

module.exports = app;
