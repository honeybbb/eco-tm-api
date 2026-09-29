-- =====================================================================
-- 관리자 탭 즐겨찾기 테이블
-- : new_tb_manager 의 관리자가 자주 쓰는 탭(경로)을 저장한다.
-- : (cIdx + managerId + path) 기준 UNIQUE 로 중복 저장을 막는다.
-- =====================================================================
CREATE TABLE IF NOT EXISTS new_tb_manager_favorite (
    idx         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '기본 키',
    cIdx        INT UNSIGNED NOT NULL             COMMENT '회사 idx (new_tb_config.idx)',
    managerId   VARCHAR(50)  NOT NULL             COMMENT '관리자 아이디 (new_tb_manager.managerId)',
    path        VARCHAR(255) NOT NULL             COMMENT '즐겨찾기 대상 라우트 경로 (예: /site/list)',
    title       VARCHAR(100) NOT NULL             COMMENT '탭에 표기할 이름',
    sort        INT          NOT NULL DEFAULT 0   COMMENT '표시 순서 (오름차순)',
    regDt       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록일시',
    modDt       DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP  COMMENT '수정일시',
    PRIMARY KEY (idx),
    UNIQUE KEY uniq_manager_fav (cIdx, managerId, path),
    KEY idx_manager (cIdx, managerId)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '관리자 탭 즐겨찾기';
