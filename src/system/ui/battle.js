/**
 * 전투 UI 컨트롤러
 * phase: idle → choosing → animating → ended
 *
 * 팀 시스템:
 *   teamMons[]   — 선택된 팀 전체 (buildBattleMon 결과)
 *   activeIdx    — 현재 전투 중인 몬 인덱스
 *   playerMon    — teamMons[activeIdx] 의 별칭 (참조 동기화)
 *
 * 교체:
 *   renderTeamGrid() — 팀 전체를 그리드 카드로 렌더 (active/fainted 상태 반영)
 *   executeSwitch()  — 무료 교체 (적 반격 없음, 로그라이크 특성)
 */

import { buildBattleMon, resolveTurn, pickEnemySkill } from '../core/battle-engine.js';
import {
  loadBattleDialogueLibrary,
  createBattleDialogueEngine,
  renderBattleDialogueMarkup,
} from '../battle-dialogue/index.js';
import { STARTER_LEVEL } from './starter.js';
import { ITEMS, RARITY_COLOR, initRunItems, getInventory, hasItem, consumeItem } from '../core/run-items.js';

/* ════════════════════════════════════════
   상태
════════════════════════════════════════ */
let phase          = 'idle';
let turn           = 0;
let teamMons       = [];   // 팀 전체 mon 객체 배열
let activeIdx      = 0;    // 현재 전투 mon 인덱스
let playerMon      = null; // teamMons[activeIdx] 참조
let enemyMon       = null;
let msgQueue       = [];
let dialogueEngine = null;
let libraryLoaded  = false;
let _onBattleEnd   = null;

const TEAM_GRID_MAX = 5; // 그리드 최대 표시 슬롯 수

const el = id => document.getElementById(id);

/* ════════════════════════════════════════
   초기화 (1회)
════════════════════════════════════════ */
export async function initBattle(onBattleEnd) {
  _onBattleEnd = onBattleEnd;

  // 이벤트 — await 전에 동기 등록
  el('battle-lower').addEventListener('click', onLowerClick);
  el('battle-panel').addEventListener('click', onPanelClick);
  el('battle-retry-btn').addEventListener('click', onRetry);

    // 교체 그리드
  el('team-switch-grid').addEventListener('click', onTeamGridClick);
  // 아이템 그리드
  el('item-grid').addEventListener('click', onItemGridClick);

  if (libraryLoaded) return;
  try {
    const library = await loadBattleDialogueLibrary({ baseUrl: './data' });
    dialogueEngine = createBattleDialogueEngine({ library });
    libraryLoaded = true;
  } catch (e) {
    console.warn('[battle] dialogue load failed:', e);
    libraryLoaded = true;
  }
}

/* ════════════════════════════════════════
   전투 시작 (teamIds[] 받음)
════════════════════════════════════════ */
export function startBattle(teamIds) {
  const level = STARTER_LEVEL;
  const ids   = Array.isArray(teamIds) ? teamIds : [teamIds];

  // 팀 빌드
  teamMons = ids.map(id => {
    try { return buildBattleMon(id, level); } catch { return null; }
  }).filter(Boolean);

  if (!teamMons.length) { console.error('[battle] 팀 빌드 실패'); return; }

  activeIdx = 0;
  playerMon = teamMons[0];

  // 적: 팀에 없는 기본 스타터 중 랜덤
  const enemyCandidates = ['001','004','007'].filter(id => !ids.includes(id));
  const enemyId = enemyCandidates.length
    ? enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)]
    : ['001','004','007'].find(id => id !== ids[0]);
  try { enemyMon = buildBattleMon(enemyId, level); }
  catch (e) { console.error('[battle] 적 빌드 실패', e); return; }

  turn = 0;
  msgQueue = [];
  if (dialogueEngine) dialogueEngine.reset();
  initRunItems(); // 여정마다 아이템 초기화 (모델볼 10, 회복약 5)

  el('battle-result').classList.add('hidden');
  hidePanel();
  el('bl-arrow').style.display = 'none';
  el('battle-lower').classList.remove('is-talking');

  renderField();
  

  phase = 'animating';
  enqueue(
    `연구원 A가 ${enemyMon.name}을(를) 내보냈다!`,
    `가자! ${playerMon.name}!`,
  );
  showNextMessage();
}

export function getBattlePhase() { return phase; }

