import { Router } from 'express';
import { loginSchema, registerSchema } from '@event-bridge/shared';
import { authenticate } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { validateBody } from '../../middleware/validate.js';
import { login, logout, me, refresh, register } from './auth.controller.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), login);
authRouter.post('/refresh', authLimiter, refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, me);
