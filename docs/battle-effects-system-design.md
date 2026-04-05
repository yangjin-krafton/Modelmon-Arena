# 전투 모션 효과 시스템 설계

> 모캐몬 아레나 — 배틀필드 시각 효과 모듈화 설계

---

## 1. 개요 및 목표

### 문제 정의
- 165개 스킬을 각각 개별 애니메이션으로 만들면 유지보수 불가
- 현재 배틀필드는 HP바 전환 외 시각 피드백 없음 (스프라이트 정적)
- 스킬 사용감이 없어 전투의 임팩트가 약함

### 설계 목표
- **165개 → ~23개 구현으로 커버**: 패턴 애니메이션 × 속성 테마 조합
- **CSS 중심**: JS는 클래스 추가/제거만 담당, GPU 가속 활용
- **성능 우선**: `transform` + `opacity` 만 애니메이션 (리플로우 없음)
- **모듈화**: `battle-effects.js` 단일 파일로 분리, `battle.js`에 후킹만

---

## 2. 핵심 아키텍처: 2-레이어 조합 시스템

```
스킬 사용
  │
  ├─ [레이어 1] 패턴 효과 (Pattern Effect)
  │     어떻게 공격하는가 → 모션 형태 결정
  │     (예: 슬래시, 연타, 광역 파동, 충전 후 발사)
  │
  ├─ [레이어 2] 속성 테마 (Element Theme)
  │     어떤 색/질감인가 → CSS 변수 오버라이드
  │     (예: 코드 = 청록 네온, 오염 = 보라 글리치)
  │
  └─ [레이어 3] 임팩트 피드백 (Impact Feedback)
        타격 반응 → 대상 스프라이트 반응
        (shake / flash / recoil)
```

실제 시각적 결과 예시:
- `연타` + `코드` 속성 → 청록색 데이터 파편이 빠르게 4번 충돌
- `충전 후 발동` + `생성` 속성 → 황금빛이 모이다가 한 번에 폭발
- `상태이상` + `오염` 속성 → 보라색 글리치 오버레이가 적 위에 잔류

---

## 3. 패턴 → 애니메이션 타입 매핑

19개 패턴을 11개 애니메이션 타입으로 그룹화:

| 애니메이션 타입 | 포함 패턴 | 모션 설명 |
|---|---|---|
| `SLASH` | 단일 공격, 강공격 | 직선 슬래시 → 대상 충격 |
| `ULTRA` | 초고위력 | 화면 전체 플래시 → 대형 충격 |
| `RAPID` | 연타 | 작은 충돌이 3~5회 반복 |
| `WAVE` | 광역 공격 | 넓은 파동이 화면 가로지름 |
| `CHARGE` | 충전 후 발동 | 글로우 빌드업 → 폭발 발사 |
| `BUFF` | 버프, 복제 | 시전자 주변 상승 파티클 |
| `SHIELD` | 보호막 | 시전자 앞 방어막 버블 |
| `STATUS` | 상태이상, 디버프, 행동 봉쇄 | 대상에 색깔 오버레이 잔류 |
| `DRAIN` | 흡수, 회복 | 대상→시전자 방향 에너지 이동 |
| `RECOIL` | 반동/고비용 | SLASH 후 시전자도 흔들림 |
| `UTIL` | 유틸, 교체/이탈, 랜덤 호출, 변환 | 미묘한 반짝임 + 페이드 |

---

## 4. 속성 → 색상 테마 매핑

12개 속성별 시각 정체성:

