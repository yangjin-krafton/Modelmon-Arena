# Modelmon Arena Battle Dialogue Guide

## 목적

이 문서는 현재 `src/system/battle-dialogue` 코드와  
`src/data/dialogue-*.csv` 테이블을 기준으로 전투 대사 시스템의 실제 구조를 정리한 문서다.

현재 목표는 아래 4가지다.

- 같은 몬스터가 같은 4개 스킬을 오래 써도 대사가 금방 바닥나지 않을 것
- 유저가 AI를 잘 몰라도 지금 상황을 쉽게 이해할 수 있을 것
- 짧은 반응과 긴 해설이 섞여 읽는 리듬이 생길 것
- 나중에 실제 전투 시스템에서 함수 호출만으로 쉽게 붙일 수 있을 것

## 현재 구조 요약

현재 시스템은 `스킬 고유 문장` 중심이 아니라  
`스킬 타입 + 상황 태그 + 조각 조립 + 반복 방지` 중심 구조다.

흐름은 아래 순서로 움직인다.

1. 전투 결과를 입력으로 받는다.
2. `phase`, `importance`, `commentary_role`, `length_band`를 계산한다.
3. `skill_pattern`을 `skill_family`로 정규화한다.
4. 같은 스킬 반복 사용 여부를 보고 `usage_bucket`을 계산한다.
5. CSV에서 조건에 맞는 문장 조각을 고른다.
6. 변수 치환으로 몬스터명과 스킬명 등을 끼워 넣는다.
7. 최근 사용 문장을 기억해서 완전 동일 문장 반복을 줄인다.

## 코드 위치

- `src/system/battle-dialogue/index.js`
- `src/system/battle-dialogue/dialogue-library.js`
- `src/system/battle-dialogue/battle-dialogue-generator.js`
- `src/system/battle-dialogue/template-engine.js`
- `src/system/battle-dialogue/csv.js`
- `src/system/battle-dialogue/dialogue-batch-pipeline.js`
- `src/system/battle-dialogue/run-dialogue-smoke-test.mjs`
- `src/system/battle-dialogue/run-dialogue-batch-demo.mjs`

## 데이터 위치

### 기본 출력층

- `src/data/dialogue-system.csv`
- `src/data/dialogue-explain.csv`
- `src/data/dialogue-quote.csv`

### 메인 조립층

- `src/data/dialogue-scene-intro.csv`
- `src/data/dialogue-scene-action.csv`
- `src/data/dialogue-scene-result.csv`
- `src/data/dialogue-scene-after.csv`

### fallback 테이블

- `src/data/dialogue-opening.csv`
- `src/data/dialogue-build.csv`
- `src/data/dialogue-impact.csv`
- `src/data/dialogue-reaction.csv`
- `src/data/dialogue-closing.csv`

## 출력 레이어

기본 출력 순서는 아래를 기준으로 한다.

1. `system`
2. `explain`
3. `quote`
4. `sceneIntro`
5. `sceneAction`
6. `sceneResult`
7. `sceneAfter`

`scene-*` 테이블에서 매칭이 안 나오는 조각은 같은 위치의 fallback 테이블로 보강한다.

- `sceneIntro -> opening`
- `sceneAction -> build`
- `sceneResult -> impact`
- `sceneAfter -> closing`

## 생성기가 계산하는 값

`battle-dialogue-generator.js`는 입력된 전투 문맥을 바탕으로 아래 값을 자동 계산한다.

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

이 값들은 CSV 필터 조건과 반복 방지 판단에 같이 사용된다.

## 문자열 작성 지침

### 기본 톤

- 소설체보다 `20대 대한민국 여성 구어체`에 맞춘다.
- 설명문처럼 딱딱하게 쓰지 않는다.
- 과한 밈체는 피한다.
- 읽는 사람이 바로 장면을 이해할 수 있어야 한다.

### 문장 길이

- `short`: 20자 안팎에서 50자 정도
- `medium`: 50자에서 110자 정도
- `long`: 110자에서 200자 안쪽

같은 카테고리 안에서도 짧은 문장과 긴 문장을 섞는다.

### 문체 원칙

- 한 줄에 정보 하나만 억지로 몰지 않는다.
- 짧게 끊는 문장과 길게 풀어 주는 문장을 섞는다.
- 같은 표현을 연속으로 복제하지 않는다.
- `쉽게 보면`, `지금은`, `근데`, `그래서` 같은 연결어는 쓰되 남용하지 않는다.
- 숫자 설명보다 흐름 설명을 우선한다.

