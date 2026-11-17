import type { RequestHandler } from 'express';
import type { UpsertQuotationInput } from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import { parsePagination } from '../../lib/pagination.js';
import {
  getMyQuotation as getMyQuotationService,
  listRequestQuotations,
  upsertQuotation,
} from './quotations.service.js';

export const submitQuotation: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const result = await upsertQuotation(
    req.user.id,
    req.params.id as string,
    req.body as UpsertQuotationInput,
  );

  res.status(result.created ? 201 : 200).json({ data: result.quotation });
};

export const getMyQuotation: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const quotation = await getMyQuotationService(req.user.id, req.params.id as string);
  res.json({ data: quotation });
};

export const listQuotations: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const page = parsePagination(req.query);
  const result = await listRequestQuotations(req.user, req.params.id as string, page);
  res.json({ data: result });
};
