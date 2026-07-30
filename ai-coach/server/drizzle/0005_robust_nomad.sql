ALTER TABLE `telemetry_imports` ADD `pilot_id` text REFERENCES pilots(id);--> statement-breakpoint
ALTER TABLE `telemetry_imports` ADD `metadata` text;--> statement-breakpoint
ALTER TABLE `telemetry_imports` ADD `recorded_at` integer;