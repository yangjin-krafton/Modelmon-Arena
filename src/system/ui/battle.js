import { buildBattleMon, resolveTurn, pickEnemySkill } from '../core/battle-engine.js';
import {
  loadBattleDialogueLibrary,
  createBattleDialogueEngine,
  renderBattleDialogueMarkup,
} from '../battle-dialogue/index.js';
import { STARTER_LEVEL } from './starter.js';
import {
  ITEMS,
  RARITY_COLOR,
  initRunItems,
  getInventory,
  hasItem,
  consumeItem,
} from '../core/run-items.js';
import { getMonLevel } from '../core/save.js';
import { applyCaptureDecision, resolvePostBattle } from '../adventure/post-battle.js';
import { initEffects, playSkillEffect, clearAllEffects } from './battle-effects.js';

let phase = 'idle';
let turn = 0;
let teamMons = [];
let activeIdx = 0;
let playerMon = null;
let enemyMon = null;
let msgQueue = [];
let dialogueEngine = null;
let libraryLoaded = false;
let onBattleEnd = null;
let lastBattleRewards = [];
let lastBattleOutcome = null;
let currentEncounterData = null;
let enemyQueue = [];
let resolvedTeamIds = [];

const TEAM_GRID_MAX = 5;
const COMBAT_TYPES = new Set(['wild', 'standard', 'elite', 'boss']);

const el = id => document.getElementById(id);

export async function initBattle(callback) {
  onBattleEnd = callback;

  moveBattleResultToLowerPanel();

  el('battle-lower').addEventListener('click', onLowerClick);
  el('battle-panel').addEventListener('click', onPanelClick);
  el('battle-retry-btn').addEventListener('click', onRetry);
  el('team-switch-grid').addEventListener('click', onTeamGridClick);
  el('item-grid').addEventListener('click', onItemGridClick);

  initEffects();

  if (libraryLoaded) return;

  try {
    const library = await loadBattleDialogueLibrary({ baseUrl: './data' });
    dialogueEngine = createBattleDialogueEngine({ library });
  } catch (error) {
    console.warn('[battle] dialogue load failed:', error);
  }

  libraryLoaded = true;
}

export function startBattle(teamIds, encounterData = null) {
  const ids = Array.isArray(teamIds) ? [...teamIds] : [teamIds];

  teamMons = ids
    .map(monId => {
      try {
        return buildBattleMon(monId, getMonLevel(monId, STARTER_LEVEL));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!teamMons.length) {
    console.error('[battle] failed to build team');
    return;
  }

  if (encounterData && !COMBAT_TYPES.has(encounterData.type)) {
    console.error('[battle] non-combat encounter passed to battle:', encounterData.type);
    return;
  }

  activeIdx = 0;
  playerMon = teamMons[0];
  resolvedTeamIds = teamMons.map(mon => mon.id);
  currentEncounterData = encounterData ? { ...encounterData, captureBonus: 0 } : null;
  enemyQueue = [];
  turn = 0;
  msgQueue = [];
  lastBattleRewards = [];
  lastBattleOutcome = null;

  setupEncounterEnemies(ids, encounterData);
  applyFieldTheme(encounterData);

  if (dialogueEngine) dialogueEngine.reset();
  initRunItems();

  el('battle-result').classList.add('hidden');
  clearResultChoices();
  resetBattleLog();
  setBattleLowerMode('log');
  el('bl-arrow').style.display = 'none';
  el('battle-lower').classList.remove('is-talking');

  renderField();

  phase = 'animating';
  enqueue(
    buildEncounterIntro(encounterData, enemyMon),
    `가라! ${playerMon.name}!`,
  );
  showNextMessage();
}

export function getBattlePhase() {
  return phase;
}

function setupEncounterEnemies(teamIds, encounterData) {
  const encounterEnemies = encounterData?.enemies || [];
  enemyQueue = encounterEnemies.slice(1).map(enemy => ({ ...enemy }));

  if (encounterEnemies.length) {
    enemyMon = buildBattleMon(encounterEnemies[0].monId, encounterEnemies[0].level);
    return;
  }

  const enemyCandidates = ['001', '004', '007'].filter(monId => !teamIds.includes(monId));
  const enemyId = enemyCandidates.length
    ? enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)]
    : ['001', '004', '007'].find(monId => monId !== teamIds[0]);
  const teamAvgLevel = Math.round(teamMons.reduce((sum, mon) => sum + mon.level, 0) / teamMons.length);
  const enemyLevel = Math.max(1, teamAvgLevel + (Math.random() < 0.5 ? 0 : 1));

  enemyMon = buildBattleMon(enemyId, enemyLevel);
}

