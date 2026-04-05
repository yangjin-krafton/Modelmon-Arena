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
    case 'elite':
      return createWildEncounter({ run, biome, waveSlot, database, difficulty });
    case 'trainer':
    case 'boss':
      return createNpcEncounter({ run, biome, waveSlot, database, difficulty });
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

// --- 야생 전투 (wild + elite) ---
// 항상 야생 몬스터 1마리 등장, 포획 가능
function createWildEncounter({ run, biome, waveSlot, database, difficulty }) {
  const isElite = waveSlot.slotType === 'elite';
  const pools = (database.wildPoolsByBiome.get(biome.id) || []).filter(pool =>
    run.wave >= pool.minWave && run.wave <= pool.maxWave,
  );

  const rarity = pickWildRarity(run, biome, isElite);
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
    wildTier: isElite ? 'elite' : 'normal',
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
      credits: 16 + Math.round(difficulty.dangerScore * (isElite ? 8 : 5)),
      captureChance: rarity === 'rare' ? 0.5 : rarity === 'uncommon' ? 0.35 : 0.22,
    },
  };
}

// --- NPC 전투 (trainer + boss) ---
// 상대 파티 1~6마리, 물약 사용 가능
function createNpcEncounter({ run, biome, waveSlot, database, difficulty }) {
  const isBoss = waveSlot.slotType === 'boss';

  if (isBoss) {
    return createBossNpcEncounter({ run, biome, waveSlot, database, difficulty });
  }
  return createTrainerNpcEncounter({ run, biome, waveSlot, database, difficulty });
}

function createTrainerNpcEncounter({ run, biome, waveSlot, database, difficulty }) {
  // difficulty_bias >= 1.0 이면 엘리트 트레이너
  const tier = waveSlot.difficultyBias >= 1.0 ? 'elite' : 'standard';
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
    nameKo: picked?.nameKo || (tier === 'elite' ? '엘리트 트레이너' : '트레이너'),
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
  const pools = (database.bossPoolsByBiome.get(biome.id) || []).filter(pool =>
    run.wave >= pool.minWave && run.wave <= pool.maxWave,
  );
  const picked = pickWeighted(run, pools);
  const partySize = picked?.partySize || 1;
  const sourceIds = picked?.partyMonIds || [];
  const enemies = buildNpcParty(run, sourceIds, partySize, {
    baseLevel: difficulty.recommendedLevel + Math.ceil((picked?.waveBonus || 0) * 0.5),
    levelBonus: 0,
    roleTag: picked?.tier || 'boss',
    rarity: 'boss',
  });

  const isFinalBoss = picked?.tier === 'final' || biome.isFinal;
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
    nameKo: picked?.nameKo || '지역 보스',
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

function buildNpcParty(run, sourceIds, partySize, { baseLevel, levelBonus, roleTag, rarity }) {
  const enemies = [];
  for (let i = 0; i < partySize; i++) {
    const monId = sourceIds.length
      ? sourceIds[randomInt(run, 0, sourceIds.length - 1)]
      : run.party[0]?.monId;
    enemies.push(buildEnemySummary(monId, {
      level: baseLevel + levelBonus + Math.floor(i / 2),
      roleTag,
      rarity,
    }));
  }
  return enemies;
}

// --- 비전투 이벤트 ---

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

// --- 공통 유틸 ---

function pickWildRarity(run, biome, isElite) {
  const localWave = run.localWave;
  // elite 슬롯은 common 없음, uncommon 이상 보장
  const weights = isElite
    ? [
        { rarity: 'uncommon', weight: biome.wildUncommonWeight + 8 },
        { rarity: 'rare', weight: biome.wildRareWeight + (localWave >= 8 ? 8 : 4) },
      ]
    : [
        { rarity: 'common', weight: biome.wildCommonWeight },
        { rarity: 'uncommon', weight: biome.wildUncommonWeight + (localWave >= 6 ? 4 : 0) },
        { rarity: 'rare', weight: biome.wildRareWeight + (localWave >= 8 ? 6 : 0) },
      ];
  return pickWeighted(run, weights)?.rarity || (isElite ? 'uncommon' : 'common');
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
