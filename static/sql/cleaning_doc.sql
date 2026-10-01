-- =====================================================================
-- 대청소 공문 발송 이력 테이블
-- : 대청소 일정 단위로 발송된 공문(작업 안내 등)의 이력을 저장한다.
-- : 스케줄에 해당 이력이 하나라도 있으면 프런트에서 'docStatus=1(발송)'로 본다.
-- =====================================================================
CREATE TABLE IF NOT EXISTS new_tb_cleaning_doc (
    idx           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '기본 키',
    cIdx          INT UNSIGNED NOT NULL             COMMENT '회사 idx (new_tb_config.idx)',
    scheduleIdx   INT UNSIGNED NOT NULL             COMMENT '대청소 스케줄 idx (new_tb_cleaning_schedule.idx)',
    docType       VARCHAR(20)  NOT NULL DEFAULT 'NOTICE' COMMENT '공문 유형 (NOTICE=작업 안내)',
    title         VARCHAR(200) NOT NULL             COMMENT '공문 제목',
    snapshotJson  JSON         NULL                 COMMENT '발송 당시 현장/일정 스냅샷',
    fileUrl       VARCHAR(500) NULL                 COMMENT '첨부 파일 경로 (선택)',
    sentAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발송 일시',
    regDt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
    PRIMARY KEY (idx),
    KEY idx_schedule (scheduleIdx),
    KEY idx_company_sent (cIdx, sentAt)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '대청소 공문 발송 이력';
