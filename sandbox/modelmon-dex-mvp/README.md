# 모델몬 도감 MVP 샘플

`001~009` 샘플을 대상으로 한 도감 MVP 실험 폴더입니다.

구성:

- `data/modelmon-dex-001-009.csv`: 도감 기준 CSV
- `index.html`: CSV를 읽어 카드형 도감으로 보여주는 정적 화면
- `../originals/001.png ~ 009.png`: 샘플 아트 원본 참조

실행:

```bash
cd sandbox/modelmon-dex-mvp
python3 -m http.server 8090
```

그 다음 브라우저에서 `http://localhost:8090`을 열면 됩니다.

또는 서버 없이 `index.html`을 브라우저에서 바로 열어도 됩니다.

메모:

- 현재는 `도감 MVP` 기준이라 전투 스탯 대신 `AI 개념`, `입출력 방식`, `모델 파라미터`, `실제 파일 크기`, `설명` 중심으로 정리했습니다.
- 이미지는 복사하지 않고 `sandbox/originals` 경로를 직접 참조합니다.
- `file://` 실행을 위해 CSV 내용을 `index.html` 내부에도 같이 넣어 두었습니다.
- 다음 단계에서는 이 CSV를 `001~151` 전체 포맷으로 확장하거나, `핵심 개념/보조 개념/입출력 방식` 사전을 별도 CSV로 분리하면 됩니다.
