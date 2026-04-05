import { S, el } from './battle-state.js';
import { applyCaptureDecision, resolvePostBattle } from '../adventure/post-battle.js';
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
    const card = {
      icon:  capture.success ? '🎉' : '❌',
      title: step.title,
      sub:   step.sub,
    };
    _showPostActionPanel({ card, buttons: buildCaptureDecisionButtons(step) });
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

function buildCaptureDecisionButtons(step) {
  const buttons = [];
  const { capture } = step;

  if (!capture.needsTeamChoice) {
    buttons.push(createChoiceButton('팀에 추가', () => {
      S.resolvedTeamIds = applyCaptureDecision({
        teamIds: S.resolvedTeamIds,
        capture,
        decision: 'add',
      });
      finalizePostBattleDecision(step, `${capture.candidate.name}을(를) 팀에 추가했다.`);
    }));
  }

  buttons.push(createChoiceButton('보관', () => {
    S.resolvedTeamIds = applyCaptureDecision({
      teamIds: S.resolvedTeamIds,
      capture,
      decision: 'skip',
    });
    finalizePostBattleDecision(step, `${capture.candidate.name}을 보관함 목록으로 보냈다.`);
  }));

  if (!capture.needsTeamChoice) return buttons;

  S.resolvedTeamIds.forEach((monId, index) => {
    const mon = S.teamMons[index];
    buttons.push(createChoiceButton(`${mon?.name || monId} 교체`, () => {
      S.resolvedTeamIds = applyCaptureDecision({
        teamIds: S.resolvedTeamIds,
        capture,
        decision: 'replace',
        replaceIndex: index,
      });
      finalizePostBattleDecision(step, `${capture.candidate.name}이(가) ${mon?.name || monId} 대신 팀에 추가됐다.`);
    }));
  });

  return buttons;
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
      encounter: S.currentEncounterData,
    });
  }
}