function applyFieldTheme(encounterData) {
  const field = document.querySelector('.battle-field');
  if (!field) return;

  field.dataset.biome = encounterData?.biomeId || 'starter-zone';
  field.dataset.time = encounterData?.localWave >= 6 ? 'night' : 'day';
}

function buildEncounterIntro(encounterData, firstEnemy) {
  if (!encounterData) {
    return `연구원 A가 ${firstEnemy.name}을 보냈다!`;
  }

  if (encounterData.type === 'wild') {
    return `${encounterData.biomeNameKo}에서 야생 ${firstEnemy.name}이 나타났다!`;
  }

  if (encounterData.type === 'boss') {
    const bossName = encounterData.bossNameKo || '관장';
    return `${bossName}이 ${firstEnemy.name}을 내보냈다!`;
  }

  const trainerName = encounterData.trainerNameKo || '훈련사';
  return `${trainerName}가 ${firstEnemy.name}을 내보냈다!`;
}

function renderTeamGrid() {
  const grid = el('team-switch-grid');
  grid.innerHTML = '';

  for (let i = 0; i < TEAM_GRID_MAX; i += 1) {
    const mon = teamMons[i];
    const button = document.createElement('button');

    if (!mon) {
      button.className = 'tsw-card tsw-empty';
      button.disabled = true;
      button.textContent = '+';
      grid.appendChild(button);
      continue;
    }

    const isActive = i === activeIdx;
    const isFainted = mon.hp <= 0;
    const pct = Math.max(0, (mon.hp / mon.maxHp) * 100);
    const hpClass = pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low';

    button.className = 'tsw-card'
      + (isActive ? ' tsw-active' : '')
      + (isFainted ? ' tsw-fainted' : '');
    button.disabled = isActive || isFainted;
    button.dataset.teamIdx = String(i);
    button.title = `${mon.name} HP ${mon.hp}/${mon.maxHp}`;
    button.innerHTML = `
      <img class="tsw-sprite" src="${mon.sprite}" alt="${mon.name}">
      <div class="tsw-hpbar">
        <div class="tsw-hpfill ${hpClass}" style="width:${pct}%"></div>
      </div>
    `;
    grid.appendChild(button);
  }
}

function renderItemGrid() {
  const grid = el('item-grid');
  grid.innerHTML = '';

  const inventory = getInventory();
  if (!Object.keys(inventory).length) {
    grid.innerHTML = '<span style="font-size:11px;color:var(--text3);padding:0 4px">아이템 없음</span>';
    return;
  }

  Object.entries(inventory).forEach(([itemId, count]) => {
    const def = ITEMS[itemId];
    if (!def) return;

    const button = document.createElement('button');
    button.className = 'item-card';
    button.disabled = count <= 0;
    button.dataset.itemId = itemId;
    button.title = `${def.name} · ${def.desc}`;
    button.style.borderColor = RARITY_COLOR[def.rarity] ?? 'rgba(255,255,255,0.1)';
    button.innerHTML = `
      <div class="item-icon"><img src="${def.icon}" alt="${def.name}"></div>
      <div class="item-info">
        <div class="item-name-row">
          <span class="item-name">${def.name}</span>
          <span class="item-count-badge">x${count}</span>
        </div>
        <span class="item-desc">${def.desc ?? ''}</span>
      </div>
    `;
    grid.appendChild(button);
  });
}

