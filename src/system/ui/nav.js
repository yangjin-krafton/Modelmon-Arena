import { closeDetail } from './detail.js';
import { initStarterScreen, showStarterScreen } from './starter.js';
import { initBattle, startBattle, getBattlePhase } from './battle.js';
import { loadAdventureSystem } from '../adventure/index.js';
import {
  clearAdventureSession,
  getAdventureSession,
  getMetaProgress,
  getMonLevel,
  recordBiomeClear,
  recordBiomeSeen,
  setAdventureSession,
} from '../core/save.js';

const adventure = await loadAdventureSystem();
const COMBAT_TYPES = new Set(['wild', 'npc']);

let toastTimer;
let ingameReady = false;
let currentBattleTeamIds = [];
let currentRun = null;
let currentEncounter = null;

const container = () => document.querySelector('.screen-container');

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

function showDex() {
  const c = container();
  c.classList.remove('ingame-starter', 'ingame-battle');
  closeDetail();
}

function showStarterUI() {
  const c = container();
  c.classList.remove('ingame-battle');
  c.classList.add('ingame-starter');
  hideBiomeChoiceModal();
  showStarterScreen();
}

function showBattleUI(teamIds, encounter = null) {
  const c = container();
  c.classList.remove('ingame-starter');
  c.classList.add('ingame-battle');
  currentBattleTeamIds = Array.isArray(teamIds) ? [...teamIds] : [teamIds];
  currentEncounter = encounter;
  persistAdventureSession('battle');
  startBattle(currentBattleTeamIds, currentEncounter);
}

function startAdventureRun(teamIds) {
  currentBattleTeamIds = [...teamIds];
  currentRun = adventure.createRun({
    starterId: teamIds[0],
    starterLevel: getMonLevel(teamIds[0], 5),
    seed: Date.now(),
  });
  currentRun.party = buildPartyState(currentBattleTeamIds);
  recordBiomeSeen(currentRun.biomeId);
  persistAdventureSession('starter');
  launchNextEncounter();
}

function launchNextEncounter() {
  if (!currentRun) return;

  currentRun.party = buildPartyState(currentBattleTeamIds);
  currentEncounter = adventure.createEncounter({
    run: currentRun,
    metaProgress: getMetaProgress(),
  });
  persistAdventureSession(COMBAT_TYPES.has(currentEncounter.type) ? 'battle' : currentEncounter.type);

  if (!COMBAT_TYPES.has(currentEncounter.type)) {
    showToast(buildNonCombatToast(currentEncounter));
    const progression = adventure.completeWave({
      run: currentRun,
      result: { victory: true },
      metaProgress: getMetaProgress(),
    });
    persistAdventureSession('starter');

    if (progression.kind === 'advanced') {
      launchNextEncounter();
      return;
    }

    if (progression.kind === 'biome_choice') {
      recordBiomeClear(progression.fromBiomeId);
      showBiomeChoiceModal(progression.choices);
      return;
    }

    clearAdventureState();
    showStarterUI();
    return;
  }

  showBattleUI(currentBattleTeamIds, currentEncounter);
}

function handleBattleFinished(result = {}) {
  if (result.outcome !== 'win') {
    clearAdventureState();
    showStarterUI();
    return;
  }

  if (Array.isArray(result.teamIds) && result.teamIds.length) {
    currentBattleTeamIds = [...result.teamIds];
  }

  const progression = adventure.completeWave({
    run: currentRun,
    result: { victory: true },
    metaProgress: getMetaProgress(),
  });
  persistAdventureSession('starter');

  if (progression.kind === 'advanced') {
    launchNextEncounter();
    return;
  }

  if (progression.kind === 'biome_choice') {
    recordBiomeClear(progression.fromBiomeId);
    showBiomeChoiceModal(progression.choices);
    return;
  }

  clearAdventureState();
  showStarterUI();
}

