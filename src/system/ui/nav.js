import { closeDetail } from './detail.js';
import { initStarterScreen, showStarterScreen } from './starter.js';
import { initBattle, startBattle, getBattlePhase } from './battle.js';
import { buildBattleMon } from '../core/battle-engine.js';
import { createDefaultInventory, getInventory, setInventory } from '../core/run-items.js';
import { loadAdventureSystem } from '../adventure/index.js';
import {
  clearAdventureSession,
  expToNextLevel,
  getAdventureSession,
  getMetaProgress,
  getMonLevel,
  getMonProgress,
  grantExp,
  recordBiomeClear,
  recordBiomeSeen,
  setAdventureSession,
} from '../core/save.js';

const adventure = await loadAdventureSystem();
const COMBAT_TYPES = new Set(['wild', 'npc']);
const SERVICE_TYPES = new Set(['shop', 'rest']);

const SHOP_POOLS = {
  3: [
    { effect: 'bundle', title: '프리미엄 캐시', detail: '울트라볼 x2, 풀리스토어 x1', items: { ultraball: 2, fullrestore: 1 } },
    { effect: 'bundle', title: '마스터 캐시', detail: '마스터볼 x1', items: { masterball: 1 } },
    { effect: 'bundle', title: '전술 패키지', detail: '울트라볼 x1, 맥스엘릭서 x1, 하이퍼포션 x2', items: { ultraball: 1, maxelixir: 1, hyperpotion: 2 } },
  ],
  2: [
    { effect: 'bundle', title: '헌터 번들', detail: '슈퍼볼 x2, 슈퍼포션 x1', items: { superball: 2, superpotion: 1 } },
    { effect: 'bundle', title: '안정화 번들', detail: '맥스포션 x1, 엘릭서 x1', items: { maxpotion: 1, elixir: 1 } },
    { effect: 'bundle', title: '포획 모듈', detail: '울트라볼 x1, 모델볼 x2', items: { ultraball: 1, modelball: 2 } },
    { effect: 'bundle', title: '지원 프로토콜', detail: '슈퍼볼 x1, 리롤 +1, 포획 +1', items: { superball: 1 }, resources: { rerolls: 1, captures: 1 } },
  ],
  1: [
    { effect: 'bundle', title: '볼 샘플팩', detail: '모델볼 x3', items: { modelball: 3 } },
    { effect: 'bundle', title: '응급 패치', detail: '포션 x2', items: { potion: 2 } },
    { effect: 'bundle', title: 'PP 셀', detail: '에테르 x1', items: { ether: 1 } },
    { effect: 'bundle', title: '캐치 킷', detail: '슈퍼볼 x1, 모델볼 x1', items: { superball: 1, modelball: 1 } },
    { effect: 'bundle', title: '리롤 토큰', detail: '리롤 +1', resources: { rerolls: 1 } },
  ],
};

const REST_POOLS = {
  3: [
    { effect: 'team-full', title: '센터 오버홀', detail: '팀 전체 HP/PP 완전 회복' },
    { effect: 'level-up', title: '심화 튜닝 +2', detail: '선택한 팀원 레벨 +2, 완전 회복', targetMode: 'single', levelGain: 2, healHp: 'full', healPp: 'full' },
  ],
  2: [
    { effect: 'single-full', title: '정밀 정비', detail: '선택한 팀원 HP/PP 완전 회복', targetMode: 'single', healHp: 'full', healPp: 'full', reviveTo: 1 },
    { effect: 'team-hp', title: '팀 메디킷', detail: '팀 전체 HP 60% 회복', healHp: 'ratio', hpRatio: 0.6 },
    { effect: 'team-pp', title: '리소스 충전', detail: '팀 전체 PP +8', healPp: 'flat', ppFlat: 8 },
    { effect: 'level-up', title: '튜닝 +1', detail: '선택한 팀원 레벨 +1, 완전 회복', targetMode: 'single', levelGain: 1, healHp: 'full', healPp: 'full' },
  ],
  1: [
    { effect: 'single-hp', title: '국소 치료', detail: '선택한 팀원 HP 50% 회복', targetMode: 'single', healHp: 'ratio', hpRatio: 0.5 },
    { effect: 'single-pp', title: 'PP 패치', detail: '선택한 팀원 PP +10', targetMode: 'single', healPp: 'flat', ppFlat: 10 },
    { effect: 'single-revive', title: '재기동', detail: '기절한 팀원 HP 40%로 복귀, PP +5', targetMode: 'single', reviveOnly: true, reviveTo: 0.4, healPp: 'flat', ppFlat: 5 },
    { effect: 'single-hp', title: '응급 수복', detail: '선택한 팀원 HP +35', targetMode: 'single', healHp: 'flat', hpFlat: 35 },
  ],
};

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
  hideAdventureModal();
  closeDetail();
}

