ALTER TABLE `tutorial_eval_drafts` MODIFY COLUMN `organizacao` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_eval_drafts` MODIFY COLUMN `cooperacao` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_eval_drafts` MODIFY COLUMN `conteudo` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_eval_drafts` MODIFY COLUMN `objetivo` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_eval_drafts` MODIFY COLUMN `metas` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_evaluations` MODIFY COLUMN `organizacao` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_evaluations` MODIFY COLUMN `cooperacao` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_evaluations` MODIFY COLUMN `conteudo` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_evaluations` MODIFY COLUMN `objetivo` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `tutorial_evaluations` MODIFY COLUMN `metas` decimal(4,2) NOT NULL DEFAULT '0';