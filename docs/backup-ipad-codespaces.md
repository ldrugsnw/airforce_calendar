# iPad·Codespaces에서 백업 암호화와 다운로드

운영 DB 변경 없이 이미 확보한 백업을 암호화해 Codespaces 밖에 보관하는 사용자 작업이다. 아직 암호화·다운로드는 수행하지 않았다. `/tmp` 보관본은 Codespace 삭제/재생성 시 사라질 수 있으므로 운영 적용 전에 완료한다. 비밀번호나 암호화 암호는 채팅·Git·명령 인자로 보내지 않는다.

## 1. iPad Safari의 Codespaces 터미널에서 암호화

GnuPG는 현재 환경에 설치돼 있다. 아래 명령을 직접 실행하고, 터미널의 암호 입력 요청에 새롭고 긴 암호를 입력한다. 암호는 별도 비밀번호 관리자에 보관한다. DB 로그인 비밀번호를 재사용하지 않는다.

```bash
umask 077
mkdir -p /tmp/airforce-encrypted-export
chmod 700 /tmp/airforce-encrypted-export
export GPG_TTY="$(tty)"
set -o pipefail
tar -C /tmp/airforce-prod-backup-20261004T063759 \
  -cf - database.dump roles.sql verification.json |
  gpg --pinentry-mode loopback --no-symkey-cache \
    --symmetric --cipher-algo AES256 \
    --output /tmp/airforce-encrypted-export/airforce-backup-20261004.tar.gpg
```

이 명령은 DB 아카이브·비밀번호 없는 역할 정의·검증 보고서 세 파일만 포함한다. 인증 JSON, 복원 오류 로그, 보조 스크립트는 포함하지 않는다. 결과 파일은 기존 출력이 있으면 덮어쓰기 확인을 요구한다. 첫 암호화에 실패했다면 원본은 그대로 두고 실패 출력만 확인한 뒤 다시 진행한다.

## 2. 암호와 무결성 확인

```bash
gpg --pinentry-mode loopback --no-symkey-cache \
  --output /dev/null --decrypt \
  /tmp/airforce-encrypted-export/airforce-backup-20261004.tar.gpg

cd /tmp/airforce-encrypted-export
sha256sum airforce-backup-20261004.tar.gpg > airforce-backup-20261004.tar.gpg.sha256
sha256sum -c airforce-backup-20261004.tar.gpg.sha256
```

첫 명령이 성공 종료하면 암호를 다시 입력해 복호화·무결성을 검사한 것이다. 원본 사용자 기록을 터미널에 출력하거나 평문 파일로 풀지 않는다. 두 번째 검사는 현재 암호화 파일의 SHA-256 일치를 확인한다. 파일명을 바꾸면 검사용 파일명도 맞춰야 한다.

## 3. iPad에 다운로드해 영구 보관

1. Codespaces의 VS Code 웹에서 `File → Open Folder`로 `/tmp/airforce-encrypted-export`를 연다. 암호화 출력 두 파일만 있는 폴더다.
2. Explorer에서 `.tar.gpg`와 `.tar.gpg.sha256` 각각의 컨텍스트 메뉴 `Download`를 선택한다. 터치 메뉴가 잘 열리지 않으면 연결한 트랙패드/마우스로 오른쪽 클릭한다. GitHub 공식 안내도 브라우저 Explorer의 Download를 사용한다.
3. Safari 다운로드를 완료하고 iPad `파일` 앱에서 두 파일의 저장을 확인한다. 개인 iCloud Drive 또는 승인된 비공개 영구 보관 위치로 옮긴다. Codespaces 경로와 공유 링크는 영구 보관본으로 간주하지 않는다. 암호는 파일과 별도로 보관한다.
4. 가능한 컴퓨터에서 두 파일을 같은 폴더에 두고 `sha256sum -c airforce-backup-20261004.tar.gpg.sha256`으로 다운로드본을 확인한다. 다운로드본 해시 검사를 하기 전에는 **전송 후 무결성은 미확인**으로 남긴다. iPad에 파일이 보인다는 것만으로 복원 완료라고 판단하지 않는다.
5. 작업 폴더는 `File → Open Folder → /workspaces/airforce_calendar`로 돌아온다. 복호화 시험·전송 확인과 영구 보관이 완료될 때까지 기존 평문 백업과 복원 환경은 삭제하지 않는다.

## 복구 범위와 남은 확인

현재 백업은 PostgreSQL 17.6 전체 DB와 역할 정의다. 별도 로컬 복원에서 46개 테이블과 주요 메타데이터를 대조했고, 관리형 역할 grantor는 로컬에서만 매핑했다. 역할 비밀번호·서비스 비밀값·Dashboard Auth/OAuth/SMTP 설정과 실제 관리형 프로젝트 복구는 포함되지 않는다. Storage 객체는 점검 당시 0건이었다. 운영 적용 직전에는 이후 정상 쓰기를 반영한 새 백업도 확보해야 한다.

암호화 파일을 내려받아도 원격 적용·병합·배포를 승인한 것은 아니다. 복구 방법·미확인 Auth 설정과 최종 적용 순서는 [운영 준비 보고서](production-preparation-2026-10-04.md)를 따른다.

근거: [GnuPG 대칭 암호화·복호화](https://www.gnupg.org/documentation/manuals/gnupg/Operational-GPG-Commands.html), [GitHub Codespaces Explorer 다운로드](https://docs.github.com/en/codespaces/troubleshooting/github-codespaces-logs?tool=vscode), [Supabase 백업 범위](https://supabase.com/docs/guides/platform/backups).
