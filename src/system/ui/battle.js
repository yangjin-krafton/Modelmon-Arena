/**
 * 전투 UI 컨트롤러
 * 상태 머신: idle → choosing → animating → ended
 * 스타터 선택 화면과 연동: startBattle(monId, level) 로 시작
 */

import { buildBattleMon, resolveTurn, pickEnemySkill } from '../core/battle-engine.js';
import {
  loadBattleDialogueLibrary,
  createBattleDialogueEngine,
} from '../battle-dialogue/index.js';
import { STARTER_LEVEL } from './starter.js';

/* ════════════════════════════════════════
   전투 상태
════════════════════════════════════════ */
let phase   = 'idle';   // idle | choosing | animating | ended
let turn    = 0;
let playerMon = null;
let enemyMon  = null;
let msgQueue  = [];
let dialogueEngine = null;
let libraryLoaded  = false;

/** 전투 종료 후 호출할 콜백 (nav에서 주입) */
let _onBattleEnd = null;

/* ════════════════════════════════════════
   DOM 헬퍼
════════════════════════════════════════ */
const el = id => document.getElementById(id);

/* ════════════════════════════════════════
   초기화 (1회)
════════════════════════════════════════ */
export async function initBattle(onBattleEnd) {
  _onBattleEnd = onBattleEnd;

  // 이벤트 리스너는 await 전에 동기적으로 등록
  el('battle-log').addEventListener('click', onLogClick);
  el('battle-actions').addEventListener('click', onActionClick);
  el('battle-retry-btn').addEventListener('click', onRetry);

  if (libraryLoaded) return;

  // 대화 라이브러리 비동기 로딩
  try {
    const library = await loadBattleDialogueLibrary({ baseUrl: './data' });
    dialogueEngine = createBattleDialogueEngine({ library });
    libraryLoaded = true;
  } catch (e) {
    console.warn('[battle] dialogue library load failed:', e);
    libraryLoaded = true;
  }
}

/* ════════════════════════════════════════
   전투 시작 (스타터 선택 후 호출)
════════════════════════════════════════ */
export function startBattle(starterMonId) {
  const level = STARTER_LEVEL;

  // 임시: 상대방은 스타터와 다른 기본 세 마리 중 하나를 랜덤 선택
  const enemyCandidates = ['001', '004', '007'].filter(id => id !== starterMonId);
  const enemyId = enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)];

  try {
    playerMon = buildBattleMon(starterMonId, level);
    enemyMon  = buildBattleMon(enemyId, level);
  } catch (e) {
    console.error('[battle] buildBattleMon failed:', e);
    return;
  }

  turn = 0;
  msgQueue = [];
  if (dialogueEngine) dialogueEngine.reset();

  el('battle-result').classList.add('hidden');
  el('battle-actions').classList.add('hidden');
  el('bl-arrow').style.display = 'none';

  renderField();

  phase = 'animating';
  enqueueMessages([
    `연구원 A가 ${enemyMon.name}을(를) 내보냈다!`,
    `가자! ${playerMon.name}!`,
  ]);
  showNextMessage();
}

export function getBattlePhase() { return phase; }

/* ════════════════════════════════════════
   렌더링
════════════════════════════════════════ */
function renderField() {
  el('enemy-sprite').src             = enemyMon.sprite;
  el('enemy-mon-name').textContent   = enemyMon.name;
  el('enemy-mon-level').textContent  = `Lv.${enemyMon.level}`;
  renderHP('enemy');

  el('player-sprite').src            = playerMon.sprite;
  el('player-mon-name').textContent  = playerMon.name;
  el('player-mon-level').textContent = `Lv.${playerMon.level}`;
  renderHP('player');
}

function renderHP(side) {
  const mon = side === 'player' ? playerMon : enemyMon;
  const pct = Math.max(0, (mon.hp / mon.maxHp) * 100);

  const fill = el(`${side}-hpfill`);
  fill.style.width = `${pct}%`;
  fill.className = 'bfm-hpfill' + (pct > 50 ? ' hp-high' : pct > 25 ? ' hp-mid' : ' hp-low');

  el(`${side}-hp-cur`).textContent = mon.hp;
  el(`${side}-hp-max`).textContent = mon.maxHp;
}

