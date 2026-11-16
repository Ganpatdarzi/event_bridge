import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors.js';
import { getSocietyProfile, updateSocietyProfile } from './societies.service.js';

export const getMySociety: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const profile = await getSocietyProfile(req.user.id);
  res.json({ data: profile });
};

export const updateMySociety: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const profile = await updateSocietyProfile(req.user.id, req.body);
  res.json({ data: profile });
};
