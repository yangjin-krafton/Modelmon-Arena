
# 모델몬 1기 스킬 도감

포켓몬 1기 기술 165개 전체를 기준으로 만든 `스킬 전용 도감` 샘플 폴더입니다.

이번 버전은 `src/data`에 있는 실제 게임용 스킬 CSV를 읽는 샌드박스 뷰어입니다.

구성:

- `src/data/modelmon-skill-dex-gen1-battle.csv`: 실제 게임용 1기 스킬 CSV
- `index.html`: 스킬 도감 화면
- `app.js`: CSV 파싱과 필터 로직
- `styles.css`: 화면 스타일

데이터 구조:

- 전투 원소
- 능력 패턴
- 상태군
- 상태 원소
- 위력 / 명중 / PP
- 우리 게임용 효과 설명

실행:

```bash
cd sandbox/modelmon-skill-dex-gen1-full
python3 -m http.server 8092
```

또는 서버 없이 `index.html`을 직접 열어도 됩니다.

메모:

- `file://` 실행을 위해 `index.html` 안에도 같은 게임용 CSV를 넣어 두었습니다.
- 검수용 컬럼인 `원본 타입`, `원본 분류`, `AI 개념`, `AI 키워드`, `매핑 메모`는 실제 게임 CSV에서 제거했습니다.
- 목록과 상세는 실제 전투에 쓰는 값만 보여줍니다.
