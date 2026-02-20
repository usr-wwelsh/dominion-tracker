// Per-request Basic Auth middleware for destructive operations
// If AUTH_USER/AUTH_PASS env vars are not set, passes through (no-op)
function requireAuth(req, res, next) {
  const user = process.env.AUTH_USER;
  const pass = process.env.AUTH_PASS;

  if (!user || !pass) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const encoded = authHeader.slice('Basic '.length);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [reqUser, reqPass] = decoded.split(':');

  if (reqUser !== user || reqPass !== pass) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
}

module.exports = { requireAuth };
