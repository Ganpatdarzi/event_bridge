import type { RequestHandler } from 'express';
import {
  closeRequestSchema,
  type CreateRequestInput,
  type UpdateRequestInput,
} from '@event-bridge/shared';
import { AppError } from '../../lib/errors.js';
import { parsePagination } from '../../lib/pagination.js';
import { requestListQuerySchema, vendorRequestQuerySchema } from './requests.schema.js';
import {
  cancelRequest as cancelRequestService,
  closeRequest as closeRequestService,
  createServiceRequest,
  getRequestDetail,
  listRequestVendors,
  listRequests,
  listVendorRequests,
  submitRequest as submitRequestService,
  updateRequest as updateRequestService,
} from './requests.service.js';

export const createRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const request = await createServiceRequest(req.user.id, req.body as CreateRequestInput);
  res.status(201).json({ data: request });
};

export const listMyRequests: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const page = parsePagination(req.query);
  const filter = requestListQuerySchema.parse(req.query);
  const result = await listRequests(req.user, { ...page, ...filter });
  res.json({ data: result });
};

export const getRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const request = await getRequestDetail(req.user, req.params.id as string);
  res.json({ data: request });
};

export const updateRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const request = await updateRequestService(
    req.user.id,
    req.params.id as string,
    req.body as UpdateRequestInput,
  );
  res.json({ data: request });
};

export const submitRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const request = await submitRequestService(req.user.id, req.params.id as string);
  res.json({ data: request });
};

export const cancelRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const request = await cancelRequestService(
    req.user,
    req.params.id as string,
    req.body.reason as string,
  );
  res.json({ data: request });
};

export const closeRequest: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const { reason } = closeRequestSchema.parse(req.body ?? {});
  const request = await closeRequestService(req.user, req.params.id as string, reason);
  res.json({ data: request });
};

export const getRequestVendors: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const result = await listRequestVendors(req.user, req.params.id as string);
  res.json({ data: result });
};

export const listVendorRequestsForMe: RequestHandler = async (req, res) => {
  if (!req.user) throw AppError.unauthenticated();

  const page = parsePagination(req.query);
  const filter = vendorRequestQuerySchema.parse(req.query);
  const result = await listVendorRequests(req.user.id, { ...page, ...filter });
  res.json({ data: result });
};
