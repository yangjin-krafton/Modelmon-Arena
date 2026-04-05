import { MONS } from '../data/mons.js';
import { computeDifficultyProfile } from './difficulty.js';
import { pickWeighted, randomInt } from './rng.js';

const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

export function createWaveEncounter({ run, database, metaProgress = {} }) {
  const biome = database.biomesById.get(run.biomeId);
  const waveSlot = run.currentBiomeWavePlan?.[run.localWave - 1] || null;
  const difficulty = computeDifficultyProfile({ run, biome, waveSlot, metaProgress });

  switch (waveSlot?.slotType) {
    case 'wild':
      return createWildEncounter({ run, biome, waveSlot, database, difficulty });
    case 'trainer':
    case 'boss':
      return createNpcEncounter({ run, biome, waveSlot, database, difficulty });
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
  const pools = database.wildPoolsByBiome.get(biome.id) || [];

  const rarity = pickWildRarity(run, biome);
  const rarityPools = pools.filter(pool => pool.rarity === rarity);
  const candidates = rarityPools.length ? rarityPools : pools;
  const picked = pickWeighted(run, candidates);

  const enemy = picked
    ? buildEnemySummary(picked.monId, {
        level: difficulty.recommendedLevel + (picked.stage - 1),
        roleTag: picked.roleTag,
        rarity: picked.rarity,
      })
    : null;

  return {
    type: 'wild',
    wildTier: rarity === 'rare' && run.localWave >= 14 ? 'elite' : 'normal',
    capturable: true,
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    rarity,
    enemies: enemy ? [enemy] : [],
    difficulty,
    rewardHint: {
      credits: 16 + Math.round(difficulty.dangerScore * (rarity === 'rare' ? 7 : 5)),
      captureChance: rarity === 'rare' ? 0.5 : rarity === 'uncommon' ? 0.35 : 0.22,
    },
  };
}

function createNpcEncounter({ run, biome, waveSlot, database, difficulty }) {
  if (waveSlot.slotType === 'boss') {
    return createBossNpcEncounter({ run, biome, waveSlot, database, difficulty });
  }
  return createTrainerNpcEncounter({ run, biome, waveSlot, database, difficulty });
}

function createTrainerNpcEncounter({ run, biome, waveSlot, database, difficulty }) {
  const tier = waveSlot.difficultyBias >= 1.0 || run.localWave >= 16 ? 'elite' : 'standard';
  const pools = (database.trainerPoolsByBiome.get(biome.id) || []).filter(pool => pool.tier === tier);
  const picked = pickWeighted(run, pools);
  const partySize = picked
    ? randomInt(run, picked.partySizeMin, picked.partySizeMax)
    : 1;
  const sourceIds = picked?.partyMonIds || [];
  const enemies = buildNpcParty(run, sourceIds, partySize, {
    baseLevel: difficulty.recommendedLevel,
    levelBonus: tier === 'elite' ? 1 : 0,
    roleTag: picked?.templateTag || tier,
    rarity: tier,
  });

  return {
    type: 'npc',
    npcType: 'trainer',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    npcId: picked?.trainerId || null,
    nameKo: picked?.nameKo || (tier === 'elite' ? '강화 트레이너' : '트레이너'),
    tier,
    templateTag: picked?.templateTag || tier,
    enemies,
    potionCount: tier === 'elite' ? 1 : 0,
    difficulty,
    rewardHint: {
      credits: 28 + Math.round(difficulty.trainerBudget * 1.2),
      rewardTier: tier,
    },
  };
}

function createBossNpcEncounter({ run, biome, waveSlot, database, difficulty }) {
  const pools = database.bossPoolsByBiome.get(biome.id) || [];
  const picked = pickWeighted(run, pools);
  const isFinalBoss = picked?.tier === 'final' || biome.isFinal;
  const biomeDepth = run.biomeOrder.length;
  const partySize = getBossPartySize({ picked, biomeDepth, isFinalBoss });
  const levelBonus = getBossWaveBonus({ picked, biomeDepth, isFinalBoss });
  const enemies = buildBossParty(run, picked?.partyMonIds || [], partySize, {
    baseLevel: difficulty.recommendedLevel + levelBonus,
    roleTag: picked?.tier || 'boss',
    rarity: 'boss',
    biomeDepth,
    isFinalBoss,
  });
  const potionCount = isFinalBoss ? 3 : 2;

  return {
    type: 'npc',
    npcType: 'boss',
    wave: run.wave,
    localWave: run.localWave,
    waveLabelKo: waveSlot.slotLabelKo,
    biomeId: biome.id,
    biomeNameKo: biome.nameKo,
    npcId: picked?.bossId || null,
    nameKo: picked?.nameKo || '관장',
    tier: picked?.tier || 'boss',
    enemies,
    potionCount,
    difficulty,
    rewardHint: {
      credits: 40 + Math.round(difficulty.bossBudget * 1.5),
      shards: isFinalBoss ? 3 : 1,
      grantsNextBiomeChoice: !biome.isFinal,
    },
  };
}

function getBossPartySize({ picked, biomeDepth, isFinalBoss }) {
  if (isFinalBoss) return Math.max(6, picked?.partySize || 6);
  const depthSizes = [3, 4, 5, 6];
  return depthSizes[Math.max(0, Math.min(depthSizes.length - 1, biomeDepth - 1))];
}

function getBossWaveBonus({ picked, biomeDepth, isFinalBoss }) {
  const depthBonuses = [1, 2, 3, 4];
  const targetBonus = depthBonuses[Math.max(0, Math.min(depthBonuses.length - 1, biomeDepth - 1))];
  if (isFinalBoss) return Math.max(targetBonus, picked?.waveBonus || targetBonus);
  return targetBonus;
}

function buildBossParty(run, sourceIds, partySize, { baseLevel, roleTag, rarity, biomeDepth, isFinalBoss }) {
  const uniqueCandidates = [...new Set(sourceIds)]
    .map(monId => MON_BY_ID.get(monId))
    .filter(Boolean);

  if (!uniqueCandidates.length) {
    return buildNpcParty(run, [run.party[0]?.monId].filter(Boolean), partySize, {
      baseLevel,
      levelBonus: 0,
      roleTag,
      rarity,
    });
  }

  const stage3 = uniqueCandidates.filter(mon => mon.stage >= 3);
  const earlyPool = uniqueCandidates.filter(mon => mon.stage <= 2);
  const midPool = uniqueCandidates.filter(mon => mon.stage <= 2 || mon.stage >= 3);
  const maxFinalCount = getBossFinalStageQuota({ biomeDepth, isFinalBoss, partySize });
  const selected = [];

  for (let index = 0; index < partySize; index += 1) {
    const slotsLeft = partySize - index;
    const finalsUsed = selected.filter(mon => mon.stage >= 3).length;
    const finalsRemaining = Math.max(0, maxFinalCount - finalsUsed);
    const mustUseFinal = finalsRemaining >= slotsLeft;
    const isAceSlot = index === partySize - 1;

    let pool;
    if (isAceSlot && stage3.length) {
      pool = stage3;
    } else if (mustUseFinal && stage3.length) {
      pool = stage3;
    } else if (finalsUsed >= maxFinalCount && earlyPool.length) {
      pool = earlyPool;
    } else if (biomeDepth <= 2 && earlyPool.length) {
      pool = earlyPool;
    } else {
      pool = midPool.length ? midPool : uniqueCandidates;
    }

    const pickedMon = pickBossMonFromPool(run, pool, isAceSlot);
    selected.push(pickedMon);
  }

  return selected.map((mon, index) => buildEnemySummary(mon.id, {
    level: baseLevel + Math.floor(index / 2),
    roleTag,
    rarity,
  }));
}

function getBossFinalStageQuota({ biomeDepth, isFinalBoss, partySize }) {
  if (isFinalBoss) return partySize;
  const quotas = [0, 1, 2, 3];
  return Math.min(partySize, quotas[Math.max(0, Math.min(quotas.length - 1, biomeDepth - 1))]);
}

function pickBossMonFromPool(run, pool, preferStrongest = false) {
  if (!pool.length) return MON_BY_ID.get(run.party[0]?.monId) || { id: run.party[0]?.monId, stage: 1, bst: 240 };
  if (preferStrongest) {
    return [...pool].sort((left, right) => {
      const stageDiff = (right.stage ?? 1) - (left.stage ?? 1);
      if (stageDiff) return stageDiff;
      return (right.bst ?? 240) - (left.bst ?? 240);
    })[0];
  }
  return pool[randomInt(run, 0, pool.length - 1)];
}

function buildNpcParty(run, sourceIds, partySize, { baseLevel, levelBonus, roleTag, rarity }) {
  const enemies = [];
  for (let index = 0; index < partySize; index += 1) {
    const monId = sourceIds.length
      ? sourceIds[randomInt(run, 0, sourceIds.length - 1)]
      : run.party[0]?.monId;
    enemies.push(buildEnemySummary(monId, {
      level: baseLevel + levelBonus + Math.floor(index / 2),
      roleTag,
      rarity,
    }));
  }
  return enemies;
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
  };
}

function pickWildRarity(run, biome) {
  const localWave = run.localWave;
  const weights = [
    { rarity: 'common', weight: biome.wildCommonWeight },
    { rarity: 'uncommon', weight: biome.wildUncommonWeight + (localWave >= 8 ? 5 : 2) },
    { rarity: 'rare', weight: biome.wildRareWeight + (localWave >= 14 ? 8 : localWave >= 10 ? 4 : 0) },
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
