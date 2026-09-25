# Sanji Sync

Cafe24 OAuth와 하루팜 상품 정보를 연결해 산지한상 상품 상세페이지·가격·재고 동기화를 돕는 Vercel/Node.js 자동화 앱입니다.

## 공개 사용 전 확인

이 저장소에는 실행 코드와 설정 예시만 포함합니다. Cafe24 앱 권한, 하루팜 API 자격증명, Vercel 환경변수는 사용자가 직접 설정해야 합니다. 실제 상품을 변경하는 동기화는 `SYNC_WRITE_ENABLED=true`일 때만 활성화되며, 기본값은 `false`입니다.

## 시작하기

1. Node.js 20 이상과 Vercel CLI를 준비합니다.
2. 저장소를 내려받고 `npm install`을 실행합니다.
3. `.env.example`을 `.env`로 복사하고 각 서비스의 본인 값으로 채웁니다.
4. `npm test`로 검증합니다.
5. `npm run dev`로 로컬 미리보기를 실행합니다.
6. Vercel에 배포한 뒤 Cafe24 Developer Center의 App URL과 Redirect URI를 배포 주소에 맞춰 등록합니다.

## 주요 기능

- Cafe24 OAuth 연결과 암호화된 HttpOnly 쿠키 기반 세션
- 읽기 전용 상품 동기화 미리보기
- 검수 후 가격·재고·품절 상태 반영
- 상품 상세페이지 배치 반영 로직
- Vercel Cron 기반 예약 동기화

## 보안

절대 API 키, Client Secret, OAuth 토큰, Redis 토큰을 커밋하지 마세요. 공개 배포 전 Vercel 프로젝트의 환경변수와 Cafe24 앱 권한을 다시 확인하세요. 자세한 내용은 `SECURITY.md`를 참고하세요.

## 라이선스

MIT License. 단, Cafe24·하루팜·Vercel 등 외부 서비스의 이용약관과 API 사용정책을 따라야 합니다.
