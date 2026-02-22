CREATE TABLE `components` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `components_id` PRIMARY KEY(`id`),
	CONSTRAINT `components_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `classes` RENAME COLUMN `componentCode` TO `componentId`;--> statement-breakpoint
ALTER TABLE `professor_components` DROP INDEX `uq_professor_component`;--> statement-breakpoint
ALTER TABLE `classes` MODIFY COLUMN `componentId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `professor_components` ADD `componentId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `professor_components` ADD CONSTRAINT `uq_professor_component` UNIQUE(`userId`,`componentId`);--> statement-breakpoint
ALTER TABLE `professor_components` DROP COLUMN `componentCode`;