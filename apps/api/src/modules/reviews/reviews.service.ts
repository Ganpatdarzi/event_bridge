import { and, desc, eq } from 'drizzle-orm';
import { type ReviewCreateInput } from '@event-bridge/shared';
import { db } from '../../db/index.js';
import { quotations, reviews, serviceRequests, societies } from '../../db/schema/index.js';
import { writeAuditTx } from '../../lib/audit.js';
import { AppError } from '../../lib/errors.js';

export interface ReviewView {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  society: { name: string };
  request: { reference: string; title: string };
}

export async function createReview(
  userId: string,
  requestId: string,
  input: ReviewCreateInput,
): Promise<ReviewView> {
  const [request] = await db
    .select({
      id: serviceRequests.id,
      societyId: societies.id,
      societyUserId: societies.userId,
      status: serviceRequests.status,
      selectedQuotationId: serviceRequests.selectedQuotationId,
    })
    .from(serviceRequests)
    .innerJoin(societies, eq(societies.id, serviceRequests.societyId))
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  if (!request) throw AppError.notFound('Request not found');
  if (request.societyUserId !== userId) throw AppError.notFound('Request not found');

  if (!['selected', 'completed'].includes(request.status)) {
    throw AppError.conflict('CONFLICT', 'Reviews can only be submitted for completed engagements');
  }

  if (!request.selectedQuotationId) {
    throw AppError.conflict('CONFLICT', 'No selected vendor for this request');
  }

  const [selected] = await db
    .select({ vendorId: quotations.vendorId })
    .from(quotations)
    .where(eq(quotations.id, request.selectedQuotationId))
    .limit(1);

  if (!selected) throw AppError.notFound('Selected quotation not found');

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(eq(reviews.requestId, requestId))
    .limit(1);

  if (existing) {
    throw AppError.conflict('CONFLICT', 'A review has already been submitted for this request');
  }

  await db.transaction(async (tx) => {
    await tx.insert(reviews).values({
      societyId: request.societyId,
      vendorId: selected.vendorId,
      requestId,
      rating: input.rating,
      comment: input.comment ?? null,
    });

    await writeAuditTx(tx, {
      actorId: userId,
      action: 'review.created',
      targetType: 'review',
      targetId: null,
      metadata: { requestId, rating: input.rating },
    });
  });

  const [created] = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      societyName: societies.name,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
    })
    .from(reviews)
    .innerJoin(societies, eq(societies.id, reviews.societyId))
    .innerJoin(serviceRequests, eq(serviceRequests.id, reviews.requestId))
    .where(eq(reviews.requestId, requestId))
    .limit(1);

  if (!created) throw AppError.notFound('Review not found');

  return {
    id: created.id,
    rating: created.rating,
    comment: created.comment,
    createdAt: created.createdAt,
    society: { name: created.societyName },
    request: { reference: created.requestReference, title: created.requestTitle },
  };
}

export async function listVendorReviews(vendorId: string): Promise<ReviewView[]> {
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      societyName: societies.name,
      requestReference: serviceRequests.reference,
      requestTitle: serviceRequests.title,
    })
    .from(reviews)
    .innerJoin(societies, eq(societies.id, reviews.societyId))
    .innerJoin(serviceRequests, eq(serviceRequests.id, reviews.requestId))
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.isHidden, false)))
    .orderBy(desc(reviews.createdAt));

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
    society: { name: row.societyName },
    request: { reference: row.requestReference, title: row.requestTitle },
  }));
}
