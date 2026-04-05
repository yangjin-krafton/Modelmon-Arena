import { buildBattleMon, resolveTurn, pickEnemySkill, resolveEnemyOnlyTurn } from '../core/battle-engine.js';
import {
  loadBattleDialogueLibrary,
  createBattleDialogueEngine,
  renderBattleDialogueMarkup,
} from '../battle-dialogue/index.js';
import { STARTER_LEVEL } from './starter.js';
import {
  ITEMS,
  initRunItems,
  hasItem,
  consumeItem,
} from '../core/run-items.js';
import { getMonLevel } from '../core/save.js';
import { createBattleLogController } from './battle-log.js';
import { createBattleLayoutController } from './battle-layout.js';
import {
  initEffects, playSkillEffect, clearAllEffects,
  playMonEnter, playMonFaint, playMonRecall,
  playNpcIntro, playBallThrow, playCaptureTry,
} from './battle-effects.js';
import { attemptCapture } from '../adventure/post-battle.js';
import { S, COMBAT_TYPES, el } from './battle-state.js';
import { renderField, renderHP, renderPanel, renderTeamGrid, renderItemGrid } from './battle-scene.js';
import {
  initBattleResult,
  showBattleResultScreen,
  getCurrentPostBattleStep,
  renderCurrentPostBattleStep,
  advancePostBattleFlow,
  onRetry as onRetryResult,
} from './battle-result.js';

export async function initBattle(callback) {
  S.onBattleEnd = callback;

  S.battleLayout = createBattleLayoutController(el);
  S.battleLayout.ensurePostActionPanel();
  S.battleLog = createBattleLogController({
    logContainer: el('bl-text'),
    arrowElement: el('bl-arrow'),
    renderMarkup: renderBattleLogHtml,
  });

  el('battle-lower').addEventListener('click', onLowerClick);
  el('battle-panel').addEventListener('click', onPanelClick);
  el('team-switch-grid').addEventListener('click', onTeamGridClick);
  el('item-grid').addEventListener('click', onItemGridClick);

  initEffects();

  initBattleResult({
    appendBattleLogEntry,
    showPostActionPanel,
    hidePostActionPanel,
    setBattleLowerMode,
    clearAllEffects,
  });

  if (S.libraryLoaded) return;

  try {
    const library = await loadBattleDialogueLibrary({ baseUrl: './data' });
    S.dialogueEngine = createBattleDialogueEngine({ library });
  } catch (error) {
    console.warn('[battle] dialogue load failed:', error);
  }

  S.libraryLoaded = true;
}

