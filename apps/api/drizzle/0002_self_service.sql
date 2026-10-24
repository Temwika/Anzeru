CREATE TYPE "public"."application_channel" AS ENUM('branch', 'self_service');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "collection_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"msisdn" varchar(15) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"settlement" boolean DEFAULT false NOT NULL,
	"status" "collection_status" DEFAULT 'pending' NOT NULL,
	"provider_ref" text,
	"payment_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "collection_requests_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN "channel" "application_channel" DEFAULT 'branch' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "interest_waivers" jsonb;--> statement-breakpoint
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_requests" ADD CONSTRAINT "collection_requests_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_requests_loan_idx" ON "collection_requests" USING btree ("tenant_id","loan_id");