function renderField() {
  el('enemy-sprite').src = enemyMon.sprite;
  el('enemy-mon-name').textContent = enemyMon.name;
  el('enemy-mon-level').textContent = `Lv.${enemyMon.level}`;
  renderHP('enemy');

  el('player-sprite').src = playerMon.sprite;
  el('player-mon-name').textContent = playerMon.name;
  el('player-mon-level').textContent = `Lv.${playerMon.level}`;
  renderHP('player');
}

function renderHP(side) {
  const mon = side === 'player' ? playerMon : enemyMon;
  const pct = Math.max(0, (mon.hp / mon.maxHp) * 100);
  const fill = el(`${side}-hpfill`);

  fill.style.width = `${pct}%`;
  fill.className = `bfm-hpfill ${pct > 50 ? 'hp-high' : pct > 25 ? 'hp-mid' : 'hp-low'}`;

  if (side === 'player') {
    el('player-hp-cur').textContent = String(mon.hp);
    el('player-hp-max').textContent = String(mon.maxHp);
  }
}

function renderPanel() {
  for (let i = 0; i < 3; i += 1) {
    const card = el(`bp-skill-${i}`);
    const skill = playerMon.skills[i];

    if (!skill) {
      card.disabled = true;
      card.dataset.elem = '';
      el(`bp-sk-name-${i}`).textContent = '-';
      el(`bp-sk-elem-${i}`).textContent = '';
      el(`bp-sk-pat-${i}`).textContent = '';
      el(`bp-sk-pow-${i}`).textContent = '-';
      el(`bp-sk-acc-${i}`).textContent = '-';
      el(`bp-sk-pp-${i}`).textContent = '-';
      el(`bp-sk-eff-${i}`).textContent = '';
      continue;
    }

    card.disabled = skill.pp <= 0;
    card.dataset.elem = skill.element;
    el(`bp-sk-name-${i}`).textContent = skill.name;
    el(`bp-sk-elem-${i}`).textContent = skill.element;
    el(`bp-sk-pat-${i}`).textContent = skill.pattern || '';
    el(`bp-sk-pow-${i}`).textContent = String(skill.power ?? '-');
    el(`bp-sk-acc-${i}`).textContent = String(skill.accuracy ?? '-');
    el(`bp-sk-pp-${i}`).textContent = `${skill.pp}/${skill.maxPp}`;
    el(`bp-sk-eff-${i}`).textContent = skill.effect || '';
  }
}

function hidePanel() {
  setBattleLowerMode('log');
}

function showPanel() {
  renderPanel();
  renderTeamGrid();
  renderItemGrid();
  setBattleLowerMode('panel');
  el('battle-lower').classList.remove('is-talking');
  el('bl-arrow').style.display = 'none';
}

function onTeamGridClick(event) {
  const button = event.target.closest('.tsw-card');
  if (!button || button.disabled || phase !== 'choosing') return;

  const nextIndex = Number(button.dataset.teamIdx);
  if (!Number.isFinite(nextIndex)) return;

  const previous = playerMon;
  activeIdx = nextIndex;
  playerMon = teamMons[activeIdx];

  hidePanel();
  renderField();
  phase = 'animating';
  enqueue(
    `${previous.name}, 돌아와!`,
    `가라! ${playerMon.name}!`,
  );
  showNextMessage();
}

function onItemGridClick(event) {
  const button = event.target.closest('.item-card');
  if (!button || button.disabled || phase !== 'choosing') return;
  useItem(button.dataset.itemId);
}