| 속성 | 주 색상 | 보조 색상 | 파티클 형태 | 특수 효과 |
|---|---|---|---|---|
| 대화 | `#7eb8ff` (라이트 블루) | `#c4e0ff` | 말풍선 점 | 물결 ripple |
| 추론 | `#a8d8ea` (시안) | `#e0f4ff` | 다이아몬드 | 수식 흐름 |
| 생성 | `#ffd166` (황금) | `#fff3cc` | 별 스파클 | 창조 파열 |
| 검색 | `#06d6a0` (에메랄드) | `#ccfff5` | 원형 펄스 | 스캔라인 |
| 코드 | `#00f5d4` (네온 청록) | `#003d35` | 사각 데이터 | 매트릭스 낙하 |
| 에이전트 | `#ef476f` (핫핑크) | `#ffd6e0` | 화살표 | 연쇄 화살 |
| 멀티모달 | `#ff9f1c` (오렌지) | `#fff0d0` | 레인보우 점 | 컬러 스플릿 |
| 메모리 | `#b5e2fa` (아이스 블루) | `#e8f6ff` | 잔상 원 | 에코 트레일 |
| 정렬 | `#c8b6ff` (라벤더) | `#f0e8ff` | 육각 실드 | 후광 링 |
| 시스템 | `#f8f9fa` (흰색) | `#adb5bd` | 사각 픽셀 | 시스템 플래시 |
| 학습 | `#95d5b2` (민트 그린) | `#d8f3dc` | 잎 상승 | 성장 링 |
| 오염 | `#9d4edd` (보라) | `#3c096c` | 글리치 조각 | RGB 분리 |

---

## 5. DOM 구조 설계

### 기존 HTML (index.html)
```html
<div class="battle-field" data-biome="..." data-time="...">
  <div class="bf-enemy-zone">...</div>
  <div class="bf-player-zone">...</div>
  <div class="battle-result">...</div>
</div>
```

### 추가할 효과 레이어
```html
<div class="battle-field" data-biome="..." data-time="...">
  <div class="bf-enemy-zone">...</div>
  <div class="bf-player-zone">...</div>

  <!-- 신규: 효과 레이어 (JS로 동적 클래스 조합) -->
  <div class="bf-fx" aria-hidden="true">
    <div class="bf-fx__projectile"></div>   <!-- 발사체/이동 효과 -->
    <div class="bf-fx__impact"></div>        <!-- 충격/폭발 효과 -->
    <div class="bf-fx__aura"></div>          <!-- 버프/상태 잔류 효과 -->
  </div>

  <div class="battle-result">...</div>
</div>
```

### 클래스 조합 방식
```javascript
// 예: 코드 속성 연타 스킬 사용 시
fxEl.className = 'bf-fx  fx-pattern--rapid  fx-elem--코드  fx-target--enemy';

// 예: 정렬 속성 보호막 스킬 사용 시 (아군)
fxEl.className = 'bf-fx  fx-pattern--shield  fx-elem--정렬  fx-target--player';
```

---

## 6. 구현 파일 구조

```
src/system/
  ├── ui/
  │   ├── battle.js             (기존 — 최소 수정)
  │   └── battle-effects.js     (신규 — 효과 시스템 전체)
  └── style/
      ├── battle.css            (기존 — 최소 수정)
      └── battle-effects.css    (신규 — 모든 keyframe + 테마 변수)
```

### battle-effects.js 공개 API
```javascript
// 스킬 사용 시 효과 트리거 (battle.js에서 호출)
export function playSkillEffect(skill, actor) { ... }
//   skill: [name, element, pattern, power, ...] — SKILLS[no] 형식
//   actor: 'player' | 'enemy'

// 상태이상 잔류 효과 (턴 종료 시 반영)
export function applyStatusFx(statusType, target) { ... }

// 효과 즉시 중단 (전투 종료 등)
export function clearAllEffects() { ... }
```

---

## 7. CSS 설계 패턴

### 7.1 CSS 변수로 테마 주입

```css
/* battle-effects.css */

/* 기본값 (fallback) */
.bf-fx {
  --fx-color-primary: #ffffff;
  --fx-color-secondary: rgba(255,255,255,0.3);
  --fx-duration-attack: 0.45s;
  --fx-duration-status: 1.2s;
}

/* 속성별 테마 오버라이드 */
.bf-fx.fx-elem--코드 {
  --fx-color-primary: #00f5d4;
  --fx-color-secondary: rgba(0, 245, 212, 0.25);
}
.bf-fx.fx-elem--오염 {
  --fx-color-primary: #9d4edd;
  --fx-color-secondary: rgba(157, 78, 221, 0.3);
}
/* ... 12개 속성 모두 */
```

