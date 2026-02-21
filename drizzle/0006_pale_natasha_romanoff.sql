ALTER TABLE `sessions` ADD `accessCode` varchar(8);--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_accessCode_unique` UNIQUE(`accessCode`);