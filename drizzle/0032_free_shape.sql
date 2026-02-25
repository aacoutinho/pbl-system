CREATE TABLE `brainstorm_board_send_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sentByName` varchar(255) NOT NULL,
	`sentByRole` varchar(64) NOT NULL,
	`recipientCount` int NOT NULL DEFAULT 0,
	`failCount` int NOT NULL DEFAULT 0,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brainstorm_board_send_history_id` PRIMARY KEY(`id`)
);
