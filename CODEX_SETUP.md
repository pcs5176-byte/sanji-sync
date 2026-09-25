# 박찬식 PC에서 시작하기

## 계정

Codex와 GitHub에 사용자의 계정으로 로그인합니다.

## Codex 프로젝트 연결

1. Codex에서 **프로젝트 추가**를 선택합니다.
2. GitHub 저장소 `pcs5176-byte/sanji-sync`를 선택합니다.
3. 프로젝트 이름을 `산지한상 상세페이지 자동화`로 지정합니다.
4. 이 저장소의 `AGENTS.md` 규칙을 확인합니다.

## Windows 로컬 실행

```powershell
git clone https://github.com/pcs5176-byte/sanji-sync.git
cd sanji-sync
Copy-Item .env.example .env
npm install
npm test
```

Cafe24 연결 전 `.env`를 본인 발급값으로 작성합니다. `.env`는 절대 GitHub에 올리지 않습니다.

## 배포 사용

Vercel에서 저장소를 Import하고 환경변수를 등록하면 PC가 꺼져 있어도 사용할 수 있습니다. 배포 후 Cafe24 Developer Center의 App URL과 Redirect URI를 배포 주소로 맞춥니다.
