# Modelmon Arena 전투 대사 시스템 가이드

## 목적

이 문서는 현재 `src/system/battle-dialogue` 코드와
`src/data/dialogue-*.csv` 테이블 기준으로
Modelmon Arena 전투 대사 시스템의 구조를 최신 상태로 정리한 문서다.

지금 전투 대사 시스템의 목표는 단순하다.

- 같은 몬스터가 같은 4개 스킬을 오래 써도
- 유저가 2시간 안에 같은 대사를 계속 본다는 느낌을 줄이고
- 전투 내용을 AI를 잘 모르는 유저도 쉽게 이해하게 만들고
- 짧은 반응부터 긴 상황 설명까지 자연스럽게 섞어 보여주는 것

## 현재 구조 요약

현재 시스템은 `스킬 고유 문장` 중심이 아니라
`스킬 타입 + 상황 태그 + 조각 조립` 중심 구조다.

즉, 문장의 핵심은 아래 순서로 결정된다.

1. 스킬을 `skill_family`로 분류한다.
2. 현재 턴 상황을 `phase`, `importance`, `commentary_role` 등으로 정리한다.
3. 최근 사용 이력을 보고 반복도를 계산한다.
4. 조건에 맞는 대사 조각을 CSV에서 고른다.
5. 변수 치환으로 몬스터 이름, 스킬 이름, 효과명을 삽입한다.

## 코드 위치

현재 코드 모듈은 아래 경로에 있다.

- `src/system/battle-dialogue/index.js`
- `src/system/battle-dialogue/dialogue-library.js`
- `src/system/battle-dialogue/battle-dialogue-generator.js`
- `src/system/battle-dialogue/template-engine.js`
- `src/system/battle-dialogue/csv.js`

## 데이터 위치

현재 대사 테이블은 아래 경로에 있다.

### 기본 출력용

- `src/data/dialogue-system.csv`
- `src/data/dialogue-explain.csv`
- `src/data/dialogue-quote.csv`

### 새 메인 조립형 scene 테이블

- `src/data/dialogue-scene-intro.csv`
- `src/data/dialogue-scene-action.csv`
- `src/data/dialogue-scene-result.csv`
- `src/data/dialogue-scene-after.csv`

### 구형 fallback 테이블

- `src/data/dialogue-opening.csv`
- `src/data/dialogue-build.csv`
- `src/data/dialogue-impact.csv`
- `src/data/dialogue-reaction.csv`
- `src/data/dialogue-closing.csv`

## 추천 출력 흐름

한 턴의 출력은 아래 레이어로 구성하는 것을 기본으로 한다.

1. `system`
2. `explain`
3. `quote`
4. `sceneIntro`
5. `sceneAction`
6. `sceneResult`
7. `sceneAfter`

scene 테이블이 충분히 채워지지 않은 경우에는
기존 `opening/build/impact/reaction/closing` 테이블을 fallback으로 사용한다.

## 현재 생성기에서 계산하는 값

`battle-dialogue-generator.js`는 입력된 전투 문맥을 바탕으로
아래 값을 자동 계산한다.

- `phase`
  - `기 / 승 / 전 / 결`
- `importance`
  - `low / mid / high`
- `commentary_role`
  - `setup / transition / analysis / highlight / climax`
- `length_band`
  - `short / medium / long`
- `skill_family`
  - `setup / strike / multi-hit / control / charge / recovery / utility`
- `usage_bucket`
  - `fresh / repeat / spam`
- `damage_band`
  - `zero / small / medium / big`
- `hp_band`
  - `high / mid / low / critical`

이 값들이 CSV 매칭 조건으로 쓰인다.

## 왜 스킬 고유 방식보다 타입 기반이 맞는가

유저는 실제 플레이에서
같은 몬스터의 같은 4개 스킬을 계속 반복해서 쓸 가능성이 높다.

따라서

- `165개 스킬 각각 전용 대사 세트`

방식으로 가면

- 작업량이 너무 커지고
- 반복 체감이 금방 생기고
- 유지보수가 어려워진다

그래서 현재 기준으로는

- `스킬 이름`은 변수 치환으로 살리고
- `문장 본체`는 `skill_family`와 상황 태그 기반으로 고르는 구조가 더 적합하다.

## 변수 치환 규칙

문장 테이블에서는 아래 플레이스홀더를 사용한다.