function showBiomeChoiceModal(choices) {
  const modal = document.getElementById('adventure-choice-modal');
  const list = document.getElementById('adventure-choice-list');

  currentEncounter = null;
  currentRun.pendingBiomeChoices = choices;
  persistAdventureSession('biome-choice');

  modal.classList.remove('hidden');
  list.innerHTML = choices.map(choice => `
    <button class="adventure-choice-btn" data-biome-id="${choice.biomeId}">
      <strong>${choice.nameKo}</strong>
      <span>${choice.themeTags.join(' / ')} · 위험도 ${choice.baseDanger}</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-biome-id]').forEach(button => {
    button.addEventListener('click', () => {
      const biomeId = button.dataset.biomeId;
      adventure.chooseNextBiome({ run: currentRun, biomeId });
      recordBiomeSeen(biomeId);
      hideBiomeChoiceModal();
      persistAdventureSession('starter');
      launchNextEncounter();
    });
  });
}

function hideBiomeChoiceModal() {
  const modal = document.getElementById('adventure-choice-modal');
  if (modal) modal.classList.add('hidden');
}

function buildNonCombatToast(encounter) {
  if (encounter.type === 'reward') return `${encounter.waveLabelKo}을 지나 다음 전투로 이동한다.`;
  if (encounter.type === 'shop') return '상점을 지나며 장비를 정비했다.';
  if (encounter.type === 'rest') return '휴식 지점을 지나며 호흡을 가다듬었다.';
  return '다음 구간으로 이동한다.';
}

function buildPartyState(teamIds) {
  return teamIds.map(monId => ({
    monId,
    level: getMonLevel(monId, 5),
    slot: 'active',
  }));
}

function persistAdventureSession(screen = 'starter') {
  if (!currentRun || !currentBattleTeamIds.length) {
    clearAdventureSession();
    return;
  }

  setAdventureSession({
    screen,
    battleTeamIds: [...currentBattleTeamIds],
    run: currentRun,
    encounter: currentEncounter,
    pendingBiomeChoices: currentRun.pendingBiomeChoices ?? null,
    savedAt: Date.now(),
  });
}

function clearAdventureState() {
  currentBattleTeamIds = [];
  currentRun = null;
  currentEncounter = null;
  clearAdventureSession();
}

function restoreAdventureSession() {
  const session = getAdventureSession();
  if (!session?.run || !Array.isArray(session.battleTeamIds) || !session.battleTeamIds.length) {
    return false;
  }

  currentRun = session.run;
  currentBattleTeamIds = [...session.battleTeamIds];
  currentEncounter = session.encounter ?? null;
  currentRun.pendingBiomeChoices = session.pendingBiomeChoices ?? currentRun.pendingBiomeChoices ?? null;
  ingameReady = true;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.dataset.active = item.dataset.tab === 'ingame' ? 'true' : 'false';
  });

  closeDetail();

  if (session.screen === 'biome-choice' && currentRun.pendingBiomeChoices?.length) {
    const c = container();
    c.classList.remove('ingame-battle');
    c.classList.add('ingame-starter');
    showStarterScreen();
    showBiomeChoiceModal(currentRun.pendingBiomeChoices);
    showToast('이전 모험 진행을 복구했다.');
    return true;
  }

  if (session.screen === 'battle' && currentEncounter && COMBAT_TYPES.has(currentEncounter.type)) {
    showBattleUI(currentBattleTeamIds, currentEncounter);
    showToast('이전 전투 지점을 복구했다.');
    return true;
  }

  launchNextEncounter();
  showToast('이전 모험 진행을 복구했다.');
  return true;
}

export function initNavEvents() {
  initStarterScreen(teamIds => startAdventureRun(teamIds));
  initBattle(handleBattleFinished);
  restoreAdventureSession();

  document.querySelector('.bottom-nav').addEventListener('click', event => {
    const item = event.target.closest('.nav-item');
    if (!item) return;

    const tab = item.dataset.tab;
    document.querySelectorAll('.nav-item').forEach(navItem => {
      navItem.dataset.active = navItem.dataset.tab === tab ? 'true' : 'false';
    });

    if (tab === 'dex') {
      showDex();
      return;
    }

    if (tab !== 'ingame') return;

    closeDetail();

    if (!ingameReady) {
      ingameReady = true;
      showStarterUI();
      return;
    }

    const battlePhase = getBattlePhase();
    if (battlePhase === 'choosing' || battlePhase === 'animating') {
      const c = container();
      c.classList.remove('ingame-starter');
      c.classList.add('ingame-battle');
      return;
    }

    if (currentRun && currentRun.pendingBiomeChoices?.length) {
      showStarterUI();
      showBiomeChoiceModal(currentRun.pendingBiomeChoices);
      return;
    }

    showStarterUI();
  });
}
