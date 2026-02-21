ALTER TABLE `classes` ADD `classCode` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `componentCode` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` ADD `semester` varchar(16) NOT NULL;--> statement-breakpoint
ALTER TABLE `classes` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `classes` DROP COLUMN `code`;