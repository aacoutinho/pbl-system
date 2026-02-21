CREATE TABLE `class_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`classId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_students_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_student_class` UNIQUE(`studentId`,`classId`)
);
--> statement-breakpoint
ALTER TABLE `students` DROP INDEX `uq_student_email_class`;--> statement-breakpoint
ALTER TABLE `students` MODIFY COLUMN `email` varchar(320);--> statement-breakpoint
ALTER TABLE `students` MODIFY COLUMN `enrollment` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD CONSTRAINT `students_enrollment_unique` UNIQUE(`enrollment`);--> statement-breakpoint
ALTER TABLE `students` DROP COLUMN `classId`;