function renderSkillButtons() {
  for (let i = 0; i < 4; i++) {
    const btn   = el(`skill-btn-${i}`);
    const skill = playerMon.skills[i];

    if (skill) {
      btn.querySelector('.sb-name').textContent = skill.name;
      btn.querySelector('.sb-pp').textContent   = `PP ${skill.pp}/${skill.maxPp}`;
      btn.querySelector('.sb-elem').textContent = skill.element;
      btn.disabled = skill.pp <= 0;
      btn.classList.remove('sb-empty');
      btn.dataset.elem = skill.element;
    } else {
      btn.querySelector('.sb-name').textContent = '—';
      btn.querySelector('.sb-pp').textContent   = '';
      btn.querySelector('.sb-elem').textContent = '';
      btn.disabled = true;
      btn.classList.add('sb-empty');
      btn.dataset.elem = '';
    }
  }
}

/* ════════════════════════════════════════
   메시지 큐
════════════════════════════════════════ */
function enqueueMessages(texts) {
  for (const text of texts) {
    if (text) msgQueue.push({ text });
  }
}

function showNextMessage() {
  if (!msgQueue.length) {
    onQueueEmpty();
    return;
  }

  const msg = msgQueue.shift();

  if (msg.hpSnap) {
    playerMon.hp = msg.hpSnap.playerHp;
    enemyMon.hp  = msg.hpSnap.enemyHp;
    renderHP('player');
    renderHP('enemy');
  }

  el('bl-text').textContent = msg.text;
  el('bl-arrow').style.display = msgQueue.length ? 'block' : 'none';
}

function onQueueEmpty() {
  if (playerMon.hp <= 0) { showEndScreen(false); return; }
  if (enemyMon.hp  <= 0) { showEndScreen(true);  return; }

  phase = 'choosing';
  renderSkillButtons();
  el('battle-actions').classList.remove('hidden');
  el('bl-arrow').style.display = 'none';
  el('bl-text').textContent = '기술을 선택하세요...';
}

/* ════════════════════════════════════════
   이벤트 핸들러
════════════════════════════════════════ */
function onLogClick() {
  if (phase !== 'animating') return;
  showNextMessage();
}

function onActionClick(e) {
  const btn = e.target.closest('.skill-btn');
  if (!btn || phase !== 'choosing' || btn.disabled) return;
  onSkillSelect(parseInt(btn.dataset.idx));
}

function onRetry() {
  // 다시 도전 → 스타터 선택 화면으로 복귀
  phase = 'idle';
  el('battle-result').classList.add('hidden');
  if (_onBattleEnd) _onBattleEnd();
}

/* ════════════════════════════════════════
   턴 처리
════════════════════════════════════════ */
function onSkillSelect(idx) {
  const skill = playerMon.skills[idx];
  if (!skill) return;

  el('battle-actions').classList.add('hidden');
  phase = 'animating';
  turn++;

  const enemySkill = pickEnemySkill(enemyMon);
  const events = resolveTurn(playerMon, enemyMon, skill, enemySkill, turn);
  msgQueue = buildMessages(events, skill, enemySkill);
  showNextMessage();
}

