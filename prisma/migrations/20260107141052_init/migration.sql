-- AlterTable
ALTER TABLE `Recorrencia` ADD COLUMN `diaDoMes` INTEGER NULL,
    ADD COLUMN `nDiaUtil` INTEGER NULL,
    ADD COLUMN `regraMensal` ENUM('DIA_DO_MES', 'N_DIA_UTIL') NULL;
