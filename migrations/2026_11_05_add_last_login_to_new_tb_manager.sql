-- 관리자 최종 로그인 IP 기록용 컬럼 추가
-- lastLoginDt 는 기존에 존재. lastLoginIp 만 신규 추가.
-- 로그인 성공 시 authModel.updateLastLogin 에서 UPDATE 된다.

ALTER TABLE new_tb_manager
    ADD COLUMN lastLoginIp VARCHAR(45) NULL DEFAULT NULL AFTER lastLoginDt;
