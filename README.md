# 로또 QR 결과

동행복권 로또 6/45 용지의 QR코드를 스마트폰 카메라로 비추면
내 게임별 당첨 결과와 1~5등 전체 당첨금을 한 화면에 보여주는 웹앱(PWA)입니다.

- `public/` 화면(index.html), 매니페스트, 서비스워커, 아이콘(SVG)
- `api/draw.js` 회차별 당첨 정보 조회 (동행복권 → 실패 시 공개 미러)
- `scripts/icons.js` 빌드 시 icon.svg → 홈 화면용 PNG 생성

배포: Vercel (빌드 명령 `npm run build`, 출력 폴더 `public`)
