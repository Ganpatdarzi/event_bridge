ALTER TYPE "public"."notification_type" ADD VALUE 'booking_created' BEFORE 'vendor_status';
--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'booking_cancelled' BEFORE 'vendor_status';
--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'completed');
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"society_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'PKR' NOT NULL,
	"notes" text,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_window_check" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_amount_check" CHECK ("bookings"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bookings_vendor_window" ON "bookings" USING btree ("vendor_id","status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_society" ON "bookings" USING btree ("society_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_vendor" ON "bookings" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_bookings_one_active_per_request" ON "bookings" USING btree ("request_id") WHERE "bookings"."status" = 'confirmed';
