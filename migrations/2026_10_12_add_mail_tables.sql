-- 메일 발송 인프라 (AWS SES + nodemailer)
-- 1) 회사(cIdx)별 발신 설정  2) 발송 큐  3) 바운스/배송 이벤트 로그

-- =========================================================================
-- new_tb_mail_config : cIdx 별 발신 도메인/주소/표시명
-- =========================================================================
CREATE TABLE IF NOT EXISTS new_tb_mail_config (
    cIdx         INT          NOT NULL,
    fromEmail    VARCHAR(255) NOT NULL COMMENT 'SES Verified Identity 로 등록된 발신 주소',
    fromName     VARCHAR(100) NOT NULL DEFAULT '' COMMENT '수신자에게 보이는 표시명',
    replyTo      VARCHAR(255) NULL COMMENT '회신 받을 주소 (없으면 fromEmail)',
    useFl        CHAR(1)      NOT NULL DEFAULT 'Y',
    regDt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modDt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cIdx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- new_tb_mail_queue : 발송 대기/진행/완료/실패 큐
--   attachments 는 JSON 배열: [{"filename":"a.pdf","path":"/uploads/x.pdf","contentType":"application/pdf"}]
-- =========================================================================
CREATE TABLE IF NOT EXISTS new_tb_mail_queue (
    idx           BIGINT        NOT NULL AUTO_INCREMENT,
    cIdx          INT           NOT NULL,
    toEmail       VARCHAR(255)  NOT NULL,
    toName        VARCHAR(100)  NULL,
    subject       VARCHAR(500)  NOT NULL,
    bodyHtml      MEDIUMTEXT    NULL,
    bodyText      MEDIUMTEXT    NULL,
    attachments   JSON          NULL,
    status        VARCHAR(20)   NOT NULL DEFAULT 'PENDING'
                  COMMENT 'PENDING | SENDING | SENT | FAILED | CANCELED',
    attempts      INT           NOT NULL DEFAULT 0,
    lastError     TEXT          NULL,
    scheduledAt   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sentAt        DATETIME      NULL,
    sesMessageId  VARCHAR(255)  NULL,
    refType       VARCHAR(50)   NULL COMMENT '예: SETTLEMENT',
    refIdx        BIGINT        NULL COMMENT '예: 정산서 idx',
    regMIdx       INT           NULL COMMENT '발송 요청한 매니저 idx',
    regDt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modDt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (idx),
    KEY idx_mail_queue_status_sched (status, scheduledAt),
    KEY idx_mail_queue_cIdx_regDt   (cIdx, regDt),
    KEY idx_mail_queue_ref          (refType, refIdx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================================================
-- new_tb_mail_log : SES 가 SNS 로 전달하는 Bounce/Complaint/Delivery 이벤트 보관
-- =========================================================================
CREATE TABLE IF NOT EXISTS new_tb_mail_log (
    idx          BIGINT       NOT NULL AUTO_INCREMENT,
    queueIdx     BIGINT       NULL,
    sesMessageId VARCHAR(255) NULL,
    eventType    VARCHAR(30)  NOT NULL COMMENT 'BOUNCE | COMPLAINT | DELIVERY | REJECT',
    payload      JSON         NULL,
    regDt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (idx),
    KEY idx_mail_log_queueIdx (queueIdx),
    KEY idx_mail_log_msgId    (sesMessageId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
