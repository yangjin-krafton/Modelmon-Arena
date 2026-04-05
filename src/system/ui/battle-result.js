import { S, el } from './battle-state.js';
import { applyCaptureDecision, resolvePostBattle } from '../adventure/post-battle.js';
import { buildMonCardHtml, TYPE_CLS } from './battle-scene.js';
import { buildBattleMon } from '../core/battle-engine.js';
import {
  buildBattleLogSummary as buildBattleLogSummaryModel,
  createDefeatFlow as createDefeatFlowModel,
  createVictoryFlow as createVictoryFlowModel,
  getCurrentPostBattleStep as getCurrentPostBattleStepModel,
  getResultStepTone as getResultStepToneModel,
} from './battle-post-flow.js';
import { playCapture } from './battle-effects.js';

// These callbacks are injected at init time to avoid circular deps with battle-runtime.js
let _appendBattleLogEntry = null;
let _showPostActionPanel = null;
let _hidePostActionPanel = null;
let _setBattleLowerMode = null;
let _clearAllEffects = null;

export function initBattleResult({ appendBattleLogEntry, showPostActionPanel, hidePostActionPanel, setBattleLowerMode, clearAllEffects }) {
  _appendBattleLogEntry = appendBattleLogEntry;
  _showPostActionPanel = showPostActionPanel;
  _hidePostActionPanel = hidePostActionPanel;
  _setBattleLowerMode = setBattleLowerMode;
  _clearAllEffects = clearAllEffects;
}

export function showBattleResultScreen(win) {
  S.phase = 'ended';
  _clearAllEffects();
  _hidePostActionPanel();
  _setBattleLowerMode('log');
  S.battleLog?.setArrowVisible(false);

  S.lastBattleOutcome = win ? 'win' : 'lose';
  S.resolvedTeamIds = S.teamMons.map(mon => mon.id);

  if (!win) {
    S.lastBattleRewards = [];
    _appendBattleLogEntry('팀이 전멸했다. 다시 도전해주세요.');
    S.postBattleFlow = createDefeatFlowModel();
    renderCurrentPostBattleStep();
    return;
  }

  const postBattle = resolvePostBattle({
    teamMons: S.teamMons,
    defeatedEnemy: S.enemyMon,
    encounter: S.currentEncounterData,
    preCapture: S._pendingCapture,
  });
  S._pendingCapture = null;

  S.lastBattleRewards = postBattle.growth;
  S.resolvedTeamIds = S.teamMons.map(mon => mon.id);
  if (postBattle.capture?.success) {
    playCapture();
  }
  _appendBattleLogEntry(buildBattleLogSummaryModel(S.enemyMon, postBattle));
  S.postBattleFlow = createVictoryFlowModel(S.currentEncounterData, postBattle);
  renderCurrentPostBattleStep();
}

export function getCurrentPostBattleStep() {
  return getCurrentPostBattleStepModel(S.postBattleFlow);
}

export function renderCurrentPostBattleStep() {
  const step = getCurrentPostBattleStep();

  if (!step) {
    _hidePostActionPanel();
    return;
  }

  ensureResultFeedEntry(step);

  if (step.type === 'capture' && step.requiresDecision && !step.resolved) {
    const { capture } = step;
    // 포획한 몬스터 스탯 미리보기 (비교용)
    let capturedMonHtml = '';
    try {
      const capturedMon = buildBattleMon(capture.candidate.monId, capture.candidate.level);
      capturedMonHtml = buildMonCardHtml(capturedMon);
    } catch {}
    const card = {
      icon:           '🎉',
      title:          step.title,
      sub:            step.sub,
      capturedMon:    true,       // layout에서 preview 블록 생성 신호
      capturedMonHtml,            // 실제 HTML
    };
    const { rows } = buildTeamChoiceUI(step);
    _showPostActionPanel({ card, rows, buttons: [] });
    return;
  }

  // 팀 여유: requiresDecision = false → 자동 합류 처리
  if (step.type === 'capture' && !step.requiresDecision && !step.resolved) {
    const { capture } = step;
    S.resolvedTeamIds = applyCaptureDecision({
      teamIds: S.resolvedTeamIds,
      capture,
      decision: 'add',
    });
    finalizePostBattleDecision(step, `${capture.candidate.name}이(가) 팀에 합류했다!`);
    return;
  }

  _hidePostActionPanel();
}

