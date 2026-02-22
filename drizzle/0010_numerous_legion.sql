CREATE TABLE `password_reset_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`code` varchar(6) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smtp_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 587,
	`secure` boolean NOT NULL DEFAULT false,
	`username` varchar(320) NOT NULL,
	`password` varchar(512) NOT NULL,
	`fromEmail` varchar(320) NOT NULL,
	`fromName` varchar(255) NOT NULL DEFAULT 'Avaliação Tutorial',
	`configured` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smtp_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `smtp_config_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','coordinator') NOT NULL DEFAULT 'user';