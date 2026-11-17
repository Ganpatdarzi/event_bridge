CREATE TABLE "system_settings" (
  "key" varchar(120) PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "public"."users"("id") ON DELETE set null
);