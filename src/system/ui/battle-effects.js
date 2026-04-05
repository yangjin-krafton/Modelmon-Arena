/**
 * 전투 모션 효과 시스템
 *
 * 패턴(19종 → 11타입) × 속성(12종) 클래스 조합으로
 * 165개 스킬을 모두 커버하는 모듈화 효과 매니저.
 *
 * 공개 API:
 *   initEffects()                     — DOM 초기화 (initBattle 에서 한 번 호출)
 *   playSkillEffect(side, skill)      — 스킬 효과 재생
 *   playMonEnter(target)              — 몬스터 등장 애니메이션
 *   playMonFaint(target)              — 몬스터 기절
 *   playMonRecall(target)             — 몬스터 교체 퇴장 (볼로 복귀)
 *   playNpcIntro(npcType, onReady)    — NPC 등장 → 자동 퇴장 후 콜백
 *   playBallThrow(onLand)             — 모델볼 투척 포물선
 *   playCapture()                     — 포획 성공 모션
 *   clearAllEffects()                 — 즉시 전체 초기화
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

/* ── 적 공격형 패턴 ────────────────────────────────── */
const HITS_OPPONENT = new Set(['slash', 'ultra', 'rapid', 'wave', 'charge', 'recoil']);

/* ── 패턴별 효과 지속 시간 (ms) ─────────────────────── */
const FX_DURATION = {
  slash:  550,
  ultra:  800,
  rapid:  700,
  wave:   650,
  charge: 850,
  buff:   800,
  shield: 700,
  status: 1800,
  drain:  900,
  recoil: 750,
  util:   550,
};

/* ── NPC 타입 → 에셋 경로 ───────────────────────────── */
const NPC_ASSET = {
  trainer:  './asset/battle-npc/trainer.svg',
  boss:     './asset/battle-npc/gym-leader.svg',
  merchant: './asset/battle-npc/merchant.svg',
};

/* ── DOM 참조 ──────────────────────────────────────── */
let fxEl         = null;
let npcEl        = null;
let enemySprite  = null;
let playerSprite = null;
let battleField  = null;
let _clearTimer  = null;
let _npcTimer    = null;

/* ════════════════════════════════════════════════════
   공개 API — 초기화
════════════════════════════════════════════════════ */

export function initEffects() {
  fxEl         = document.querySelector('.bf-fx');
  npcEl        = document.getElementById('battle-npc');
  enemySprite  = document.querySelector('.enemy-sprite');
  playerSprite = document.querySelector('.player-sprite');
  battleField  = document.querySelector('.battle-field');
}

/* ════════════════════════════════════════════════════
   공개 API — 스킬 효과
════════════════════════════════════════════════════ */

/**
 * @param {'player'|'enemy'} side
 * @param {{ pattern: string, element: string }} skill
 */
export function playSkillEffect(side, skill) {
  if (!fxEl || !skill) return;

  const fxType    = PATTERN_FX[skill.pattern] ?? 'util';
  const elemClass = ELEM_CLASS[skill.element]  ?? '';

  _resetFx();
  void fxEl.offsetWidth;

  fxEl.dataset.actor = side;
  if (elemClass) fxEl.classList.add(elemClass);
  fxEl.classList.add(`p-${fxType}`);

  _applySpriteFx(side, fxType);

  const dur = FX_DURATION[fxType] ?? 600;
  _clearTimer = setTimeout(_resetFx, dur);
}

/* ════════════════════════════════════════════════════
   공개 API — 몬스터 등장 / 퇴장
════════════════════════════════════════════════════ */

/**
 * 몬스터 등장 bounce-in
 * @param {'player'|'enemy'} target
 */
export function playMonEnter(target) {
  const sprite = _getSprite(target);
  if (!sprite) return;
  const cls = target === 'enemy' ? 'fx-mon-enter-enemy' : 'fx-mon-enter-player';
  _clearMonAnim(sprite);
  sprite.classList.remove('fx-hidden');
  void sprite.offsetWidth;
  sprite.classList.add(cls);
  sprite.addEventListener('animationend', () => sprite.classList.remove(cls), { once: true });
}

/**
 * 몬스터 기절 (HP → 0)
 * @param {'player'|'enemy'} target
 */
export function playMonFaint(target) {
  const sprite = _getSprite(target);
  if (!sprite) return;
  _clearMonAnim(sprite);
  void sprite.offsetWidth;
  sprite.classList.add('fx-mon-faint');
  // faint 완료 후에도 opacity:0 유지 (animation forwards)
}

/**
 * 교체 퇴장 — 볼로 빨려들어감
 * @param {'player'|'enemy'} target
 * @param {Function}         [callback] — 애니메이션 완료 후 호출
 */
export function playMonRecall(target, callback) {
  const sprite = _getSprite(target);
  if (!sprite) return;
  _clearMonAnim(sprite);
  void sprite.offsetWidth;
  sprite.classList.add('fx-mon-recall');
  setTimeout(() => {
    if (callback) callback();
  }, 360);
}

