CREATE TABLE `professor_student_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`professorUserId` int NOT NULL,
	`positivePoints` int NOT NULL DEFAULT 0,
	`negativePoints` int NOT NULL DEFAULT 0,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professor_student_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_prof_student_session` UNIQUE(`sessionId`,`studentId`,`professorUserId`)
);
