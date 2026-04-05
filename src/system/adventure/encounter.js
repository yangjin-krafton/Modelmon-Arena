import { MONS } from '../data/mons.js';
import { computeDifficultyProfile } from './difficulty.js';
import { pickWeighted, randomInt } from './rng.js';

const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

export function createWaveEncounter({ run, database, metaProgress = {} }) {
  const biome = database.biomesById.get(run.biomeId);
  const waveSlot = database.waveSlotByLocalWave.get(run.localWave);
  const difficulty = computeDifficultyProfile({ run, biome, waveSlot, metaProgress });

  switch (waveSlot?.slotType) {
    case 'wild':
      return createWildEncounter({ run, biome, waveSlot, database, difficulty });
    case 'trainer':
    case 'elite':
      return createTrainerEncounter({ run, biome, waveSlot, database, difficulty });
    case 'boss':
      return createBossEncounter({ run, biome, waveSlot, database, difficulty });
    case 'reward':
      return createRewardEncounter({ run, biome, waveSlot, difficulty });
    case 'shop':
      return createShopEncounter({ run, biome, waveSlot, difficulty });
    case 'rest':
      return createRestEncounter({ run, biome, waveSlot, difficulty });
    default:
      return {
        type: waveSlot?.slotType || 'wild',
        wave: run.wave,
        localWave: run.localWave,
        biomeId: biome.id,
        biomeNameKo: biome.nameKo,
        difficulty,
      };
  }
}

function createWildEncounter({ run, biome, waveSlot, database, difficulty }) {
  const pools = (database.wildPoolsByBiome.get(biome.id) || []).filter(pool =>
    run.wave >= pool.minWave && run.wave <= pool.maxWave,
  );

  const rarity = pickWildRarity(run, biome);
  const rarityPools = pools.filter(pool => pool.rarity === rarity);
  const candidates = rarityPools.length ? rarityPools : pools;
  const enemyCount = difficulty.encounterBudget >= 22 ? 2 : 1;
  const enemies = [];

  for (let i = 0; i < enemyCount; i++) {
    const picked = pickWeighted(run, candidates);
    if (!picked) break;
    enemies.push(buildEnemySummary(picked.monId, {
      level: difficulty.recommendedLevel + (picked.stage - 1) + i,
      roleTag: picked.roleTag,
      rarity: picked.rarity,
    }));
  }

  return {
    type: 'wild',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    rarity,
    enemyCount: enemies.length,
    enemies,
    difficulty,
    rewardHint: {
      credits: 16 + Math.round(difficulty.dangerScore * 5),
      captureChance: rarity === 'rare' ? 0.5 : rarity === 'uncommon' ? 0.35 : 0.22,
    },
  };
}

function createTrainerEncounter({ run, biome, waveSlot, database, difficulty }) {
  const tier = waveSlot.slotType === 'elite' ? 'elite' : 'standard';
  const pools = (database.trainerPoolsByBiome.get(biome.id) || []).filter(pool =>
    pool.tier === tier &&
    run.wave >= pool.minWave &&
    run.wave <= pool.maxWave,
  );
  const picked = pickWeighted(run, pools);
  const partySize = picked
    ? randomInt(run, picked.partySizeMin, picked.partySizeMax)
    : 1;
  const sourceIds = picked?.partyMonIds || [];
  const enemies = [];

  for (let i = 0; i < partySize; i++) {
    const monId = sourceIds.length
      ? sourceIds[randomInt(run, 0, sourceIds.length - 1)]
      : run.party[0]?.monId;
    enemies.push(buildEnemySummary(monId, {
      level: difficulty.recommendedLevel + i + (tier === 'elite' ? 2 : 0),
      roleTag: picked?.templateTag || tier,
      rarity: tier,
    }));
  }

  return {
    type: tier,
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    trainerId: picked?.trainerId || null,
    trainerNameKo: picked?.nameKo || (tier === 'elite' ? '엘리트 트레이너' : '트레이너'),
    templateTag: picked?.templateTag || tier,
    enemies,
    difficulty,
    rewardHint: {
      credits: 28 + Math.round(difficulty.trainerBudget * 1.2),
      rewardTier: tier,
    },
  };
}

function createBossEncounter({ run, biome, waveSlot, database, difficulty }) {
  const pools = (database.bossPoolsByBiome.get(biome.id) || []).filter(pool =>
    run.wave >= pool.minWave && run.wave <= pool.maxWave,
  );
  const picked = pickWeighted(run, pools);
  const partySize = picked?.partySize || 1;
  const sourceIds = picked?.partyMonIds || [];
  const enemies = [];

  for (let i = 0; i < partySize; i++) {
    const monId = sourceIds[i % sourceIds.length] || run.party[0]?.monId;
    enemies.push(buildEnemySummary(monId, {
      level: difficulty.recommendedLevel + (picked?.waveBonus || 0) + i,
      roleTag: picked?.tier || 'boss',
      rarity: 'boss',
    }));
  }

  return {
    type: 'boss',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    bossId: picked?.bossId || null,
    bossNameKo: picked?.nameKo || '지역 보스',
    bossTier: picked?.tier || 'boss',
    enemies,
    difficulty,
    rewardHint: {
      credits: 40 + Math.round(difficulty.bossBudget * 1.5),
      shards: biome.isFinal ? 3 : 1,
      grantsNextBiomeChoice: !biome.isFinal,
    },
  };
}

function createRewardEncounter({ run, biome, waveSlot, difficulty }) {
  return {
    type: 'reward',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    difficulty,
    choices: [
      { rewardId: 'stable_patch', labelKo: '안정 패치', effect: 'hp +18, stability +1' },
      { rewardId: 'power_boost', labelKo: '출력 증폭', effect: 'power +2, hp -4' },
      { rewardId: 'economy_core', labelKo: '경제 엔진', effect: 'credits +55, reroll +1' },
    ],
  };
}

function createShopEncounter({ run, biome, waveSlot, difficulty }) {
  return {
    type: 'shop',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    difficulty,
    inventory: [
      { itemId: 'heal_pack', labelKo: '회복팩', price: Math.round(36 * biome.shopBias) },
      { itemId: 'tuning_chip', labelKo: '튜닝 칩', price: Math.round(52 * biome.shopBias) },
      { itemId: 'capture_mod', labelKo: '포획 모듈', price: Math.round(44 * biome.shopBias) },
    ],
  };
}

function createRestEncounter({ run, biome, waveSlot, difficulty }) {
  return {
    type: 'rest',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    difficulty,
    options: [
      { restId: 'heal', labelKo: '전체 회복', effect: `hp +${Math.round(22 * biome.restBias)}` },
      { restId: 'recruit', labelKo: '예비 정비', effect: 'reserve +1 or reroll +1' },
    ],
  };
}

function pickWildRarity(run, biome) {
  const localWave = run.localWave;
  const weights = [
    { rarity: 'common', weight: biome.wildCommonWeight },
    { rarity: 'uncommon', weight: biome.wildUncommonWeight + (localWave >= 6 ? 4 : 0) },
    { rarity: 'rare', weight: biome.wildRareWeight + (localWave >= 8 ? 6 : 0) },
  ];
  return pickWeighted(run, weights)?.rarity || 'common';
}

function buildEnemySummary(monId, { level, roleTag, rarity }) {
  const mon = MON_BY_ID.get(monId);
  return {
    monId,
    nameKo: mon?.nameKo || monId,
    nameEn: mon?.nameEn || monId,
    level,
    roleTag,
    rarity,
    stage: mon?.stage ?? 1,
    coreConcept: mon?.coreConcept ?? '',
    bst: mon?.bst ?? 240,
  };
}