/* ════════════════════════════════════════════════════
   공개 API — NPC 훈련사 / 관장 등장
════════════════════════════════════════════════════ */

/**
 * NPC 등장 → 적 스프라이트 숨김 → 800ms 후 NPC 퇴장 + 적 몬 등장 → onReady 호출
 * @param {'trainer'|'boss'|'merchant'} npcType
 * @param {Function} onReady — 적 몬 등장 완료 후 게임 시작 콜백
 */
export function playNpcIntro(npcType, onReady) {
  if (!npcEl || !enemySprite) { onReady?.(); return; }

  const src = NPC_ASSET[npcType] ?? NPC_ASSET.trainer;

  // 적 스프라이트 숨기고 NPC 등장
  enemySprite.classList.add('fx-hidden');
  _clearNpcAnim();

  npcEl.src = src;
  npcEl.classList.remove('npc-enter', 'npc-exit');
  void npcEl.offsetWidth;
  npcEl.classList.add('npc-enter');

  // 800ms 후: NPC 퇴장 + 적 몬 등장
  _npcTimer = setTimeout(() => {
    _playNpcExit();
    enemySprite.classList.remove('fx-hidden');
    playMonEnter('enemy');

    // 몬 등장 애니메이션(480ms) 완료 후 onReady
    setTimeout(() => { onReady?.(); }, 500);
  }, 800);
}

/* ════════════════════════════════════════════════════
   공개 API — 모델볼 투척
════════════════════════════════════════════════════ */

/**
 * 모델볼을 플레이어→적 방향으로 투척
 * @param {Function} [onLand] — 볼 착지(750ms) 후 콜백 — playCaptureTry 를 여기서 호출
 */
export function playBallThrow(onLand) {
  if (!fxEl || !battleField) { onLand?.(); return; }

  const fw = battleField.offsetWidth;
  const fh = battleField.offsetHeight;
  const sx = 38;
  const sy = fh - 46;
  const dx = fw - 48 - sx;
  const dy = 42 - sy;

  const ball = fxEl.querySelector('.bf-fx__ball');
  if (ball) {
    ball.style.left      = `${sx}px`;
    ball.style.top       = `${sy}px`;
    ball.style.opacity   = '1';
    ball.style.transform = '';
    ball.style.animation = '';
  }

  _resetFx();
  void fxEl.offsetWidth;

  fxEl.style.setProperty('--ball-dx', `${dx}px`);
  fxEl.style.setProperty('--ball-dy', `${dy}px`);
  fxEl.style.setProperty('--ball-sx', `${sx}px`);
  fxEl.style.setProperty('--ball-sy', `${sy}px`);
  fxEl.dataset.actor = 'player';
  fxEl.classList.add('p-ball');

  // 착지 좌표 저장 (playCaptureTry 에서 재배치용)
  fxEl._ballTarget = { left: sx + dx, top: sy + dy };

  // arc 완료(750ms) 후 콜백 — fxEl 리셋 없음 (playCaptureTry 가 처리)
  _clearTimer = setTimeout(() => {
    _clearTimer = null;
    onLand?.();
  }, 750);
}

/**
 * 볼 착지 후 포획 시도 연출
 *   흡수(700ms) → 흔들기(1100ms) → 잠금 or 열림 → onComplete
 * @param {boolean}  success    — true=포획 성공, false=탈출
 * @param {Function} onComplete — 전체 연출 완료 후 콜백
 */
export function playCaptureTry(success, onComplete) {
  if (!fxEl) { onComplete?.(); return; }

  const ball   = fxEl.querySelector('.bf-fx__ball');
  const target = fxEl._ballTarget;

  // 볼을 착지 위치로 재배치
  if (ball && target) {
    ball.style.animation = 'none';
    ball.style.left      = `${target.left}px`;
    ball.style.top       = `${target.top}px`;
    ball.style.opacity   = '1';
    ball.style.transform = 'scale(0.7)';
    void ball.offsetWidth;
    ball.style.transform = '';
  }
  fxEl.className = 'bf-fx';
  delete fxEl.dataset.actor;

  // ── 1: 적 몬 흡수 ──────────────────────────────────
  if (enemySprite) {
    _clearMonAnim(enemySprite);
    void enemySprite.offsetWidth;
    enemySprite.classList.add('fx-capture');
  }

  // ── 2: 볼 흔들기 (700ms 후) ────────────────────────
  setTimeout(() => {
    _resetFx();
    void fxEl.offsetWidth;
    if (ball && target) {
      ball.style.left      = `${target.left}px`;
      ball.style.top       = `${target.top}px`;
      ball.style.opacity   = '1';
      ball.style.transform = 'scale(0.7)';
    }
    fxEl.classList.add('p-ball-wobble');

    // ── 3: 결과 (1100ms 후 = 1800ms 총) ────────────────
    setTimeout(() => {
      _resetFx();
      void fxEl.offsetWidth;
      if (ball && target) {
        ball.style.left      = `${target.left}px`;
        ball.style.top       = `${target.top}px`;
        ball.style.opacity   = '1';
        ball.style.transform = 'scale(0.7)';
      }

      if (success) {
        // 잠금 + 황금 플래시
        fxEl.classList.add('p-ball-lock');
        setTimeout(() => {
          _resetFx();
          if (ball) ball.style.opacity = '0';
          onComplete?.();
        }, 950);
      } else {
        // 볼 열림 → 적 재등장
        fxEl.classList.add('p-ball-break');
        setTimeout(() => {
          if (enemySprite) {
            _clearMonAnim(enemySprite);
            void enemySprite.offsetWidth;
            playMonEnter('enemy');
          }
          _resetFx();
          if (ball) ball.style.opacity = '0';
          onComplete?.();
        }, 480);
      }
    }, 1100);
  }, 700);
}

