CREATE TABLE `evaluation_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluationId` int NOT NULL,
	`evaluatedStudentId` int NOT NULL,
	`role` enum('COORDENADOR','MESA','QUADRO','PARTICIPANTE') NOT NULL,
	`absent` boolean NOT NULL DEFAULT false,
	`atuacao` decimal(3,1) NOT NULL DEFAULT '0',
	`pontualidade` decimal(3,1) NOT NULL DEFAULT '0',
	`dominio` decimal(3,1) NOT NULL DEFAULT '0',
	`metas` decimal(3,1) NOT NULL DEFAULT '0',
	`participacao` decimal(3,1) NOT NULL DEFAULT '0',
	CONSTRAINT `evaluation_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`evaluatorStudentId` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_eval_session_evaluator` UNIQUE(`sessionId`,`evaluatorStudentId`)
);
--> statement-breakpoint
CREATE TABLE `session_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	CONSTRAINT `session_students_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_session_student` UNIQUE(`sessionId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`problemNumber` int NOT NULL,
	`sessionNumber` int NOT NULL,
	`label` varchar(100) NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_email_unique` UNIQUE(`email`)
);