/* ════════════════════════════════════════
   팀 교체 그리드
════════════════════════════════════════ */
function renderTeamGrid() {
  const grid = el('team-switch-grid');
  grid.innerHTML = '';

  const total = Math.max(teamMons.length, Math.min(TEAM_GRID_MAX, teamMons.length));

  for (let i = 0; i < TEAM_GRID_MAX; i++) {
    const mon = teamMons[i];
    const btn = document.createElement('button');

    if (!mon) {
      btn.className = 'tsw-card tsw-empty';
      btn.disabled  = true;
      btn.textContent = '+';
      grid.appendChild(btn);
      continue;
    }

    const isActive  = i === activeIdx;
    const isFainted = mon.hp <= 0;
    const pct = Math.max(0, (mon.hp / mon.maxHp) * 100);
    const hpClass = pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low';

    btn.className  = 'tsw-card'
      + (isActive  ? ' tsw-active'  : '')
      + (isFainted ? ' tsw-fainted' : '');
    btn.disabled   = isActive || isFainted;
    btn.dataset.teamIdx = i;
    btn.title      = `${mon.name}  HP ${mon.hp}/${mon.maxHp}`;

    btn.innerHTML = `
      <img class="tsw-sprite" src="${mon.sprite}" alt="${mon.name}"
           onerror="this.style.opacity=0">
      <div class="tsw-hpbar">
        <div class="tsw-hpfill ${hpClass}" style="width:${pct}%"></div>
      </div>`;

    grid.appendChild(btn);
  }
}

function onTeamGridClick(e) {
  const btn = e.target.closest('.tsw-card');
  if (!btn || btn.disabled || phase !== 'choosing') return;
  const idx = parseInt(btn.dataset.teamIdx);
  if (Number.isFinite(idx)) executeSwitch(idx);
}

function executeSwitch(newIdx) {
  const prevMon = playerMon;
  activeIdx = newIdx;
  playerMon = teamMons[activeIdx];
  

  hidePanel();
  phase = 'animating';

  renderField(); // 플레이어 스프라이트 + HP 업데이트
  

  enqueue(
    `${prevMon.name}은(는) 물러났다!`,
    `가자! ${playerMon.name}!`,
  );
  showNextMessage();
}

/** 아군 쓰러짐 → 다음 살아있는 멤버로 강제 교체 */
function forceNextMon() {
  const next = teamMons.find((m, i) => i !== activeIdx && m.hp > 0);
  if (!next) { showEndScreen(false); return; }

  const prevMon = playerMon;
  activeIdx  = teamMons.indexOf(next);
  playerMon  = next;
  

  renderField();
  

  enqueue(
    `${prevMon.name}이(가) 셧다운되었다!`,
    `가자! ${playerMon.name}!`,
  );
  phase = 'animating';
  showNextMessage();
}

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
  fill.className   = 'bfm-hpfill ' + (pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low');

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
      card.disabled     = skill.pp <= 0;
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
  renderTeamGrid();
  renderItemGrid();
  el('battle-panel').classList.remove('hidden');
  el('battle-lower').classList.remove('is-talking');
  el('bl-text').textContent = '행동을 선택하세요.';
  el('bl-arrow').style.display = 'none';
}

/* ════════════════════════════════════════
   아이템 그리드
════════════════════════════════════════ */
function renderItemGrid() {
  const grid = el('item-grid');
  grid.innerHTML = '';

  const inv = getInventory();
  if (!Object.keys(inv).length) {
    grid.innerHTML = '<span style="font-size:11px;color:var(--text3);padding:0 4px">아이템 없음</span>';
    return;
  }

  for (const [itemId, count] of Object.entries(inv)) {
    const def = ITEMS[itemId];
    if (!def) continue;

    const btn = document.createElement('button');
    btn.className      = 'item-card';
    btn.disabled       = count <= 0;
    btn.dataset.itemId = itemId;
    btn.title          = `${def.name} — ${def.desc}`;
    // 희귀도 테두리 색상
    btn.style.borderColor = RARITY_COLOR[def.rarity] ?? 'rgba(255,255,255,0.1)';

    btn.innerHTML = `
      <div class="item-icon"><img src="${def.icon}" alt="${def.name}"></div>
      <span class="item-name">${def.name}</span>
      <span class="item-count-badge">${count}</span>`;
    grid.appendChild(btn);
  }
}

function onItemGridClick(e) {
  const btn = e.target.closest('.item-card');
  if (!btn || btn.disabled || phase !== 'choosing') return;
  useItem(btn.dataset.itemId);
}