/* ════════════════════════════════════════════════════
   공개 API — 포획 모션 (전투 종료 후 즉시 표시용 레거시)
════════════════════════════════════════════════════ */

/** 전투 종료 결과에서 포획 연출 (playCaptureTry 가 없을 때 fallback) */
export function playCapture() {
  if (!enemySprite || !fxEl) return;
  _clearMonAnim(enemySprite);
  void enemySprite.offsetWidth;
  enemySprite.classList.add('fx-capture');
  _resetFx();
  void fxEl.offsetWidth;
  fxEl.classList.add('p-capture');
  _clearTimer = setTimeout(_resetFx, 1500);
}

/* ════════════════════════════════════════════════════
   공개 API — 전체 초기화
════════════════════════════════════════════════════ */

export function clearAllEffects() {
  if (_clearTimer) clearTimeout(_clearTimer);
  if (_npcTimer)   clearTimeout(_npcTimer);
  _resetFx();
  _clearNpcAnim();
  if (enemySprite)  { _clearMonAnim(enemySprite);  enemySprite.classList.remove('fx-hidden'); }
  if (playerSprite) { _clearMonAnim(playerSprite); playerSprite.classList.remove('fx-hidden'); }
}

/* ════════════════════════════════════════════════════
   내부 헬퍼
════════════════════════════════════════════════════ */

function _resetFx() {
  if (!fxEl) return;
  if (_clearTimer) { clearTimeout(_clearTimer); _clearTimer = null; }
  fxEl.className = 'bf-fx';
  fxEl.style.removeProperty('--ball-dx');
  fxEl.style.removeProperty('--ball-dy');
  delete fxEl.dataset.actor;
}

function _getSprite(target) {
  return target === 'enemy' ? enemySprite : playerSprite;
}

function _clearMonAnim(sprite) {
  if (!sprite) return;
  sprite.classList.remove(
    'fx-mon-enter-enemy', 'fx-mon-enter-player',
    'fx-mon-faint', 'fx-mon-recall', 'fx-capture',
    'fx-shake', 'fx-flash', 'fx-recoil',
  );
}

function _clearNpcAnim() {
  if (!npcEl) return;
  if (_npcTimer) { clearTimeout(_npcTimer); _npcTimer = null; }
  npcEl.classList.remove('npc-enter', 'npc-exit');
  npcEl.style.opacity = '0';
  npcEl.style.transform = 'translateX(110%)';
}

function _playNpcExit() {
  if (!npcEl) return;
  npcEl.classList.remove('npc-enter');
  void npcEl.offsetWidth;
  npcEl.classList.add('npc-exit');
  npcEl.addEventListener('animationend', () => {
    npcEl.style.opacity = '0';
    npcEl.classList.remove('npc-exit');
  }, { once: true });
}

function _applySpriteFx(side, fxType) {
  if (fxType === 'buff' || fxType === 'shield' || fxType === 'util') return;

  const isAttack = HITS_OPPONENT.has(fxType);
  const targetEl = isAttack
    ? (side === 'player' ? enemySprite  : playerSprite)
    : (side === 'player' ? playerSprite : enemySprite);

  const impactCls = fxType === 'ultra' ? 'fx-flash' : 'fx-shake';
  const delay = (fxType === 'slash' || fxType === 'recoil') ? 180 : 0;
  setTimeout(() => _setSpriteCls(targetEl, impactCls), delay);

  if (fxType === 'recoil') {
    const casterEl = side === 'player' ? playerSprite : enemySprite;
    setTimeout(() => _setSpriteCls(casterEl, 'fx-recoil'), 320);
  }
  if (fxType === 'drain') {
    const selfEl = side === 'player' ? playerSprite : enemySprite;
    setTimeout(() => _setSpriteCls(selfEl, 'fx-shake'), 400);
  }
}

function _setSpriteCls(el, cls) {
  if (!el) return;
  el.classList.remove('fx-shake', 'fx-flash', 'fx-recoil');
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 500);
}
