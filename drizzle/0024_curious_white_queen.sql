CREATE TABLE `session_access_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_access_tokens_token_unique` UNIQUE(`token`),
	CONSTRAINT `uq_session_student_token` UNIQUE(`sessionId`,`studentId`)
);
