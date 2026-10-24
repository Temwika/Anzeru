ALTER TYPE "public"."interest_method" ADD VALUE 'flat_term' BEFORE 'interest_only';--> statement-breakpoint
CREATE TABLE "loan_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"meeting_place" text,
	"meeting_day" text,
	"officer_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_groups" ADD CONSTRAINT "loan_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_groups" ADD CONSTRAINT "loan_groups_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_groups" ADD CONSTRAINT "loan_groups_officer_id_users_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loan_groups_tenant_name_uq" ON "loan_groups" USING btree ("tenant_id",lower("name"));--> statement-breakpoint
CREATE INDEX "loan_groups_branch_idx" ON "loan_groups" USING btree ("tenant_id","branch_id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_group_id_loan_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."loan_groups"("id") ON DELETE no action ON UPDATE no action;