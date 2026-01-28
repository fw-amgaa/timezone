CREATE TYPE "public"."audit_action" AS ENUM('clock_in', 'clock_out', 'request_submitted', 'request_approved', 'request_denied', 'shift_revised', 'user_created', 'user_updated', 'org_created', 'org_updated', 'settings_changed');--> statement-breakpoint
CREATE TYPE "public"."location_status" AS ENUM('in_range', 'out_of_range', 'unknown', 'spoofing_detected');--> statement-breakpoint
CREATE TYPE "public"."otp_status" AS ENUM('pending', 'verified', 'expired', 'max_attempts');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'denied', 'auto_expired');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('open', 'closed', 'stale', 'pending_revision', 'revised');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'org_admin', 'org_manager', 'employee');--> statement-breakpoint
CREATE TABLE "org_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"radius_meters" integer DEFAULT 200,
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"logo_url" varchar(500),
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(255),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"geofence_settings" jsonb DEFAULT '{"enabled":true,"radiusMeters":200,"strictMode":false,"requireServerVerification":true}'::jsonb,
	"locale_settings" jsonb DEFAULT '{"timezone":"UTC","dateFormat":"MM/DD/YYYY","timeFormat":"12h","weekStartsOn":0,"language":"en-US"}'::jsonb,
	"shift_policy_settings" jsonb DEFAULT '{"maxShiftHours":16,"minShiftMinutes":5,"autoBreakDeductionMinutes":30,"autoBreakThresholdHours":6,"overtimeThresholdHours":40,"requireBreakClockOut":false}'::jsonb,
	"subscription_tier" "subscription_tier" DEFAULT 'free',
	"max_employees" integer DEFAULT 10,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(50) NOT NULL,
	"code" varchar(6) NOT NULL,
	"status" "otp_status" DEFAULT 'pending',
	"attempts" varchar(10) DEFAULT '0',
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"device_info" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"position" varchar(100),
	"registration_number" varchar(100),
	"avatar_url" varchar(500),
	"email" varchar(255),
	"phone" varchar(50),
	"phone_verified" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"password_hash" text,
	"biometric_public_key" text,
	"last_login_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"preferences" jsonb DEFAULT '{"notifications":{"shiftReminders":true,"requestUpdates":true,"weeklyReports":true},"display":{"theme":"system","compactMode":false},"biometricEnabled":false,"lastBiometricPrompt":null}'::jsonb,
	"is_active" boolean DEFAULT true,
	"invited_at" timestamp with time zone,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"duration_minutes" integer,
	"break_type" varchar(50) DEFAULT 'unpaid',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"shift_id" uuid,
	"request_type" varchar(20) NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"requested_location" jsonb NOT NULL,
	"distance_from_geofence" integer,
	"reason" text NOT NULL,
	"requested_timestamp" timestamp with time zone NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"reviewer_note" text,
	"denial_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" uuid,
	"status" "shift_status" DEFAULT 'open' NOT NULL,
	"clock_in_at" timestamp with time zone NOT NULL,
	"clock_in_location" jsonb,
	"clock_in_location_status" "location_status" DEFAULT 'unknown',
	"clock_in_server_verification" jsonb,
	"clock_in_device_info" jsonb,
	"clock_out_at" timestamp with time zone,
	"clock_out_location" jsonb,
	"clock_out_location_status" "location_status",
	"clock_out_server_verification" jsonb,
	"clock_out_device_info" jsonb,
	"duration_minutes" integer,
	"break_minutes" integer DEFAULT 0,
	"net_duration_minutes" integer,
	"shift_date" timestamp with time zone NOT NULL,
	"clock_in_note" text,
	"clock_out_note" text,
	"manager_note" text,
	"is_revised" boolean DEFAULT false,
	"original_clock_out_at" timestamp with time zone,
	"revised_by" uuid,
	"revised_at" timestamp with time zone,
	"revision_reason" text,
	"marked_stale_at" timestamp with time zone,
	"stale_resolution_note" text,
	"was_offline" boolean DEFAULT false,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"user_id" uuid,
	"user_email" varchar(255),
	"user_role" varchar(50),
	"action" "audit_action" NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"description" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb NOT NULL,
	"client_timestamp" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"processed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" varchar(10) DEFAULT '0',
	"device_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_locations" ADD CONSTRAINT "org_locations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaks" ADD CONSTRAINT "breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_requests" ADD CONSTRAINT "check_in_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_requests" ADD CONSTRAINT "check_in_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_requests" ADD CONSTRAINT "check_in_requests_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_in_requests" ADD CONSTRAINT "check_in_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_location_id_org_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."org_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offline_sync_queue" ADD CONSTRAINT "offline_sync_queue_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_phone_idx" ON "otp_verifications" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_status_idx" ON "otp_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "users_org_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "breaks_shift_idx" ON "breaks" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "requests_org_idx" ON "check_in_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "requests_user_idx" ON "check_in_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "check_in_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_org_status_idx" ON "check_in_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "shifts_org_id_idx" ON "shifts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shifts_user_id_idx" ON "shifts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shifts_clock_in_idx" ON "shifts" USING btree ("clock_in_at");--> statement-breakpoint
CREATE INDEX "shifts_shift_date_idx" ON "shifts" USING btree ("shift_date");--> statement-breakpoint
CREATE INDEX "shifts_user_status_idx" ON "shifts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "shifts_org_date_idx" ON "shifts" USING btree ("organization_id","shift_date");--> statement-breakpoint
CREATE INDEX "audit_org_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "sync_queue_user_idx" ON "offline_sync_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_queue_status_idx" ON "offline_sync_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_queue_org_status_idx" ON "offline_sync_queue" USING btree ("organization_id","status");