function showStarterUI() {
  const c = container();
  c.classList.remove('ingame-battle');
  c.classList.add('ingame-starter');
  hideAdventureModal();
  showStarterScreen();
}

function showBattleUI(teamIds, encounter = null) {
  const c = container();
  c.classList.remove('ingame-starter');
  c.classList.add('ingame-battle');
  currentBattleTeamIds = Array.isArray(teamIds) ? [...teamIds] : [teamIds];
  currentEncounter = encounter;
  currentRun.party = syncRunPartyState(currentRun.party, currentBattleTeamIds);
  currentRun.inventory = normalizeRunInventory(currentRun.inventory);
  setInventory(currentRun.inventory);
  persistAdventureSession('battle');
  startBattle(currentBattleTeamIds, currentEncounter, currentRun.party);
}

function startAdventureRun(teamIds) {
  currentBattleTeamIds = [...teamIds];
  currentRun = adventure.createRun({
    starterId: teamIds[0],
    starterLevel: getMonLevel(teamIds[0], 5),
    seed: Date.now(),
  });
  currentRun.party = buildPartyState(currentBattleTeamIds);
  currentRun.inventory = createDefaultInventory();
  currentRun.pendingServiceState = null;
  recordBiomeSeen(currentRun.biomeId);
  persistAdventureSession('starter');
  launchNextEncounter();
}

