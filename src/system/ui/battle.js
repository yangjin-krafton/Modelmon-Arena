/**
 * 전투 UI 컨트롤러
 * 상태 머신: idle → choosing → animating → ended
 * 스타터 선택 화면과 연동: startBattle(monId, level) 로 시작
 */

import { buildBattleMon, resolveTurn, pickEnemySkill } from '../core/battle-engine.js';
import {
  loadBattleDialogueLibrary,
  createBattleDialogueEngine,
  renderBattleDialogueMarkup,
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

  // 이벤트 리스너 — await 전에 동기 등록
  el('battle-lower').addEventListener('click', onLowerClick);
  el('battle-panel').addEventListener('click', onPanelClick);
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
  hidePanel();
  el('bl-arrow').style.display = 'none';
  el('battle-lower').classList.remove('is-talking');

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
  fill.className = 'bfm-hpfill ' + (pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low');

  // HP 숫자는 플레이어만 표시 (적은 바만)
  if (side === 'player') {
    el('player-hp-cur').textContent = mon.hp;
    el('player-hp-max').textContent = mon.maxHp;
  }
}

function renderPanel() {
  for (let i = 0; i < 4; i++) {
    const card  = el(`bp-skill-${i}`);
    const skill = playerMon.skills[i];

    if (skill) {
      const ppEmpty = skill.pp <= 0;
      card.disabled     = ppEmpty;
      card.dataset.elem = skill.element;

      el(`bp-sk-name-${i}`).textContent = skill.name;
      el(`bp-sk-elem-${i}`).textContent = skill.element;
      el(`bp-sk-pat-${i}`).textContent  = skill.pattern || '';
      el(`bp-sk-pow-${i}`).textContent  = skill.power === '—' || !skill.power ? '—' : skill.power;
      el(`bp-sk-acc-${i}`).textContent  = skill.accuracy === '무한' || skill.accuracy === '—' ? '—' : skill.accuracy;
      el(`bp-sk-pp-${i}`).textContent   = `${skill.pp}/${skill.maxPp}`;
      el(`bp-sk-eff-${i}`).textContent  = skill.effect || '';
    } else {
      card.disabled     = true;
      card.dataset.elem = '';
      el(`bp-sk-name-${i}`).textContent = '—';
      el(`bp-sk-elem-${i}`).textContent = '';
      el(`bp-sk-pat-${i}`).textContent  = '';
      el(`bp-sk-pow-${i}`).textContent  = '—';
      el(`bp-sk-acc-${i}`).textContent  = '—';
      el(`bp-sk-pp-${i}`).textContent   = '—';
      el(`bp-sk-eff-${i}`).textContent  = '';
    }
  }
}

/* ════════════════════════════════════════
   패널 표시 제어
════════════════════════════════════════ */
function hidePanel() {
  el('battle-panel').classList.add('hidden');
}

function showPanel() {
  renderPanel();
  el('battle-panel').classList.remove('hidden');
  el('battle-lower').classList.remove('is-talking');
  el('bl-text').textContent = '행동을 선택하세요.';
  el('bl-arrow').style.display = 'none';
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

  el('bl-text').innerHTML = renderBattleLogHtml(msg.text, msg.highlight);
  const hasMore = msgQueue.length > 0;
  el('bl-arrow').style.display = hasMore ? 'block' : 'none';
  // 메시지 남아있을 때 하단 전체가 탭 가능함을 시각적으로 표시
  el('battle-lower').classList.toggle('is-talking', hasMore);
}

function onQueueEmpty() {
  el('battle-lower').classList.remove('is-talking');

  if (playerMon.hp <= 0) { showEndScreen(false); return; }
  if (enemyMon.hp  <= 0) { showEndScreen(true);  return; }

  phase = 'choosing';
  showPanel();
}

/* ════════════════════════════════════════
   이벤트 핸들러
════════════════════════════════════════ */
function onLowerClick(e) {
  // 버튼 클릭은 각 핸들러가 처리 — 대화 진행만 여기서
  if (phase !== 'animating') return;
  if (e.target.closest('button')) return;
  showNextMessage();
}

function onPanelClick(e) {
  const card = e.target.closest('.bp-skill-card');
  if (!card || phase !== 'choosing' || card.disabled) return;
  onSkillSelect(parseInt(card.dataset.idx));
}

function onRetry() {
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

  hidePanel();
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
          const dialogueLines = [
            result.system,
            result.explain,
            result.quote,
            ...(result.storyParagraphs || [])
          ].filter(Boolean);

          for (const line of uniqueDialogueLines(dialogueLines)) {
            actionMsgs.push(line);
          }
        } catch (_) {}
      }
    }

    const hpSnap = { playerHp: evt.playerHp, enemyHp: evt.enemyHp };
    const highlight = buildMessageHighlight(evt);
    msgs.push({ text: actionMsgs[0], hpSnap, highlight });
    for (let mi = 1; mi < actionMsgs.length; mi++) {
      msgs.push({ text: actionMsgs[mi], highlight });
    }
  }

  return msgs;
}

function uniqueDialogueLines(lines) {
  const seen = new Set();
  const result = [];

  for (const line of lines) {
    const normalized = String(line || "").trim();
    if (!normalized) continue;

    const key = normalized.replace(/\s+/g, " ");
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function renderBattleLogHtml(text, highlight = null) {
  return renderBattleDialogueMarkup(text, {
    allyNames: playerMon ? [playerMon.name, playerMon.brand] : [],
    enemyNames: enemyMon ? [enemyMon.name, enemyMon.brand] : [],
    allySkills: highlight?.allySkills || [],
    enemySkills: highlight?.enemySkills || []
  });
}

function buildMessageHighlight(evt) {
  const skillName = evt?.skillName ? [evt.skillName] : [];
  return evt?.side === 'player'
    ? { allySkills: skillName, enemySkills: [] }
    : { allySkills: [], enemySkills: skillName };
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
  hidePanel();
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
  hidePanel();
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
  hidePanel();
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
