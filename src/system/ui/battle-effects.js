/**
 * 전투 모션 효과 시스템
 *
 * 패턴(19종 → 11타입) × 속성(12종) 클래스 조합으로
 * 165개 스킬을 모두 커버하는 모듈화 효과 매니저.
 *
 * 공개 API:
 *   initEffects()                  — DOM 초기화 (initBattle 에서 한 번 호출)
 *   playSkillEffect(side, skill)   — 스킬 효과 재생
 *   clearAllEffects()              — 전투 종료 등 즉시 초기화
 */

/* ── 패턴 → 애니메이션 타입 ────────────────────────── */
const PATTERN_FX = {
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

/* ── 속성 → CSS 클래스명 ────────────────────────────── */
const ELEM_CLASS = {
  '대화':    'e-talk',
  '추론':    'e-reason',
  '생성':    'e-create',
  '검색':    'e-search',
  '코드':    'e-code',
  '에이전트': 'e-agent',
  '멀티모달': 'e-multi',
  '메모리':  'e-memory',
  '정렬':    'e-align',
  '시스템':  'e-system',
  '학습':    'e-learn',
  '오염':    'e-corrupt',
};

/* ── 상대방을 타겟으로 하는 패턴 ──────────────────── */
const HITS_OPPONENT = new Set(['slash', 'ultra', 'rapid', 'wave', 'charge', 'recoil']);

/* ── 패턴별 효과 총 지속 시간 (ms) ────────────────── */
const FX_DURATION = {
  slash:  550,
  ultra:  800,
  rapid:  700,
  wave:   650,
  charge: 850,
  buff:   800,
  shield: 700,
  status: 1800,  // 잔류 (2회 맥동)
  drain:  900,
  recoil: 750,
  util:   550,
};

/* ── DOM 참조 ──────────────────────────────────────── */
let fxEl         = null;
let enemySprite  = null;
let playerSprite = null;
let _clearTimer  = null;

/* ════════════════════════════════════════════════════
   공개 API
════════════════════════════════════════════════════ */

/** DOM 준비 후 한 번 호출 */
export function initEffects() {
  fxEl        = document.querySelector('.bf-fx');
  enemySprite = document.querySelector('.enemy-sprite');
  playerSprite= document.querySelector('.player-sprite');
}

/**
 * 스킬 효과 재생
 * @param {'player'|'enemy'} side  — 시전자
 * @param {object}           skill — { pattern, element } (battle-engine의 skill 객체)
 */
export function playSkillEffect(side, skill) {
  if (!fxEl || !skill) return;

  const fxType    = PATTERN_FX[skill.pattern] ?? 'util';
  const elemClass = ELEM_CLASS[skill.element]  ?? '';

  /* 이전 효과 초기화 + animation 재시작 보장 */
  _resetFx();
  void fxEl.offsetWidth;

  /* 클래스 조합 적용 */
  fxEl.dataset.actor = side;
  if (elemClass) fxEl.classList.add(elemClass);
  fxEl.classList.add(`p-${fxType}`);

  /* 스프라이트 임팩트 */
  _applySpriteFx(side, fxType);

  /* 자동 초기화 */
  const dur = FX_DURATION[fxType] ?? 600;
  _clearTimer = setTimeout(_resetFx, dur);
}

/** 전투 종료 / 화면 전환 시 즉시 초기화 */
export function clearAllEffects() {
  if (_clearTimer) clearTimeout(_clearTimer);
  _resetFx();
  _clearSpriteFx(enemySprite);
  _clearSpriteFx(playerSprite);
}

/* ════════════════════════════════════════════════════
   내부 헬퍼
════════════════════════════════════════════════════ */

function _resetFx() {
  if (!fxEl) return;
  if (_clearTimer) { clearTimeout(_clearTimer); _clearTimer = null; }
  fxEl.className = 'bf-fx';
  delete fxEl.dataset.actor;
}

function _applySpriteFx(side, fxType) {
  if (fxType === 'buff' || fxType === 'shield' || fxType === 'util') return;

  /* 타격 대상 스프라이트 결정 */
  const isAttack  = HITS_OPPONENT.has(fxType);
  const targetEl  = isAttack
    ? (side === 'player' ? enemySprite  : playerSprite)
    : (side === 'player' ? playerSprite : enemySprite);

  /* 임팩트 종류 */
  const impactCls = fxType === 'ultra' ? 'fx-flash' : 'fx-shake';

  /* 딜레이: 빔 이동 후 임팩트 (슬래시류는 0.18s 후) */
  const delay = (fxType === 'slash' || fxType === 'recoil') ? 180 : 0;
  setTimeout(() => _setSpriteCls(targetEl, impactCls), delay);

  /* 반동: 시전자도 흔들림 (0.3s 후) */
  if (fxType === 'recoil') {
    const casterEl = side === 'player' ? playerSprite : enemySprite;
    setTimeout(() => _setSpriteCls(casterEl, 'fx-recoil'), 320);
  }

  /* drain: 타겟이 먼저 흔들린 뒤 자신도 회복 반응 */
  if (fxType === 'drain') {
    const selfEl = side === 'player' ? playerSprite : enemySprite;
    setTimeout(() => _setSpriteCls(selfEl, 'fx-shake'), 400);
  }
}

function _setSpriteCls(el, cls) {
  if (!el) return;
  _clearSpriteFx(el);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}

function _clearSpriteFx(el) {
  if (!el) return;
  el.classList.remove('fx-shake', 'fx-flash', 'fx-recoil');
}
