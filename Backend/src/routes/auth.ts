import { Router, Request, Response } from 'express';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import { registerUser, loginUser, getUserById } from '../services/auth.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();


router.post('/signup', async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }

  const { name, email, password } = parsed.data;

  try {
    const result = await registerUser(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'EMAIL_IN_USE') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
  }

  const { email, password } = parsed.data;

  try {
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserById(req.userId!);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});
export default router;