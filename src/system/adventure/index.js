import { loadAdventureDatabase } from './database.js';
import { createWaveEncounter } from './encounter.js';
import { computeDifficultyProfile } from './difficulty.js';
import { createSeed, pickWeightedDistinct, randomInt } from './rng.js';

export { loadAdventureDatabase, createWaveEncounter, computeDifficultyProfile };

const BIOME_WAVE_COUNT = 20;
const EARLY_SERVICE_RANGE = [5, 9];
const LATE_SERVICE_RANGE = [15, 19];
const TRAINER_WAVE_COUNT = 7;
const WILD_WAVE_COUNT = 10;

export async function loadAdventureSystem(options = {}) {
  const database = await loadAdventureDatabase(options);
  return createAdventureSystem(database);
}

export function createAdventureSystem(database) {
  return {
    database,
    createRun: options => createAdventureRun(database, options),
    getCurrentWaveSlot: run => getCurrentWaveSlot(database, run),
    createEncounter: ({ run, metaProgress }) => {
      ensureBiomeWavePlan(run);
      return createWaveEncounter({ run, database, metaProgress });
    },
    completeWave: ({ run, result, metaProgress }) => completeAdventureWave({ run, database, result, metaProgress }),
    chooseNextBiome: ({ run, biomeId }) => chooseNextBiome({ run, database, biomeId }),
    getNextBiomeChoices: run => getNextBiomeChoices({ run, database }),
  };
}

export function createAdventureRun(database, {
  starterId,
  starterLevel = 5,
  startBiomeId,
  maxBiomes = 4,
  seed = Date.now(),
} = {}) {
  const startBiome = startBiomeId
    ? database.biomesById.get(startBiomeId)
    : database.startBiomes[0];

  if (!startBiome) throw new Error('No start biome found');
  if (!starterId) throw new Error('starterId is required');

  const run = {
    seed,
    rngState: createSeed(seed),
    starterId,
    status: 'active',
    wave: 1,
    localWave: 1,
    biomeId: startBiome.id,
    biomeOrder: [startBiome.id],
    maxBiomes,
    gymClears: 0,
    pendingBiomeChoices: null,
    pendingServiceState: null,
    lastEncounterSummary: null,
    currentBiomeWavePlan: null,
    party: [{ monId: starterId, level: starterLevel, slot: 'active' }],
    reserve: [],
    resources: {
      credits: 100,
      shards: 0,
      rerolls: 1,
      captures: 2,
    },
    stats: {
      wins: 0,
      losses: 0,
    },
  };

  ensureBiomeWavePlan(run);
  return run;
}

export function getCurrentWaveSlot(database, run) {
  ensureBiomeWavePlan(run);
  return run.currentBiomeWavePlan?.[run.localWave - 1] || null;
}

export function completeAdventureWave({
  run,
  database,
  result = { victory: true },
  metaProgress = {},
}) {
  if (run.status !== 'active') {
    return { kind: 'inactive', status: run.status };
  }

  const slot = getCurrentWaveSlot(database, run);
  if (!slot) throw new Error(`Unknown local wave slot: ${run.localWave}`);

  run.lastEncounterSummary = {
    wave: run.wave,
    localWave: run.localWave,
    slotType: slot.slotType,
    victory: !!result.victory,
  };

  if (!result.victory) {
    run.status = 'failed';
    run.stats.losses += 1;
    return {
      kind: 'failed',
      status: run.status,
      wave: run.wave,
      biomeId: run.biomeId,
    };
  }

  run.stats.wins += 1;

  if (slot.slotType === 'boss') {
    run.gymClears += 1;
    const biome = database.biomesById.get(run.biomeId);
    if (biome?.isFinal || run.biomeOrder.length >= run.maxBiomes) {
      run.status = 'cleared';
      return {
        kind: 'cleared',
        status: run.status,
        wave: run.wave,
        biomeId: run.biomeId,
      };
    }

    const choices = getNextBiomeChoices({ run, database, metaProgress });
    run.pendingBiomeChoices = choices;
    return {
      kind: 'biome_choice',
      choices,
      fromBiomeId: run.biomeId,
      clearedGyms: run.gymClears,
    };
  }

  advanceToNextWave(run);
  return {
    kind: 'advanced',
    wave: run.wave,
    localWave: run.localWave,
    biomeId: run.biomeId,
    slotType: getCurrentWaveSlot(database, run)?.slotType || null,
  };
}