function buildMessages(events, playerSkill, enemySkill) {
  const msgs = [];

  for (const evt of events) {
    const isPlayer = evt.side === 'player';
    const actionMsgs = [];

    if (evt.type === 'miss') {
      actionMsgs.push(`${evt.atkName}의 공격이 빗나갔다!`);
    } else {
      actionMsgs.push(`${evt.atkName}이(가) ${evt.skillName}을(를) 사용했다!`);

      if      (evt.effectiveness === 0) actionMsgs.push('효과가 없는 것 같다...');
      else if (evt.effectiveness >= 2)  actionMsgs.push('효과가 굉장한 것 같다!');
      else if (evt.effectiveness <= 0.5) actionMsgs.push('효과가 별로인 것 같다...');

      if (evt.isCrit) actionMsgs.push('급소에 맞았다!');

      if (dialogueEngine) {
        try {
          const ctx = {
            turn,
            skillName:     evt.skillName,
            skillPattern:  evt.skillPattern,
            attackerName:  evt.atkName,
            defenderName:  evt.defName,
            attackerBrand: evt.atkBrand,
            defenderBrand: evt.defBrand,
            damage:        evt.damage,
            attackerHp:    evt.atkHp,
            attackerMaxHp: evt.atkMaxHp,
            defenderHp:    evt.defHp,
            defenderMaxHp: evt.defMaxHp,
            momentum: playerMon.hp >= enemyMon.hp ? 'player_ahead' : 'enemy_ahead',
          };
          const result = dialogueEngine.generateTurn(ctx);
          if (result.system) actionMsgs.push(result.system);
          if (result.quote)  actionMsgs.push(result.quote);
        } catch (_) {}
      }
    }

    const hpSnap = { playerHp: evt.playerHp, enemyHp: evt.enemyHp };
    msgs.push({ text: actionMsgs[0], hpSnap });
    for (let mi = 1; mi < actionMsgs.length; mi++) {
      msgs.push({ text: actionMsgs[mi] });
    }
  }

  return msgs;
}

/* ════════════════════════════════════════
   Debug API (debug.js 에서 호출)
════════════════════════════════════════ */
export function debugWin() {
  if (!enemyMon || (phase !== 'choosing' && phase !== 'animating')) {
    console.warn('[mdm] 전투 중이 아닙니다 (phase:', phase, ')');
    return;
  }
  msgQueue = [];
  enemyMon.hp = 0;
  renderHP('enemy');
  el('battle-actions').classList.add('hidden');
  showEndScreen(true);
}

export function debugLose() {
  if (!playerMon || (phase !== 'choosing' && phase !== 'animating')) {
    console.warn('[mdm] 전투 중이 아닙니다 (phase:', phase, ')');
    return;
  }
  msgQueue = [];
  playerMon.hp = 0;
  renderHP('player');
  el('battle-actions').classList.add('hidden');
  showEndScreen(false);
}

export function debugSkip() {
  if (phase !== 'animating') {
    console.warn('[mdm] 대화 진행 중이 아닙니다 (phase:', phase, ')');
    return;
  }
  msgQueue = [];
  onQueueEmpty();
}

export function debugSetHp(side, value) {
  const mon = side === 'player' ? playerMon : (side === 'enemy' ? enemyMon : null);
  if (!mon) { console.warn('[mdm] side는 "player" 또는 "enemy"'); return; }
  mon.hp = Math.max(0, Math.min(Number(value) || 0, mon.maxHp));
  renderHP(side);
  console.log(`[mdm] ${mon.name} HP → ${mon.hp}/${mon.maxHp}`);
}

export function debugState() {
  if (!playerMon) { console.log('[mdm] 전투 없음 (phase: idle)'); return; }
  console.table({
    phase,
    turn,
    [`${playerMon.name}(player)`]: `${playerMon.hp}/${playerMon.maxHp}`,
    [`${enemyMon.name}(enemy)`]:   `${enemyMon.hp}/${enemyMon.maxHp}`,
  });
}

/* ════════════════════════════════════════
   결과 화면
════════════════════════════════════════ */
function showEndScreen(win) {
  phase = 'ended';
  el('battle-actions').classList.add('hidden');
  el('bl-arrow').style.display = 'none';

  const resultEl = el('battle-result');
  resultEl.classList.remove('hidden');
  resultEl.querySelector('.br-icon').textContent  = win ? '🏆' : '💀';
  resultEl.querySelector('.br-title').textContent = win ? '승리!' : '셧다운...';
  resultEl.querySelector('.br-sub').textContent   = win
    ? `${enemyMon.name}을(를) 쓰러뜨렸다!`
    : `${playerMon.name}이(가) 셧다운되었다...`;

  el('bl-text').textContent = win
    ? `${enemyMon.name}을(를) 쓰러뜨렸다! 승리!`
    : `${playerMon.name}이(가) 셧다운되었다...`;

  // 버튼 라벨 변경 (다음 여정 시작 / 재도전)
  el('battle-retry-btn').textContent = win ? '다음 여정' : '재도전';
}