function useItem(itemId) {
  const def = ITEMS[itemId];
  if (!def || !hasItem(itemId)) return;

  if (def.category === 'ball') {
    if (currentEncounterData?.type !== 'wild') {
      hidePanel();
      phase = 'animating';
      enqueue(`${def.name}은 야생 몬스터에게만 사용할 수 있다.`);
      showNextMessage();
      return;
    }

    consumeItem(itemId);
    currentEncounterData.captureBonus = Math.max(
      currentEncounterData.captureBonus ?? 0,
      Math.min(0.65, Number(def.catchMult || 1) * 0.08),
    );
    renderItemGrid();
    hidePanel();
    phase = 'animating';
    enqueue(
      `${def.name}을 준비했다.`,
      `이번 전투가 끝나면 포획 확률이 오른다.`,
    );
    showNextMessage();
    return;
  }

  if (def.revivePct > 0) {
    if (playerMon.hp > 0) {
      hidePanel();
      phase = 'animating';
      enqueue(`${playerMon.name}은 아직 쓰러지지 않았다.`);
      showNextMessage();
      return;
    }

    const restoredHp = def.hpFull
      ? playerMon.maxHp
      : Math.floor(playerMon.maxHp * def.revivePct / 100);
    consumeItem(itemId);
    playerMon.hp = Math.max(1, restoredHp);
    renderHP('player');
    renderItemGrid();
    hidePanel();
    phase = 'animating';
    enqueue(`${def.name}을 사용했다.`, `${playerMon.name}의 HP가 회복됐다.`);
    showNextMessage();
    return;
  }

  if (def.hpFull || def.hpFlat > 0) {
    if (playerMon.hp >= playerMon.maxHp) {
      hidePanel();
      phase = 'animating';
      enqueue(`${playerMon.name}의 HP는 이미 가득하다.`);
      showNextMessage();
      return;
    }

    const beforeHp = playerMon.hp;
    playerMon.hp = def.hpFull
      ? playerMon.maxHp
      : Math.min(playerMon.maxHp, playerMon.hp + def.hpFlat);
    consumeItem(itemId);
    renderHP('player');
    renderItemGrid();
    hidePanel();
    phase = 'animating';
    enqueue(
      `${def.name}을 사용했다.`,
      `${playerMon.name}의 HP가 ${playerMon.hp - beforeHp} 회복됐다.`,
    );
    showNextMessage();
    return;
  }

  if (def.ppFull || def.ppFlat > 0) {
    let restored = 0;
    consumeItem(itemId);

    for (const skill of playerMon.skills) {
      if (!skill) continue;
      const before = skill.pp;
      skill.pp = def.ppFull ? skill.maxPp : Math.min(skill.maxPp, skill.pp + def.ppFlat);
      restored += skill.pp - before;
      if (!def.ppAll) break;
    }

    renderPanel();
    renderItemGrid();
    hidePanel();
    phase = 'animating';
    enqueue(`${def.name}을 사용했다.`, `스킬 PP가 ${restored} 회복됐다.`);
    showNextMessage();
    return;
  }

  if (def.category === 'combo') {
    consumeItem(itemId);
    playerMon.hp = playerMon.maxHp;
    playerMon.skills.forEach(skill => {
      if (skill) skill.pp = skill.maxPp;
    });
    renderHP('player');
    renderPanel();
    renderItemGrid();
    hidePanel();
    phase = 'animating';
    enqueue(`${def.name}을 사용했다.`, 'HP와 PP가 전부 회복됐다.');
    showNextMessage();
  }
}

function enqueue(...texts) {
  texts.filter(Boolean).forEach(text => {
    msgQueue.push({ text });
  });
}

function showNextMessage() {
  if (!msgQueue.length) {
    onQueueEmpty();
    return;
  }

  const message = msgQueue.shift();
  if (message.fxData) {
    playSkillEffect(message.fxData.side, { pattern: message.fxData.pattern, element: message.fxData.element });
  }
  if (message.hpSnap) {
    playerMon.hp = message.hpSnap.playerHp;
    enemyMon.hp = message.hpSnap.enemyHp;
    renderHP('player');
    renderHP('enemy');
  }

  appendBattleLogEntry(message.text, message.highlight);
  const hasMore = msgQueue.length > 0;
  el('bl-arrow').style.display = hasMore ? 'block' : 'none';
  el('battle-lower').classList.toggle('is-talking', hasMore);
}

