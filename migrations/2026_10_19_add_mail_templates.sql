-- =========================================================================
-- 회사별 메일 템플릿 컬럼 추가
--   settleSubject  : 정산서 송부 메일 제목 템플릿
--   settleBodyHtml : 정산서 송부 메일 본문(HTML) 템플릿
--   플레이스홀더: {siteName}, {period}
-- =========================================================================
ALTER TABLE new_tb_mail_config
    ADD COLUMN settleSubject  VARCHAR(255) NULL AFTER useFl,
    ADD COLUMN settleBodyHtml TEXT         NULL AFTER settleSubject;