### 금지에 가까운 것

- 모든 문장을 `...다`, `...이었다` 식 문어체로 통일하기
- `ㅋㅋ`, `헐`, `미쳤다`, `레전드` 같은 강한 밈 표현을 기본값으로 쓰기
- 너무 방송 중계처럼 과장된 어휘만 반복하기
- 한 카테고리에서 같은 말버릇을 여러 행에 복붙하기

### 카테고리별 역할

- `system`
  - 사실 전달 중심
  - 짧고 명확해야 함
- `explain`
  - 유저가 쉽게 이해하는 해설
  - 왜 중요한지 설명해야 함
- `quote`
  - 캐릭터 반응
  - 짧지만 감정선이 있어야 함
- `scene-*`
  - 읽는 재미를 만드는 본문
  - 장면 묘사와 국면 해설을 함께 담당

### 변수 사용 원칙

- 문장 자체는 공용으로 유지하고 고유성은 변수 치환으로 낸다.
- 같은 행 안에서 변수는 1개에서 3개 정도가 적당하다.
- 변수만 바뀌고 문장 골격이 똑같은 행을 과도하게 늘리지 않는다.

## 변수 치환 규칙

지원 플레이스홀더는 아래와 같다.

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

## CSV 컬럼 규칙

모든 dialogue CSV는 아래 컬럼을 공통 사용한다.

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

세부 규칙은 아래와 같다.

- 빈 값 또는 `*` 는 전체 허용
- `a|b|c` 형식은 다중 허용
- `weight` 는 선택 가중치
- `tags` 는 추가 교차 필터
- `text` 는 플레이스홀더 포함 가능

## 반복 방지 규칙

세션 단위 메모리를 사용한다.

### exact repeat 방지

최근 일정 턴 안에 같은 `row.id`가 이미 사용됐으면 가중치를 크게 깎는다.

### phrase repeat 방지

완전 동일 행이 아니어도 비슷한 문장 골격이 최근에 나왔으면 다시 뽑힐 확률을 낮춘다.

### 같은 스킬 연속 사용

같은 스킬을 계속 쓰면 `usage_bucket`이 바뀐다.

- `fresh`
- `repeat`
- `spam`

즉 같은 기술을 계속 써도 문장 선택 기준이 같이 변한다.

## fallback 유지 기준

현재 fallback CSV는 아직 삭제 대상이 아니다.

아래 조건 중 하나라도 해당하면 유지한다.

1. `scene-*` 테이블의 커버가 아직 부족하다.
2. 자주 나오는 `skill_family`, `length_band`, `usage_bucket` 조합이 비어 있다.
3. 테스트에서 빈 문장이나 과도한 반복이 나온다.
4. `scene-*`만으로 2시간 플레이 커버가 충분히 검증되지 않았다.

## fallback 삭제 기준

아래 조건이 모두 충족될 때만 삭제 후보로 본다.

1. `scene-*` 4개 테이블이 주력 플레이 구간을 대부분 커버한다.
2. 주요 `skill_family`별로 `short / medium / long` 문장이 있다.
3. `fresh / repeat / spam` 구간별 문장이 있다.
4. 2시간 플레이 테스트에서 fallback 비율이 매우 낮다.
5. 빈 출력이 없다.

권장 목표치는 아래다.

- `scene hit rate`: 85% 이상
- `fallback hit rate`: 15% 이하
- `empty rate`: 0%

## 대량 작성 워크플로우

현재 `src/system/battle-dialogue`에는 두 단계의 authoring workflow가 있다.

### 1. 단건 승인 루프

파일:

- `src/system/battle-dialogue/dialogue-workflow.js`
- `src/system/battle-dialogue/run-dialogue-workflow.mjs`

용도:

- 한 개 job에 대해
- `writer -> reviewer -> revise -> approve/reject`
- 흐름을 가장 단순하게 검증할 때 사용

핵심 입력:

- `job.id`
- `job.category`
- `job.rowDefaults`
- `job.requiredPlaceholders`
- `job.promptHints`

핵심 출력:

- `approvedDraft`
- `approvedRow`
- `attempts`
- `lastReview`

### 2. 대량 배치 루프

파일:

- `src/system/battle-dialogue/dialogue-batch-pipeline.js`
- `src/system/battle-dialogue/run-dialogue-batch-demo.mjs`

용도:

- 여러 개의 대사 작성 job을 순서대로 돌릴 때 사용
- 나중에 실제 writer agent 1개, reviewer agent 1개를 외부 함수로 붙이기 쉽게 설계됨

