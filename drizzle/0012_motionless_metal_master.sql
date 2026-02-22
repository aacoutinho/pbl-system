ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','coordinator','prof') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `professor_components` ADD `componentRole` enum('coordinator','prof') DEFAULT 'prof' NOT NULL;--> statement-breakpoint
ALTER TABLE `professor_components` ADD `status` enum('pending','approved') DEFAULT 'pending' NOT NULL;