### 7.2 패턴별 keyframe 예시

```css
/* SLASH: 발사체 이동 → 충격 */
@keyframes fx-slash-projectile {
  0%   { transform: translateX(var(--fx-origin-x, -60px)) scaleX(0.3); opacity: 0; }
  30%  { opacity: 1; transform: translateX(0) scaleX(1); }
  60%  { transform: translateX(var(--fx-target-x, 60px)) scaleX(0.3); opacity: 0.8; }
  100% { opacity: 0; }
}

/* RAPID: 반복 충격 (animation-iteration-count: 4) */
@keyframes fx-rapid-hit {
  0%  { transform: scale(0.5); opacity: 0; }
  40% { transform: scale(1.2); opacity: 1; }
  70% { transform: scale(0.9); opacity: 0.7; }
  100%{ transform: scale(0); opacity: 0; }
}

/* CHARGE: 빌드업 → 폭발 */
@keyframes fx-charge-buildup {
  0%  { transform: scale(0.3); opacity: 0.2; filter: brightness(1); }
  80% { transform: scale(1.5); opacity: 0.9; filter: brightness(2); }
  100%{ transform: scale(0.1); opacity: 0; }
}

/* STATUS: 잔류 오버레이 */
@keyframes fx-status-linger {
  0%,100% { opacity: 0.15; }
  50%     { opacity: 0.45; }
}

/* BUFF: 상승 파티클 */
@keyframes fx-buff-rise {
  0%  { transform: translateY(0) scale(1); opacity: 0.9; }
  100%{ transform: translateY(-40px) scale(0.3); opacity: 0; }
}

/* SHIELD: 방어막 팽창 */
@keyframes fx-shield-expand {
  0%  { transform: scale(0.8); opacity: 0; }
  40% { transform: scale(1.05); opacity: 0.9; }
  70% { transform: scale(1.0); opacity: 0.7; }
  100%{ transform: scale(1.0); opacity: 0.4; }
}

/* DRAIN: 에너지 흡수 이동 */
@keyframes fx-drain-flow {
  0%  { transform: translate(var(--fx-from-x), var(--fx-from-y)) scale(1); opacity: 0.8; }
  100%{ transform: translate(var(--fx-to-x), var(--fx-to-y)) scale(0.3); opacity: 0; }
}

/* WAVE: 넓은 파동 */
@keyframes fx-wave-spread {
  0%  { transform: scaleX(0.1); opacity: 0.8; }
  60% { transform: scaleX(1.0); opacity: 0.6; }
  100%{ transform: scaleX(1.2); opacity: 0; }
}

/* 임팩트: 타격 대상 흔들림 */
@keyframes fx-impact-shake {
  0%,100%{ transform: translateX(0); }
  20%    { transform: translateX(-6px); }
  40%    { transform: translateX(5px); }
  60%    { transform: translateX(-4px); }
  80%    { transform: translateX(3px); }
}

/* 임팩트: 강타 스케일 충격 */
@keyframes fx-impact-flash {
  0%  { filter: brightness(1) saturate(1); }
  15% { filter: brightness(3) saturate(0); }
  100%{ filter: brightness(1) saturate(1); }
}
```

### 7.3 컴포지트 클래스 (패턴+대상 조합)
```css
/* 패턴이 활성화될 때 각 하위 요소에 적용 */
.bf-fx.fx-pattern--slash .bf-fx__projectile {
  animation: fx-slash-projectile 0.45s var(--fx-easing, ease-out) forwards;
  background: radial-gradient(circle, var(--fx-color-primary), transparent 70%);
}
.bf-fx.fx-pattern--slash.fx-target--enemy .bf-fx__impact {
  animation: fx-impact-shake 0.3s ease-in-out,
             fx-impact-flash  0.25s ease-out;
  /* impact는 enemy-sprite에 직접 적용 */
}
```

