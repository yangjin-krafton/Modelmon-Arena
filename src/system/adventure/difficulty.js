import { MONS } from '../data/mons.js';

const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

export function getPlayerPowerScore(run) {
  const party = run.party || [];
  if (!party.length) return 4;

  const total = party.reduce((sum, member) => {
    const mon = MON_BY_ID.get(member.monId);
    const bst = mon?.bst ?? 240;
    return sum + (bst / 85) + member.level * 0.55;
  }, 0);

  return total / party.length + party.length * 1.5 + (run.gymClears || 0);
}

export function getBiomeFamiliarityBonus(metaProgress, biomeId) {
  const seenCount = Number(metaProgress?.biomeSeenCounts?.[biomeId] ?? 0);
  return Math.max(0, 1.5 - seenCount * 0.3);
}

export function computeDifficultyProfile({ run, biome, waveSlot, metaProgress }) {
  const localWave = run.localWave;
  const runDepth = run.biomeOrder.length;
  const baseDanger = Number(biome.baseDanger || 1);
  const slotBias = Number(waveSlot?.difficultyBias || 0);
  const playerPower = getPlayerPowerScore(run);
  const familiarityBonus = getBiomeFamiliarityBonus(metaProgress, biome.id);

  const dangerScore = Number((
    baseDanger +
    runDepth * 1.6 +
    localWave * 0.7 +
    slotBias +
    playerPower * 0.08 -
    familiarityBonus
  ).toFixed(2));

  const recommendedLevel = Math.max(
    run.party[0]?.level ?? 5,
    Math.round(4 + runDepth * 5 + localWave * 1.5 + slotBias * 2),
  );

  const encounterBudget = Math.max(
    8,
    Math.round(10 + dangerScore * 2.4 + playerPower * 0.3),
  );

  const trainerBudget = Math.max(
    10,
    Math.round(12 + dangerScore * 2.8 + playerPower * 0.35),
  );

  const bossBudget = Math.max(
    16,
    Math.round(18 + dangerScore * 3.4 + playerPower * 0.42),
  );

  return {
    baseDanger,
    playerPower,
    familiarityBonus,
    dangerScore,
    recommendedLevel,
    encounterBudget,
    trainerBudget,
    bossBudget,
  };
}