- `{{attacker_name}}`
- `{{defender_name}}`
- `{{monster_name}}`
- `{{target_name}}`
- `{{skill_name}}`
- `{{skill_pattern}}`
- `{{skill_family}}`
- `{{status_name}}`
- `{{effect_name}}`
- `{{damage}}`
- `{{phase}}`
- `{{importance}}`
- `{{commentary_role}}`
- `{{length_band}}`
- `{{usage_bucket}}`
- `{{damage_band}}`
- `{{hp_band}}`
- `{{momentum}}`
- `{{turn}}`
- `{{attacker_hp}}`
- `{{defender_hp}}`
- `{{attacker_brand}}`
- `{{defender_brand}}`

즉 문장 자체는 공용 자산으로 두고,
실제 고유성은 치환 변수로 넣는다.

## CSV 컬럼 규칙

현재 dialogue CSV는 공통적으로 아래 컬럼을 사용한다.

- `id`
- `weight`
- `phase`
- `importance`
- `commentary_role`
- `skill_pattern`
- `skill_family`
- `status_name`
- `momentum`
- `length_band`
- `usage_bucket`
- `damage_band`
- `hp_band`
- `tags`
- `text`

규칙:

- 빈 값 또는 `*` 는 전체 허용
- `a|b|c` 는 다중 허용
- `weight` 는 선택 가중치
- `text` 에는 플레이스홀더를 넣을 수 있음

## 반복 방지 규칙

현재 생성기는 세션 단위 메모리를 가진다.

### 1. exact repeat 방지

최근 일정 턴 안에 완전히 같은 문장이 나온 경우
선택 확률을 크게 낮춘다.

### 2. phrase repeat 방지

문장 전체는 달라도
앞부분 표현이 비슷한 경우 반복 점수를 낮춘다.

### 3. 같은 스킬 연속 사용 감지

같은 스킬이 반복되면
`usage_bucket`을 `fresh -> repeat -> spam`으로 올린다.

즉, 같은 스킬을 계속 써도
같은 대사를 그대로 다시 보여주지 않도록 설계되어 있다.

## fallback 유지 기준

현재 구형 fallback CSV는 아직 삭제 대상이 아니다.

아래 조건 중 하나라도 해당하면 유지한다.

1. scene 테이블의 행 수가 아직 부족하다.
2. 특정 `skill_family`, `length_band`, `usage_bucket` 조합이 비어 있다.
3. 실제 테스트에서 빈 문장 또는 과도한 반복이 발생한다.
4. scene 테이블만으로 충분한 커버가 검증되지 않았다.

## fallback 삭제 기준

아래 조건을 모두 만족할 때만 삭제 후보로 본다.

1. scene 4개 테이블이 메인 플레이 구간을 대부분 커버한다.
2. 자주 쓰는 `skill_family` 전부에 대해 `short / medium / long` 문장이 있다.
3. `fresh / repeat / spam` 구간별 문장이 있다.
4. 2시간 플레이 테스트에서 fallback 사용 비율이 매우 낮다.
5. 빈 대사 없이 안정적으로 생성된다.

권장 목표:

- scene hit rate `85% 이상`
- fallback hit rate `15% 이하`
- empty rate `0%`

## 현재 권장 운영 방식

현재는 아래 비율로 운영하는 것이 적절하다.

- `system / explain / quote`
  - 즉시 이해용
- `scene-*`
  - 메인 문장 자산
- `opening/build/impact/reaction/closing`
  - fallback 안전망

즉, 지금 단계에서는 fallback을 지우기보다
scene 테이블을 계속 채우는 쪽이 우선이다.

## 앞으로의 우선순위

### 1. scene 테이블 확대

먼저 아래 범위를 채운다.

- `skill_family`
- `length_band`
- `usage_bucket`
- `damage_band`
- `hp_band`

### 2. 몬스터 말투 차등화

그 다음에

- 차분형
- 발랄형
- 냉정형
- 강압형

같은 말투 축을 추가할 수 있다.

### 3. 시그니처 스킬 전용 문장

마지막으로

- 필살기
- 대표 스킬
- 보스전 기술

정도만 전용 대사를 얹는 것이 효율적이다.

## 결론

현재 `src` 기준 전투 대사 시스템의 핵심은
`스킬 이름 중심`이 아니라
`타입 중심 + 상황 중심 + 반복 방지 중심`이다.

즉 가장 중요한 것은

- 같은 4개 스킬을 오래 써도 반복이 덜 느껴지게 하는 것
- 대사 길이와 분위기를 국면에 맞게 바꾸는 것
- 몬스터 고유성은 변수 치환과 일부 시그니처 문장으로 살리는 것

이다.

이 기준으로 보면,
현재 구조는 올바른 방향으로 정리되어 있고
이후 작업의 핵심은 코드 변경보다
`scene CSV를 얼마나 촘촘하게 채우느냐`에 있다.