function ensureResultFeedEntry(step) {
  if (!S.postBattleFlow || step.feedLogged) return;
  const tone = getResultStepToneModel(step);
  S.postBattleFlow.feed.push({ tone, title: step.title, text: step.sub });
  _appendBattleLogEntry(`${step.title} · ${step.sub}`, null, tone);
  step.feedLogged = true;
}

/**
 * 팀이 가득 찼을 때 — 교체할 팀원 선택 목록 (보관 없음)
 * 팀 슬롯은 6개 고정, 반드시 한 명을 내보내야 함.
 */
function buildTeamChoiceUI(step) {
  const { capture } = step;
  const listWrap = document.createElement('div');
  listWrap.className = 'ptc-list';

  S.teamMons.forEach((mon, index) => {
    const fainted = mon.hp <= 0;

    // tsw-card 와 동일한 레이아웃 — buildMonCardHtml 재사용
    const row = document.createElement('div');
    row.className = 'ptc-row';

    const card = document.createElement('button');
    card.className = 'tsw-card ptc-mon-card' + (fainted ? ' tsw-fainted' : '');
    card.disabled  = fainted;
    card.innerHTML = buildMonCardHtml(mon);

    // "내보내기" 오버레이 배지
    const badge = document.createElement('span');
    badge.className = 'ptc-dismiss-badge';
    badge.textContent = fainted ? '기절' : '내보내기';
    card.appendChild(badge);

    card.addEventListener('click', () => {
      if (fainted) return;
      S.resolvedTeamIds = applyCaptureDecision({
        teamIds: S.resolvedTeamIds,
        capture,
        decision: 'replace',
        replaceIndex: index,
      });
      finalizePostBattleDecision(
        step,
        `${mon.name}을(를) 내보내고 ${capture.candidate.name}이(가) 팀에 합류했다!`,
      );
    });

    row.appendChild(card);
    listWrap.appendChild(row);
  });

  return { rows: [listWrap] };
}

function createChoiceButton(label, onClick) {
  const button = document.createElement('button');
  button.className = 'br-choice-btn';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function finalizePostBattleDecision(step, message) {
  step.resolved = true;
  step.requiresDecision = false;
  step.sub = message;
  if (S.postBattleFlow) {
    S.postBattleFlow.feed.push({
      tone: 'ally',
      title: '선택 완료',
      text: message,
    });
  }
  _appendBattleLogEntry(message);
  renderCurrentPostBattleStep();
}

export function advancePostBattleFlow() {
  if (!S.postBattleFlow) return false;
  if (S.postBattleFlow.index >= S.postBattleFlow.steps.length - 1) return false;
  S.postBattleFlow.index += 1;
  renderCurrentPostBattleStep();
  return true;
}

export function onRetry(deps) {
  const { hidePostActionPanel, showCombatPanelLayout, setBattleLowerMode } = deps;
  const step = getCurrentPostBattleStep();
  if (step?.requiresDecision && !step.resolved) {
    return;
  }

  if (S.postBattleFlow && !step?.completesFlow) {
    advancePostBattleFlow();
    return;
  }

  S.phase = 'idle';
  S._pendingCapture = null;
  hidePostActionPanel();
  showCombatPanelLayout();
  setBattleLowerMode('log');
  S.postBattleFlow = null;

  if (S.onBattleEnd) {
    S.onBattleEnd({
      outcome: S.lastBattleOutcome,
      rewards: S.lastBattleRewards,
      teamIds: [...S.resolvedTeamIds],
      partyState: serializeBattlePartyState(S.teamMons),
      encounter: S.currentEncounterData,
    });
  }
}

function serializeBattlePartyState(teamMons) {
  return (teamMons || []).map(mon => ({
    monId: mon.id,
    level: mon.level,
    slot: 'active',
    hp: mon.hp,
    maxHp: mon.maxHp,
    skills: (mon.skills || []).map(skill => ({
      no: skill.no,
      pp: skill.pp,
      maxPp: skill.maxPp,
    })),
  }));
}
