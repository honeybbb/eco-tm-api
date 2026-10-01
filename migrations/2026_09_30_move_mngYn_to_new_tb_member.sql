-- 관리 권한(mngYn)을 직책 기반(new_tb_code)에서 직원 기반(new_tb_member)으로 이관

-- 1) 직원 테이블에 컬럼 추가 (기본 'N')
ALTER TABLE new_tb_member
    ADD COLUMN mngYn CHAR(1) NOT NULL DEFAULT 'N' AFTER position;

-- 2) 기존 직책 mngYn='Y' 를 부여받은 직원에게 자동 상속 (일회성 이관)
UPDATE new_tb_member m
    JOIN new_tb_code c ON c.itemCd = m.position AND c.cIdx = m.cIdx
SET m.mngYn = 'Y'
WHERE c.mngYn = 'Y';

-- 3) 직책 테이블에서 mngYn 컬럼 제거
ALTER TABLE new_tb_code DROP COLUMN mngYn;
