CREATE TABLE `brainstorm_boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`mesaStudentId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brainstorm_boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `brainstorm_boards_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `brainstorm_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`section` enum('ideias','fatos','questoes','metas') NOT NULL,
	`content` text NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'default',
	`attachmentUrl` varchar(1024),
	`attachmentType` enum('link','image','video','photo'),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brainstorm_items_id` PRIMARY KEY(`id`)
);
