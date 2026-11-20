-- Older versions could select two quotations for the same request in a race.
-- Keep only the most recently updated selected offer before adding the guard.
UPDATE "quotations" q
SET "status" = 'not_selected', "updated_at" = now()
FROM (
  SELECT "id", row_number() OVER (
    PARTITION BY "request_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS rn
  FROM "quotations"
  WHERE "status" = 'selected'
) dup
WHERE q."id" = dup."id" AND dup.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quotations_one_selected_per_request" ON "quotations" USING btree ("request_id") WHERE "quotations"."status" = 'selected';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_quotations_one_preferred_per_request" ON "quotations" USING btree ("request_id") WHERE "quotations"."status" = 'preferred';
