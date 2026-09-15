CREATE TABLE "recovery_incident_audit" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"incident_id" uuid,
"endpoint_id" text,
"event_type" text NOT NULL,
"actor_label" text NOT NULL,
"summary" text NOT NULL,
"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "recovery_incident_endpoints" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"incident_id" uuid NOT NULL,
"endpoint_id" text NOT NULL,
"organization_id" text NOT NULL,
"organization_name" text NOT NULL,
"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
"source_refreshed_at" timestamp with time zone NOT NULL,
"device_snapshot" jsonb NOT NULL
);

CREATE TABLE "recovery_incidents" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"title" text NOT NULL,
"case_number" text,
"owner" text,
"status" text DEFAULT 'OPEN' NOT NULL,
"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
"resolved_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "recovery_location_observations" (
"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"observation_key" text NOT NULL,
"endpoint_id" text NOT NULL,
"device_id" text,
"computer_name" text NOT NULL,
"organization_id" text NOT NULL,
"organization_name" text NOT NULL,
"serial_number" text,
"manufacturer" text,
"model" text,
"operating_system" text NOT NULL,
"agent_version" text,
"source" text DEFAULT 'Action1' NOT NULL,
"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
"source_refreshed_at" timestamp with time zone NOT NULL,
"location_observed_at" timestamp with time zone,
"last_seen_at" timestamp with time zone,
"latitude" double precision,
"longitude" double precision,
"accuracy" text,
"street_address" text,
"city" text,
"state" text,
"postal_code" text,
"country" text,
"address_source" text,
"nearest_address" text,
"cross_streets" text,
"address_precision" text,
"location_coordinates" text,
"location_status" text,
"location_integrity" text,
"location_quality" text,
"location_source" text,
"position_source" text,
"location_permission" text,
"location_sequence" text,
"location_age_minutes" text,
"location_error" text,
"location_summary" text,
"is_map_safe" boolean DEFAULT false NOT NULL,
"device_snapshot" jsonb NOT NULL
);

CREATE TABLE "recovery_device_aliases" (
"endpoint_id" text PRIMARY KEY NOT NULL,
"friendly_name" varchar(120) NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "recovery_geocoding_cache" (
"coordinate_key" text PRIMARY KEY NOT NULL,
"latitude" double precision NOT NULL,
"longitude" double precision NOT NULL,
"street_address" text,
"city" text,
"state" text,
"postal_code" text,
"country" text,
"nearest_address" text,
"address_precision" text,
"status" text NOT NULL,
"attempted_at" timestamp with time zone NOT NULL,
"expires_at" timestamp with time zone NOT NULL
);

ALTER TABLE "recovery_incident_audit" ADD CONSTRAINT "recovery_incident_audit_incident_id_recovery_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."recovery_incidents"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "recovery_incident_endpoints" ADD CONSTRAINT "recovery_incident_endpoints_incident_id_recovery_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."recovery_incidents"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "recovery_incident_audit_incident_at_idx" ON "recovery_incident_audit" USING btree ("incident_id","occurred_at");
CREATE INDEX "recovery_incident_endpoints_incident_idx" ON "recovery_incident_endpoints" USING btree ("incident_id");
CREATE INDEX "recovery_incident_endpoints_endpoint_idx" ON "recovery_incident_endpoints" USING btree ("endpoint_id");
CREATE UNIQUE INDEX "recovery_incident_endpoints_unique" ON "recovery_incident_endpoints" USING btree ("incident_id","endpoint_id");
CREATE INDEX "recovery_incidents_status_idx" ON "recovery_incidents" USING btree ("status");
CREATE INDEX "recovery_incidents_reported_at_idx" ON "recovery_incidents" USING btree ("reported_at");
CREATE UNIQUE INDEX "recovery_location_observations_key_unique" ON "recovery_location_observations" USING btree ("observation_key");
CREATE INDEX "recovery_location_observations_endpoint_at_idx" ON "recovery_location_observations" USING btree ("endpoint_id","source_refreshed_at");
CREATE INDEX "recovery_location_observations_captured_at_idx" ON "recovery_location_observations" USING btree ("captured_at");
CREATE INDEX "recovery_location_observations_device_id_idx" ON "recovery_location_observations" USING btree ("device_id");
CREATE INDEX "recovery_geocoding_cache_expires_at_idx" ON "recovery_geocoding_cache" USING btree ("expires_at");
