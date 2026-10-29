-- Frozen relational baseline. No runtime model/schema generation.
CREATE TABLE `astrologyproviders` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `displayTitle` VARCHAR(120) NOT NULL,
  `bio` VARCHAR(1200) NOT NULL,
  `revealIdentity` TINYINT(1) NULL,
  `serviceType` LONGTEXT NULL,
  `fee` DOUBLE NULL,
  `currency` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `rejectionReason` VARCHAR(400) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_astrologyproviders_user_unique` (`user`),
  KEY `ix_astrologyproviders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `astrologyproviders__skills` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_astrologyproviders__skills_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `auditlogs` (
  `actor` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `details` VARCHAR(500) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_auditlogs_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `broadcasttickers` (
  `text` VARCHAR(500) NOT NULL,
  `type` VARCHAR(255) NULL,
  `priority` DOUBLE NULL,
  `enabled` TINYINT(1) NULL,
  `startsAt` DATETIME(3) NULL,
  `endsAt` DATETIME(3) NULL,
  `createdBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_broadcasttickers_type` (`type`),
  KEY `ix_broadcasttickers_priority` (`priority`),
  KEY `ix_broadcasttickers_enabled` (`enabled`),
  KEY `ix_broadcasttickers_startsAt` (`startsAt`),
  KEY `ix_broadcasttickers_endsAt` (`endsAt`),
  KEY `ix_broadcasttickers_enabled_priority_createdAt` (`enabled`, `priority`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `consultationproviders` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `category` VARCHAR(255) NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `specialty` VARCHAR(120) NOT NULL,
  `bio` VARCHAR(1200) NOT NULL,
  `serviceType` LONGTEXT NULL,
  `fee` DOUBLE NULL,
  `currency` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `rejectionReason` VARCHAR(400) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_consultationproviders_user` (`user`),
  KEY `ix_consultationproviders_category` (`category`),
  KEY `ix_consultationproviders_status` (`status`),
  UNIQUE KEY `ix_consultationproviders_user_category_unique` (`user`, `category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `conversations` (
  `lastMessage` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `unread` JSON NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `conversations__participants` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_conversations__participants_parent` (`parent_id`, `position`),
  KEY `ix_conversations__participants_value` (`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `datasyncrecords` (
  `entityType` VARCHAR(255) NOT NULL,
  `entityId` VARCHAR(255) NOT NULL,
  `source` VARCHAR(255) NOT NULL,
  `target` VARCHAR(255) NOT NULL,
  `operation` LONGTEXT NULL,
  `version` DOUBLE NULL,
  `status` VARCHAR(255) NULL,
  `payload` JSON NULL,
  `attempts` DOUBLE NULL,
  `nextAttemptAt` DATETIME(3) NULL,
  `lastError` LONGTEXT NULL,
  `syncedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_datasyncrecords_entityType` (`entityType`),
  KEY `ix_datasyncrecords_entityId` (`entityId`),
  KEY `ix_datasyncrecords_source` (`source`),
  KEY `ix_datasyncrecords_target` (`target`),
  KEY `ix_datasyncrecords_status` (`status`),
  KEY `ix_datasyncrecords_nextAttemptAt` (`nextAttemptAt`),
  KEY `ix_datasyncrecords_entityType_entityId_target_status` (`entityType`(192), `entityId`(192), `target`(192), `status`(192))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `developermfas` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `pairedPhone` LONGTEXT NULL,
  `phoneSecretHash` LONGTEXT NULL,
  `phonePairedAt` DATETIME(3) NULL,
  `registrationChallenge` LONGTEXT NULL,
  `authenticationChallenge` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_developermfas_user_unique` (`user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `developermfas__credentials` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `id` LONGTEXT NOT NULL,
  `publicKey` LONGTEXT NOT NULL,
  `counter` DOUBLE NULL,
  `deviceType` LONGTEXT NULL,
  `backedUp` TINYINT(1) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_developermfas__credentials_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `developermfas__credentials__transports` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_developermfas__credentials__transports_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `developermfas__phoneChallenges` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `challengeId` LONGTEXT NULL,
  `approved` TINYINT(1) NULL,
  `expiresAt` DATETIME(3) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_developermfas__phoneChallenges_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `follows` (
  `follower` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `following` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_follows_follower` (`follower`),
  KEY `ix_follows_following` (`following`),
  UNIQUE KEY `ix_follows_follower_following_unique` (`follower`, `following`),
  KEY `ix_follows_following_createdAt` (`following`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `friendrequests` (
  `sender` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `receiver` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `pairKey` VARCHAR(255) NULL,
  `source` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  `_idx_ix_friendrequests_pairKey_unique_0` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `pairKey` IS NOT NULL AND `pairKey` > CONVERT(X'' USING utf8mb4) THEN `pairKey` ELSE NULL END) STORED,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_friendrequests_sender_receiver_unique` (`sender`, `receiver`),
  UNIQUE KEY `ix_friendrequests_pairKey_unique` (`_idx_ix_friendrequests_pairKey_unique_0`),
  KEY `ix_friendrequests_receiver_status` (`receiver`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gameprofiles` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `points` DOUBLE NULL,
  `xp` DOUBLE NULL,
  `level` DOUBLE NULL,
  `streak` DOUBLE NULL,
  `bestStreak` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_gameprofiles_user_unique` (`user`),
  KEY `ix_gameprofiles_points` (`points`),
  KEY `ix_gameprofiles_points_updatedAt` (`points`, `updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gameprofiles__chess` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `played` DOUBLE NULL,
  `wins` DOUBLE NULL,
  `losses` DOUBLE NULL,
  `draws` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gameprofiles__chess_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gameprofiles__domino` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `played` DOUBLE NULL,
  `wins` DOUBLE NULL,
  `losses` DOUBLE NULL,
  `draws` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gameprofiles__domino_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gameprofiles__tawla` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `played` DOUBLE NULL,
  `wins` DOUBLE NULL,
  `losses` DOUBLE NULL,
  `draws` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gameprofiles__tawla_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gameprofiles__cards` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `played` DOUBLE NULL,
  `wins` DOUBLE NULL,
  `losses` DOUBLE NULL,
  `draws` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gameprofiles__cards_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamerooms` (
  `roomCode` VARCHAR(255) NULL,
  `name` VARCHAR(100) NULL,
  `gameType` VARCHAR(255) NULL,
  `visibility` VARCHAR(255) NULL,
  `maxPlayers` DOUBLE NULL,
  `teamMode` LONGTEXT NULL,
  `scoreTarget` DOUBLE NULL,
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `spectatorsPolicy` LONGTEXT NULL,
  `voiceEnabled` TINYINT(1) NULL,
  `voicePolicy` LONGTEXT NULL,
  `liveEnabled` TINYINT(1) NULL,
  `isPaid` TINYINT(1) NULL,
  `price` DOUBLE NULL,
  `currency` VARCHAR(8) NULL,
  `isActive` TINYINT(1) NULL,
  `lastOpenedAt` DATETIME(3) NULL,
  `abandonedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `savedAt` DATETIME(3) NULL,
  `gameState.status` VARCHAR(255) NULL,
  `gameState.turn` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `gameState.scores` JSON NULL,
  `gameState.teamScores` JSON NULL,
  `gameState.moveCount` DOUBLE NULL,
  `gameState.engineState` JSON NULL,
  `gameState.updatedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_gamerooms_roomCode` (`roomCode`),
  KEY `ix_gamerooms_gameType` (`gameType`),
  KEY `ix_gamerooms_visibility` (`visibility`),
  KEY `ix_gamerooms_owner` (`owner`),
  KEY `ix_gamerooms_isPaid` (`isPaid`),
  KEY `ix_gamerooms_isActive` (`isActive`),
  KEY `ix_gamerooms_lastOpenedAt` (`lastOpenedAt`),
  KEY `ix_gamerooms_expiresAt` (`expiresAt`),
  KEY `ix_gamerooms_gameType_visibility_gameState_status_updatedAt` (`gameType`, `visibility`, `gameState.status`, `updatedAt`),
  KEY `ix_gamerooms_roomCode_isActive` (`roomCode`, `isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamerooms__players` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gamerooms__players_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamerooms__reservations` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `seatIndex` DOUBLE NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gamerooms__reservations_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamerooms__spectators` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gamerooms__spectators_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamerooms__gameState_board` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` JSON NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_gamerooms__gameState_board_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `gamespectatorinvites` (
  `room` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `inviter` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `invitee` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `status` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_gamespectatorinvites_room` (`room`),
  KEY `ix_gamespectatorinvites_invitee` (`invitee`),
  UNIQUE KEY `ix_gamespectatorinvites_room_inviter_invitee_unique` (`room`, `inviter`, `invitee`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups` (
  `name` VARCHAR(120) NOT NULL,
  `description` LONGTEXT NULL,
  `privacy` VARCHAR(255) NULL,
  `joinApproval` VARCHAR(255) NULL,
  `roomType` VARCHAR(255) NULL,
  `teacherBroadcast` TINYINT(1) NULL,
  `teacherProfile` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `isOfficial` TINYINT(1) NULL,
  `isLive` TINYINT(1) NULL,
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `isLocked` TINYINT(1) NULL,
  `allowMemberAudio` TINYINT(1) NULL,
  `allowMemberVideo` TINYINT(1) NULL,
  `maxSpeakers` DOUBLE NULL,
  `coverUrl` LONGTEXT NULL,
  `isActive` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_groups_privacy` (`privacy`),
  KEY `ix_groups_joinApproval` (`joinApproval`),
  KEY `ix_groups_roomType` (`roomType`),
  KEY `ix_groups_teacherBroadcast` (`teacherBroadcast`),
  KEY `ix_groups_isOfficial` (`isOfficial`),
  KEY `ix_groups_isLive` (`isLive`),
  KEY `ix_groups_owner` (`owner`),
  KEY `ix_groups_isActive` (`isActive`),
  FULLTEXT KEY `ix_groups_name_description` (`name`, `description`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__admins` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__admins_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__moderators` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__moderators_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__members` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__members_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__pendingMembers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__pendingMembers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__mutedMembers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__mutedMembers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groups__bannedMembers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_groups__bannedMembers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groupmessages` (
  `group` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sender` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` LONGTEXT NULL,
  `attachment.url` LONGTEXT NULL,
  `attachment.type` LONGTEXT NULL,
  `attachment.mimeType` LONGTEXT NULL,
  `attachment.originalName` LONGTEXT NULL,
  `attachment.size` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_groupmessages_group` (`group`),
  KEY `ix_groupmessages_sender` (`sender`),
  KEY `ix_groupmessages_group_createdAt` (`group`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `groupreports` (
  `group` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reporter` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `targetUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `message` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reason` VARCHAR(500) NOT NULL,
  `status` VARCHAR(255) NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `resolution` VARCHAR(500) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_groupreports_group` (`group`),
  KEY `ix_groupreports_reporter` (`reporter`),
  KEY `ix_groupreports_status` (`status`),
  KEY `ix_groupreports_group_reporter_createdAt` (`group`, `reporter`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `guardiancomplaints` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject` VARCHAR(200) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `status` VARCHAR(255) NULL,
  `adminResponse.text` LONGTEXT NULL,
  `adminResponse.respondedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `adminResponse.respondedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_guardiancomplaints_guardian` (`guardian`),
  KEY `ix_guardiancomplaints_student` (`student`),
  KEY `ix_guardiancomplaints_status` (`status`),
  KEY `ix_guardiancomplaints_guardian_status_createdAt` (`guardian`, `status`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `guardiancomplaints__attachments` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NULL,
  `originalName` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_guardiancomplaints__attachments_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `guardianconsents` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `consentType` VARCHAR(255) NOT NULL,
  `granted` TINYINT(1) NOT NULL,
  `version` LONGTEXT NOT NULL,
  `text` LONGTEXT NOT NULL,
  `decidedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_guardianconsents_guardian` (`guardian`),
  KEY `ix_guardianconsents_student` (`student`),
  KEY `ix_guardianconsents_isSynthetic` (`isSynthetic`),
  KEY `ix_guardianconsents_syntheticBatch` (`syntheticBatch`),
  UNIQUE KEY `ix_guardianconsents_guardian_student_consentType_unique` (`guardian`, `student`, `consentType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `islamicposts` (
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `category` VARCHAR(255) NULL,
  `title` VARCHAR(180) NULL,
  `text` LONGTEXT NULL,
  `active` TINYINT(1) NULL,
  `sharedToGeneral` TINYINT(1) NULL,
  `generalPostId` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_islamicposts_author` (`author`),
  KEY `ix_islamicposts_category` (`category`),
  KEY `ix_islamicposts_active` (`active`),
  KEY `ix_islamicposts_category_createdAt` (`category`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `islamicposts__media` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NOT NULL,
  `type` LONGTEXT NOT NULL,
  `mimeType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  `originalName` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_islamicposts__media_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `islamicposts__likes` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_islamicposts__likes_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `islamicposts__comments` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` VARCHAR(2000) NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_islamicposts__comments_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `messages` (
  `conversation` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sender` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` LONGTEXT NULL,
  `text` LONGTEXT NULL,
  `replyTo` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `deliveredAt` DATETIME(3) NULL,
  `readAt` DATETIME(3) NULL,
  `deletedForEveryone` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_messages_conversation` (`conversation`),
  KEY `ix_messages_sender` (`sender`),
  KEY `ix_messages_conversation_createdAt` (`conversation`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `messages__attachment` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `mimeType` LONGTEXT NOT NULL,
  `size` DOUBLE NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_messages__attachment_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `messages__deletedFor` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_messages__deletedFor_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `notifications` (
  `recipient` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `actor` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` VARCHAR(255) NOT NULL,
  `targetId` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `href` LONGTEXT NOT NULL,
  `text` VARCHAR(300) NULL,
  `readAt` DATETIME(3) NULL,
  `groupKey` VARCHAR(255) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_notifications_recipient` (`recipient`),
  KEY `ix_notifications_type` (`type`),
  KEY `ix_notifications_readAt` (`readAt`),
  KEY `ix_notifications_groupKey` (`groupKey`),
  KEY `ix_notifications_recipient_createdAt` (`recipient`, `createdAt`),
  KEY `ix_notifications_recipient_groupKey_createdAt` (`recipient`, `groupKey`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `phonecontacts` (
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NULL,
  `phone` VARCHAR(255) NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_phonecontacts_owner` (`owner`),
  UNIQUE KEY `ix_phonecontacts_owner_phone_unique` (`owner`, `phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `posts` (
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` LONGTEXT NULL,
  `type` VARCHAR(255) NULL,
  `visibility` VARCHAR(255) NULL,
  `adStatus` VARCHAR(255) NULL,
  `adTitle` VARCHAR(120) NULL,
  `adContact` VARCHAR(160) NULL,
  `adCategory` VARCHAR(80) NULL,
  `adReviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `adReviewedAt` DATETIME(3) NULL,
  `adReviewNote` VARCHAR(500) NULL,
  `sharesCount` DOUBLE NULL,
  `commentsCount` DOUBLE NULL,
  `active` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_posts_author` (`author`),
  KEY `ix_posts_type` (`type`),
  KEY `ix_posts_visibility` (`visibility`),
  KEY `ix_posts_adStatus` (`adStatus`),
  KEY `ix_posts_active` (`active`),
  KEY `ix_posts_isSynthetic` (`isSynthetic`),
  KEY `ix_posts_syntheticBatch` (`syntheticBatch`),
  KEY `ix_posts_createdAt` (`createdAt`),
  KEY `ix_posts_type_adStatus_createdAt` (`type`, `adStatus`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `posts__media` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NOT NULL,
  `fallbackUrl` LONGTEXT NULL,
  `storageKey` LONGTEXT NULL,
  `storage` LONGTEXT NULL,
  `type` LONGTEXT NOT NULL,
  `mimeType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_posts__media_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `posts__likes` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_posts__likes_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `postcomments` (
  `post` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` VARCHAR(2000) NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_postcomments_post` (`post`),
  KEY `ix_postcomments_author` (`author`),
  KEY `ix_postcomments_isSynthetic` (`isSynthetic`),
  KEY `ix_postcomments_syntheticBatch` (`syntheticBatch`),
  KEY `ix_postcomments_post_createdAt` (`post`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `reels` (
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` LONGTEXT NULL,
  `visibility` VARCHAR(255) NULL,
  `expiresAt` DATETIME(3) NULL,
  `active` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_reels_author` (`author`),
  KEY `ix_reels_visibility` (`visibility`),
  KEY `ix_reels_expiresAt` (`expiresAt`),
  KEY `ix_reels_active` (`active`),
  KEY `ix_reels_isSynthetic` (`isSynthetic`),
  KEY `ix_reels_syntheticBatch` (`syntheticBatch`),
  KEY `ix_reels_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `reels__media` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NULL,
  `fallbackUrl` LONGTEXT NULL,
  `storageKey` LONGTEXT NULL,
  `storage` LONGTEXT NULL,
  `type` LONGTEXT NULL,
  `mimeType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_reels__media_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `reels__likes` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_reels__likes_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `reels__comments` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` VARCHAR(2000) NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_reels__comments_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `reels__savedBy` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_reels__savedBy_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolannouncements` (
  `title` VARCHAR(180) NOT NULL,
  `body` LONGTEXT NOT NULL,
  `audience` VARCHAR(255) NULL,
  `stage` LONGTEXT NULL,
  `grade` LONGTEXT NULL,
  `publishedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  `active` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolannouncements_audience` (`audience`),
  KEY `ix_schoolannouncements_publishedAt` (`publishedAt`),
  KEY `ix_schoolannouncements_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolassignments` (
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacherProfile` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(255) NOT NULL,
  `section` LONGTEXT NULL,
  `classroom` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `subject` VARCHAR(120) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` LONGTEXT NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `maxScore` DOUBLE NOT NULL,
  `allowLateSubmission` TINYINT(1) NULL,
  `status` VARCHAR(255) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolassignments_teacher` (`teacher`),
  KEY `ix_schoolassignments_teacherProfile` (`teacherProfile`),
  KEY `ix_schoolassignments_stage` (`stage`),
  KEY `ix_schoolassignments_grade` (`grade`),
  KEY `ix_schoolassignments_subject` (`subject`),
  KEY `ix_schoolassignments_dueAt` (`dueAt`),
  KEY `ix_schoolassignments_status` (`status`),
  KEY `ix_schoolassignments_stage_grade_subject` (`stage`, `grade`, `subject`),
  KEY `ix_schoolassignments_teacher_status` (`teacher`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolassignments__attachments` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` LONGTEXT NULL,
  `url` LONGTEXT NULL,
  `fileType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolassignments__attachments_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolassignments__assignedStudents` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolassignments__assignedStudents_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolassignmentsubmissions` (
  `assignment` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `studentUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `content` LONGTEXT NULL,
  `submittedAt` DATETIME(3) NULL,
  `status` VARCHAR(255) NULL,
  `score` DOUBLE NULL,
  `maxScore` DOUBLE NULL,
  `teacherFeedback` VARCHAR(2000) NULL,
  `gradedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `gradedAt` DATETIME(3) NULL,
  `gradeRecord` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `resubmissionCount` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolassignmentsubmissions_assignment` (`assignment`),
  KEY `ix_schoolassignmentsubmissions_student` (`student`),
  KEY `ix_schoolassignmentsubmissions_studentUser` (`studentUser`),
  KEY `ix_schoolassignmentsubmissions_status` (`status`),
  UNIQUE KEY `ix_schoolassignmentsubmissions_assignment_student_unique` (`assignment`, `student`),
  KEY `ix_schoolassignmentsubmissions_student_status` (`student`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolassignmentsubmissions__attachments` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` LONGTEXT NULL,
  `url` LONGTEXT NULL,
  `fileType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolassignmentsubmissions__attachments_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolattendancerecords` (
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `scheduleEvent` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `stage` LONGTEXT NULL,
  `grade` LONGTEXT NULL,
  `section` LONGTEXT NULL,
  `subject` LONGTEXT NULL,
  `date` DATETIME(3) NULL,
  `status` LONGTEXT NOT NULL,
  `notes` VARCHAR(500) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolattendancerecords_student` (`student`),
  KEY `ix_schoolattendancerecords_teacher` (`teacher`),
  KEY `ix_schoolattendancerecords_scheduleEvent` (`scheduleEvent`),
  KEY `ix_schoolattendancerecords_date` (`date`),
  KEY `ix_schoolattendancerecords_isSynthetic` (`isSynthetic`),
  KEY `ix_schoolattendancerecords_syntheticBatch` (`syntheticBatch`),
  KEY `ix_schoolattendancerecords_student_date` (`student`, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolclassrooms` (
  `code` VARCHAR(255) NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacherName` VARCHAR(100) NOT NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(80) NOT NULL,
  `subject` VARCHAR(120) NOT NULL,
  `lesson` VARCHAR(160) NULL,
  `status` VARCHAR(255) NULL,
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `whiteboard.drawing` LONGTEXT NULL,
  `whiteboard.updatedAt` DATETIME(3) NULL,
  `answeringStudent` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `studentMayWrite` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_schoolclassrooms_code_unique` (`code`),
  KEY `ix_schoolclassrooms_teacher` (`teacher`),
  KEY `ix_schoolclassrooms_status` (`status`),
  KEY `ix_schoolclassrooms_status_stage_grade_subject` (`status`, `stage`, `grade`, `subject`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolclassrooms__participants` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `role` LONGTEXT NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `permissions.camera` TINYINT(1) NULL,
  `permissions.voice` TINYINT(1) NULL,
  `joinedAt` DATETIME(3) NULL,
  `leftAt` DATETIME(3) NULL,
  `online` TINYINT(1) NULL,
  `handRaised` TINYINT(1) NULL,
  `handRaisedAt` DATETIME(3) NULL,
  `mutedByTeacher` TINYINT(1) NULL,
  `media.camera` TINYINT(1) NULL,
  `media.mic` TINYINT(1) NULL,
  `kicked` TINYINT(1) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolclassrooms__participants_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolclassrooms__participants__attendance` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `joinedAt` DATETIME(3) NULL,
  `leftAt` DATETIME(3) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolclassrooms__participants__attendance_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolenrollmentrequests` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `requestedRole` VARCHAR(255) NOT NULL,
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `studentName` VARCHAR(100) NULL,
  `studentUsername` VARCHAR(30) NULL,
  `guardianPhone` LONGTEXT NULL,
  `relationship` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `stage` LONGTEXT NULL,
  `grade` LONGTEXT NULL,
  `note` VARCHAR(1000) NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reviewedAt` DATETIME(3) NULL,
  `rejectionReason` VARCHAR(1000) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  `_idx_ix_schoolenrollmentrequests_user_requestedRole_unique_0` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN `guardian` IS NULL THEN `user` ELSE NULL END) STORED,
  `_idx_ix_schoolenrollmentrequests_user_requestedRole_unique_1` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `guardian` IS NULL THEN `requestedRole` ELSE NULL END) STORED,
  `_idx_ix_schoolenrollmentrequests_guardian_stude_58fd9cd6e437` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN `guardian` IS NOT NULL AND `studentUsername` IS NOT NULL AND `studentUsername` > CONVERT(X'' USING utf8mb4) THEN `guardian` ELSE NULL END) STORED,
  `_idx_ix_schoolenrollmentrequests_guardian_stude_7017837c8d34` VARCHAR(30) GENERATED ALWAYS AS (CASE WHEN `guardian` IS NOT NULL AND `studentUsername` IS NOT NULL AND `studentUsername` > CONVERT(X'' USING utf8mb4) THEN `studentUsername` ELSE NULL END) STORED,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolenrollmentrequests_user` (`user`),
  KEY `ix_schoolenrollmentrequests_requestedRole` (`requestedRole`),
  KEY `ix_schoolenrollmentrequests_guardian` (`guardian`),
  KEY `ix_schoolenrollmentrequests_status` (`status`),
  KEY `ix_schoolenrollmentrequests_isSynthetic` (`isSynthetic`),
  KEY `ix_schoolenrollmentrequests_syntheticBatch` (`syntheticBatch`),
  UNIQUE KEY `ix_schoolenrollmentrequests_user_requestedRole_unique` (`_idx_ix_schoolenrollmentrequests_user_requestedRole_unique_0`, `_idx_ix_schoolenrollmentrequests_user_requestedRole_unique_1`),
  UNIQUE KEY `ix_schoolenrollmentrequests_guardian_studentUsername_unique` (`_idx_ix_schoolenrollmentrequests_guardian_stude_58fd9cd6e437`, `_idx_ix_schoolenrollmentrequests_guardian_stude_7017837c8d34`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolenrollmentrequests__consents` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `consentType` LONGTEXT NULL,
  `granted` TINYINT(1) NULL,
  `decidedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolenrollmentrequests__consents_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolenrollmentrequests__subjects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolenrollmentrequests__subjects_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schooleventschedules` (
  `type` VARCHAR(255) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `description` VARCHAR(1000) NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacherName` VARCHAR(100) NOT NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(80) NOT NULL,
  `section` VARCHAR(40) NULL,
  `subject` VARCHAR(120) NOT NULL,
  `lesson` VARCHAR(160) NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `durationMinutes` DOUBLE NULL,
  `status` VARCHAR(255) NULL,
  `recordedResourceUrl` LONGTEXT NULL,
  `examConfig.maxScore` DOUBLE NULL,
  `examConfig.passingScore` DOUBLE NULL,
  `examConfig.instructions` LONGTEXT NULL,
  `examConfig.notifiedManagement` TINYINT(1) NULL,
  `createdBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schooleventschedules_type` (`type`),
  KEY `ix_schooleventschedules_teacher` (`teacher`),
  KEY `ix_schooleventschedules_scheduledAt` (`scheduledAt`),
  KEY `ix_schooleventschedules_status` (`status`),
  KEY `ix_schooleventschedules_isSynthetic` (`isSynthetic`),
  KEY `ix_schooleventschedules_syntheticBatch` (`syntheticBatch`),
  KEY `ix_schooleventschedules_scheduledAt_stage_grade_status` (`scheduledAt`, `stage`, `grade`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schooleventschedules__students` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schooleventschedules__students_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolgraderecords` (
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `scheduleEvent` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `subject` VARCHAR(120) NOT NULL,
  `gradeType` LONGTEXT NULL,
  `title` VARCHAR(180) NOT NULL,
  `score` DOUBLE NOT NULL,
  `maxScore` DOUBLE NOT NULL,
  `notes` VARCHAR(1000) NULL,
  `recordedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolgraderecords_student` (`student`),
  KEY `ix_schoolgraderecords_teacher` (`teacher`),
  KEY `ix_schoolgraderecords_scheduleEvent` (`scheduleEvent`),
  KEY `ix_schoolgraderecords_isSynthetic` (`isSynthetic`),
  KEY `ix_schoolgraderecords_syntheticBatch` (`syntheticBatch`),
  KEY `ix_schoolgraderecords_student_subject_recordedAt` (`student`, `subject`, `recordedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolguardians` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `relationship` LONGTEXT NULL,
  `contactPhone` LONGTEXT NULL,
  `contactMethod` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_schoolguardians_user_unique` (`user`),
  KEY `ix_schoolguardians_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolguardians__students` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolguardians__students_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolguardiannotifications` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `type` VARCHAR(255) NOT NULL,
  `subject` LONGTEXT NULL,
  `title` LONGTEXT NOT NULL,
  `message` VARCHAR(2000) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `meta` JSON NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolguardiannotifications_guardian` (`guardian`),
  KEY `ix_schoolguardiannotifications_student` (`student`),
  KEY `ix_schoolguardiannotifications_teacher` (`teacher`),
  KEY `ix_schoolguardiannotifications_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolguardianrequests` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` LONGTEXT NULL,
  `title` VARCHAR(180) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `status` VARCHAR(255) NULL,
  `response` LONGTEXT NULL,
  `resolvedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolguardianrequests_guardian` (`guardian`),
  KEY `ix_schoolguardianrequests_student` (`student`),
  KEY `ix_schoolguardianrequests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolknowledgesources` (
  `title` LONGTEXT NOT NULL,
  `sourceType` VARCHAR(255) NOT NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `chapter` LONGTEXT NULL,
  `lesson` VARCHAR(255) NULL,
  `year` DOUBLE NULL,
  `page` LONGTEXT NULL,
  `question` LONGTEXT NULL,
  `modelAnswer` LONGTEXT NULL,
  `content` LONGTEXT NOT NULL,
  `sourceUrl` LONGTEXT NULL,
  `license` LONGTEXT NULL,
  `verified` TINYINT(1) NULL,
  `uploadedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `file.url` LONGTEXT NULL,
  `file.originalName` LONGTEXT NULL,
  `file.mimeType` LONGTEXT NULL,
  `file.size` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolknowledgesources_sourceType` (`sourceType`),
  KEY `ix_schoolknowledgesources_stage` (`stage`),
  KEY `ix_schoolknowledgesources_grade` (`grade`),
  KEY `ix_schoolknowledgesources_subject` (`subject`),
  KEY `ix_schoolknowledgesources_lesson` (`lesson`),
  KEY `ix_schoolknowledgesources_verified` (`verified`),
  KEY `ix_schoolknowledgesources_uploadedBy` (`uploadedBy`),
  KEY `ix_schoolknowledgesources_stage_grade_subject_l_385b8c11dbf5` (`stage`(191), `grade`(191), `subject`(191), `lesson`(191), `verified`),
  FULLTEXT KEY `ft_schoolknowledgesources` (`title`, `content`, `question`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolknowledgesources__keywords` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolknowledgesources__keywords_parent` (`parent_id`, `position`),
  FULLTEXT KEY `ft_schoolknowledgesources__keywords_value` (`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoollearningrecords` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `session` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `subject` VARCHAR(255) NULL,
  `lesson` VARCHAR(255) NULL,
  `question` LONGTEXT NOT NULL,
  `answer` LONGTEXT NULL,
  `provider` LONGTEXT NULL,
  `model` LONGTEXT NULL,
  `correct` TINYINT(1) NULL,
  `score` DOUBLE NULL,
  `maxScore` DOUBLE NULL,
  `feedback` LONGTEXT NULL,
  `errorTag` VARCHAR(200) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoollearningrecords_guardian` (`guardian`),
  KEY `ix_schoollearningrecords_student` (`student`),
  KEY `ix_schoollearningrecords_session` (`session`),
  KEY `ix_schoollearningrecords_subject` (`subject`),
  KEY `ix_schoollearningrecords_lesson` (`lesson`),
  KEY `ix_schoollearningrecords_guardian_student_createdAt` (`guardian`, `student`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoollearningrecords__sources` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `title` LONGTEXT NULL,
  `page` LONGTEXT NULL,
  `sourceType` LONGTEXT NULL,
  `year` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoollearningrecords__sources_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolschedules` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject` LONGTEXT NOT NULL,
  `title` LONGTEXT NULL,
  `scheduledAt` DATETIME(3) NOT NULL,
  `durationMinutes` DOUBLE NULL,
  `reminderMinutes` DOUBLE NULL,
  `status` LONGTEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `parentMessage` VARCHAR(1000) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolschedules_guardian` (`guardian`),
  KEY `ix_schoolschedules_student` (`student`),
  KEY `ix_schoolschedules_scheduledAt` (`scheduledAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolsessions` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `mode` LONGTEXT NULL,
  `subject` LONGTEXT NULL,
  `lesson` LONGTEXT NULL,
  `status` LONGTEXT NULL,
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `attention.responses` DOUBLE NULL,
  `attention.unanswered` DOUBLE NULL,
  `attention.activeMinutes` DOUBLE NULL,
  `score` DOUBLE NULL,
  `maxScore` DOUBLE NULL,
  `teacherNote` VARCHAR(2000) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolsessions_guardian` (`guardian`),
  KEY `ix_schoolsessions_student` (`student`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstaffrequests` (
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `type` LONGTEXT NULL,
  `title` VARCHAR(180) NOT NULL,
  `details` LONGTEXT NOT NULL,
  `status` VARCHAR(255) NULL,
  `response` LONGTEXT NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reviewedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolstaffrequests_teacher` (`teacher`),
  KEY `ix_schoolstaffrequests_status` (`status`),
  KEY `ix_schoolstaffrequests_teacher_createdAt` (`teacher`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudents` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `stage` LONGTEXT NOT NULL,
  `grade` LONGTEXT NOT NULL,
  `section` LONGTEXT NULL,
  `studentUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `assignedVirtualTeacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `status` VARCHAR(255) NULL,
  `registeredBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `registrationDate` DATETIME(3) NULL,
  `parentApproved` TINYINT(1) NULL,
  `active` TINYINT(1) NULL,
  `learningPermissions.voice` TINYINT(1) NULL,
  `learningPermissions.camera` TINYINT(1) NULL,
  `learningPermissions.updatedAt` DATETIME(3) NULL,
  `progress.average` DOUBLE NULL,
  `progress.sessions` DOUBLE NULL,
  `progress.answered` DOUBLE NULL,
  `trialStartedAt` DATETIME(3) NULL,
  `trialEndsAt` DATETIME(3) NULL,
  `trialStatus` VARCHAR(255) NULL,
  `isTestBot` TINYINT(1) NULL,
  `simulationBatch` VARCHAR(255) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  `_idx_studentUser_linked_unique_0` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN `studentUser` IS NOT NULL THEN `studentUser` ELSE NULL END) STORED,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolstudents_guardian` (`guardian`),
  KEY `ix_schoolstudents_status` (`status`),
  KEY `ix_schoolstudents_trialStatus` (`trialStatus`),
  KEY `ix_schoolstudents_isTestBot` (`isTestBot`),
  KEY `ix_schoolstudents_simulationBatch` (`simulationBatch`),
  KEY `ix_schoolstudents_isSynthetic` (`isSynthetic`),
  KEY `ix_schoolstudents_syntheticBatch` (`syntheticBatch`),
  UNIQUE KEY `studentUser_linked_unique` (`_idx_studentUser_linked_unique_0`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudents__subjects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolstudents__subjects_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudents__assignedTeachers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `subject` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolstudents__assignedTeachers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudents__notes` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` VARCHAR(1000) NULL,
  `subject` LONGTEXT NULL,
  `createdAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolstudents__notes_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudents__scores` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject` LONGTEXT NULL,
  `lesson` LONGTEXT NULL,
  `score` DOUBLE NULL,
  `maxScore` DOUBLE NULL,
  `createdAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolstudents__scores_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolstudentreports` (
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `subject` LONGTEXT NULL,
  `level` LONGTEXT NULL,
  `participation` VARCHAR(1000) NULL,
  `homework` VARCHAR(1000) NULL,
  `learningBehavior` VARCHAR(1000) NULL,
  `recommendations` VARCHAR(2000) NULL,
  `visibleToGuardian` TINYINT(1) NULL,
  `createdBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolstudentreports_student` (`student`),
  KEY `ix_schoolstudentreports_teacher` (`teacher`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolsyncoperations` (
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `clientOpId` VARCHAR(255) NOT NULL,
  `type` LONGTEXT NOT NULL,
  `localId` VARCHAR(255) NULL,
  `status` VARCHAR(255) NULL,
  `result` JSON NULL,
  `error` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolsyncoperations_guardian` (`guardian`),
  KEY `ix_schoolsyncoperations_localId` (`localId`),
  KEY `ix_schoolsyncoperations_status` (`status`),
  UNIQUE KEY `ix_schoolsyncoperations_guardian_clientOpId_unique` (`guardian`, `clientOpId`),
  KEY `ix_schoolsyncoperations_guardian_localId` (`guardian`, `localId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `gender` LONGTEXT NULL,
  `phone` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `registeredBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_schoolteachers_user_unique` (`user`),
  KEY `ix_schoolteachers_status` (`status`),
  KEY `ix_schoolteachers_isSynthetic` (`isSynthetic`),
  KEY `ix_schoolteachers_syntheticBatch` (`syntheticBatch`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__subjects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__subjects_parent` (`parent_id`, `position`),
  KEY `ix_schoolteachers__subjects_value` (`value`(768))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__stages` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__stages_parent` (`parent_id`, `position`),
  KEY `ix_schoolteachers__stages_value` (`value`(768))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__grades` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__grades_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__sections` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__sections_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__scheduleSlots` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `day` LONGTEXT NOT NULL,
  `startTime` LONGTEXT NOT NULL,
  `endTime` LONGTEXT NOT NULL,
  `stage` LONGTEXT NOT NULL,
  `grade` LONGTEXT NOT NULL,
  `section` LONGTEXT NULL,
  `subject` LONGTEXT NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__scheduleSlots_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteachers__assignedStudents` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteachers__assignedStudents_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications` (
  `applicant` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `fullName` VARCHAR(100) NOT NULL,
  `phone` LONGTEXT NULL,
  `email` LONGTEXT NULL,
  `qualifications` VARCHAR(2000) NULL,
  `experience` VARCHAR(2000) NULL,
  `experienceYears` DOUBLE NULL,
  `bio` VARCHAR(2000) NULL,
  `notes` VARCHAR(2000) NULL,
  `status` VARCHAR(255) NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reviewedAt` DATETIME(3) NULL,
  `rejectionReason` VARCHAR(1000) NULL,
  `approvedTeacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolteacherapplications_applicant` (`applicant`),
  KEY `ix_schoolteacherapplications_status` (`status`),
  KEY `ix_schoolteacherapplications_applicant_status` (`applicant`, `status`),
  KEY `ix_schoolteacherapplications_status_createdAt` (`status`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications__subjects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherapplications__subjects_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications__specialties` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherapplications__specialties_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications__stages` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherapplications__stages_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications__grades` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherapplications__grades_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherapplications__sections` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherapplications__sections_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherstudentrequests` (
  `teacher` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `teacherUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `guardian` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` VARCHAR(255) NOT NULL,
  `requestedBy` LONGTEXT NOT NULL,
  `stage` LONGTEXT NOT NULL,
  `grade` LONGTEXT NOT NULL,
  `section` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `decidedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `decidedAt` DATETIME(3) NULL,
  `note` VARCHAR(1000) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolteacherstudentrequests_teacher` (`teacher`),
  KEY `ix_schoolteacherstudentrequests_teacherUser` (`teacherUser`),
  KEY `ix_schoolteacherstudentrequests_student` (`student`),
  KEY `ix_schoolteacherstudentrequests_guardian` (`guardian`),
  KEY `ix_schoolteacherstudentrequests_status` (`status`),
  KEY `ix_schoolteacherstudentrequests_teacher_student_kind_status` (`teacher`, `student`, `kind`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolteacherstudentrequests__subjects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_schoolteacherstudentrequests__subjects_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `schoolwhiteboards` (
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ownerType` LONGTEXT NULL,
  `title` VARCHAR(160) NOT NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(255) NOT NULL,
  `section` VARCHAR(255) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `lesson` LONGTEXT NULL,
  `visibility` LONGTEXT NULL,
  `strokes` JSON NULL,
  `notes` LONGTEXT NULL,
  `sharedWithVirtualTeacher` TINYINT(1) NULL,
  `archived` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_schoolwhiteboards_owner` (`owner`),
  KEY `ix_schoolwhiteboards_stage` (`stage`),
  KEY `ix_schoolwhiteboards_grade` (`grade`),
  KEY `ix_schoolwhiteboards_section` (`section`),
  KEY `ix_schoolwhiteboards_subject` (`subject`),
  KEY `ix_schoolwhiteboards_owner_stage_grade_section_subject` (`owner`, `stage`(153), `grade`(153), `section`(153), `subject`(153))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `serviceproviders` (
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` VARCHAR(255) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(1200) NULL,
  `governorate` VARCHAR(80) NOT NULL,
  `area` VARCHAR(100) NOT NULL,
  `address` VARCHAR(240) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `whatsapp` VARCHAR(30) NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `imageUrl` LONGTEXT NULL,
  `vehicleType` VARCHAR(80) NULL,
  `vehicleModel` VARCHAR(80) NULL,
  `availableForWork` TINYINT(1) NULL,
  `status` VARCHAR(255) NULL,
  `ratingAverage` DOUBLE NULL,
  `ratingCount` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_serviceproviders_owner` (`owner`),
  KEY `ix_serviceproviders_kind` (`kind`),
  KEY `ix_serviceproviders_category` (`category`),
  KEY `ix_serviceproviders_governorate` (`governorate`),
  KEY `ix_serviceproviders_availableForWork` (`availableForWork`),
  KEY `ix_serviceproviders_status` (`status`),
  KEY `ix_serviceproviders_kind_category_governorate_status` (`kind`, `category`, `governorate`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `servicerequests` (
  `requester` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `provider` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `providerOwner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` VARCHAR(255) NOT NULL,
  `requestType` VARCHAR(120) NULL,
  `description` VARCHAR(1800) NOT NULL,
  `pickupAddress` VARCHAR(300) NULL,
  `destination` VARCHAR(300) NULL,
  `phone` VARCHAR(40) NOT NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `status` VARCHAR(255) NULL,
  `providerNote` VARCHAR(600) NULL,
  `acceptedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_servicerequests_requester` (`requester`),
  KEY `ix_servicerequests_provider` (`provider`),
  KEY `ix_servicerequests_providerOwner` (`providerOwner`),
  KEY `ix_servicerequests_kind` (`kind`),
  KEY `ix_servicerequests_status` (`status`),
  KEY `ix_servicerequests_providerOwner_status_createdAt` (`providerOwner`, `status`, `createdAt`),
  KEY `ix_servicerequests_requester_createdAt` (`requester`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `smartfriends` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `slot` DOUBLE NULL,
  `name` VARCHAR(40) NULL,
  `gender` LONGTEXT NOT NULL,
  `age` DOUBLE NOT NULL,
  `avatar` LONGTEXT NULL,
  `avatarUrl` LONGTEXT NULL,
  `personality` LONGTEXT NULL,
  `dialect` LONGTEXT NULL,
  `conversationStyle` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_smartfriends_user` (`user`),
  UNIQUE KEY `ix_smartfriends_user_slot_unique` (`user`, `slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `smartfriends__interests` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(40) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_smartfriends__interests_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `smartfriendmessages` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `friend` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `roomId` VARCHAR(80) NULL,
  `role` LONGTEXT NOT NULL,
  `text` LONGTEXT NULL,
  `media.url` LONGTEXT NULL,
  `media.type` LONGTEXT NULL,
  `media.mimeType` LONGTEXT NULL,
  `media.size` DOUBLE NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_smartfriendmessages_user` (`user`),
  KEY `ix_smartfriendmessages_friend` (`friend`),
  KEY `ix_smartfriendmessages_roomId` (`roomId`),
  KEY `ix_smartfriendmessages_user_friend_createdAt` (`user`, `friend`, `createdAt`),
  KEY `ix_smartfriendmessages_user_roomId_createdAt` (`user`, `roomId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `smartfriendreminders` (
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `notes` VARCHAR(1000) NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `repeat` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `voice` TINYINT(1) NULL,
  `notifiedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_smartfriendreminders_user` (`user`),
  KEY `ix_smartfriendreminders_dueAt` (`dueAt`),
  KEY `ix_smartfriendreminders_status` (`status`),
  KEY `ix_smartfriendreminders_user_status_dueAt` (`user`, `status`, `dueAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stores` (
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `description` VARCHAR(1000) NOT NULL,
  `governorate` VARCHAR(80) NOT NULL,
  `area` VARCHAR(100) NOT NULL,
  `address` VARCHAR(240) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `whatsapp` VARCHAR(30) NULL,
  `facebook` VARCHAR(220) NULL,
  `instagram` VARCHAR(220) NULL,
  `website` VARCHAR(220) NULL,
  `plan` LONGTEXT NOT NULL,
  `template` LONGTEXT NULL,
  `spaceSize` LONGTEXT NULL,
  `logoUrl` LONGTEXT NULL,
  `coverUrl` LONGTEXT NULL,
  `status` VARCHAR(255) NULL,
  `rejectionReason` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_stores_owner` (`owner`),
  KEY `ix_stores_status` (`status`),
  UNIQUE KEY `ix_stores_owner_name_unique` (`owner`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stores__delegates` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `name` VARCHAR(120) NULL,
  `phone` VARCHAR(30) NULL,
  `role` LONGTEXT NULL,
  `addedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_stores__delegates_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stories` (
  `author` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `text` VARCHAR(1000) NULL,
  `visibility` VARCHAR(255) NULL,
  `expiresAt` DATETIME(3) NULL,
  `active` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_stories_author` (`author`),
  KEY `ix_stories_visibility` (`visibility`),
  KEY `ix_stories_expiresAt` (`expiresAt`),
  KEY `ix_stories_active` (`active`),
  KEY `ix_stories_isSynthetic` (`isSynthetic`),
  KEY `ix_stories_syntheticBatch` (`syntheticBatch`),
  KEY `ix_stories_author_createdAt` (`author`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stories__media` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NULL,
  `fallbackUrl` LONGTEXT NULL,
  `storageKey` LONGTEXT NULL,
  `storage` LONGTEXT NULL,
  `type` LONGTEXT NULL,
  `mimeType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_stories__media_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stories__overlays` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `kind` LONGTEXT NOT NULL,
  `value` VARCHAR(300) NOT NULL,
  `x` DOUBLE NULL,
  `y` DOUBLE NULL,
  `size` DOUBLE NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_stories__overlays_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `stories__music` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `url` LONGTEXT NULL,
  `fallbackUrl` LONGTEXT NULL,
  `storageKey` LONGTEXT NULL,
  `storage` LONGTEXT NULL,
  `mimeType` LONGTEXT NULL,
  `size` DOUBLE NULL,
  `name` VARCHAR(180) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_stories__music_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `supportrequests` (
  `type` VARCHAR(255) NOT NULL,
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `identity` VARCHAR(160) NULL,
  `subject` VARCHAR(180) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `status` VARCHAR(255) NULL,
  `adminReply` LONGTEXT NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reviewedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_supportrequests_type` (`type`),
  KEY `ix_supportrequests_user` (`user`),
  KEY `ix_supportrequests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `tvrooms` (
  `name` VARCHAR(120) NULL,
  `owner` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `mode` VARCHAR(255) NULL,
  `visibility` VARCHAR(255) NULL,
  `sourceType` LONGTEXT NULL,
  `sourceUrl` VARCHAR(1000) NULL,
  `title` VARCHAR(180) NULL,
  `voiceEnabled` TINYINT(1) NULL,
  `chatEnabled` TINYINT(1) NULL,
  `isActive` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_tvrooms_owner` (`owner`),
  KEY `ix_tvrooms_mode` (`mode`),
  KEY `ix_tvrooms_visibility` (`visibility`),
  KEY `ix_tvrooms_isActive` (`isActive`),
  KEY `ix_tvrooms_isActive_updatedAt` (`isActive`, `updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `tvrooms__viewers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_tvrooms__viewers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `tvrooms__invitedUsers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_tvrooms__invitedUsers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `users` (
  `fullName` VARCHAR(100) NOT NULL,
  `username` VARCHAR(30) NOT NULL,
  `contact` VARCHAR(255) NOT NULL,
  `contactType` LONGTEXT NOT NULL,
  `phone` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `contactVerified` TINYINT(1) NULL,
  `friendCode` VARCHAR(40) NULL,
  `contactVerifiedAt` DATETIME(3) NULL,
  `contactVerifiedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `verificationCodeHash` LONGTEXT NULL,
  `verificationCodeExpiresAt` DATETIME(3) NULL,
  `verificationAttempts` DOUBLE NULL,
  `verificationLastSentAt` DATETIME(3) NULL,
  `notificationPreferences.inApp` TINYINT(1) NULL,
  `notificationPreferences.phone` TINYINT(1) NULL,
  `notificationPreferences.email` TINYINT(1) NULL,
  `birthDate` DATETIME(3) NULL,
  `gender` LONGTEXT NULL,
  `passwordHash` LONGTEXT NOT NULL,
  `termsAccepted` TINYINT(1) NOT NULL,
  `privacyAccepted` TINYINT(1) NULL,
  `privacyAcceptedAt` DATETIME(3) NULL,
  `privacyVersion` LONGTEXT NULL,
  `role` LONGTEXT NULL,
  `schoolAccess.role` LONGTEXT NULL,
  `schoolAccess.status` LONGTEXT NULL,
  `schoolAccess.activatedAt` DATETIME(3) NULL,
  `schoolAccess.trialStartedAt` DATETIME(3) NULL,
  `schoolAccess.trialEndsAt` DATETIME(3) NULL,
  `schoolAccess.subscriptionEndsAt` DATETIME(3) NULL,
  `status` LONGTEXT NULL,
  `rejectionReason` LONGTEXT NULL,
  `approvalSource` LONGTEXT NULL,
  `displayName` VARCHAR(100) NULL,
  `profile.bio` VARCHAR(500) NULL,
  `profile.avatarUrl` LONGTEXT NULL,
  `profile.coverUrl` LONGTEXT NULL,
  `profile.coverPositionX` DOUBLE NULL,
  `profile.coverPositionY` DOUBLE NULL,
  `profile.online` TINYINT(1) NULL,
  `profile.lastSeen` DATETIME(3) NULL,
  `profile.governorate` VARCHAR(80) NULL,
  `profile.city` VARCHAR(80) NULL,
  `profile.profession` VARCHAR(120) NULL,
  `profile.workplace` VARCHAR(120) NULL,
  `profile.education` VARCHAR(120) NULL,
  `profile.website` VARCHAR(240) NULL,
  `privacy` JSON NULL,
  `phoneVisibility` LONGTEXT NULL,
  `tvPlaylists` JSON NULL,
  `reviewedBy` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `reviewedAt` DATETIME(3) NULL,
  `isSynthetic` TINYINT(1) NULL,
  `syntheticBatch` VARCHAR(255) NULL,
  `simulationKey` LONGTEXT NULL,
  `syntheticPersona.disclosureLabel` LONGTEXT NULL,
  `syntheticPersona.ageBand` LONGTEXT NULL,
  `syntheticPersona.activityLevel` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  `_idx_ix_users_phone_unique_0` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `phone` IS NOT NULL AND `phone` > CONVERT(X'' USING utf8mb4) THEN `phone` ELSE NULL END) STORED,
  `_idx_ix_users_email_unique_0` VARCHAR(255) GENERATED ALWAYS AS (CASE WHEN `email` IS NOT NULL AND `email` > CONVERT(X'' USING utf8mb4) THEN `email` ELSE NULL END) STORED,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_users_username_unique` (`username`),
  UNIQUE KEY `ix_users_contact_unique` (`contact`),
  KEY `ix_users_contactVerified` (`contactVerified`),
  UNIQUE KEY `ix_users_friendCode_unique` (`friendCode`),
  KEY `ix_users_isSynthetic` (`isSynthetic`),
  KEY `ix_users_syntheticBatch` (`syntheticBatch`),
  UNIQUE KEY `ix_users_phone_unique` (`_idx_ix_users_phone_unique_0`),
  UNIQUE KEY `ix_users_email_unique` (`_idx_ix_users_email_unique_0`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `users__profile_socialLinks` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_users__profile_socialLinks_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `users__phoneVisibleTo` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_users__phoneVisibleTo_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `users__blockedUsers` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_users__blockedUsers_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `users__syntheticPersona_interests` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_users__syntheticPersona_interests_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroommessages` (
  `session` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `code` VARCHAR(255) NOT NULL,
  `senderType` LONGTEXT NOT NULL,
  `senderUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `senderStudent` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `senderName` VARCHAR(100) NOT NULL,
  `type` LONGTEXT NULL,
  `text` LONGTEXT NOT NULL,
  `isVoiceQuestion` TINYINT(1) NULL,
  `aiProvider` LONGTEXT NULL,
  `aiModel` LONGTEXT NULL,
  `timestamp` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  KEY `ix_virtualclassroommessages_session` (`session`),
  KEY `ix_virtualclassroommessages_code` (`code`),
  KEY `ix_virtualclassroommessages_timestamp` (`timestamp`),
  KEY `ix_virtualclassroommessages_code_timestamp` (`code`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroommessages__sourceRefs` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` LONGTEXT NULL,
  `page` LONGTEXT NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroommessages__sourceRefs_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions` (
  `code` VARCHAR(255) NOT NULL,
  `hostUser` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `hostName` VARCHAR(100) NOT NULL,
  `hostRole` LONGTEXT NULL,
  `virtualTeacher.profileId` LONGTEXT NOT NULL,
  `virtualTeacher.name` LONGTEXT NOT NULL,
  `virtualTeacher.label` LONGTEXT NULL,
  `virtualTeacher.title` LONGTEXT NULL,
  `virtualTeacher.avatar` LONGTEXT NULL,
  `virtualTeacher.dialect` LONGTEXT NULL,
  `virtualTeacher.voiceEnabled` TINYINT(1) NULL,
  `stage` VARCHAR(255) NOT NULL,
  `grade` VARCHAR(255) NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `lesson` VARCHAR(160) NOT NULL,
  `sourceTitle` LONGTEXT NOT NULL,
  `sourceBookName` LONGTEXT NULL,
  `sourceCatalogId` LONGTEXT NULL,
  `sourcePage` LONGTEXT NULL,
  `lessonContent` LONGTEXT NULL,
  `whiteboardData.currentSlide` DOUBLE NULL,
  `status` VARCHAR(255) NULL,
  `startedAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_virtualclassroomsessions_code_unique` (`code`),
  KEY `ix_virtualclassroomsessions_hostUser` (`hostUser`),
  KEY `ix_virtualclassroomsessions_stage` (`stage`),
  KEY `ix_virtualclassroomsessions_grade` (`grade`),
  KEY `ix_virtualclassroomsessions_subject` (`subject`),
  KEY `ix_virtualclassroomsessions_status` (`status`),
  KEY `ix_virtualclassroomsessions_status_stage_grade_subject` (`status`(192), `stage`(192), `grade`(192), `subject`(192))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions__whiteboardData_slides` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `title` LONGTEXT NULL,
  `subtitle` LONGTEXT NULL,
  `leftColumn.title` LONGTEXT NULL,
  `rightColumn.title` LONGTEXT NULL,
  `rightColumn.diagram` LONGTEXT NULL,
  `example` LONGTEXT NULL,
  `note` LONGTEXT NULL,
  `drawing` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroomsessions__whiteboardData_slides_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions__whiteboardData_slides_25860c7b6041` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroomsessions__whiteboardData_sli_a0089660149e` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions__whiteboardData_slides_407aa370672b` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroomsessions__whiteboardData_sli_784a7bd566d1` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions__participants` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `user` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `student` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `role` LONGTEXT NULL,
  `permissions.camera` TINYINT(1) NULL,
  `permissions.voice` TINYINT(1) NULL,
  `joinedAt` DATETIME(3) NULL,
  `leftAt` DATETIME(3) NULL,
  `online` TINYINT(1) NULL,
  `handRaised` TINYINT(1) NULL,
  `handRaisedAt` DATETIME(3) NULL,
  `media.camera` TINYINT(1) NULL,
  `media.mic` TINYINT(1) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroomsessions__participants_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualclassroomsessions__participants__attendance` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `joinedAt` DATETIME(3) NULL,
  `leftAt` DATETIME(3) NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualclassroomsessions__participants__attendance_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualteacherprofiles` (
  `profileId` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `label` LONGTEXT NULL,
  `title` VARCHAR(150) NOT NULL,
  `defaultDialect` LONGTEXT NULL,
  `avatar` LONGTEXT NULL,
  `voiceSettings.voiceGender` LONGTEXT NULL,
  `voiceSettings.defaultPitch` DOUBLE NULL,
  `voiceSettings.defaultRate` DOUBLE NULL,
  `voiceSettings.lang` LONGTEXT NULL,
  `introGreeting` VARCHAR(500) NULL,
  `active` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `createdAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NULL,
  `__v` DOUBLE NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `ix_virtualteacherprofiles_profileId_unique` (`profileId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualteacherprofiles__subjectSpecialty` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `value` LONGTEXT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualteacherprofiles__subjectSpecialty_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

CREATE TABLE `virtualteacherprofiles__supportedDialects` (
  `parent_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `position` INT UNSIGNED NOT NULL,
  `_row_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `id` LONGTEXT NOT NULL,
  `name` LONGTEXT NOT NULL,
  `isDefault` TINYINT(1) NULL,
  `_id` VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`_row_id`),
  UNIQUE KEY `ix_virtualteacherprofiles__supportedDialects_parent` (`parent_id`, `position`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC;

ALTER TABLE `astrologyproviders` ADD CONSTRAINT `fk_astrologyproviders_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `astrologyproviders__skills` ADD CONSTRAINT `fk_astrologyproviders__skills_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `astrologyproviders` (`_id`) ON DELETE CASCADE;

ALTER TABLE `auditlogs` ADD CONSTRAINT `fk_auditlogs_actor` FOREIGN KEY (`actor`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `auditlogs` ADD CONSTRAINT `fk_auditlogs_target` FOREIGN KEY (`target`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `broadcasttickers` ADD CONSTRAINT `fk_broadcasttickers_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `consultationproviders` ADD CONSTRAINT `fk_consultationproviders_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `conversations__participants` ADD CONSTRAINT `fk_conversations__participants_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `conversations` (`_id`) ON DELETE CASCADE;

ALTER TABLE `conversations__participants` ADD CONSTRAINT `fk_conversations__participants_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `conversations` ADD CONSTRAINT `fk_conversations_lastMessage` FOREIGN KEY (`lastMessage`) REFERENCES `messages` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `developermfas` ADD CONSTRAINT `fk_developermfas_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `developermfas__credentials` ADD CONSTRAINT `fk_developermfas__credentials_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `developermfas` (`_id`) ON DELETE CASCADE;

ALTER TABLE `developermfas__credentials__transports` ADD CONSTRAINT `fk_developermfas__credentials__transports_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `developermfas__credentials` (`_row_id`) ON DELETE CASCADE;

ALTER TABLE `developermfas__phoneChallenges` ADD CONSTRAINT `fk_developermfas__phoneChallenges_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `developermfas` (`_id`) ON DELETE CASCADE;

ALTER TABLE `follows` ADD CONSTRAINT `fk_follows_follower` FOREIGN KEY (`follower`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `follows` ADD CONSTRAINT `fk_follows_following` FOREIGN KEY (`following`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `friendrequests` ADD CONSTRAINT `fk_friendrequests_sender` FOREIGN KEY (`sender`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `friendrequests` ADD CONSTRAINT `fk_friendrequests_receiver` FOREIGN KEY (`receiver`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gameprofiles` ADD CONSTRAINT `fk_gameprofiles_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gameprofiles__chess` ADD CONSTRAINT `fk_gameprofiles__chess_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gameprofiles` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gameprofiles__domino` ADD CONSTRAINT `fk_gameprofiles__domino_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gameprofiles` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gameprofiles__tawla` ADD CONSTRAINT `fk_gameprofiles__tawla_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gameprofiles` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gameprofiles__cards` ADD CONSTRAINT `fk_gameprofiles__cards_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gameprofiles` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gamerooms` ADD CONSTRAINT `fk_gamerooms_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamerooms__players` ADD CONSTRAINT `fk_gamerooms__players_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gamerooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gamerooms__players` ADD CONSTRAINT `fk_gamerooms__players_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamerooms__reservations` ADD CONSTRAINT `fk_gamerooms__reservations_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gamerooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gamerooms__reservations` ADD CONSTRAINT `fk_gamerooms__reservations_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamerooms__spectators` ADD CONSTRAINT `fk_gamerooms__spectators_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gamerooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gamerooms__spectators` ADD CONSTRAINT `fk_gamerooms__spectators_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamerooms` ADD CONSTRAINT `fk_gamerooms_gameState_turn` FOREIGN KEY (`gameState.turn`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamerooms__gameState_board` ADD CONSTRAINT `fk_gamerooms__gameState_board_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `gamerooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `gamespectatorinvites` ADD CONSTRAINT `fk_gamespectatorinvites_room` FOREIGN KEY (`room`) REFERENCES `gamerooms` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamespectatorinvites` ADD CONSTRAINT `fk_gamespectatorinvites_inviter` FOREIGN KEY (`inviter`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `gamespectatorinvites` ADD CONSTRAINT `fk_gamespectatorinvites_invitee` FOREIGN KEY (`invitee`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups` ADD CONSTRAINT `fk_groups_teacherProfile` FOREIGN KEY (`teacherProfile`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups` ADD CONSTRAINT `fk_groups_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__admins` ADD CONSTRAINT `fk_groups__admins_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__admins` ADD CONSTRAINT `fk_groups__admins_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__moderators` ADD CONSTRAINT `fk_groups__moderators_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__moderators` ADD CONSTRAINT `fk_groups__moderators_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__members` ADD CONSTRAINT `fk_groups__members_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__members` ADD CONSTRAINT `fk_groups__members_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__pendingMembers` ADD CONSTRAINT `fk_groups__pendingMembers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__pendingMembers` ADD CONSTRAINT `fk_groups__pendingMembers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__mutedMembers` ADD CONSTRAINT `fk_groups__mutedMembers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__mutedMembers` ADD CONSTRAINT `fk_groups__mutedMembers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groups__bannedMembers` ADD CONSTRAINT `fk_groups__bannedMembers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `groups` (`_id`) ON DELETE CASCADE;

ALTER TABLE `groups__bannedMembers` ADD CONSTRAINT `fk_groups__bannedMembers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupmessages` ADD CONSTRAINT `fk_groupmessages_group` FOREIGN KEY (`group`) REFERENCES `groups` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupmessages` ADD CONSTRAINT `fk_groupmessages_sender` FOREIGN KEY (`sender`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupreports` ADD CONSTRAINT `fk_groupreports_group` FOREIGN KEY (`group`) REFERENCES `groups` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupreports` ADD CONSTRAINT `fk_groupreports_reporter` FOREIGN KEY (`reporter`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupreports` ADD CONSTRAINT `fk_groupreports_targetUser` FOREIGN KEY (`targetUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupreports` ADD CONSTRAINT `fk_groupreports_message` FOREIGN KEY (`message`) REFERENCES `groupmessages` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `groupreports` ADD CONSTRAINT `fk_groupreports_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `guardiancomplaints` ADD CONSTRAINT `fk_guardiancomplaints_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `guardiancomplaints` ADD CONSTRAINT `fk_guardiancomplaints_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `guardiancomplaints` ADD CONSTRAINT `fk_guardiancomplaints_adminResponse_respondedBy` FOREIGN KEY (`adminResponse.respondedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `guardiancomplaints__attachments` ADD CONSTRAINT `fk_guardiancomplaints__attachments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `guardiancomplaints` (`_id`) ON DELETE CASCADE;

ALTER TABLE `guardianconsents` ADD CONSTRAINT `fk_guardianconsents_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `guardianconsents` ADD CONSTRAINT `fk_guardianconsents_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `islamicposts` ADD CONSTRAINT `fk_islamicposts_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `islamicposts__media` ADD CONSTRAINT `fk_islamicposts__media_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `islamicposts` (`_id`) ON DELETE CASCADE;

ALTER TABLE `islamicposts__likes` ADD CONSTRAINT `fk_islamicposts__likes_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `islamicposts` (`_id`) ON DELETE CASCADE;

ALTER TABLE `islamicposts__likes` ADD CONSTRAINT `fk_islamicposts__likes_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `islamicposts__comments` ADD CONSTRAINT `fk_islamicposts__comments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `islamicposts` (`_id`) ON DELETE CASCADE;

ALTER TABLE `islamicposts__comments` ADD CONSTRAINT `fk_islamicposts__comments_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `islamicposts` ADD CONSTRAINT `fk_islamicposts_generalPostId` FOREIGN KEY (`generalPostId`) REFERENCES `posts` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation`) REFERENCES `conversations` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `messages__attachment` ADD CONSTRAINT `fk_messages__attachment_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `messages` (`_id`) ON DELETE CASCADE;

ALTER TABLE `messages` ADD CONSTRAINT `fk_messages_replyTo` FOREIGN KEY (`replyTo`) REFERENCES `messages` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `messages__deletedFor` ADD CONSTRAINT `fk_messages__deletedFor_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `messages` (`_id`) ON DELETE CASCADE;

ALTER TABLE `messages__deletedFor` ADD CONSTRAINT `fk_messages__deletedFor_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `phonecontacts` ADD CONSTRAINT `fk_phonecontacts_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `posts__media` ADD CONSTRAINT `fk_posts__media_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `posts` (`_id`) ON DELETE CASCADE;

ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_adReviewedBy` FOREIGN KEY (`adReviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `posts__likes` ADD CONSTRAINT `fk_posts__likes_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `posts` (`_id`) ON DELETE CASCADE;

ALTER TABLE `posts__likes` ADD CONSTRAINT `fk_posts__likes_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `postcomments` ADD CONSTRAINT `fk_postcomments_post` FOREIGN KEY (`post`) REFERENCES `posts` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `postcomments` ADD CONSTRAINT `fk_postcomments_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `reels` ADD CONSTRAINT `fk_reels_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `reels__media` ADD CONSTRAINT `fk_reels__media_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `reels` (`_id`) ON DELETE CASCADE;

ALTER TABLE `reels__likes` ADD CONSTRAINT `fk_reels__likes_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `reels` (`_id`) ON DELETE CASCADE;

ALTER TABLE `reels__likes` ADD CONSTRAINT `fk_reels__likes_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `reels__comments` ADD CONSTRAINT `fk_reels__comments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `reels` (`_id`) ON DELETE CASCADE;

ALTER TABLE `reels__comments` ADD CONSTRAINT `fk_reels__comments_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `reels__savedBy` ADD CONSTRAINT `fk_reels__savedBy_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `reels` (`_id`) ON DELETE CASCADE;

ALTER TABLE `reels__savedBy` ADD CONSTRAINT `fk_reels__savedBy_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolannouncements` ADD CONSTRAINT `fk_schoolannouncements_publishedBy` FOREIGN KEY (`publishedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignments` ADD CONSTRAINT `fk_schoolassignments_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignments` ADD CONSTRAINT `fk_schoolassignments_teacherProfile` FOREIGN KEY (`teacherProfile`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignments` ADD CONSTRAINT `fk_schoolassignments_classroom` FOREIGN KEY (`classroom`) REFERENCES `schoolclassrooms` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignments__attachments` ADD CONSTRAINT `fk_schoolassignments__attachments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolassignments` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolassignments__assignedStudents` ADD CONSTRAINT `fk_schoolassignments__assignedStudents_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolassignments` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolassignments__assignedStudents` ADD CONSTRAINT `fk_schoolassignments__assignedStudents_value` FOREIGN KEY (`value`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignmentsubmissions` ADD CONSTRAINT `fk_schoolassignmentsubmissions_assignment` FOREIGN KEY (`assignment`) REFERENCES `schoolassignments` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignmentsubmissions` ADD CONSTRAINT `fk_schoolassignmentsubmissions_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignmentsubmissions` ADD CONSTRAINT `fk_schoolassignmentsubmissions_studentUser` FOREIGN KEY (`studentUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignmentsubmissions__attachments` ADD CONSTRAINT `fk_schoolassignmentsubmissions__attachments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolassignmentsubmissions` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolassignmentsubmissions` ADD CONSTRAINT `fk_schoolassignmentsubmissions_gradedBy` FOREIGN KEY (`gradedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolassignmentsubmissions` ADD CONSTRAINT `fk_schoolassignmentsubmissions_gradeRecord` FOREIGN KEY (`gradeRecord`) REFERENCES `schoolgraderecords` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolattendancerecords` ADD CONSTRAINT `fk_schoolattendancerecords_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolattendancerecords` ADD CONSTRAINT `fk_schoolattendancerecords_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolattendancerecords` ADD CONSTRAINT `fk_schoolattendancerecords_scheduleEvent` FOREIGN KEY (`scheduleEvent`) REFERENCES `schooleventschedules` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolclassrooms` ADD CONSTRAINT `fk_schoolclassrooms_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolclassrooms` ADD CONSTRAINT `fk_schoolclassrooms_answeringStudent` FOREIGN KEY (`answeringStudent`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolclassrooms__participants` ADD CONSTRAINT `fk_schoolclassrooms__participants_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolclassrooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolclassrooms__participants` ADD CONSTRAINT `fk_schoolclassrooms__participants_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolclassrooms__participants` ADD CONSTRAINT `fk_schoolclassrooms__participants_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolclassrooms__participants__attendance` ADD CONSTRAINT `fk_schoolclassrooms__participants__attendance_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolclassrooms__participants` (`_row_id`) ON DELETE CASCADE;

ALTER TABLE `schoolenrollmentrequests` ADD CONSTRAINT `fk_schoolenrollmentrequests_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolenrollmentrequests` ADD CONSTRAINT `fk_schoolenrollmentrequests_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolenrollmentrequests__consents` ADD CONSTRAINT `fk_schoolenrollmentrequests__consents_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolenrollmentrequests` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolenrollmentrequests__subjects` ADD CONSTRAINT `fk_schoolenrollmentrequests__subjects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolenrollmentrequests` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolenrollmentrequests` ADD CONSTRAINT `fk_schoolenrollmentrequests_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schooleventschedules` ADD CONSTRAINT `fk_schooleventschedules_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schooleventschedules__students` ADD CONSTRAINT `fk_schooleventschedules__students_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schooleventschedules` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schooleventschedules__students` ADD CONSTRAINT `fk_schooleventschedules__students_value` FOREIGN KEY (`value`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schooleventschedules` ADD CONSTRAINT `fk_schooleventschedules_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolgraderecords` ADD CONSTRAINT `fk_schoolgraderecords_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolgraderecords` ADD CONSTRAINT `fk_schoolgraderecords_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolgraderecords` ADD CONSTRAINT `fk_schoolgraderecords_scheduleEvent` FOREIGN KEY (`scheduleEvent`) REFERENCES `schooleventschedules` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardians` ADD CONSTRAINT `fk_schoolguardians_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardians__students` ADD CONSTRAINT `fk_schoolguardians__students_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolguardians` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolguardians__students` ADD CONSTRAINT `fk_schoolguardians__students_value` FOREIGN KEY (`value`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardiannotifications` ADD CONSTRAINT `fk_schoolguardiannotifications_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardiannotifications` ADD CONSTRAINT `fk_schoolguardiannotifications_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardiannotifications` ADD CONSTRAINT `fk_schoolguardiannotifications_teacher` FOREIGN KEY (`teacher`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardianrequests` ADD CONSTRAINT `fk_schoolguardianrequests_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardianrequests` ADD CONSTRAINT `fk_schoolguardianrequests_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolguardianrequests` ADD CONSTRAINT `fk_schoolguardianrequests_resolvedBy` FOREIGN KEY (`resolvedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolknowledgesources__keywords` ADD CONSTRAINT `fk_schoolknowledgesources__keywords_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolknowledgesources` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolknowledgesources` ADD CONSTRAINT `fk_schoolknowledgesources_uploadedBy` FOREIGN KEY (`uploadedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoollearningrecords` ADD CONSTRAINT `fk_schoollearningrecords_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoollearningrecords` ADD CONSTRAINT `fk_schoollearningrecords_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoollearningrecords` ADD CONSTRAINT `fk_schoollearningrecords_session` FOREIGN KEY (`session`) REFERENCES `schoolsessions` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoollearningrecords__sources` ADD CONSTRAINT `fk_schoollearningrecords__sources_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoollearningrecords` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoollearningrecords__sources` ADD CONSTRAINT `fk_schoollearningrecords__sources_source` FOREIGN KEY (`source`) REFERENCES `schoolknowledgesources` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolschedules` ADD CONSTRAINT `fk_schoolschedules_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolschedules` ADD CONSTRAINT `fk_schoolschedules_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolsessions` ADD CONSTRAINT `fk_schoolsessions_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolsessions` ADD CONSTRAINT `fk_schoolsessions_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstaffrequests` ADD CONSTRAINT `fk_schoolstaffrequests_teacher` FOREIGN KEY (`teacher`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstaffrequests` ADD CONSTRAINT `fk_schoolstaffrequests_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstaffrequests` ADD CONSTRAINT `fk_schoolstaffrequests_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents` ADD CONSTRAINT `fk_schoolstudents_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents` ADD CONSTRAINT `fk_schoolstudents_studentUser` FOREIGN KEY (`studentUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents__subjects` ADD CONSTRAINT `fk_schoolstudents__subjects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolstudents` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolstudents__assignedTeachers` ADD CONSTRAINT `fk_schoolstudents__assignedTeachers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolstudents` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolstudents__assignedTeachers` ADD CONSTRAINT `fk_schoolstudents__assignedTeachers_teacher` FOREIGN KEY (`teacher`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents` ADD CONSTRAINT `fk_schoolstudents_assignedVirtualTeacher` FOREIGN KEY (`assignedVirtualTeacher`) REFERENCES `virtualteacherprofiles` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents` ADD CONSTRAINT `fk_schoolstudents_registeredBy` FOREIGN KEY (`registeredBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudents__notes` ADD CONSTRAINT `fk_schoolstudents__notes_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolstudents` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolstudents__scores` ADD CONSTRAINT `fk_schoolstudents__scores_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolstudents` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolstudentreports` ADD CONSTRAINT `fk_schoolstudentreports_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudentreports` ADD CONSTRAINT `fk_schoolstudentreports_teacher` FOREIGN KEY (`teacher`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolstudentreports` ADD CONSTRAINT `fk_schoolstudentreports_createdBy` FOREIGN KEY (`createdBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolsyncoperations` ADD CONSTRAINT `fk_schoolsyncoperations_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteachers` ADD CONSTRAINT `fk_schoolteachers_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteachers__subjects` ADD CONSTRAINT `fk_schoolteachers__subjects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__stages` ADD CONSTRAINT `fk_schoolteachers__stages_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__grades` ADD CONSTRAINT `fk_schoolteachers__grades_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__sections` ADD CONSTRAINT `fk_schoolteachers__sections_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__scheduleSlots` ADD CONSTRAINT `fk_schoolteachers__scheduleSlots_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__assignedStudents` ADD CONSTRAINT `fk_schoolteachers__assignedStudents_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteachers` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteachers__assignedStudents` ADD CONSTRAINT `fk_schoolteachers__assignedStudents_value` FOREIGN KEY (`value`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteachers` ADD CONSTRAINT `fk_schoolteachers_registeredBy` FOREIGN KEY (`registeredBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherapplications` ADD CONSTRAINT `fk_schoolteacherapplications_applicant` FOREIGN KEY (`applicant`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherapplications__subjects` ADD CONSTRAINT `fk_schoolteacherapplications__subjects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherapplications` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherapplications__specialties` ADD CONSTRAINT `fk_schoolteacherapplications__specialties_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherapplications` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherapplications__stages` ADD CONSTRAINT `fk_schoolteacherapplications__stages_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherapplications` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherapplications__grades` ADD CONSTRAINT `fk_schoolteacherapplications__grades_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherapplications` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherapplications__sections` ADD CONSTRAINT `fk_schoolteacherapplications__sections_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherapplications` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherapplications` ADD CONSTRAINT `fk_schoolteacherapplications_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherapplications` ADD CONSTRAINT `fk_schoolteacherapplications_approvedTeacher` FOREIGN KEY (`approvedTeacher`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherstudentrequests` ADD CONSTRAINT `fk_schoolteacherstudentrequests_teacher` FOREIGN KEY (`teacher`) REFERENCES `schoolteachers` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherstudentrequests` ADD CONSTRAINT `fk_schoolteacherstudentrequests_teacherUser` FOREIGN KEY (`teacherUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherstudentrequests` ADD CONSTRAINT `fk_schoolteacherstudentrequests_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherstudentrequests` ADD CONSTRAINT `fk_schoolteacherstudentrequests_guardian` FOREIGN KEY (`guardian`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolteacherstudentrequests__subjects` ADD CONSTRAINT `fk_schoolteacherstudentrequests__subjects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `schoolteacherstudentrequests` (`_id`) ON DELETE CASCADE;

ALTER TABLE `schoolteacherstudentrequests` ADD CONSTRAINT `fk_schoolteacherstudentrequests_decidedBy` FOREIGN KEY (`decidedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `schoolwhiteboards` ADD CONSTRAINT `fk_schoolwhiteboards_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `serviceproviders` ADD CONSTRAINT `fk_serviceproviders_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `servicerequests` ADD CONSTRAINT `fk_servicerequests_requester` FOREIGN KEY (`requester`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `servicerequests` ADD CONSTRAINT `fk_servicerequests_provider` FOREIGN KEY (`provider`) REFERENCES `serviceproviders` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `servicerequests` ADD CONSTRAINT `fk_servicerequests_providerOwner` FOREIGN KEY (`providerOwner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `smartfriends` ADD CONSTRAINT `fk_smartfriends_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `smartfriends__interests` ADD CONSTRAINT `fk_smartfriends__interests_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `smartfriends` (`_id`) ON DELETE CASCADE;

ALTER TABLE `smartfriendmessages` ADD CONSTRAINT `fk_smartfriendmessages_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `smartfriendmessages` ADD CONSTRAINT `fk_smartfriendmessages_friend` FOREIGN KEY (`friend`) REFERENCES `smartfriends` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `smartfriendreminders` ADD CONSTRAINT `fk_smartfriendreminders_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `stores` ADD CONSTRAINT `fk_stores_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `stores__delegates` ADD CONSTRAINT `fk_stores__delegates_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `stores` (`_id`) ON DELETE CASCADE;

ALTER TABLE `stores__delegates` ADD CONSTRAINT `fk_stores__delegates_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `stories` ADD CONSTRAINT `fk_stories_author` FOREIGN KEY (`author`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `stories__media` ADD CONSTRAINT `fk_stories__media_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `stories` (`_id`) ON DELETE CASCADE;

ALTER TABLE `stories__overlays` ADD CONSTRAINT `fk_stories__overlays_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `stories` (`_id`) ON DELETE CASCADE;

ALTER TABLE `stories__music` ADD CONSTRAINT `fk_stories__music_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `stories` (`_id`) ON DELETE CASCADE;

ALTER TABLE `supportrequests` ADD CONSTRAINT `fk_supportrequests_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `supportrequests` ADD CONSTRAINT `fk_supportrequests_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `tvrooms` ADD CONSTRAINT `fk_tvrooms_owner` FOREIGN KEY (`owner`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `tvrooms__viewers` ADD CONSTRAINT `fk_tvrooms__viewers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tvrooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `tvrooms__viewers` ADD CONSTRAINT `fk_tvrooms__viewers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `tvrooms__invitedUsers` ADD CONSTRAINT `fk_tvrooms__invitedUsers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `tvrooms` (`_id`) ON DELETE CASCADE;

ALTER TABLE `tvrooms__invitedUsers` ADD CONSTRAINT `fk_tvrooms__invitedUsers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `users` ADD CONSTRAINT `fk_users_contactVerifiedBy` FOREIGN KEY (`contactVerifiedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `users__profile_socialLinks` ADD CONSTRAINT `fk_users__profile_socialLinks_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `users` (`_id`) ON DELETE CASCADE;

ALTER TABLE `users__phoneVisibleTo` ADD CONSTRAINT `fk_users__phoneVisibleTo_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `users` (`_id`) ON DELETE CASCADE;

ALTER TABLE `users__phoneVisibleTo` ADD CONSTRAINT `fk_users__phoneVisibleTo_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `users__blockedUsers` ADD CONSTRAINT `fk_users__blockedUsers_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `users` (`_id`) ON DELETE CASCADE;

ALTER TABLE `users__blockedUsers` ADD CONSTRAINT `fk_users__blockedUsers_value` FOREIGN KEY (`value`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `users` ADD CONSTRAINT `fk_users_reviewedBy` FOREIGN KEY (`reviewedBy`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `users__syntheticPersona_interests` ADD CONSTRAINT `fk_users__syntheticPersona_interests_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `users` (`_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroommessages` ADD CONSTRAINT `fk_virtualclassroommessages_session` FOREIGN KEY (`session`) REFERENCES `virtualclassroomsessions` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroommessages` ADD CONSTRAINT `fk_virtualclassroommessages_senderUser` FOREIGN KEY (`senderUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroommessages` ADD CONSTRAINT `fk_virtualclassroommessages_senderStudent` FOREIGN KEY (`senderStudent`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroommessages__sourceRefs` ADD CONSTRAINT `fk_virtualclassroommessages__sourceRefs_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroommessages` (`_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroomsessions` ADD CONSTRAINT `fk_virtualclassroomsessions_hostUser` FOREIGN KEY (`hostUser`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroomsessions__whiteboardData_slides` ADD CONSTRAINT `fk_virtualclassroomsessions__whiteboardData_slides_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroomsessions` (`_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroomsessions__whiteboardData_slides_25860c7b6041` ADD CONSTRAINT `fk_virtualclassroomsessions__whiteboardData_sli_f7167d52842c` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroomsessions__whiteboardData_slides` (`_row_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroomsessions__whiteboardData_slides_407aa370672b` ADD CONSTRAINT `fk_virtualclassroomsessions__whiteboardData_sli_60dd15de77ee` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroomsessions__whiteboardData_slides` (`_row_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroomsessions__participants` ADD CONSTRAINT `fk_virtualclassroomsessions__participants_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroomsessions` (`_id`) ON DELETE CASCADE;

ALTER TABLE `virtualclassroomsessions__participants` ADD CONSTRAINT `fk_virtualclassroomsessions__participants_user` FOREIGN KEY (`user`) REFERENCES `users` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroomsessions__participants` ADD CONSTRAINT `fk_virtualclassroomsessions__participants_student` FOREIGN KEY (`student`) REFERENCES `schoolstudents` (`_id`) ON DELETE RESTRICT;

ALTER TABLE `virtualclassroomsessions__participants__attendance` ADD CONSTRAINT `fk_virtualclassroomsessions__participants__atte_4e63665aa9e1` FOREIGN KEY (`parent_id`) REFERENCES `virtualclassroomsessions__participants` (`_row_id`) ON DELETE CASCADE;

ALTER TABLE `virtualteacherprofiles__subjectSpecialty` ADD CONSTRAINT `fk_virtualteacherprofiles__subjectSpecialty_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `virtualteacherprofiles` (`_id`) ON DELETE CASCADE;

ALTER TABLE `virtualteacherprofiles__supportedDialects` ADD CONSTRAINT `fk_virtualteacherprofiles__supportedDialects_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `virtualteacherprofiles` (`_id`) ON DELETE CASCADE;