---

## 8. JavaScript 구현 상세

### battle-effects.js 전체 구조

```javascript
// src/system/ui/battle-effects.js

/* ── 패턴 → 애니메이션 타입 매핑 ──────────────── */
const PATTERN_TO_FX = {
  '단일 공격':    'slash',
  '강공격':       'slash',
  '초고위력':     'ultra',
  '연타':         'rapid',
  '광역 공격':    'wave',
  '충전 후 발동': 'charge',
  '버프':         'buff',
  '복제':         'buff',
  '보호막':       'shield',
  '상태이상':     'status',
  '디버프':       'status',
  '행동 봉쇄':    'status',
  '흡수':         'drain',
  '회복':         'drain',
  '반동/고비용':  'recoil',
  '변환':         'util',
  '유틸':         'util',
  '교체/이탈':    'util',
  '랜덤 호출':    'util',
};

/* ── 공격형 패턴 (타격 임팩트 포함) ──────────── */
const ATTACK_PATTERNS = new Set([
  'slash', 'ultra', 'rapid', 'wave', 'charge', 'drain', 'recoil'
]);

/* ── 메인 API ─────────────────────────────────── */
const fxEl    = document.querySelector('.bf-fx');
const enemyEl = document.querySelector('.enemy-sprite');
const playerEl= document.querySelector('.player-sprite');

export function playSkillEffect(skill, actor) {
  // skill = [name, element, pattern, power, accuracy, pp, effect]
  const [, element, pattern] = skill;
  const fxType  = PATTERN_TO_FX[pattern] ?? 'util';
  const target  = _getTarget(fxType, actor);
  const spriteEl= target === 'enemy' ? enemyEl : playerEl;

  // 기존 효과 초기화 (클래스 재설정으로 재생 보장)
  fxEl.className = 'bf-fx';
  void fxEl.offsetWidth; // reflow 강제 → animation 재시작

  // 클래스 조합 적용
  fxEl.classList.add(
    `fx-pattern--${fxType}`,
    `fx-elem--${element}`,
    `fx-target--${target}`
  );

  // 임팩트 피드백 (공격형만)
  if (ATTACK_PATTERNS.has(fxType)) {
    _applyImpact(spriteEl, fxType);
  }

  // 상태이상은 잔류 클래스 유지 (다음 턴까지)
  const isLingering = fxType === 'status';
  const duration = isLingering ? 1200 : 600;
  if (!isLingering) {
    setTimeout(() => { fxEl.className = 'bf-fx'; }, duration);
  }
}

export function applyStatusFx(statusType, targetActor) {
  // 상태이상 잔류 효과 (별도 element가 없으므로 statusType을 elem로 사용)
  fxEl.className = `bf-fx fx-pattern--status fx-elem--${statusType} fx-target--${targetActor} fx-linger`;
}

export function clearAllEffects() {
  fxEl.className = 'bf-fx';
  enemyEl.classList.remove('fx-impact--shake', 'fx-impact--flash');
  playerEl.classList.remove('fx-impact--shake', 'fx-impact--flash');
}

/* ── 내부 헬퍼 ────────────────────────────────── */
function _getTarget(fxType, actor) {
  // 버프/쉴드/회복/변환은 시전자 자신에게 효과
  const SELF_FX = new Set(['buff', 'shield', 'drain', 'util']);
  return SELF_FX.has(fxType) ? actor : (actor === 'player' ? 'enemy' : 'player');
}

function _applyImpact(spriteEl, fxType) {
  const isHeavy = fxType === 'ultra';
  spriteEl.classList.add(isHeavy ? 'fx-impact--flash' : 'fx-impact--shake');
  setTimeout(() => {
    spriteEl.classList.remove('fx-impact--shake', 'fx-impact--flash');
  }, 400);
}
```

### battle.js 연동 (최소 수정)

