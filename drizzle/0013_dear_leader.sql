CREATE TABLE `class_eval_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`classId` int NOT NULL,
	`authorizedUserId` int NOT NULL,
	`grantedByUserId` int NOT NULL,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_eval_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_class_eval_perm` UNIQUE(`classId`,`authorizedUserId`)
);