function launchNextEncounter() {
  if (!currentRun) return;

  currentRun.party = syncRunPartyState(currentRun.party, currentBattleTeamIds);
  currentRun.inventory = normalizeRunInventory(currentRun.inventory);
  currentEncounter = adventure.createEncounter({
    run: currentRun,
    metaProgress: getMetaProgress(),
  });

  if (SERVICE_TYPES.has(currentEncounter.type)) {
    prepareServiceEncounter(currentEncounter);
    return;
  }

  persistAdventureSession(COMBAT_TYPES.has(currentEncounter.type) ? 'battle' : currentEncounter.type);

  if (!COMBAT_TYPES.has(currentEncounter.type)) {
    applyNonCombatEncounter(currentEncounter);
    showToast(buildNonCombatToast(currentEncounter));
    resolveNonCombatProgression();
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
  if (Array.isArray(result.partyState) && result.partyState.length) {
    currentRun.party = syncRunPartyState(result.partyState, currentBattleTeamIds);
  }
  currentRun.inventory = getInventory();

  const progression = adventure.completeWave({
    run: currentRun,
    result: { victory: true },
    metaProgress: getMetaProgress(),
  });
  persistAdventureSession('starter');
  handleAdventureProgression(progression);
}

function prepareServiceEncounter(encounter) {
  if (!currentRun) return;

  currentRun.pendingServiceState = ensureServiceState(encounter, currentRun.pendingServiceState);
  currentEncounter = encounter;
  showStarterUI();
  persistAdventureSession('service');
  showServiceModal(currentRun.pendingServiceState);
}

function ensureServiceState(encounter, existingState = null) {
  const key = `${encounter.type}:${currentRun.wave}:${currentRun.localWave}`;
  if (existingState?.key === key) return existingState;

  return {
    key,
    type: encounter.type,
    title: encounter.type === 'shop' ? '상점 웨이브' : '포켓센터 웨이브',
    sub: encounter.type === 'shop'
      ? '이번 웨이브 전용 코인 3개로 상품을 골라 담습니다.'
      : '이번 웨이브 전용 코인 3개로 회복과 강화 서비스를 고릅니다.',
    coins: 3,
    offers: createServiceOffers(encounter.type),
    pendingTargetOfferId: null,
  };
}

function createServiceOffers(type) {
  const pools = type === 'shop' ? SHOP_POOLS : REST_POOLS;
  const cost3 = pickDistinct(pools[3], 1).map(offer => ({ ...offer, cost: 3 }));
  const cost2 = pickDistinct(pools[2], 2).map(offer => ({ ...offer, cost: 2 }));
  const cost1 = pickDistinct(pools[1], 3).map(offer => ({ ...offer, cost: 1 }));
  return [...cost3, ...cost2, ...cost1].map((offer, index) => ({
    ...offer,
    id: `${type}-offer-${index + 1}`,
    purchased: false,
  }));
}

function pickDistinct(entries, count) {
  const pool = [...entries];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

function showAdventureModal({ title, sub, bodyClass = '', bodyHtml = '', footerHtml = '' }) {
  const modal = document.getElementById('adventure-choice-modal');
  const panel = modal?.querySelector('.adventure-choice-panel');
  if (!modal || !panel) return;

  panel.className = `adventure-choice-panel ${bodyClass}`.trim();
  panel.innerHTML = `
    <div class="ac-title">${title}</div>
    <div class="ac-sub">${sub}</div>
    ${bodyHtml}
    ${footerHtml}
  `;
  modal.classList.remove('hidden');
}

function hideAdventureModal() {
  const modal = document.getElementById('adventure-choice-modal');
  if (modal) modal.classList.add('hidden');
}

function showBiomeChoiceModal(choices) {
  currentEncounter = null;
  currentRun.pendingBiomeChoices = choices;
  persistAdventureSession('biome-choice');

  const bodyHtml = `
    <div class="adventure-choice-list" id="adventure-choice-list">
      ${choices.map(choice => `
        <button class="adventure-choice-btn" data-biome-id="${choice.biomeId}">
          <strong>${choice.nameKo}</strong>
          <span>${choice.themeTags.join(' / ')} · 위험도 ${choice.baseDanger}</span>
        </button>
      `).join('')}
    </div>
  `;

  showAdventureModal({
    title: '다음 지역 선택',
    sub: '관문을 돌파했다. 다음 여정의 방향을 고른다.',
    bodyHtml,
  });

  document.querySelectorAll('[data-biome-id]').forEach(button => {
    button.addEventListener('click', () => {
      const biomeId = button.dataset.biomeId;
      adventure.chooseNextBiome({ run: currentRun, biomeId });
      recordBiomeSeen(biomeId);
      hideAdventureModal();
      persistAdventureSession('starter');
      launchNextEncounter();
    });
  });
}

function showServiceModal(state) {
  const offerTarget = state.offers.find(offer => offer.id === state.pendingTargetOfferId) || null;
  const bodyHtml = `
    <div class="service-wallet">
      <span class="service-wallet__label">웨이브 코인</span>
      <strong class="service-wallet__value">${state.coins}</strong>
      <span class="service-wallet__hint">남은 코인은 이 웨이브에서만 사용됩니다.</span>
    </div>
    ${offerTarget ? buildServiceTargetSection(offerTarget) : ''}
    <div class="service-offer-grid">
      ${state.offers.map(offer => buildServiceOfferCard(offer, state.coins)).join('')}
    </div>
  `;
  const footerHtml = `
    <div class="service-footer">
      <button class="service-footer__btn service-footer__btn--ghost" id="service-skip-btn" type="button">
        ${offerTarget ? '대상 선택 취소' : '선택 종료'}
      </button>
      <button class="service-footer__btn" id="service-continue-btn" type="button">
        ${state.coins > 0 ? '다음 웨이브로' : '정산 완료'}
      </button>
    </div>
  `;

  showAdventureModal({
    title: state.title,
    sub: state.sub,
    bodyClass: 'adventure-choice-panel--service',
    bodyHtml,
    footerHtml,
  });

  document.querySelectorAll('[data-service-offer-id]').forEach(button => {
    button.addEventListener('click', () => {
      onServiceOfferClick(button.dataset.serviceOfferId);
    });
  });
  document.querySelectorAll('[data-service-target-mon-id]').forEach(button => {
    button.addEventListener('click', () => {
      onServiceTargetClick(button.dataset.serviceTargetMonId);
    });
  });

  document.getElementById('service-skip-btn')?.addEventListener('click', () => {
    if (state.pendingTargetOfferId) {
      currentRun.pendingServiceState.pendingTargetOfferId = null;
      persistAdventureSession('service');
      showServiceModal(currentRun.pendingServiceState);
      return;
    }
    finishServiceEncounter();
  });
  document.getElementById('service-continue-btn')?.addEventListener('click', finishServiceEncounter);
}

function buildServiceOfferCard(offer, coins) {
  const disabled = offer.purchased || offer.cost > coins;
  const classes = [
    'service-offer-card',
    `is-cost-${offer.cost}`,
    disabled ? 'is-disabled' : '',
    offer.purchased ? 'is-purchased' : '',
  ].filter(Boolean).join(' ');

  return `
    <button class="${classes}" type="button" data-service-offer-id="${offer.id}" ${disabled ? 'disabled' : ''}>
      <span class="service-offer-card__cost">${offer.cost} 코인</span>
      <strong class="service-offer-card__title">${offer.title}</strong>
      <span class="service-offer-card__detail">${offer.detail}</span>
      <span class="service-offer-card__state">${offer.purchased ? '구매 완료' : offer.targetMode === 'single' ? '선택 후 대상 지정' : '즉시 적용'}</span>
    </button>
  `;
}

function buildServiceTargetSection(offer) {
  const targetButtons = currentRun.party
    .map(member => {
      const preview = buildPartyPreview(member);
      const disabled = !isOfferTargetEligible(offer, member);
      return `
        <button class="service-target-card ${disabled ? 'is-disabled' : ''}" type="button"
          data-service-target-mon-id="${member.monId}" ${disabled ? 'disabled' : ''}>
          <strong>${preview.name}</strong>
          <span>Lv.${preview.level} · HP ${preview.hp}/${preview.maxHp}</span>
          <span>PP ${preview.ppText}</span>
        </button>
      `;
    })
    .join('');

  return `
    <div class="service-target-box">
      <div class="service-target-box__title">${offer.title} 대상 선택</div>
      <div class="service-target-box__sub">${offer.detail}</div>
      <div class="service-target-list">${targetButtons}</div>
    </div>
  `;
}

function onServiceOfferClick(offerId) {
  const state = currentRun?.pendingServiceState;
  const offer = state?.offers.find(entry => entry.id === offerId);
  if (!state || !offer || offer.purchased || offer.cost > state.coins) return;

  if (offer.targetMode === 'single') {
    if (!currentRun.party.some(member => isOfferTargetEligible(offer, member))) {
      showToast('선택 가능한 팀원이 없습니다.');
      return;
    }
    state.pendingTargetOfferId = offer.id;
    persistAdventureSession('service');
    showServiceModal(state);
    return;
  }

  applyServiceOffer(offer);
}

function onServiceTargetClick(monId) {
  const state = currentRun?.pendingServiceState;
  const offer = state?.offers.find(entry => entry.id === state.pendingTargetOfferId);
  if (!state || !offer) return;
  applyServiceOffer(offer, monId);
}

function applyServiceOffer(offer, targetMonId = null) {
  const state = currentRun.pendingServiceState;
  if (!state || offer.purchased || offer.cost > state.coins) return;

  if (state.type === 'shop') {
    applyShopOffer(offer);
  } else {
    applyRestOffer(offer, targetMonId);
  }

  offer.purchased = true;
  state.coins -= offer.cost;
  state.pendingTargetOfferId = null;
  persistAdventureSession('service');
  showServiceModal(state);
  showToast(`${offer.title} 적용 완료`);
}

function applyShopOffer(offer) {
  currentRun.inventory = normalizeRunInventory(currentRun.inventory);
  currentRun.resources = currentRun.resources || {};

  Object.entries(offer.items || {}).forEach(([itemId, count]) => {
    currentRun.inventory[itemId] = (currentRun.inventory[itemId] ?? 0) + count;
  });
  Object.entries(offer.resources || {}).forEach(([resourceId, count]) => {
    currentRun.resources[resourceId] = (currentRun.resources[resourceId] ?? 0) + count;
  });

  setInventory(currentRun.inventory);
}

function applyRestOffer(offer, targetMonId = null) {
  if (offer.effect === 'team-full') {
    currentRun.party = currentRun.party.map(member => rebuildPartyMember(member, {
      healHp: 'full',
      healPp: 'full',
      reviveTo: 1,
    }));
    return;
  }

  if (offer.effect === 'team-hp' || offer.effect === 'team-pp') {
    currentRun.party = currentRun.party.map(member => rebuildPartyMember(member, offer));
    return;
  }

  currentRun.party = currentRun.party.map(member =>
    member.monId === targetMonId
      ? rebuildPartyMember(member, offer)
      : member,
  );
}

function rebuildPartyMember(member, offer) {
  const levelGain = Number(offer.levelGain || 0);
  if (levelGain > 0) {
    grantLevels(member.monId, levelGain);
  }

  const nextLevel = getMonLevel(member.monId, member.level ?? 5);
  const template = buildBattleMon(member.monId, nextLevel);
  const previousHp = Number.isFinite(member.hp) ? member.hp : template.maxHp;
  const previousSkills = new Map((member.skills || []).map(skill => [skill.no, skill.pp]));

  let nextHp = previousHp;
  if (previousHp <= 0) {
    if (offer.reviveTo) {
      nextHp = Math.max(1, Math.floor(template.maxHp * offer.reviveTo));
    } else {
      nextHp = 0;
    }
  }

  if (offer.healHp === 'full') {
    nextHp = template.maxHp;
  } else if (offer.healHp === 'ratio' && nextHp > 0) {
    nextHp = Math.min(template.maxHp, nextHp + Math.floor(template.maxHp * (offer.hpRatio || 0)));
  } else if (offer.healHp === 'flat' && nextHp > 0) {
    nextHp = Math.min(template.maxHp, nextHp + Math.floor(offer.hpFlat || 0));
  }

  const nextSkills = template.skills.map(skill => {
    const before = previousSkills.has(skill.no) ? previousSkills.get(skill.no) : skill.maxPp;
    if (offer.healPp === 'full') {
      return { no: skill.no, pp: skill.maxPp, maxPp: skill.maxPp };
    }
    if (offer.healPp === 'flat') {
      return {
        no: skill.no,
        pp: Math.max(0, Math.min(skill.maxPp, before + Math.floor(offer.ppFlat || 0))),
        maxPp: skill.maxPp,
      };
    }
    return {
      no: skill.no,
      pp: Math.max(0, Math.min(skill.maxPp, before)),
      maxPp: skill.maxPp,
    };
  });

  return {
    ...member,
    monId: member.monId,
    level: nextLevel,
    slot: member.slot || 'active',
    hp: Math.max(0, Math.min(nextHp, template.maxHp)),
    maxHp: template.maxHp,
    skills: nextSkills,
  };
}

function grantLevels(monId, levels) {
  const totalLevels = Math.max(0, Math.floor(Number(levels) || 0));
  if (!totalLevels) return;

  const progress = getMonProgress(monId);
  let levelCursor = progress.lv;
  let expCursor = progress.exp;
  let totalExp = 0;

  for (let index = 0; index < totalLevels && levelCursor < 100; index += 1) {
    totalExp += Math.max(0, expToNextLevel(levelCursor) - expCursor);
    levelCursor += 1;
    expCursor = 0;
  }

  if (totalExp > 0) grantExp(monId, totalExp);
}

function isOfferTargetEligible(offer, member) {
  if (offer.reviveOnly) return (member.hp ?? 0) <= 0;
  return true;
}

function buildPartyPreview(member) {
  const level = member.level ?? getMonLevel(member.monId, 5);
  const template = buildBattleMon(member.monId, level);
  const hp = Number.isFinite(member.hp) ? member.hp : template.maxHp;
  const ppText = template.skills.map(skill => {
    const current = (member.skills || []).find(entry => entry.no === skill.no)?.pp ?? skill.maxPp;
    return `${current}/${skill.maxPp}`;
  }).join(' · ');

  return {
    name: template.name,
    level,
    hp,
    maxHp: template.maxHp,
    ppText,
  };
}

function finishServiceEncounter() {
  if (!currentRun) return;
  currentRun.pendingServiceState = null;
  hideAdventureModal();
  persistAdventureSession('starter');
  resolveNonCombatProgression();
}

function resolveNonCombatProgression() {
  const progression = adventure.completeWave({
    run: currentRun,
    result: { victory: true },
    metaProgress: getMetaProgress(),
  });
  persistAdventureSession('starter');
  handleAdventureProgression(progression);
}

function handleAdventureProgression(progression) {
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

function applyNonCombatEncounter(encounter) {
  if (!currentRun) return;
  if (encounter.type === 'rest') {
    currentRun.party = currentRun.party.map(member => rebuildPartyMember(member, {
      healHp: 'full',
      healPp: 'full',
      reviveTo: 1,
    }));
  }
}

function buildNonCombatToast(encounter) {
  if (encounter.type === 'reward') return `${encounter.waveLabelKo}을 지나 다음 전투로 이동한다.`;
  if (encounter.type === 'shop') return '상점을 지나며 장비를 정비했다.';
  if (encounter.type === 'rest') return '휴식 지점을 지나며 HP와 PP를 회복했다.';
  return '다음 구간으로 이동한다.';
}

function buildPartyState(teamIds) {
  return teamIds.map(monId => ({
    monId,
    level: getMonLevel(monId, 5),
    slot: 'active',
  }));
}

function syncRunPartyState(existingParty, teamIds) {
  const currentById = new Map(
    (existingParty || [])
      .filter(Boolean)
      .map(member => [member.monId || member.id, member]),
  );

  return teamIds.map(monId => {
    const existing = currentById.get(monId);
    return existing
      ? {
          ...existing,
          monId,
          level: getMonLevel(monId, existing.level ?? 5),
          slot: 'active',
        }
      : {
          monId,
          level: getMonLevel(monId, 5),
          slot: 'active',
        };
  });
}

function normalizeRunInventory(inventory) {
  return inventory && Object.keys(inventory).length
    ? inventory
    : createDefaultInventory();
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
  currentRun.party = syncRunPartyState(currentRun.party, currentBattleTeamIds);
  currentRun.inventory = normalizeRunInventory(currentRun.inventory);
  ingameReady = true;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.dataset.active = item.dataset.tab === 'ingame' ? 'true' : 'false';
  });

  closeDetail();

  if (session.screen === 'biome-choice' && currentRun.pendingBiomeChoices?.length) {
    showStarterUI();
    showBiomeChoiceModal(currentRun.pendingBiomeChoices);
    showToast('이전 모험 진행을 복구했다.');
    return true;
  }

  if (session.screen === 'service' && currentRun.pendingServiceState && currentEncounter && SERVICE_TYPES.has(currentEncounter.type)) {
    showStarterUI();
    showServiceModal(currentRun.pendingServiceState);
    showToast('서비스 웨이브를 복구했다.');
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

    if (currentRun?.pendingBiomeChoices?.length) {
      showStarterUI();
      showBiomeChoiceModal(currentRun.pendingBiomeChoices);
      return;
    }

    if (currentRun?.pendingServiceState && currentEncounter && SERVICE_TYPES.has(currentEncounter.type)) {
      showStarterUI();
      showServiceModal(currentRun.pendingServiceState);
      return;
    }

    showStarterUI();
  });
}
