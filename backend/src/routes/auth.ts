import express from 'express';
import jwt from 'jsonwebtoken';
import { AdminModel } from '../models/Admin';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AuditLogService, sanitizeForAuditLog } from '../services/auditLog';

const router = express.Router();

router.post('/login', async (req, res): Promise<void> => {
  const ip = req.ip ?? 'unknown';
  const ua = req.get('user-agent') ?? null;
  const rawUsername = typeof req.body?.username === 'string' ? req.body.username : '';
  const cleanUsername = sanitizeForAuditLog(rawUsername, 100);

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      AuditLogService.log({
        admin_id_snapshot: -1,
        admin_id: null,
        admin_username: cleanUsername,
        action: 'LOGIN_FAILED',
        resource_type: 'admin',
        http_method: 'POST',
        endpoint: '/api/v1/auth/login',
        status_code: 400,
        ip_address: ip,
        user_agent: ua,
        details: { failure_reason: 'unknown' },
      }).catch(() => {});
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const admin = await AdminModel.findByUsername(username);
    if (!admin) {
      AuditLogService.log({
        admin_id_snapshot: -1,
        admin_id: null,
        admin_username: cleanUsername,
        action: 'LOGIN_FAILED',
        resource_type: 'admin',
        http_method: 'POST',
        endpoint: '/api/v1/auth/login',
        status_code: 401,
        ip_address: ip,
        user_agent: ua,
        details: { failure_reason: 'user_not_found' },
      }).catch(() => {});
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = await AdminModel.verifyPassword(admin, password);
    if (!isValidPassword) {
      AuditLogService.log({
        admin_id_snapshot: admin.id,
        admin_id: admin.id,
        admin_username: admin.username,
        action: 'LOGIN_FAILED',
        resource_type: 'admin',
        resource_id: String(admin.id),
        http_method: 'POST',
        endpoint: '/api/v1/auth/login',
        status_code: 401,
        ip_address: ip,
        user_agent: ua,
        details: { failure_reason: 'invalid_credentials' },
      }).catch(() => {});
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await AdminModel.updateLastLogin(admin.id);

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret not configured' });
      return;
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
      jwtSecret,
      {
        expiresIn: expiresIn,
      } as jwt.SignOptions
    );

    AuditLogService.log({
      admin_id_snapshot: admin.id,
      admin_id: admin.id,
      admin_username: admin.username,
      action: 'LOGIN',
      resource_type: 'admin',
      resource_id: String(admin.id),
      http_method: 'POST',
      endpoint: '/api/v1/auth/login',
      status_code: 200,
      ip_address: ip,
      user_agent: ua,
    }).catch(() => {});

    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const admin = await AdminModel.findById(req.user.id);
    if (!admin) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(admin);
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

