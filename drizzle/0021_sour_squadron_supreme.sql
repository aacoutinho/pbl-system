CREATE TABLE `tutorial_eval_drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`professorUserId` int NOT NULL,
	`organizacao` decimal(3,1) NOT NULL DEFAULT '0',
	`cooperacao` decimal(3,1) NOT NULL DEFAULT '0',
	`conteudo` decimal(3,1) NOT NULL DEFAULT '0',
	`objetivo` decimal(3,1) NOT NULL DEFAULT '0',
	`metas` decimal(3,1) NOT NULL DEFAULT '0',
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutorial_eval_drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `tutorial_eval_drafts_sessionId_unique` UNIQUE(`sessionId`)
);
