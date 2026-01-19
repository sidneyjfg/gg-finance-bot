-- 1️⃣ Cria a coluna como NULL (temporário)
ALTER TABLE `Usuario`
ADD COLUMN `userId` VARCHAR(191) NULL;

-- 2️⃣ Preenche userId usando o identificador atual
UPDATE `Usuario`
SET userId = CONCAT(telefone, '@c.us')
WHERE userId IS NULL;

-- 3️⃣ Torna o campo obrigatório
ALTER TABLE `Usuario`
MODIFY `userId` VARCHAR(191) NOT NULL;

-- 4️⃣ Cria índice único
CREATE UNIQUE INDEX `Usuario_userId_key`
ON `Usuario`(`userId`);