function onQueueEmpty() {
  el('battle-lower').classList.remove('is-talking');

  if (enemyMon.hp <= 0) {
    if (enemyQueue.length) {
      sendNextEnemy();
      return;
    }
    showBattleResultScreen(true);
    return;
  }

  if (playerMon.hp <= 0) {
    const nextMon = teamMons.find((mon, index) => index !== activeIdx && mon.hp > 0);
    if (!nextMon) {
      showBattleResultScreen(false);
      return;
    }

    const previous = playerMon;
    activeIdx = teamMons.indexOf(nextMon);
    playerMon = nextMon;
    renderField();
    phase = 'animating';
    enqueue(
      `${previous.name}은 전투 불능이 됐다!`,
      `가라! ${playerMon.name}!`,
    );
    showNextMessage();
    return;
  }

  phase = 'choosing';
  showPanel();
}

function sendNextEnemy() {
  const nextEnemy = enemyQueue.shift();
  if (!nextEnemy) {
    showBattleResultScreen(true);
    return;
  }

  enemyMon = buildBattleMon(nextEnemy.monId, nextEnemy.level);
  renderField();
  phase = 'animating';
  enqueue(`상대가 다음 몬스터 ${enemyMon.name}을 내보냈다!`);
  showNextMessage();
}

function onLowerClick(event) {
  if (phase !== 'animating') return;
  if (event.target.closest('button')) return;
  showNextMessage();
}

function onPanelClick(event) {
  const card = event.target.closest('.bp-skill-card');
  if (!card || card.disabled || phase !== 'choosing') return;

  const index = Number(card.dataset.idx);
  if (!Number.isFinite(index)) return;

  const playerSkill = playerMon.skills[index];
  if (!playerSkill) return;

  hidePanel();
  phase = 'animating';
  turn += 1;

  const enemySkill = pickEnemySkill(enemyMon);
  const events = resolveTurn(playerMon, enemyMon, playerSkill, enemySkill, turn);
  msgQueue = buildMessages(events);
  showNextMessage();
}

function buildMessages(events) {
  const messages = [];

  for (const event of events) {
    const lines = [];

    if (event.type === 'miss') {
      lines.push(`${event.atkName}의 공격이 빗나갔다!`);
    } else {
      lines.push(`${event.atkName}이 ${event.skillName}을 사용했다!`);
      if (event.effectiveness === 0) lines.push('효과가 없는 것 같다...');
      if (event.effectiveness >= 2) lines.push('효과가 굉장했다!');
      if (event.effectiveness > 0 && event.effectiveness <= 0.5) lines.push('효과가 별로인 것 같다...');
      if (event.isCrit) lines.push('급소에 맞았다!');

      if (dialogueEngine) {
        try {
          const result = dialogueEngine.generateTurn({
            turn,
            skillName: event.skillName,
            skillPattern: event.skillPattern,
            attackerName: event.atkName,
            defenderName: event.defName,
            attackerBrand: event.atkBrand,
            defenderBrand: event.defBrand,
            damage: event.damage,
            attackerHp: event.atkHp,
            attackerMaxHp: event.atkMaxHp,
            defenderHp: event.defHp,
            defenderMaxHp: event.defMaxHp,
            momentum: playerMon.hp >= enemyMon.hp ? 'player_ahead' : 'enemy_ahead',
          });
          lines.push(
            ...uniqueLines([
              result.system,
              result.explain,
              result.quote,
              ...(result.storyParagraphs || []),
            ]),
          );
        } catch {
          // no-op
        }
      }
    }

    const hpSnap = {
      playerHp: event.playerHp,
      enemyHp: event.enemyHp,
    };
    const highlight = event.side === 'player'
      ? { allySkills: [event.skillName], enemySkills: [] }
      : { allySkills: [], enemySkills: [event.skillName] };

    const fxData = event.type === 'attack'
      ? { side: event.side, pattern: event.skillPattern, element: event.skillElement }
      : null;
    messages.push({ text: lines[0], hpSnap, highlight, fxData });
    lines.slice(1).forEach(text => {
      messages.push({ text, highlight });
    });
  }

  return messages;
}

