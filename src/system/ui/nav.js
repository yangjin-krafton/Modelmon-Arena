/** Toast, bottom-nav 탭 전환, 스타터 ↔ 전투 화면 전환 */

import { closeDetail } from './detail.js';
import { initStarterScreen, showStarterScreen } from './starter.js';
import { initBattle, startBattle, getBattlePhase } from './battle.js';
import { loadAdventureSystem } from '../adventure/index.js';
import { getMetaProgress, getMonLevel, recordBiomeClear, recordBiomeSeen } from '../core/save.js';

const adventure = await loadAdventureSystem();

/* ════════════════════════════════════════
   Toast
════════════════════════════════════════ */
let toastTimer;

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ════════════════════════════════════════
   화면 전환 헬퍼
════════════════════════════════════════ */
const container = () => document.querySelector('.screen-container');
let currentBattleTeamIds = [];
let currentRun = null;
let currentEncounter = null;
const COMBAT_TYPES = new Set(['wild', 'standard', 'elite', 'boss']);

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
  startBattle(teamIds, encounter);   // 팀 배열 전체 전달
}

function startAdventureRun(teamIds) {
  currentBattleTeamIds = [...teamIds];
  currentRun = adventure.createRun({
    starterId: teamIds[0],
    starterLevel: getMonLevel(teamIds[0], 5),
    seed: Date.now(),
  });
  currentRun.party = teamIds.map(monId => ({
    monId,
    level: getMonLevel(monId, 5),
    slot: 'active',
  }));
  recordBiomeSeen(currentRun.biomeId);
  launchNextEncounter();
}

function launchNextEncounter() {
  if (!currentRun) return;
  currentRun.party = currentBattleTeamIds.map(monId => ({
    monId,
    level: getMonLevel(monId, 5),
    slot: 'active',
  }));
  currentEncounter = adventure.createEncounter({
    run: currentRun,
    metaProgress: getMetaProgress(),
  });

  if (!COMBAT_TYPES.has(currentEncounter.type)) {
    showToast(buildNonCombatToast(currentEncounter));
    const progression = adventure.completeWave({
      run: currentRun,
      result: { victory: true },
      metaProgress: getMetaProgress(),
    });

    if (progression.kind === 'advanced') {
      launchNextEncounter();
      return;
    }

    if (progression.kind === 'biome_choice') {
      recordBiomeClear(progression.fromBiomeId);
      showBiomeChoiceModal(progression.choices);
      return;
    }

    currentBattleTeamIds = [];
    currentRun = null;
    currentEncounter = null;
    showStarterUI();
    return;
  }

  showBattleUI(currentBattleTeamIds, currentEncounter);
}

function handleBattleFinished(result = {}) {
  if (result.outcome !== 'win') {
    currentBattleTeamIds = [];
    currentRun = null;
    currentEncounter = null;
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

  if (progression.kind === 'advanced') {
    launchNextEncounter();
    return;
  }

  if (progression.kind === 'biome_choice') {
    recordBiomeClear(progression.fromBiomeId);
    showBiomeChoiceModal(progression.choices);
    return;
  }

  currentBattleTeamIds = [];
  currentRun = null;
  currentEncounter = null;
  showStarterUI();
}

function showBiomeChoiceModal(choices) {
  const modal = document.getElementById('adventure-choice-modal');
  const list = document.getElementById('adventure-choice-list');
  modal.classList.remove('hidden');
  list.innerHTML = choices.map(choice => `
    <button class="adventure-choice-btn" data-biome-id="${choice.biomeId}">
      <strong>${choice.nameKo}</strong>
      <span>${choice.themeTags.join(' / ')} · 위험도 ${choice.baseDanger}</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-biome-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const biomeId = button.dataset.biomeId;
      adventure.chooseNextBiome({ run: currentRun, biomeId });
      recordBiomeSeen(biomeId);
      hideBiomeChoiceModal();
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

/* ════════════════════════════════════════
   Bottom nav 초기화
════════════════════════════════════════ */
let ingameReady = false;

export function initNavEvents() {
  // 스타터 팀 선택 완료 → 전투 화면으로 (teamIds 배열)
  initStarterScreen(teamIds => startAdventureRun(teamIds));

  // 전투 종료 / 재도전 → 스타터 선택으로 복귀
  initBattle(handleBattleFinished);

  document.querySelector('.bottom-nav').addEventListener('click', e => {
    const item = e.target.closest('.nav-item');
    if (!item) return;
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => {
      n.dataset.active = n.dataset.tab === tab ? 'true' : 'false';
    });

    if (tab === 'dex') {
      showDex();
    } else if (tab === 'ingame') {
      closeDetail();

      if (!ingameReady) {
        ingameReady = true;
        // initBattle()은 async이지만 이미 위에서 시작됨 → 완료 후 starter 표시
        // 로딩 중 화면 전환을 먼저 하고 완료되면 starter가 렌더됨
        showStarterUI();
      } else {
        // 이미 전투 중이면 전투 화면 유지, 그렇지 않으면 스타터 복귀
        const battlePhase = getBattlePhase();
        if (battlePhase === 'choosing' || battlePhase === 'animating') {
          const c = container();
          c.classList.remove('ingame-starter');
          c.classList.add('ingame-battle');
        } else {
          showStarterUI();
        }
      }
    }
  });
}