export function startBattle(teamIds, encounterData = null) {
  const ids = Array.isArray(teamIds) ? [...teamIds] : [teamIds];

  S.teamMons = ids
    .map(monId => {
      try {
        return buildBattleMon(monId, getMonLevel(monId, STARTER_LEVEL));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!S.teamMons.length) {
    console.error('[battle] failed to build team');
    return;
  }

  if (encounterData && !COMBAT_TYPES.has(encounterData.type)) {
    console.error('[battle] non-combat encounter passed to battle:', encounterData.type);
    return;
  }

  S.activeIdx = 0;
  S.playerMon = S.teamMons[0];
  S.resolvedTeamIds = S.teamMons.map(mon => mon.id);
  S.currentEncounterData = encounterData ? { ...encounterData, captureBonus: 0 } : null;
  S.enemyQueue = [];
  S.turn = 0;
  S.msgQueue = [];
  S.lastBattleRewards = [];
  S.lastBattleOutcome = null;
  S.postBattleFlow = null;
  S._pendingCapture = null;

  setupEncounterEnemies(ids, encounterData);
  applyFieldTheme(encounterData);

  if (S.dialogueEngine) S.dialogueEngine.reset();
  initRunItems();

  resetBattleLog();
  setBattleLowerMode('log');
  el('battle-lower').classList.remove('is-talking');

  renderField();

  S.phase = 'animating';
  enqueue(
    buildEncounterIntro(encounterData, S.enemyMon),
    `가라! ${S.playerMon.name}!`,
  );

  const isTrainer = encounterData?.type === 'npc';
  if (isTrainer) {
    const npcType = encounterData.npcType === 'boss' ? 'boss' : 'trainer';
    playNpcIntro(npcType, () => {
      playMonEnter('player');
      showNextMessage();
    });
  } else {
    playMonEnter('enemy');
    playMonEnter('player');
    showNextMessage();
  }
}

export function getBattlePhase() {
  return S.phase;
}

function setupEncounterEnemies(teamIds, encounterData) {
  const encounterEnemies = encounterData?.enemies || [];
  S.enemyQueue = encounterEnemies.slice(1).map(enemy => ({ ...enemy }));

  if (encounterEnemies.length) {
    S.enemyMon = buildBattleMon(encounterEnemies[0].monId, encounterEnemies[0].level);
    return;
  }

  const enemyCandidates = ['001', '004', '007'].filter(monId => !teamIds.includes(monId));
  const enemyId = enemyCandidates.length
    ? enemyCandidates[Math.floor(Math.random() * enemyCandidates.length)]
    : ['001', '004', '007'].find(monId => monId !== teamIds[0]);
  const teamAvgLevel = Math.round(S.teamMons.reduce((sum, mon) => sum + mon.level, 0) / S.teamMons.length);
  const enemyLevel = Math.max(1, teamAvgLevel + (Math.random() < 0.5 ? 0 : 1));

  S.enemyMon = buildBattleMon(enemyId, enemyLevel);
}

function applyFieldTheme(encounterData) {
  const field = document.querySelector('.battle-field');
  if (!field) return;

  field.dataset.biome = encounterData?.biomeId || 'starter-zone';
  field.dataset.time = encounterData?.localWave >= 6 ? 'night' : 'day';
}

function buildEncounterIntro(encounterData, firstEnemy) {
  if (!encounterData) {
    return `연구원 A가 ${firstEnemy.name}을(를) 내보냈다!`;
  }

  if (encounterData.type === 'wild') {
    return `${encounterData.biomeNameKo}에서 야생 ${firstEnemy.name}이 나타났다!`;
  }

  if (encounterData.type === 'boss') {
    const bossName = encounterData.bossNameKo || '관장';
    return `${bossName}이 ${firstEnemy.name}을(를) 내보냈다!`;
  }

  if (encounterData.type === 'standard' || encounterData.type === 'elite') {
    const trainerName = encounterData.trainerNameKo || '훈련사';
    return `${trainerName}가 ${firstEnemy.name}을(를) 내보냈다!`;
  }

  return `상대가 ${firstEnemy.name}을(를) 내보냈다!`;
}

function hidePanel() {
  hidePostActionPanel();
  setBattleLowerMode('log');
}

function showPanel() {
  showCombatPanelLayout();
  renderPanel();
  renderTeamGrid();
  renderItemGrid();
  setBattleLowerMode('panel');
  el('battle-lower').classList.remove('is-talking');
  S.battleLog?.setArrowVisible(false);
}

function onTeamGridClick(event) {
  const button = event.target.closest('.tsw-card');
  if (!button || button.disabled || S.phase !== 'choosing') return;

  const nextIndex = Number(button.dataset.teamIdx);
  if (!Number.isFinite(nextIndex)) return;

  const previous = S.playerMon;
  S.activeIdx = nextIndex;
  S.playerMon = S.teamMons[S.activeIdx];

  hidePanel();
  S.phase = 'animating';

  // recall 애니메이션(350ms) 후 필드 재구성
  playMonRecall('player', () => {
    renderField();
    playMonEnter('player');
  });

  enqueue(
    `${previous.name}, 돌아와!`,
    `가라! ${S.playerMon.name}!`,
  );
  appendEnemyCounter(); // 교체는 턴 소비 → 적 반격
  showNextMessage();
}

function onItemGridClick(event) {
  const button = event.target.closest('.item-card');
  if (!button || button.disabled || S.phase !== 'choosing') return;
  useItem(button.dataset.itemId);
}

function useItem(itemId) {
  const def = ITEMS[itemId];
  if (!def || !hasItem(itemId)) return;

  if (def.category === 'ball') {
    if (S.currentEncounterData?.type !== 'wild') {
      hidePanel();
      S.phase = 'animating';
      enqueue(`${def.name}은 야생 몬스터에게만 사용할 수 있습니다.`);
      showNextMessage();
      return;
    }

    consumeItem(itemId);
    renderItemGrid();
    hidePanel();
    S.phase = 'capturing';  // 포획 판정 대기 (포획 결과 처리 이후)

    appendBattleLogEntry(`${def.name}을 던졌다!`);

    const catchMult = Number(def.catchMult || 1);

    playBallThrow(() => {
      // 볼 판정: 임시 포획 결정
      S._pendingCapture = attemptCapture(S.enemyMon, S.currentEncounterData, S.teamMons, catchMult);
      const showed = S._pendingCapture?.success;

      playCaptureTry(showed, () => {
        if (S._pendingCapture?.success) {
          // 포획 성공 — 자동으로 결과 화면 전환 (탭 불필요, 포켓몬 원작 방식)
          appendBattleLogEntry(`${S.enemyMon.name}을 포획했다!`);
          setTimeout(() => showBattleResultScreen(true), 1400);
        } else {
          // 포획 실패 — 탭으로 진행, 적 반격 포함
          S.phase = 'animating';
          enqueue(`${S.enemyMon.name}을 놓쳤다!`);
          appendEnemyCounter();
          S._pendingCapture = null;
          showNextMessage();
        }
      });
    });
    return;
  }

  if (def.revivePct > 0) {
    if (S.playerMon.hp > 0) {
      hidePanel();
      S.phase = 'animating';
      enqueue(`${S.playerMon.name}은 아직 기절하지 않았어.`);
      showNextMessage();
      return;
    }

    const restoredHp = def.hpFull
      ? S.playerMon.maxHp
      : Math.floor(S.playerMon.maxHp * def.revivePct / 100);
    consumeItem(itemId);
    S.playerMon.hp = Math.max(1, restoredHp);
    renderHP('player');
    renderItemGrid();
    hidePanel();
    S.phase = 'animating';
    enqueue(`${def.name}을(를) 사용했다.`, `${S.playerMon.name}의 HP가 회복됐다.`);
    appendEnemyCounter(); // 아이템 사용 = 턴 소비 → 적 반격
    showNextMessage();
    return;
  }

  if (def.hpFull || def.hpFlat > 0) {
    if (S.playerMon.hp >= S.playerMon.maxHp) {
      hidePanel();
      S.phase = 'animating';
      enqueue(`${S.playerMon.name}의 HP는 이미 가득찼어.`);
      showNextMessage();
      return;
    }

    const beforeHp = S.playerMon.hp;
    S.playerMon.hp = def.hpFull
      ? S.playerMon.maxHp
      : Math.min(S.playerMon.maxHp, S.playerMon.hp + def.hpFlat);
    consumeItem(itemId);
    renderHP('player');
    renderItemGrid();
    hidePanel();
    S.phase = 'animating';
    enqueue(
      `${def.name}을(를) 사용했다.`,
      `${S.playerMon.name}의 HP가 ${S.playerMon.hp - beforeHp} 회복됐다.`,
    );
    appendEnemyCounter(); // 아이템 사용 = 턴 소비 → 적 반격
    showNextMessage();
    return;
  }

  if (def.ppFull || def.ppFlat > 0) {
    let restored = 0;
    consumeItem(itemId);

    for (const skill of S.playerMon.skills) {
      if (!skill) continue;
      const before = skill.pp;
      skill.pp = def.ppFull ? skill.maxPp : Math.min(skill.maxPp, skill.pp + def.ppFlat);
      restored += skill.pp - before;
      if (!def.ppAll) break;
    }

    renderPanel();
    renderItemGrid();
    hidePanel();
    S.phase = 'animating';
    enqueue(`${def.name}을(를) 사용했다.`, `모든 PP가 ${restored} 회복됐다.`);
    appendEnemyCounter(); // 아이템 사용 = 턴 소비 → 적 반격
    showNextMessage();
    return;
  }

  if (def.category === 'combo') {
    consumeItem(itemId);
    S.playerMon.hp = S.playerMon.maxHp;
    S.playerMon.skills.forEach(skill => {
      if (skill) skill.pp = skill.maxPp;
    });
    renderHP('player');
    renderPanel();
    renderItemGrid();
    hidePanel();
    S.phase = 'animating';
    enqueue(`${def.name}을(를) 사용했다.`, 'HP와 PP가 모두 회복됐다.');
    appendEnemyCounter(); // 아이템 사용 = 턴 소비 → 적 반격
    showNextMessage();
  }
}

/**
 * 아이템 사용 / 교체 후 적 반격 추가 1회 (턴제 시스템 매우 중요).
 * 현재 큐에 쌓인 메시지 뒤에 적 공격 메시지를 붙여준다.
 * 실패시도 동작(HP 변경, 진화 발생 등 않는 것들)
 */
function appendEnemyCounter() {
  if (!S.enemyMon || S.enemyMon.hp <= 0) return;
  if (!S.playerMon || S.playerMon.hp <= 0) return;

  S.turn++;
  const skill = pickEnemySkill(S.enemyMon);
  if (!skill) return;

  const events = resolveEnemyOnlyTurn(S.playerMon, S.enemyMon, skill, S.turn);
  S.msgQueue.push(...buildMessages(events));
}

export function enqueue(...texts) {
  texts.filter(Boolean).forEach(text => {
    S.msgQueue.push({ text });
  });
}

export function showNextMessage() {
  if (!S.msgQueue.length) {
    onQueueEmpty();
    return;
  }

  const message = S.msgQueue.shift();
  if (message.fxData) {
    playSkillEffect(message.fxData.side, { pattern: message.fxData.pattern, element: message.fxData.element });
  }
  if (message.hpSnap) {
    const prevEnemyHp  = S.enemyMon.hp;
    const prevPlayerHp = S.playerMon.hp;
    S.playerMon.hp = message.hpSnap.playerHp;
    S.enemyMon.hp  = message.hpSnap.enemyHp;
    renderHP('player');
    renderHP('enemy');
    if (prevEnemyHp  > 0 && S.enemyMon.hp  <= 0) playMonFaint('enemy');
    if (prevPlayerHp > 0 && S.playerMon.hp <= 0) playMonFaint('player');
  }

  appendBattleLogEntry(message.text, message.highlight);
  const hasMore = S.msgQueue.length > 0;
  S.battleLog?.setArrowVisible(hasMore);
  el('battle-lower').classList.toggle('is-talking', hasMore);
}

function onQueueEmpty() {
  el('battle-lower').classList.remove('is-talking');

  // 포획 성공 시 결과 화면 전환은 setTimeout으로 처리됨
  // 혹시 탭이 먼저 들어오는 경우를 위한 guard
  if (S._pendingCapture?.success) {
    showBattleResultScreen(true);
    return;
  }

  if (S.enemyMon.hp <= 0) {
    if (S.enemyQueue.length) {
      sendNextEnemy();
      return;
    }
    showBattleResultScreen(true);
    return;
  }

  if (S.playerMon.hp <= 0) {
    const nextMon = S.teamMons.find((mon, index) => index !== S.activeIdx && mon.hp > 0);
    if (!nextMon) {
      showBattleResultScreen(false);
      return;
    }

    const previous = S.playerMon;
    playMonFaint('player');
    S.activeIdx = S.teamMons.indexOf(nextMon);
    S.playerMon = nextMon;
    setTimeout(() => {
      renderField();
      playMonEnter('player');
    }, 560);
    S.phase = 'animating';
    enqueue(
      `${previous.name}이 쓰러졌다!`,
      `가라! ${S.playerMon.name}!`,
    );
    showNextMessage();
    return;
  }

  S.phase = 'choosing';
  showPanel();
}

function sendNextEnemy() {
  const nextEnemy = S.enemyQueue.shift();
  if (!nextEnemy) {
    showBattleResultScreen(true);
    return;
  }

  S.enemyMon = buildBattleMon(nextEnemy.monId, nextEnemy.level);
  renderField();
  playMonEnter('enemy');
  S.phase = 'animating';
  enqueue(`상대가 다음 몬스터 ${S.enemyMon.name}을 내보냈다!`);
  showNextMessage();
}

function onLowerClick(event) {
  if (event.target.closest('button')) return;

  if (S.phase === 'ended') {
    const step = getCurrentPostBattleStep();
    if (!step || (step.requiresDecision && !step.resolved)) return;
    onRetry();
    return;
  }

  if (S.phase !== 'animating') return;
  showNextMessage();
}

function onPanelClick(event) {
  const card = event.target.closest('.bp-skill-card');
  if (!card || card.disabled || S.phase !== 'choosing') return;

  const index = Number(card.dataset.idx);
  if (!Number.isFinite(index)) return;

  const playerSkill = S.playerMon.skills[index];
  if (!playerSkill) return;

  hidePanel();
  S.phase = 'animating';
  S.turn += 1;

  const enemySkill = pickEnemySkill(S.enemyMon);
  const events = resolveTurn(S.playerMon, S.enemyMon, playerSkill, enemySkill, S.turn);
  S.msgQueue = buildMessages(events);
  showNextMessage();
}

function buildMessages(events) {
  const messages = [];

  for (const event of events) {
    const lines = [];

    if (event.type === 'miss') {
      lines.push(`${event.atkName}의 공격이 빗나갔다!`);
    } else {
      lines.push(`${event.atkName}이(가) ${event.skillName}을(를) 사용했다!`);
      if (event.effectiveness === 0) lines.push('효과가 없는 것 같다...');
      if (event.effectiveness >= 2) lines.push('효과가 굉장한 것 같다!');
      if (event.effectiveness > 0 && event.effectiveness <= 0.5) lines.push('효과가 별로인 것 같다...');
      if (event.isCrit) lines.push('급소에 맞았다!');

      if (S.dialogueEngine) {
        try {
          const result = S.dialogueEngine.generateTurn({
            turn: S.turn,
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
            momentum: S.playerMon.hp >= S.enemyMon.hp ? 'player_ahead' : 'enemy_ahead',
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
    allyNames: S.playerMon ? [S.playerMon.name, S.playerMon.brand] : [],
    enemyNames: S.enemyMon ? [S.enemyMon.name, S.enemyMon.brand] : [],
    allySkills: highlight?.allySkills || [],
    enemySkills: highlight?.enemySkills || [],
  });
}

export function setBattleLowerMode(mode) {
  S.battleLayout?.setBattleLowerMode(mode);
}

function showCombatPanelLayout() {
  S.battleLayout?.showCombatPanelLayout();
}

export function hidePostActionPanel() {
  S.battleLayout?.hidePostActionPanel(S.phase);
}

export function showPostActionPanel(buttons = []) {
  S.battleLayout?.showPostActionPanel(buttons);
}

function resetBattleLog() {
  S.battleLog?.reset();
}

export function appendBattleLogEntry(text, highlight = null, forcedSide = null) {
  S.battleLog?.append(text, { highlight, forcedSide });
}

function onRetry() {
  onRetryResult({
    hidePostActionPanel,
    showCombatPanelLayout,
    setBattleLowerMode,
  });
}

export function debugWin() {
  if (!S.enemyMon || (S.phase !== 'choosing' && S.phase !== 'animating')) return;
  S.msgQueue = [];
  S.enemyMon.hp = 0;
  renderHP('enemy');
  showBattleResultScreen(true);
}

export function debugLose() {
  if (!S.playerMon || (S.phase !== 'choosing' && S.phase !== 'animating')) return;
  S.teamMons.forEach(mon => {
    mon.hp = 0;
  });
  S.msgQueue = [];
  renderHP('player');
  showBattleResultScreen(false);
}

export function debugSkip() {
  if (S.phase !== 'animating') return;
  S.msgQueue = [];
  onQueueEmpty();
}

export function debugSetHp(side, value) {
  const mon = side === 'player' ? S.playerMon : side === 'enemy' ? S.enemyMon : null;
  if (!mon) return;
  mon.hp = Math.max(0, Math.min(Number(value) || 0, mon.maxHp));
  renderHP(side);
}

export function debugState() {
  if (!S.playerMon || !S.enemyMon) return;
  const teamInfo = S.teamMons.map((mon, index) =>
    `${index === S.activeIdx ? '*' : ' '} [${index}] ${mon.name} ${mon.hp}/${mon.maxHp}`,
  ).join('\n');
  console.log(`[battle] phase:${S.phase} turn:${S.turn}\n${teamInfo}\nvs ${S.enemyMon.name} ${S.enemyMon.hp}/${S.enemyMon.maxHp}`);
}
