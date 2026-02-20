CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(64) NOT NULL,
	`professorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `students` DROP INDEX `students_email_unique`;--> statement-breakpoint
ALTER TABLE `sessions` ADD `classId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `classId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `uq_student_email_class` UNIQUE(`email`,`classId`);