# Security Policy

## Reporting a vulnerability

공개 이슈에 비밀값이나 실제 상점 정보를 올리지 마세요. 보안 문제가 발견되면 저장소 관리자에게 비공개로 전달하고, 노출된 키는 즉시 폐기·재발급하세요.

## 운영 원칙

- `.env`와 토큰 파일은 커밋하지 않습니다.
- `SYNC_WRITE_ENABLED=false`를 기본값으로 유지합니다.
- 실서비스 연결 전 읽기 전용 `/api/sync/preview`로 결과를 검토합니다.
