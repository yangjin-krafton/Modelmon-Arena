import { closeDetail } from './detail.js';
import { initStarterScreen, showStarterScreen } from './starter.js';
import { initBattle, startBattle, getBattlePhase } from './battle.js';
import { buildBattleMon } from '../core/battle-engine.js';
import { loadCSV } from '../core/csv.js';
import { ITEMS, RARITY_COLOR, createDefaultInventory, getInventory, setInventory } from '../core/run-items.js';
import { buildMonCardHtml } from './battle-scene.js';
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
const serviceRows = await loadCSV('./data/adventure-services.csv');
const COMBAT_TYPES = new Set(['wild', 'npc']);
const SERVICE_TYPES = new Set(['shop', 'rest']);

const SHOP_POOLS = {
  3: [
    { itemId: 'masterball', qty: 1 },
    { itemId: 'fullrestore', qty: 2 },
    { itemId: 'maxelixir', qty: 2 },
    { itemId: 'ultraball', qty: 4 },
    { itemId: 'chatball', qty: 2 },
    { itemId: 'reasonball', qty: 2 },
    { itemId: 'codeball', qty: 2 },
    { itemId: 'alignball', qty: 2 },
  ],
  2: [
    { itemId: 'ultraball', qty: 2 },
    { itemId: 'maxpotion', qty: 2 },
    { itemId: 'hyperpotion', qty: 2 },
    { itemId: 'maxether', qty: 1 },
    { itemId: 'elixir', qty: 1 },
    { itemId: 'revive', qty: 2 },
    { itemId: 'quickball', qty: 2 },
    { itemId: 'timerball', qty: 2 },
    { itemId: 'dualball', qty: 2 },
    { itemId: 'visionball', qty: 2 },
    { itemId: 'memoryball', qty: 2 },
    { itemId: 'systemball', qty: 2 },
  ],
  1: [
    { itemId: 'modelball', qty: 3 },
    { itemId: 'premierball', qty: 3 },
    { itemId: 'superball', qty: 2 },
    { itemId: 'potion', qty: 2 },
    { itemId: 'superpotion', qty: 1 },
    { itemId: 'ether', qty: 1 },
    { itemId: 'agentball', qty: 1 },
    { itemId: 'learnball', qty: 1 },
  ],
};

const REST_POOLS = groupServiceRowsByCost(serviceRows);

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
  hideServicePanel();
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
  showServiceBattleUI();
  persistAdventureSession('service');
  renderServicePanel(currentRun.pendingServiceState);
}

function showServiceBattleUI() {
  const c = container();
  c.classList.remove('ingame-starter');
  c.classList.add('ingame-battle');

  const field = document.querySelector('.battle-field');
  if (field && currentRun?.biomeId) {
    field.setAttribute('data-biome', currentRun.biomeId);
    field.setAttribute('data-time', 'day');
  }
  document.getElementById('battle-log')?.classList.add('hidden');
  document.getElementById('battle-panel')?.classList.add('hidden');
  document.getElementById('post-action-panel')?.classList.add('hidden');
  document.getElementById('battle-result')?.classList.add('hidden');
}

function hideServicePanel() {
  document.getElementById('service-lower-panel')?.classList.add('hidden');
  document.getElementById('service-field-overlay')?.classList.add('hidden');
  document.getElementById('battle-log')?.classList.remove('hidden');
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
  const cost3 = pickDistinct(pools[3], 1).map(offer => materializeServiceOffer(type, offer, 3));
  const cost2 = pickDistinct(pools[2], 2).map(offer => materializeServiceOffer(type, offer, 2));
  const cost1 = pickDistinct(pools[1], 3).map(offer => materializeServiceOffer(type, offer, 1));
  return [...cost3, ...cost2, ...cost1].map((offer, index) => ({
    ...offer,
    id: `${type}-offer-${index + 1}`,
    purchased: false,
  }));
}

function materializeServiceOffer(type, offer, cost) {
  if (type !== 'shop') {
    const icon = ITEMS[offer.iconItemId]?.icon || '';
    return { ...offer, cost, icon };
  }

  const item = ITEMS[offer.itemId];
  if (!item) {
    return {
      ...offer,
      cost,
      title: offer.itemId,
      detail: `${offer.itemId} x${offer.qty}`,
      icon: '',
    };
  }

  return {
    ...offer,
    cost,
    title: item.name,
    detail: `${item.desc} · x${offer.qty}`,
    icon: item.icon,
  };
}

