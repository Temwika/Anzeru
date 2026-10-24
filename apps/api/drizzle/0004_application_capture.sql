CREATE TABLE "application_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"guarantor_id" uuid,
	"collateral_id" uuid,
	"doc_type" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collateral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"identifier" text,
	"estimated_value" numeric(18, 2) NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN "borrower_signature" text;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN "borrower_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "loan_products" ADD COLUMN "requires_collateral" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_guarantor_id_guarantors_id_fk" FOREIGN KEY ("guarantor_id") REFERENCES "public"."guarantors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_collateral_id_collateral_id_fk" FOREIGN KEY ("collateral_id") REFERENCES "public"."collateral"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral" ADD CONSTRAINT "collateral_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral" ADD CONSTRAINT "collateral_application_id_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;