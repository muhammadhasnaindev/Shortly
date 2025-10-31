import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requireAdmin } from '../middlewares/admin.js';
import Link from '../models/Link.js';
import Click from '../models/Click.js';
import User from '../models/User.js';

const r = Router();
r.use(requireAuth, requireAdmin);

r.get('/stats', async (_req, res) => {
  const [users, links, clicks] = await Promise.all([
    User.countDocuments(),
    Link.countDocuments(),
    Click.countDocuments()
  ]);
  const recentAbuse = await Link.find({ isActive: false }).sort({ updatedAt: -1 }).limit(20).lean();
  res.json({ users, links, clicks, disabledExamples: recentAbuse.map(x => ({ code: x.code, reason: 'manual/auto', updatedAt: x.updatedAt })) });
});

export default r;