function groupServiceRowsByCost(rows) {
  return rows.reduce((acc, row) => {
    const cost = Math.max(1, Math.floor(Number(row.cost) || 1));
    if (!acc[cost]) acc[cost] = [];
    acc[cost].push({
      serviceId: row.service_id,
      category: row.category || null,
      title: row.title,
      detail: row.detail,
      iconItemId: row.icon_item_id,
      effect: row.effect,
      targetMode: row.target_mode || null,
      levelGain: Number(row.level_gain || 0),
      expGain: Number(row.exp_gain || 0),
      expNextRatio: Number(row.exp_next_ratio || 0),
      healHp: row.heal_hp || null,
      hpRatio: Number(row.hp_ratio || 0),
      hpFlat: Number(row.hp_flat || 0),
      healPp: row.heal_pp || null,
      ppFlat: Number(row.pp_flat || 0),
      reviveTo: Number(row.revive_to || 0),
      reviveOnly: row.revive_only === 'true',
    });
    return acc;
  }, {});
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

function renderServicePanel(state) {
  const panel = document.getElementById('service-lower-panel');
  if (!panel) return;

  const icon = state.type === 'shop' ? '🏪' : '🏥';
  const overlay = document.getElementById('service-field-overlay');
  if (overlay) {
    document.getElementById('sfo-icon').textContent = icon;
    document.getElementById('sfo-title').textContent = state.title;
    document.getElementById('sfo-sub').textContent = state.sub;
    overlay.classList.remove('hidden');
  }

  const offerTarget = state.offers.find(offer => offer.id === state.pendingTargetOfferId) || null;

  const headerHtml = `
    <div class="slp-header">
      <span class="slp-header__label">${icon} 웨이브 코인</span>
      <strong class="slp-header__coin">${state.coins}</strong>
      <span class="slp-header__hint">남은 코인은 이 웨이브에서만 유효합니다</span>
    </div>
  `;

  const footerHtml = `
    <div class="slp-footer">
      <button class="slp-footer__btn slp-footer__btn--ghost" id="service-skip-btn" type="button">
        ${offerTarget ? '선택 취소' : '종료'}
      </button>
      <button class="slp-footer__btn" id="service-continue-btn" type="button">
        ${state.coins > 0 ? '다음 웨이브로' : '정산 완료'}
      </button>
    </div>
  `;

  let bodyHtml;
  if (offerTarget) {
    // 대상 선택 모드 — tsw-card 가로 스크롤로 팀원 표시
    const targetCards = currentRun.party
      .map(member => buildServiceTargetCard(offerTarget, member))
      .join('');
    bodyHtml = `
      <div class="slp-target-row">
        <div class="slp-target-title">${offerTarget.title} — 대상 선택</div>
        <div class="slp-chip-scroll">${targetCards}</div>
      </div>
    `;
  } else {
    // 오퍼 선택 모드 — 코스트 티어 행
    const byCost = { 3: [], 2: [], 1: [] };
    for (const offer of state.offers) {
      if (byCost[offer.cost]) byCost[offer.cost].push(offer);
    }
    bodyHtml = [3, 2, 1].map(cost => {
      const offers = byCost[cost];
      if (!offers.length) return '';
      const chips = offers.map(offer => buildServiceOfferChip(state.type, offer, state.coins)).join('');
      return `
        <div class="slp-tier-row is-cost-${cost}">
          <span class="slp-row-label">${'★'.repeat(cost)}</span>
          <div class="slp-chip-scroll">${chips}</div>
        </div>
      `;
    }).join('');
  }

  panel.innerHTML = headerHtml + bodyHtml + footerHtml;
  panel.classList.remove('hidden');

  panel.querySelectorAll('[data-service-offer-id]').forEach(btn => {
    btn.addEventListener('click', () => onServiceOfferClick(btn.dataset.serviceOfferId));
  });
  panel.querySelectorAll('[data-service-target-mon-id]').forEach(btn => {
    btn.addEventListener('click', () => onServiceTargetClick(btn.dataset.serviceTargetMonId));
  });
  panel.querySelector('#service-skip-btn')?.addEventListener('click', () => {
    if (state.pendingTargetOfferId) {
      currentRun.pendingServiceState.pendingTargetOfferId = null;
      persistAdventureSession('service');
      renderServicePanel(currentRun.pendingServiceState);
      return;
    }
    finishServiceEncounter();
  });
  panel.querySelector('#service-continue-btn')?.addEventListener('click', finishServiceEncounter);
}

const COST_BORDER = {
  3: 'rgba(255,205,96,0.38)',
  2: 'rgba(91,141,255,0.28)',
  1: 'rgba(104,248,152,0.24)',
};

function buildServiceOfferChip(type, offer, coins) {
  const disabled = offer.purchased || offer.cost > coins;
  const stateText = offer.purchased ? '구매 완료' : offer.targetMode === 'single' ? '대상 지정' : '즉시 적용';
  const disabledCls = offer.purchased ? ' is-purchased' : disabled ? ' is-disabled' : '';

  if (type === 'shop') {
    const def = ITEMS[offer.itemId];
    const borderColor = RARITY_COLOR[def?.rarity] ?? 'rgba(255,255,255,0.12)';
    return `
      <button class="item-card shop-offer-card${disabledCls}" type="button"
        data-service-offer-id="${offer.id}"
        style="border-color:${borderColor}"
        ${disabled ? 'disabled' : ''}>
        <div class="item-icon"><img src="${def?.icon ?? ''}" alt="${def?.name ?? offer.itemId}"></div>
        <div class="item-info">
          <div class="item-name-row">
            <span class="item-name">${def?.name ?? offer.itemId}</span>
            <span class="item-count-badge">x${offer.qty}</span>
          </div>
          <span class="item-desc">${def?.desc ?? ''}</span>
        </div>
        <div class="shop-offer-cost">${offer.cost}<span class="shop-offer-cost__unit">코인</span></div>
      </button>
    `;
  }

  // rest — item-card 동일 레이아웃, 코스트별 테두리 색상
  const borderColor = COST_BORDER[offer.cost] ?? 'rgba(255,255,255,0.12)';
  return `
    <button class="item-card shop-offer-card${disabledCls}" type="button"
      data-service-offer-id="${offer.id}"
      style="border-color:${borderColor}"
      ${disabled ? 'disabled' : ''}>
      <div class="item-icon">${offer.icon ? `<img src="${offer.icon}" alt="${offer.title}">` : ''}</div>
      <div class="item-info">
        <div class="item-name-row">
          <span class="item-name">${offer.title}</span>
          <span class="item-count-badge soc-state">${stateText}</span>
        </div>
        <span class="item-desc">${offer.detail}</span>
      </div>
      <div class="shop-offer-cost">${offer.cost}<span class="shop-offer-cost__unit">코인</span></div>
    </button>
  `;
}

function buildServiceTargetCard(offer, member) {
  const disabled = !isOfferTargetEligible(offer, member);
  const template = buildBattleMon(member.monId, member.level ?? 5);
  const currentHp = Number.isFinite(member.hp) ? member.hp : template.maxHp;
  const ppMap = new Map((member.skills || []).map(s => [s.no, s.pp]));
  const monObj = {
    ...template,
    hp: currentHp,
    skills: template.skills.map(skill => ({
      ...skill,
      pp: ppMap.has(skill.no) ? ppMap.get(skill.no) : skill.maxPp,
    })),
  };
  const isFainted = currentHp <= 0;
  const classes = ['tsw-card', isFainted ? 'tsw-fainted' : '', disabled ? 'is-disabled' : '']
    .filter(Boolean).join(' ');
  return `
    <button class="${classes}" type="button"
      data-service-target-mon-id="${member.monId}" ${disabled ? 'disabled' : ''}>
      ${buildMonCardHtml(monObj)}
    </button>
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
    renderServicePanel(state);
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
  renderServicePanel(state);
  showToast(`${offer.title} 적용 완료`);
}

function applyShopOffer(offer) {
  currentRun.inventory = normalizeRunInventory(currentRun.inventory);
  currentRun.resources = currentRun.resources || {};

  if (offer.itemId && offer.qty) {
    currentRun.inventory[offer.itemId] = (currentRun.inventory[offer.itemId] ?? 0) + offer.qty;
  }
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

  if (offer.targetMode === 'team' || offer.effect === 'team-hp' || offer.effect === 'team-pp') {
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
  grantOfferExp(member.monId, offer);

  const nextLevel = getMonLevel(member.monId, member.level ?? 5);
  const template = buildBattleMon(member.monId, nextLevel);
  const previousHp = Number.isFinite(member.hp) ? member.hp : template.maxHp;
  const previousSkills = new Map((member.skills || []).map(skill => [skill.no, skill.pp]));

  let nextHp = previousHp;
  if (previousHp <= 0) {
    if (offer.reviveTo) {
      nextHp = Math.max(1, Math.floor(template.maxHp * offer.reviveTo));
    } else if (offer.healHp === 'full') {
      // healHp:'full' 은 기절 상태도 완전 회복 (service_level_1/2 등)
      nextHp = template.maxHp;
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

function grantOfferExp(monId, offer) {
  const flatExp = Math.max(0, Math.floor(Number(offer.expGain) || 0));
  const nextRatio = Math.max(0, Number(offer.expNextRatio) || 0);
  let totalExp = flatExp;

  if (nextRatio > 0) {
    const progress = getMonProgress(monId);
    const required = expToNextLevel(progress.lv);
    const missing = Math.max(0, required - progress.exp);
    totalExp += Math.floor(missing * nextRatio);
  }

  if (totalExp > 0) grantExp(monId, totalExp);
}

function isOfferTargetEligible(offer, member) {
  const isFainted = (member.hp ?? 0) <= 0;
  if (offer.reviveOnly) return isFainted;
  if (isFainted) {
    // ratio/flat HP 회복은 nextHp > 0 가드로 기절 시 무효 → 대상 불가
    // reviveTo > 0 또는 healHp === 'full' 인 경우는 실제 부활 효과가 있으므로 허용
    const healsPartial = offer.healHp === 'ratio' || offer.healHp === 'flat';
    if (healsPartial && !offer.reviveTo) return false;
  }
  return true;
}


function finishServiceEncounter() {
  if (!currentRun) return;
  currentRun.pendingServiceState = null;
  hideServicePanel();
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

function applyNonCombatEncounter(_encounter) {
  // shop·rest 는 SERVICE_TYPES 로 분기되어 이 함수에 도달하지 않음
}

function buildNonCombatToast(_encounter) {
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
    showServiceBattleUI();
    renderServicePanel(currentRun.pendingServiceState);
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
      showServiceBattleUI();
      renderServicePanel(currentRun.pendingServiceState);
      return;
    }

    showStarterUI();
  });
}
