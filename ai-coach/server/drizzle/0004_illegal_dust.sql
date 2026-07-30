ALTER TABLE `telemetry_imports` ADD `track_id` text REFERENCES tracks(id);--> statement-breakpoint
ALTER TABLE `tracks` ADD `variant` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `length_m` real;--> statement-breakpoint
ALTER TABLE `tracks` ADD `corner_count` integer;--> statement-breakpoint
ALTER TABLE `tracks` ADD `reference_lap_seconds` real;--> statement-breakpoint
ALTER TABLE `tracks` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `profile` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `profile_import_id` text;--> statement-breakpoint
ALTER TABLE `tracks` ADD `profile_updated_at` integer;