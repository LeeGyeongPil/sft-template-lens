# 보안 정책 / Security policy

보안 취약점을 발견하셨다면 **공개 이슈 대신** 이 레포의 **Security → Report a vulnerability**(비공개 취약점 신고)로 알려 주세요. 확인 후 답변드리고, 고친 버전을 릴리스하면서 함께 안내합니다.

If you find a security issue, please **do not open a public issue**. Use **Security → Report a vulnerability** in this repository to report it privately. We will reply after checking and announce the fix with a release.

이 도구는 서버를 띄우지 않습니다. 웹 화면은 브라우저 안에서만 데이터를 처리하고, 허브 모드에서만 huggingface.co 에 모델 파일을 요청합니다. `npm start`(개발 서버)는 Vite 기본값대로 localhost 에서만 열립니다.

This tool does not run a server. The web page processes your data only inside the browser, and only the hub mode requests model files from huggingface.co. `npm start` (the dev server) listens on localhost only, which is the Vite default.
