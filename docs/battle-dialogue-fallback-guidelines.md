# Battle Dialogue Fallback Guidelines

## 목적

이 문서는 `src/data` 아래 전투 대사 CSV 중

- 새 조립형 scene 테이블
- 기존 fallback 테이블

을 어떤 기준으로 유지하거나 삭제할지 정리한다.

## 현재 역할 구분

### 메인 테이블

아래 4개는 앞으로 전투 대사 시스템의 메인 자산이다.

- `src/data/dialogue-scene-intro.csv`
- `src/data/dialogue-scene-action.csv`
- `src/data/dialogue-scene-result.csv`
- `src/data/dialogue-scene-after.csv`

생성기는 이 4개를 먼저 보고,
여기서 충분한 문장을 찾지 못할 때만 fallback으로 내려간다.

### fallback 테이블

아래 5개는 구형 구조이지만 아직 안전망으로 필요하다.

- `src/data/dialogue-opening.csv`
- `src/data/dialogue-build.csv`
- `src/data/dialogue-impact.csv`
- `src/data/dialogue-reaction.csv`
- `src/data/dialogue-closing.csv`

이 테이블들은 scene 테이블이 아직 비어 있거나,
특정 조건 조합이 충분히 채워지지 않았을 때를 위한 백업이다.

## 유지 기준

fallback CSV는 아래 조건 중 하나라도 해당하면 유지한다.

1. scene 테이블의 행 수가 아직 적다.
2. 특정 `skill_family`, `length_band`, `usage_bucket` 조합이 scene 테이블에 없다.
3. 실제 플레이 테스트에서 빈 문장 또는 과도한 반복이 발생한다.
4. 대사 생성기가 fallback 없이 충분한 문장을 뽑는지 아직 검증되지 않았다.

## 삭제 기준

fallback CSV는 아래 조건을 모두 만족할 때 삭제 후보가 된다.

1. scene 4개 테이블이 메인 플레이 구간을 대부분 커버한다.
2. 자주 쓰는 `skill_family` 전부에 대해 `short / medium / long` 문장이 있다.
3. `fresh / repeat / spam` 반복도 구간별 문장이 있다.
4. 2시간 플레이 테스트에서 fallback 히트 비율이 거의 0에 가깝다.
5. 삭제 후에도 빈 대사 없이 생성이 유지된다.

## 권장 측정 기준

삭제 여부는 감으로 판단하지 말고 아래 수치로 본다.

- scene hit rate
  - scene 테이블에서 바로 뽑힌 비율
- fallback hit rate
  - fallback까지 내려간 비율
- empty rate
  - 어떤 문장도 못 뽑은 비율
- repeat complaint rate
  - 플레이 테스트에서 반복 체감이 보고된 비율

권장 목표:

- scene hit rate `85% 이상`
- fallback hit rate `15% 이하`
- empty rate `0%`

## 실무 권장안

당장은 fallback CSV를 지우지 않는다.

우선순위는 아래와 같다.

1. scene 테이블 문장을 먼저 늘린다.
2. 플레이 로그에서 fallback 사용 빈도를 본다.
3. 충분히 커버된 뒤에 fallback를 단계적으로 축소한다.

즉, 현재 시점에서 fallback CSV는 `삭제 대상`이 아니라
`점진적 축소 대상`으로 보는 것이 맞다.
