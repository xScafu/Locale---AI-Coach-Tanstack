CREATE TABLE `telemetry_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`car_id` text,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`tables` text,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
