ALTER TABLE `evaluation_items` RENAME COLUMN `atuacao` TO `desempenho_papel`;--> statement-breakpoint
ALTER TABLE `evaluation_items` MODIFY COLUMN `desempenho_papel` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `evaluation_items` MODIFY COLUMN `pontualidade` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `evaluation_items` MODIFY COLUMN `dominio` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `evaluation_items` MODIFY COLUMN `participacao` decimal(4,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `evaluation_items` ADD `pesquisa_metas` decimal(4,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `evaluation_items` DROP COLUMN `metas`;