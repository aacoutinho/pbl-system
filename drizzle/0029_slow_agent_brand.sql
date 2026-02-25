CREATE TABLE `brainstorm_item_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`url` varchar(1024) NOT NULL,
	`type` enum('link','image','video','photo','document') NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brainstorm_item_attachments_id` PRIMARY KEY(`id`)
);
