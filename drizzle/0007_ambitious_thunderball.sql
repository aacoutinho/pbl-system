CREATE TABLE `professor_components` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`componentCode` varchar(32) NOT NULL,
	`authorizedAt` timestamp NOT NULL DEFAULT (now()),
	`authorizedByUserId` int,
	CONSTRAINT `professor_components_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_professor_component` UNIQUE(`userId`,`componentCode`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;