상태 전이:

- `queued`
- `writing`
- `reviewing`
- `needs_revision`
- `approved`
- `rejected`

검수 결정:

- `approve`
- `revise`

권장 검수 코드:

- `too_similar_recently`
- `placeholder_missing`
- `too_short`
- `tone_mismatch`

### 실제 연결 방식

실서비스에서는 아래처럼 붙이는 것을 권장한다.

1. writer agent
   - 카테고리와 제약 조건을 받아 draft row 생성
2. reviewer agent
   - draft row를 받아 점수, 이슈, rewrite prompt 반환
3. workflow module
   - approve면 승인 row 보존
   - revise면 rewrite prompt를 다음 writer 호출에 전달
4. 승인 row 누적
   - 카테고리별 CSV append 후보로 저장

즉 코드 레벨에서는 특정 LLM SDK를 고정하지 않고,
`writer()`와 `reviewer()` callback만 바꿔 끼우면 되도록 유지하는 것이 핵심이다.

## 테스트 방법

현재는 CSV 데이터 밀도와 시스템 분기를 빠르게 확인할 수 있도록 스모크 테스트 스크립트를 둔다.

실행:

```bash
npm run dialogue:test
npm run dialogue:workflow
npm run dialogue:batch-demo
```

이 스크립트는 아래를 출력한다.

- 카테고리별 행 개수
- `scene-*` 테이블의 `skill_family / length_band / usage_bucket` 커버 스냅샷
- 여러 전투 시나리오에서 실제 생성된 `system / explain / quote / story`
- 각 턴의 계산된 컨텍스트
- 어떤 scene 또는 fallback 행이 선택됐는지에 대한 debug 정보
- 단건 writer/reviewer 승인 루프 결과
- 배치 writer/reviewer revise -> approve 상태 전이 결과

현재 포함된 시나리오는 아래를 검증한다.

- 초반 단일 공격
- 연타 반복 사용으로 `repeat -> spam` 전이
- 버프와 보호막 분석형 턴
- 행동 제어와 상태이상 부여
- 회복 턴
- 충전형 마무리 기술

## 대량 작성 워크플로우

대량 CSV 작업은 `writer -> reviewer -> approve/revise` 2단계로 돌린다.

핵심 모듈:

- `createDialogueBatchJob()`
  - 카테고리와 목표 행 수를 가진 작업 단위 생성
- `createDialogueBatchWorkflow()`
  - 작성과 검수를 이어 붙이는 오케스트레이터

상태 전이:

- `queued`
- `writing`
- `reviewing`
- `needs_revision`
- `approved` 또는 `rejected`

최소 작업 필드:

- `jobId`
- `category`
- `requestedCount`
- `constraints`
- `reviewPolicy`
- `seedRows`

최소 검수 결과 필드:

- `decision`
  - `approve` 또는 `revise`
- `score`
- `summary`
- `issues`
- `rewritePrompt`

승인된 행은 그대로 CSV에 반영하고  
`revise`가 나오면 reviewer의 `rewritePrompt`를 writer에게 다시 넘겨 다음 시도로 이어 간다.

데모 실행:

```bash
npm run dialogue:batch-demo
```

## 현재 운영 권장

지금 단계에서는 아래 비중이 적절하다.

- `system / explain / quote`
  - 즉시 이해 담당
- `scene-*`
  - 메인 문장 자산
- `opening/build/impact/reaction/closing`
  - 보강용 fallback

즉 지금은 fallback을 급하게 지우기보다 `scene-*` 밀도를 계속 올리는 쪽이 우선이다.

## 다음 우선순위

1. `scene-*` 테이블을 더 채워서 `skill_family`별 커버를 높인다.
2. 몬스터 성격별 말투 축을 추가한다.
3. 시그니처 스킬만 별도 전용 문장으로 분리한다.
4. 실제 게임 전투 시스템과 연결해 장시간 플레이 로그를 수집한다.

## 결론

현재 `src` 기준 전투 대사 시스템은 `스킬명 고정 문장` 구조가 아니라  
`타입 기반 + 상황 기반 + 조각 조립 + 반복 방지` 구조다.

앞으로 가장 중요한 일은 코드보다는 데이터 품질 관리다.

- 자주 나오는 상황 조합을 먼저 채우기
- 짧은 문장과 긴 문장을 섞기
- 같은 말버릇 반복을 줄이기
- 스모크 테스트와 실제 플레이 로그를 같이 보면서 보강하기
