import type { RequestHandler } from 'express';
import { clearRefreshCookie, setRefreshCookie } from '../../lib/cookies.js';
import { AppError } from '../../lib/errors.js';
import { refreshCookieName } from '../../lib/tokens.js';
import {
  buildSession,
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  type RequestMeta,
} from './auth.service.js';

function meta(req: Parameters<RequestHandler>[0]): RequestMeta {
  return {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  };
}

export const register: RequestHandler = async (req, res) => {
  const result = await registerUser(req.body);
  res.status(201).json({ data: result });
};

export const login: RequestHandler = async (req, res) => {
  const { session, tokens } = await loginUser(req.body, meta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ data: { ...session, accessToken: tokens.accessToken } });
};

export const refresh: RequestHandler = async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)[refreshCookieName];
  if (!token) {
    throw AppError.unauthenticated('No active session');
  }

  const { session, tokens } = await rotateRefreshToken(token, meta(req));
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ data: { ...session, accessToken: tokens.accessToken } });
};

export const logout: RequestHandler = async (req, res) => {
  const token = (req.cookies as Record<string, string | undefined>)[refreshCookieName];
  if (token) {
    await revokeRefreshToken(token);
  }
  clearRefreshCookie(res);
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  if (!req.user) {
    throw AppError.unauthenticated();
  }
  const session = await buildSession(req.user.id);
  res.json({ data: session });
};