export function chooseNextBiome({ run, database, biomeId }) {
  const pending = run.pendingBiomeChoices || [];
  const picked = pending.find(choice => choice.biomeId === biomeId);
  if (!picked) {
    throw new Error(`Biome choice not available: ${biomeId}`);
  }

  run.pendingBiomeChoices = null;
  run.biomeId = biomeId;
  run.biomeOrder.push(biomeId);
  run.wave += 1;
  run.localWave = 1;
  run.currentBiomeWavePlan = null;
  ensureBiomeWavePlan(run);

  return {
    kind: 'moved_biome',
    biomeId,
    biomeNameKo: picked.nameKo,
    routeTag: picked.routeTag,
    wave: run.wave,
    localWave: run.localWave,
  };
}

export function getNextBiomeChoices({ run, database }) {
  const candidates = (database.transitionsByFrom.get(run.biomeId) || []).filter(edge =>
    run.gymClears >= edge.minClears &&
    run.gymClears <= edge.maxClears,
  );

  const picked = pickWeightedDistinct(run, candidates, 2);
  return picked.map(edge => {
    const biome = database.biomesById.get(edge.toBiomeId);
    return {
      biomeId: biome.id,
      nameKo: biome.nameKo,
      routeTag: edge.routeTag,
      themeTags: biome.themeTags,
      baseDanger: biome.baseDanger,
    };
  });
}

function advanceToNextWave(run) {
  run.wave += 1;
  run.localWave += 1;
}

function ensureBiomeWavePlan(run) {
  if (Array.isArray(run.currentBiomeWavePlan) && run.currentBiomeWavePlan.length === BIOME_WAVE_COUNT) {
    return run.currentBiomeWavePlan;
  }

  run.currentBiomeWavePlan = createBiomeWavePlan(run);
  return run.currentBiomeWavePlan;
}

function createBiomeWavePlan(run) {
  const servicePattern = randomInt(run, 0, 1) === 0
    ? ['shop', 'rest']
    : ['rest', 'shop'];
  const earlyServiceWave = randomInt(run, EARLY_SERVICE_RANGE[0], EARLY_SERVICE_RANGE[1]);
  const lateServiceWave = randomInt(run, LATE_SERVICE_RANGE[0], LATE_SERVICE_RANGE[1]);
  const serviceByWave = new Map([
    [earlyServiceWave, servicePattern[0]],
    [lateServiceWave, servicePattern[1]],
  ]);

  const combatPool = [
    ...Array.from({ length: WILD_WAVE_COUNT }, () => 'wild'),
    ...Array.from({ length: TRAINER_WAVE_COUNT }, () => 'trainer'),
  ];
  shuffleInPlace(run, combatPool);

  const plan = [];
  for (let localWave = 1; localWave <= BIOME_WAVE_COUNT; localWave += 1) {
    let slotType = 'wild';
    if (localWave === BIOME_WAVE_COUNT) {
      slotType = 'boss';
    } else if (serviceByWave.has(localWave)) {
      slotType = serviceByWave.get(localWave);
    } else {
      slotType = combatPool.shift() || 'wild';
    }

    plan.push(buildWaveSlot(localWave, slotType));
  }

  return plan;
}

function buildWaveSlot(localWave, slotType) {
  const progress = (localWave - 1) / (BIOME_WAVE_COUNT - 1);

  if (slotType === 'boss') {
    return {
      localWave,
      slotType,
      slotLabelKo: '관장 배틀',
      difficultyBias: 2.2,
      rewardBias: 1.2,
    };
  }

  if (slotType === 'shop') {
    return {
      localWave,
      slotType,
      slotLabelKo: '상점',
      difficultyBias: 0,
      rewardBias: 0,
    };
  }

  if (slotType === 'rest') {
    return {
      localWave,
      slotType,
      slotLabelKo: '포켓센터',
      difficultyBias: 0,
      rewardBias: 0,
    };
  }

  if (slotType === 'trainer') {
    return {
      localWave,
      slotType,
      slotLabelKo: progress >= 0.65 ? '강화 트레이너' : '트레이너 배틀',
      difficultyBias: Number((0.35 + progress * 0.95).toFixed(2)),
      rewardBias: Number((0.2 + progress * 0.35).toFixed(2)),
    };
  }

  return {
    localWave,
    slotType: 'wild',
    slotLabelKo: progress >= 0.65 ? '심화 야생 조우' : '야생 조우',
    difficultyBias: Number((0.05 + progress * 0.7).toFixed(2)),
    rewardBias: Number((progress * 0.15).toFixed(2)),
  };
}

function shuffleInPlace(run, items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(run, 0, index);
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