function useItem(itemId) {
  const def = ITEMS[itemId];
  if (!def || !hasItem(itemId)) return;

  // ── 볼 계열 ──────────────────────────────
  if (def.category === 'ball') {
    enqueue(`${def.name}을(를) 던졌다!`, '포획 기능은 아직 구현 중이다...');
    hidePanel(); phase = 'animating'; showNextMessage(); return;
  }

  // ── 부활 ─────────────────────────────────
  if (def.revivePct > 0) {
    if (playerMon.hp > 0) {
      enqueue(`${playerMon.name}은 쓰러지지 않았다!`);
      hidePanel(); phase = 'animating'; showNextMessage(); return;
    }
    const hp = def.hpFull
      ? playerMon.maxHp
      : Math.floor(playerMon.maxHp * def.revivePct / 100);
    consumeItem(itemId);
    playerMon.hp = hp;
    renderHP('player'); renderItemGrid();
    enqueue(`${def.name}을(를) 사용했다!`, `${playerMon.name}이(가) HP ${hp}로 부활!`);
    hidePanel(); phase = 'animating'; showNextMessage(); return;
  }

  // ── HP 회복 ──────────────────────────────
  if (def.hpFull || def.hpFlat > 0) {
    if (playerMon.hp >= playerMon.maxHp) {
      enqueue(`${playerMon.name}의 HP는 이미 가득 찼다!`);
      hidePanel(); phase = 'animating'; showNextMessage(); return;
    }
    const prev = playerMon.hp;
    playerMon.hp = def.hpFull
      ? playerMon.maxHp
      : Math.min(playerMon.hp + def.hpFlat, playerMon.maxHp);
    const actual = playerMon.hp - prev;
    consumeItem(itemId);
    renderHP('player'); renderItemGrid();
    enqueue(`${def.name}을(를) 사용했다!`, `${playerMon.name}의 HP가 ${actual} 회복됐다!`);
    hidePanel(); phase = 'animating'; showNextMessage(); return;
  }

  // ── PP 회복 ──────────────────────────────
  if (def.ppFull || def.ppFlat > 0) {
    consumeItem(itemId);
    let restored = 0;
    for (const skill of playerMon.skills) {
      if (!skill) continue;
      const before = skill.pp;
      if (def.ppFull)       skill.pp = skill.maxPp;
      else if (def.ppFlat)  skill.pp = Math.min(skill.pp + def.ppFlat, skill.maxPp);
      restored += skill.pp - before;
      if (!def.ppAll) break; // 단일 스킬이면 첫 번째만
    }
    renderPanel(); renderItemGrid();
    enqueue(`${def.name}을(를) 사용했다!`, `스킬 PP가 ${restored} 회복됐다!`);
    hidePanel(); phase = 'animating'; showNextMessage(); return;
  }

  // ── 콤보 (HP + PP) ───────────────────────
  if (def.category === 'combo') {
    consumeItem(itemId);
    playerMon.hp = playerMon.maxHp;
    for (const skill of playerMon.skills) if (skill) skill.pp = skill.maxPp;
    renderHP('player'); renderPanel(); renderItemGrid();
    enqueue(`${def.name}을(를) 사용했다!`, `HP와 모든 PP가 완전 회복됐다!`);
    hidePanel(); phase = 'animating'; showNextMessage();
  }
}

/* ════════════════════════════════════════
   메시지 큐
════════════════════════════════════════ */
function enqueue(...texts) {
  for (const t of texts) if (t) msgQueue.push({ text: t });
}

function showNextMessage() {
  if (!msgQueue.length) { onQueueEmpty(); return; }

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
  el('battle-lower').classList.toggle('is-talking', hasMore);
}

function onQueueEmpty() {
  el('battle-lower').classList.remove('is-talking');

  // 적 쓰러짐 → 승리
  if (enemyMon.hp <= 0) { showEndScreen(true); return; }

  // 아군 쓰러짐 → 팀에 살아있는 멤버 확인
  if (playerMon.hp <= 0) {
    const hasNext = teamMons.some((m, i) => i !== activeIdx && m.hp > 0);
    if (hasNext) { forceNextMon(); } else { showEndScreen(false); }
    return;
  }

  phase = 'choosing';
  showPanel();
}

/* ════════════════════════════════════════
   이벤트 핸들러
════════════════════════════════════════ */
function onLowerClick(e) {
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
  const events     = resolveTurn(playerMon, enemyMon, skill, enemySkill, turn);
  msgQueue = buildMessages(events);
  showNextMessage();
}

