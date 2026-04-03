# 모델몬 스킬 도감 MVP

`001~009` 모델몬을 대상으로 만든 스킬 도감 샘플 폴더입니다.

구성:

- `data/modelmon-skill-dex-001-009.csv`: 스킬 데이터 CSV
- `index.html`: 스킬 도감 화면
- `app.js`: CSV 파싱과 필터 로직
- `styles.css`: 화면 스타일

현재 스코프:

- 각 모델몬당 `기본기 / 시그니처 / 유틸 / 궁극기` 4개
- 총 36개 스킬
- `1기 포켓몬 기술 아키타입`을 참고해 AI 개념 스킬로 재해석

실행:

```bash
cd sandbox/modelmon-skill-dex-mvp
python3 -m http.server 8091
```

또는 서버 없이 `index.html`을 직접 열어도 됩니다.

메모:

- `file://` 실행을 위해 CSV 내용을 `index.html` 안에도 같이 넣어 두었습니다.
- 스킬 수치와 부가 효과는 밸런스 확정 전의 초안입니다.
- 다음 단계에서는 이 CSV를 기반으로 `skills.json` 또는 전투용 데이터 테이블로 분리할 수 있습니다.
