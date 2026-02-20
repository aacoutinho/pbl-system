CREATE TABLE `tutorial_evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`professorUserId` int NOT NULL,
	`organizacao` decimal(3,1) NOT NULL DEFAULT '0',
	`cooperacao` decimal(3,1) NOT NULL DEFAULT '0',
	`conteudo` decimal(3,1) NOT NULL DEFAULT '0',
	`objetivo` decimal(3,1) NOT NULL DEFAULT '0',
	`metas` decimal(3,1) NOT NULL DEFAULT '0',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorial_evaluations_id` PRIMARY KEY(`id`),
	CONSTRAINT `tutorial_evaluations_sessionId_unique` UNIQUE(`sessionId`)
);
