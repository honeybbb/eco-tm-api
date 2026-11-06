-- 회사(cIdx)별 SMTP 자격증명 저장을 위한 컬럼 추가
--   smtpHost / smtpPort / smtpUser  : 평문
--   smtpPassEnc                     : AES-256-GCM 암호문 (iv(12) || tag(16) || ciphertext)
--   마스터 키(MAIL_ENC_KEY)는 .env 에서 관리 — DB 유출만으로는 복호화 불가.

ALTER TABLE new_tb_mail_config
    ADD COLUMN smtpHost    VARCHAR(100)   NOT NULL DEFAULT 'smtp.naver.com' AFTER useFl,
    ADD COLUMN smtpPort    SMALLINT       NOT NULL DEFAULT 465              AFTER smtpHost,
    ADD COLUMN smtpUser    VARCHAR(255)   NOT NULL DEFAULT ''               AFTER smtpPort,
    ADD COLUMN smtpPassEnc VARBINARY(512) NULL                              AFTER smtpUser;