function uniqueLines(lines) {
  const seen = new Set();
  return lines.filter(line => {
    const normalized = String(line || '').trim().replace(/\s+/g, ' ');
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function renderBattleLogHtml(text, highlight = null) {
  return renderBattleDialogueMarkup(text, {
    allyNames: playerMon ? [playerMon.name, playerMon.brand] : [],
    enemyNames: enemyMon ? [enemyMon.name, enemyMon.brand] : [],
    allySkills: highlight?.allySkills || [],
    enemySkills: highlight?.enemySkills || [],
  });
}

function setBattleLowerMode(mode) {
  const log = el('battle-log');
  const panel = el('battle-panel');
  const result = el('battle-result');
  const showPanelMode = mode === 'panel';
  const showResultMode = mode === 'post';

  log.classList.toggle('hidden', showPanelMode || showResultMode);
  panel.classList.toggle('hidden', !showPanelMode);
  result.classList.toggle('hidden', !showResultMode);
}

function moveBattleResultToLowerPanel() {
  const lower = el('battle-lower');
  const panel = el('battle-panel');
  const result = el('battle-result');
  if (!lower || !panel || !result) return;
  if (result.parentElement === lower) return;
  lower.insertBefore(result, panel.nextSibling);
}

function resetBattleLog() {
  const log = el('bl-text');
  if (!log) return;
  log.innerHTML = '';
  log.scrollTop = 0;
}

function appendBattleLogEntry(text, highlight = null) {
  const log = el('bl-text');
  if (!log) return;

  const side = getBattleLogSide(highlight);
  const entry = document.createElement('div');
  const bubble = document.createElement('div');

  entry.className = `bl-entry bl-entry--${side}`;
  bubble.className = 'bl-bubble';
  bubble.innerHTML = renderBattleLogHtml(text, highlight);

  entry.appendChild(bubble);
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function getBattleLogSide(highlight) {
  if (highlight?.allySkills?.length) return 'ally';
  if (highlight?.enemySkills?.length) return 'enemy';
  return 'system';
}

function showBattleResultScreen(win) {
  phase = 'ended';
  clearAllEffects();
  setBattleLowerMode('post');
  el('bl-arrow').style.display = 'none';
  clearResultChoices();

  const result = el('battle-result');

  lastBattleOutcome = win ? 'win' : 'lose';
  resolvedTeamIds = teamMons.map(mon => mon.id);

  if (!win) {
    lastBattleRewards = [];
    result.querySelector('.br-icon').textContent = '패';
    result.querySelector('.br-title').textContent = '전투 패배';
    result.querySelector('.br-sub').textContent = '파티가 전투 불능이 됐다.';
    appendBattleLogEntry('파티가 쓰러졌다. 다시 준비해야 한다.');
    el('battle-retry-btn').textContent = '재도전';
    return;
  }

  const postBattle = resolvePostBattle({
    teamMons,
    defeatedEnemy: enemyMon,
    encounter: currentEncounterData,
  });

  lastBattleRewards = postBattle.growth;
  resolvedTeamIds = teamMons.map(mon => mon.id);

  result.querySelector('.br-icon').textContent = '승';
  result.querySelector('.br-title').textContent = buildResultTitle(currentEncounterData);
  result.querySelector('.br-sub').textContent = buildResultSubtitle(postBattle);
  appendBattleLogEntry(buildBattleLogSummary(postBattle));
  el('battle-retry-btn').textContent = '다음 진행';

  renderPostBattleChoices(postBattle);
}

function buildResultTitle(encounter) {
  if (encounter?.type === 'boss') return '관장 돌파';
  if (encounter?.type === 'elite') return '엘리트 승리';
  if (encounter?.type === 'standard') return '훈련사 승리';
  return '전투 승리';
}

function buildResultSubtitle(postBattle) {
  if (postBattle.summaryLines.length) {
    return postBattle.summaryLines.slice(0, 3).join(' · ');
  }
  return '전투 정산이 완료됐다.';
}

function buildBattleLogSummary(postBattle) {
  if (postBattle.summaryLines.length) {
    return postBattle.summaryLines.join(' / ');
  }
  return `${enemyMon.name}을 쓰러뜨렸다.`;
}

function clearResultChoices() {
  const container = el('battle-result-choices');
  if (container) container.innerHTML = '';
}

function renderPostBattleChoices(postBattle) {
  const container = el('battle-result-choices');
  if (!container) return;

  const capture = postBattle.capture;
  if (!capture?.success) return;

  if (!capture.needsTeamChoice) {
    container.appendChild(createChoiceButton('팀에 합류', () => {
      resolvedTeamIds = applyCaptureDecision({
        teamIds: resolvedTeamIds,
        capture,
        decision: 'add',
      });
      finalizeChoice(`${capture.candidate.name}이 팀에 합류했다.`);
    }));
  }

  container.appendChild(createChoiceButton('보류', () => {
    resolvedTeamIds = applyCaptureDecision({
      teamIds: resolvedTeamIds,
      capture,
      decision: 'skip',
    });
    finalizeChoice(`${capture.candidate.name}은 보관 목록으로 보냈다.`);
  }));

  if (!capture.needsTeamChoice) return;

  resolvedTeamIds.forEach((monId, index) => {
    const mon = teamMons[index];
    container.appendChild(createChoiceButton(`${mon?.name || monId} 교체`, () => {
      resolvedTeamIds = applyCaptureDecision({
        teamIds: resolvedTeamIds,
        capture,
        decision: 'replace',
        replaceIndex: index,
      });
      finalizeChoice(`${capture.candidate.name}이 ${mon?.name || monId} 대신 합류했다.`);
    }));
  });
}

function createChoiceButton(label, onClick) {
  const button = document.createElement('button');
  button.className = 'br-choice-btn';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function finalizeChoice(message) {
  clearResultChoices();
  appendBattleLogEntry(message);
}

function onRetry() {
  phase = 'idle';
  setBattleLowerMode('log');
  clearResultChoices();

  if (onBattleEnd) {
    onBattleEnd({
      outcome: lastBattleOutcome,
      rewards: lastBattleRewards,
      teamIds: [...resolvedTeamIds],
      encounter: currentEncounterData,
    });
  }
}

export function debugWin() {
  if (!enemyMon || (phase !== 'choosing' && phase !== 'animating')) return;
  msgQueue = [];
  enemyMon.hp = 0;
  renderHP('enemy');
  showBattleResultScreen(true);
}

export function debugLose() {
  if (!playerMon || (phase !== 'choosing' && phase !== 'animating')) return;
  teamMons.forEach(mon => {
    mon.hp = 0;
  });
  msgQueue = [];
  renderHP('player');
  showBattleResultScreen(false);
}

export function debugSkip() {
  if (phase !== 'animating') return;
  msgQueue = [];
  onQueueEmpty();
}

export function debugSetHp(side, value) {
  const mon = side === 'player' ? playerMon : side === 'enemy' ? enemyMon : null;
  if (!mon) return;
  mon.hp = Math.max(0, Math.min(Number(value) || 0, mon.maxHp));
  renderHP(side);
}

export function debugState() {
  if (!playerMon || !enemyMon) return;
  const teamInfo = teamMons.map((mon, index) =>
    `${index === activeIdx ? '*' : ' '} [${index}] ${mon.name} ${mon.hp}/${mon.maxHp}`,
  ).join('\n');
  console.log(`[battle] phase:${phase} turn:${turn}\n${teamInfo}\nvs ${enemyMon.name} ${enemyMon.hp}/${enemyMon.maxHp}`);
}
