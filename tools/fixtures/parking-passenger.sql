-- 停车联调的副驾快照。调用方传入测试用户编号和宠物目录的 rules.initialFood。
-- 在同一 MySQL 会话先 SET @test_owner 和 @initial_food，再执行本文件。
-- 仅补缺失记录，已有宠物、口粮和跨游戏钱包余额均沿用原值。
START TRANSACTION;
SET @parking_owner = NULL;
SELECT oId INTO @parking_owner FROM symphony_user
WHERE oId = BINARY @test_owner AND userRole = 'defaultRole' AND userAppRole = 0
  AND (userName = 'parkDriveA' OR userName REGEXP '^parkLocal[0-9a-f]{8}$')
  AND DATABASE() REGEXP '^fishpi_parking_check_[0-9]+$' AND @initial_food >= 0
FOR UPDATE;
SET @fixture_now = CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED);

INSERT INTO symphony_user_pet
  (oId, userId, speciesId, name, hunger, water, mood, energy, experience, friendship, lastCalculatedAt,
   activityKind, activityStartedAt, activityEndsAt, petAvailableAt, playAvailableAt, adoptedAt, updatedAt)
SELECT @parking_owner, @parking_owner, 'hexiaotun', '荷小豚', 100, 100, 100, 100, 0, 0, @fixture_now,
       '', 0, 0, 0, 0, @fixture_now, @fixture_now
WHERE @parking_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM symphony_user_pet WHERE userId = BINARY @parking_owner);

INSERT INTO symphony_pet_account (oId, coins, supplyDate, growthDate, growthCount, createdAt, updatedAt)
SELECT @parking_owner, 0, '', '', 0, @fixture_now, @fixture_now
WHERE @parking_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM symphony_pet_account WHERE oId = BINARY @parking_owner);

INSERT INTO symphony_game_wallet (oId, coins)
SELECT @parking_owner, 0
WHERE @parking_owner IS NOT NULL AND NOT EXISTS (SELECT 1 FROM symphony_game_wallet WHERE oId = BINARY @parking_owner);

INSERT INTO symphony_pet_inventory (oId, userId, itemId, quantity, updatedAt)
SELECT CONCAT(@parking_owner, ':food'), @parking_owner, 'food', @initial_food, @fixture_now
WHERE @parking_owner IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM symphony_pet_inventory WHERE userId = BINARY @parking_owner AND itemId = 'food'
);
COMMIT;
