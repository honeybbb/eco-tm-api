-- 직책 코드에 관리권한(mngYn) 플래그 추가
-- 값이 'Y'인 직책의 소속 직원은 user 앱에서 청소용품 신청 / 청소 완료 사진 업로드 가능

ALTER TABLE new_tb_code
    ADD COLUMN mngYn CHAR(1) NOT NULL DEFAULT 'N' AFTER `option`;

-- (선택) 기존 직책 중 반장/실장/감독 자동 부여가 필요하면 아래 예시처럼 수동 UPDATE
-- UPDATE new_tb_code SET mngYn = 'Y'
-- WHERE groupCd = '01002' AND itemNm IN ('반장', '실장', '감독');