```javascript
// battle.js 내 스킬 사용 처리 부분에 한 줄 추가
import { playSkillEffect } from './battle-effects.js';

// 기존 스킬 해석 로직 직후:
function applySkill(skillNo, actor) {
  const skill = SKILLS[skillNo];
  playSkillEffect(skill, actor);  // ← 이 한 줄만 추가
  // ... 기존 데미지 계산 로직
}
```

---

## 9. 구현 우선순위 로드맵

### Phase 1: 기반 구조 (즉시 구현 가능)
- [ ] `bf-fx` DOM 레이어 추가 (index.html)
- [ ] `battle-effects.css` 기본 keyframe 8종 작성
- [ ] `battle-effects.js` 기본 API 구현
- [ ] `battle.js` 훅 연결
- [ ] 속성 테마 CSS 변수 12종 정의

### Phase 2: 패턴 효과 완성
- [ ] SLASH: 발사체 + 임팩트 흔들림
- [ ] RAPID: 반복 충돌 (iteration-count 활용)
- [ ] WAVE: 가로 확산 파동
- [ ] BUFF: 상승 파티클
- [ ] SHIELD: 방어막 버블
- [ ] STATUS: 잔류 오버레이 (색상 맥동)
- [ ] DRAIN: 흡수 흐름 이동
- [ ] CHARGE: 빌드업 → 폭발
- [ ] ULTRA: 화면 플래시 + 대형 충격
- [ ] RECOIL: SLASH + 자기 흔들림
- [ ] UTIL: 미묘한 페이드 반짝임

### Phase 3: 속성 특화 (선택 강화)
- [ ] `오염`: CSS `filter: hue-rotate()` 글리치 효과
- [ ] `코드`: 하강 데이터 파편 (pseudo-element 트릭)
- [ ] `생성`: 황금 스파클 파티클 (다수 `::before`/`::after`)
- [ ] `멀티모달`: `filter: sepia() hue-rotate()` 컬러 쉬프트

---

## 10. 성능 고려사항

| 항목 | 방침 |
|---|---|
| 리플로우 방지 | `transform`, `opacity`, `filter` 만 애니메이션 |
| GPU 레이어 | `.bf-fx { will-change: transform, opacity; }` |
| 메모리 | 효과 종료 후 `className = 'bf-fx'` 즉시 초기화 |
| 중복 실행 | `void el.offsetWidth` 강제 reflow로 재시작 보장 |
| 저사양 대응 | `@media (prefers-reduced-motion: reduce)` → 효과 비활성화 |

---

## 11. 예상 파일 크기

| 파일 | 예상 크기 |
|---|---|
| `battle-effects.css` | ~250줄 / ~6KB |
| `battle-effects.js` | ~120줄 / ~3KB |
| index.html 수정 | +4줄 |
| battle.js 수정 | +2줄 (import + 호출) |

총 ~10KB 추가, 기존 코드베이스 변경 최소화.

---

## 부록: 스킬 분류 레퍼런스

### 패턴 분포 (165개 스킬)
```
단일 공격  : 공격형의 절반 이상 (약 60여개)
버프       : 약 20개
상태이상   : 약 15개
광역 공격  : 약 12개
연타       : 약 10개
보호막     : 약 8개
충전 후 발동: 약 7개
흡수       : 약 7개
강공격     : 약 6개
초고위력   : 약 5개
반동/고비용 : 약 5개
기타       : 나머지
```

### 구현 우선 대상 스킬 예시
| 스킬명 | 속성 | 패턴 | 기대 효과 |
|---|---|---|---|
| 프롬프트 연사 (007) | 대화 | 연타 | 하늘색 점 4연속 충돌 |
| 프롬프트 폭발 (041) | 대화 | 초고위력 | 전화면 하늘색 플래시 |
| 코드 인젝션 (계열) | 코드 | 상태이상 | 청록 글리치 오버레이 |
| 기억 흡수 (001) | 메모리 | 흡수 | 아이스블루 에너지 이동 |
| 오염 산성 (002) | 오염 | 단일 공격 | 보라 슬래시 + 글리치 충격 |
