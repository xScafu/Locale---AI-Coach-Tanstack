CREATE TABLE `car_problems` (
	`id` text PRIMARY KEY NOT NULL,
	`car_id` text NOT NULL,
	`phase` text NOT NULL,
	`problem` text NOT NULL,
	`severity` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cars` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`manufacturer` text,
	`name` text NOT NULL,
	`simulator` text,
	`category` text,
	`notes` text,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `coach_context` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`pilot_id` text,
	`car_id` text,
	`track_id` text,
	`summary` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `chat_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pilots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` text,
	`experience` text,
	`driving_style` text,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`openai_model` text,
	`max_input_tokens` integer,
	`max_output_tokens` integer,
	`temperature` real,
	`auto_summary_every` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setups` (
	`id` text PRIMARY KEY NOT NULL,
	`car_id` text NOT NULL,
	`name` text NOT NULL,
	`brake_bias` real,
	`front_ride_height` real,
	`rear_ride_height` real,
	`front_camber` real,
	`rear_camber` real,
	`front_toe` real,
	`rear_toe` real,
	`front_arb` real,
	`rear_arb` real,
	`front_spring` real,
	`rear_spring` real,
	`diff_preload` real,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`car_id`) REFERENCES `cars`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`pilot_id` text NOT NULL,
	`name` text NOT NULL,
	`country` text,
	`is_active` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pilot_id`) REFERENCES `pilots`(`id`) ON UPDATE no action ON DELETE no action
);
