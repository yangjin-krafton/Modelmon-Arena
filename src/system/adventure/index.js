import { loadAdventureDatabase } from './database.js';
import { createWaveEncounter } from './encounter.js';
import { computeDifficultyProfile } from './difficulty.js';
import { createSeed, pickWeightedDistinct } from './rng.js';

export { loadAdventureDatabase, createWaveEncounter, computeDifficultyProfile };

export async function loadAdventureSystem(options = {}) {
  const database = await loadAdventureDatabase(options);
  return createAdventureSystem(database);
}

export function createAdventureSystem(database) {
  return {
    database,
    createRun: options => createAdventureRun(database, options),
    getCurrentWaveSlot: run => getCurrentWaveSlot(database, run),
    createEncounter: ({ run, metaProgress }) => createWaveEncounter({ run, database, metaProgress }),
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

  return {
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
}

export function getCurrentWaveSlot(database, run) {
  return database.waveSlotByLocalWave.get(run.localWave) || null;
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
