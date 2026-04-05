import { loadCSV } from '../core/csv.js';
import { MONS } from '../data/mons.js';

const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

function parseList(value) {
  return String(value || '')
    .split('|')
    .map(item => item.trim())
    .filter(Boolean);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function loadAdventureDatabase({ baseUrl = './data' } = {}) {
  const [
    biomeRows,
    transitionRows,
    waveRows,
    wildRows,
    trainerRows,
    bossRows,
  ] = await Promise.all([
    loadCSV(`${baseUrl}/adventure-biomes.csv`),
    loadCSV(`${baseUrl}/adventure-biome-transitions.csv`),
    loadCSV(`${baseUrl}/adventure-wave-slots.csv`),
    loadCSV(`${baseUrl}/adventure-wild-pools.csv`),
    loadCSV(`${baseUrl}/adventure-trainer-pools.csv`),
    loadCSV(`${baseUrl}/adventure-boss-pools.csv`),
  ]);

  const biomes = biomeRows.map(row => ({
    id: row.biome_id,
    nameKo: row.name_ko,
    themeTags: parseList(row.theme_tags),
    startWeight: asNumber(row.start_weight),
    baseDanger: asNumber(row.base_danger),
    wildCommonWeight: asNumber(row.wild_common_weight),
    wildUncommonWeight: asNumber(row.wild_uncommon_weight),
    wildRareWeight: asNumber(row.wild_rare_weight),
    trainerChance: asNumber(row.trainer_chance),
    eliteChance: asNumber(row.elite_chance),
    shopBias: asNumber(row.shop_bias, 1),
    restBias: asNumber(row.rest_bias, 1),
    isStart: row.is_start === '1',
    isFinal: row.is_final === '1',
  }));

  const biomesById = new Map(biomes.map(biome => [biome.id, biome]));

  const transitions = transitionRows.map(row => ({
    fromBiomeId: row.from_biome_id,
    toBiomeId: row.to_biome_id,
    weight: asNumber(row.weight, 1),
    routeTag: row.route_tag,
    minClears: asNumber(row.min_clears, 0),
    maxClears: asNumber(row.max_clears, 999),
  }));

  const transitionsByFrom = groupBy(transitions, row => row.fromBiomeId);

  const waveSlots = waveRows
    .map(row => ({
      localWave: asNumber(row.local_wave),
      slotType: row.slot_type,
      slotLabelKo: row.slot_label_ko,
      difficultyBias: asNumber(row.difficulty_bias),
      rewardBias: asNumber(row.reward_bias),
    }))
    .sort((a, b) => a.localWave - b.localWave);

  const waveSlotByLocalWave = new Map(waveSlots.map(slot => [slot.localWave, slot]));

  const wildPools = wildRows.map(row => {
    const mon = MON_BY_ID.get(row.mon_id);
    return {
      biomeId: row.biome_id,
      monId: row.mon_id,
      monNameKo: mon?.nameKo ?? row.mon_id,
      rarity: row.rarity,
      minWave: asNumber(row.min_wave, 1),
      maxWave: asNumber(row.max_wave, 999),
      weight: asNumber(row.weight, 1),
      roleTag: row.role_tag,
      stage: mon?.stage ?? 1,
      bst: mon?.bst ?? 240,
      coreConcept: mon?.coreConcept ?? '',
    };
  });

  const trainerPools = trainerRows.map(row => ({
    biomeId: row.biome_id,
    trainerId: row.trainer_id,
    nameKo: row.name_ko,
    templateTag: row.template_tag,
    tier: row.tier,
    minWave: asNumber(row.min_wave, 1),
    maxWave: asNumber(row.max_wave, 999),
    partyMonIds: parseList(row.party_mon_ids),
    partySizeMin: asNumber(row.party_size_min, 1),
    partySizeMax: asNumber(row.party_size_max, 1),
    weight: asNumber(row.weight, 1),
  }));

  const bossPools = bossRows.map(row => ({
    biomeId: row.biome_id,
    bossId: row.boss_id,
    nameKo: row.name_ko,
    tier: row.tier,
    minWave: asNumber(row.min_wave, 1),
    maxWave: asNumber(row.max_wave, 999),
    partyMonIds: parseList(row.party_mon_ids),
    partySize: asNumber(row.party_size, 1),
    waveBonus: asNumber(row.wave_bonus, 0),
    weight: asNumber(row.weight, 1),
  }));

  return {
    biomes,
    biomesById,
    transitions,
    transitionsByFrom,
    waveSlots,
    waveSlotByLocalWave,
    wildPools,
    wildPoolsByBiome: groupBy(wildPools, row => row.biomeId),
    trainerPools,
    trainerPoolsByBiome: groupBy(trainerPools, row => row.biomeId),
    bossPools,
    bossPoolsByBiome: groupBy(bossPools, row => row.biomeId),
    startBiomes: biomes.filter(biome => biome.isStart),
    finalBiomes: biomes.filter(biome => biome.isFinal),
  };
}

function groupBy(items, keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = keySelector(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