function buildMessages(events) {
  const msgs = [];
  for (const evt of events) {
    const lines = [];

    if (evt.type === 'miss') {
      lines.push(`${evt.atkName}의 공격이 빗나갔다!`);
    } else {
      lines.push(`${evt.atkName}이(가) ${evt.skillName}을(를) 사용했다!`);
      if      (evt.effectiveness === 0)   lines.push('효과가 없는 것 같다...');
      else if (evt.effectiveness >= 2)    lines.push('효과가 굉장한 것 같다!');
      else if (evt.effectiveness <= 0.5)  lines.push('효과가 별로인 것 같다...');
      if (evt.isCrit) lines.push('급소에 맞았다!');

      if (dialogueEngine) {
        try {
          const result = dialogueEngine.generateTurn({
            turn,
            skillName: evt.skillName, skillPattern: evt.skillPattern,
            attackerName: evt.atkName, defenderName: evt.defName,
            attackerBrand: evt.atkBrand, defenderBrand: evt.defBrand,
            damage: evt.damage,
            attackerHp: evt.atkHp,  attackerMaxHp: evt.atkMaxHp,
            defenderHp: evt.defHp,  defenderMaxHp: evt.defMaxHp,
            momentum: playerMon.hp >= enemyMon.hp ? 'player_ahead' : 'enemy_ahead',
          });
          const extra = uniqueLines([
            result.system, result.explain, result.quote,
            ...(result.storyParagraphs || [])
          ]);
          lines.push(...extra);
        } catch (_) {}
      }
    }

    const hpSnap   = { playerHp: evt.playerHp, enemyHp: evt.enemyHp };
    const highlight = evt.side === 'player'
      ? { allySkills: [evt.skillName], enemySkills: [] }
      : { allySkills: [], enemySkills: [evt.skillName] };

    msgs.push({ text: lines[0], hpSnap, highlight });
    for (let i = 1; i < lines.length; i++) msgs.push({ text: lines[i], highlight });
  }
  return msgs;
}

function uniqueLines(lines) {
  const seen = new Set();
  return lines.filter(l => {
    const k = String(l || '').trim().replace(/\s+/g, ' ');
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function renderBattleLogHtml(text, highlight = null) {
  return renderBattleDialogueMarkup(text, {
    allyNames:   playerMon ? [playerMon.name,  playerMon.brand]  : [],
    enemyNames:  enemyMon  ? [enemyMon.name,   enemyMon.brand]   : [],
    allySkills:  highlight?.allySkills  || [],
    enemySkills: highlight?.enemySkills || [],
  });
}

/* ════════════════════════════════════════
   결과 화면
════════════════════════════════════════ */
function showEndScreen(win) {
  phase = 'ended';
  hidePanel();
  el('bl-arrow').style.display = 'none';

  const r = el('battle-result');
  r.classList.remove('hidden');
  r.querySelector('.br-icon').textContent  = win ? '🏆' : '💀';
  r.querySelector('.br-title').textContent = win ? '승리!' : '전멸...';
  r.querySelector('.br-sub').textContent   = win
    ? `${enemyMon.name}을(를) 쓰러뜨렸다!`
    : '팀 전원이 셧다운되었다...';

  el('bl-text').textContent = win
    ? `${enemyMon.name}을(를) 쓰러뜨렸다! 승리!`
    : '팀 전원이 셧다운되었다...';

  el('battle-retry-btn').textContent = win ? '다음 여정' : '재도전';
}

/* ════════════════════════════════════════
   Debug API
════════════════════════════════════════ */
export function debugWin() {
  if (!enemyMon || (phase !== 'choosing' && phase !== 'animating')) {
    console.warn('[mdm] 전투 중 아님 (phase:', phase, ')'); return;
  }
  msgQueue = []; enemyMon.hp = 0;
  renderHP('enemy'); hidePanel(); showEndScreen(true);
}

export function debugLose() {
  if (!playerMon || (phase !== 'choosing' && phase !== 'animating')) {
    console.warn('[mdm] 전투 중 아님 (phase:', phase, ')'); return;
  }
  // 팀 전원 HP 0으로
  teamMons.forEach(m => { m.hp = 0; });
  msgQueue = [];
  renderHP('player'); hidePanel(); showEndScreen(false);
}

export function debugSkip() {
  if (phase !== 'animating') {
    console.warn('[mdm] 대화 중 아님 (phase:', phase, ')'); return;
  }
  msgQueue = []; onQueueEmpty();
}

export function debugSetHp(side, value) {
  const mon = side === 'player' ? playerMon : (side === 'enemy' ? enemyMon : null);
  if (!mon) { console.warn('[mdm] side: "player" 또는 "enemy"'); return; }
  mon.hp = Math.max(0, Math.min(Number(value) || 0, mon.maxHp));
  renderHP(side);
  console.log(`[mdm] ${mon.name} HP → ${mon.hp}/${mon.maxHp}`);
}

export function debugState() {
  if (!playerMon) { console.log('[mdm] 전투 없음'); return; }
  const teamInfo = teamMons.map((m, i) =>
    `${i === activeIdx ? '▶' : ' '} [${i}] ${m.name} ${m.hp}/${m.maxHp}`
  ).join('\n');
  console.log(`[mdm] phase:${phase}  turn:${turn}\n팀:\n${teamInfo}\n적: ${enemyMon.name} ${enemyMon.hp}/${enemyMon.maxHp}`);
}
