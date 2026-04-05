/**
 * User save state stored in localStorage.
 * Growth/progression is now tracked per monster instance in `monRoster`.
 * `MON_STATE` remains as a species-summary view for list/detail UI.
 */

import { MONS } from '../data/mons.js';

const SAVE_KEY = 'modelmon-save';
const SAVE_VERSION = 5;
const MON_BY_ID = new Map(MONS.map(mon => [mon.id, mon]));

const STARTER_IDS = ['001', '004', '007'];
const MON_STATE = {};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version === SAVE_VERSION) return normalizeSaveShape(data);
    if (data.version === 4) return migrateV4Save(data);
    return null;
  } catch {
    return null;
  }
}

function createNewSave() {
  const data = normalizeSaveShape({
    version: SAVE_VERSION,
    monRoster: {},
    starterUnlocks: {},
    metaProgress: { biomeSeenCounts: {}, biomeClearCounts: {} },
    adventureSession: null,
    nextInstanceSeq: 1,
  });

  STARTER_IDS.forEach(monId => {
    createMonInstanceInternal(data.monRoster, monId, {
      level: 5,
      exp: 0,
      state: 'captured',
      instanceId: generateInstanceId(data),
    });
  });

  updateSpeciesStateSummary(data.monRoster);
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

const _save = loadSave() ?? createNewSave();
export const MON_ROSTER = _save.monRoster;
export { MON_STATE };

function normalizeSaveShape(data) {
  const next = {
    version: SAVE_VERSION,
    monRoster: {},
    starterUnlocks: data?.starterUnlocks ?? {},
    metaProgress: data?.metaProgress ?? { biomeSeenCounts: {}, biomeClearCounts: {} },
    adventureSession: data?.adventureSession ?? null,
    nextInstanceSeq: Math.max(1, Math.floor(Number(data?.nextInstanceSeq) || 1)),
  };

  Object.entries(data?.monRoster ?? {}).forEach(([instanceId, entry]) => {
    next.monRoster[instanceId] = normalizeRosterEntry(instanceId, entry);
  });

  updateSpeciesStateSummary(next.monRoster);
  return next;
}

function migrateV4Save(data) {
  const migrated = normalizeSaveShape({
    version: SAVE_VERSION,
    monRoster: {},
    starterUnlocks: data?.starterUnlocks ?? {},
    metaProgress: data?.metaProgress ?? { biomeSeenCounts: {}, biomeClearCounts: {} },
    adventureSession: migrateAdventureSession(data?.adventureSession),
    nextInstanceSeq: 1,
  });

  Object.entries(data?.monState ?? {}).forEach(([monId, entry]) => {
    if (!entry || entry.state !== 'captured') return;
    createMonInstanceInternal(migrated.monRoster, monId, {
      level: entry.lv,
      exp: entry.exp,
      state: entry.state,
      statBonus: entry.statBonus,
      instanceId: generateInstanceId(migrated),
    });
  });

  STARTER_IDS.forEach(monId => {
    if (getPreferredMonInstanceId(migrated.monRoster, monId)) return;
    createMonInstanceInternal(migrated.monRoster, monId, {
      level: 5,
      exp: 0,
      state: 'captured',
      instanceId: generateInstanceId(migrated),
    });
  });

  updateSpeciesStateSummary(migrated.monRoster);
  localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
  return migrated;
}

function migrateAdventureSession(session) {
  if (!session?.run) return session ?? null;

  const next = JSON.parse(JSON.stringify(session));
  const ids = Array.isArray(next.battleTeamIds) ? next.battleTeamIds : [];
  const instanceIds = ids.map(monId => getPreferredMonInstanceIdFromSave(next, monId) || monId);
  next.battleTeamIds = instanceIds;

  if (Array.isArray(next.run.party)) {
    next.run.party = next.run.party.map(member => {
      const monId = member?.monId || member?.id;
      const instanceId = member?.instanceId || getPreferredMonInstanceIdFromSave(next, monId) || monId;
      return {
        ...member,
        instanceId,
        monId,
      };
    });
  }

  return next;
}

function getPreferredMonInstanceIdFromSave(saveLike, monId) {
  const roster = saveLike?.monRoster ?? {};
  return getPreferredMonInstanceId(roster, monId);
}

function normalizeRosterEntry(instanceId, entry = {}) {
  const monId = String(entry.monId || entry.id || '').padStart(3, '0');
  return {
    instanceId,
    monId,
    state: entry.state || 'captured',
    lv: Math.max(1, Math.floor(Number(entry.lv) || 5)),
    exp: Math.max(0, Math.floor(Number(entry.exp) || 0)),
    statBonus: normalizeStatBonus(entry.statBonus),
    createdAt: Number(entry.createdAt) || Date.now(),
  };
}

function createMonInstanceInternal(roster, monId, {
  level = 5,
  exp = 0,
  state = 'captured',
  statBonus = null,
  instanceId = null,
  backfillGrowth = false,
} = {}) {
  const nextId = instanceId || generateInstanceId(_save);
  const entry = normalizeRosterEntry(nextId, {
    monId,
    lv: Math.max(1, Math.floor(Number(level) || 5)),
    exp,
    state,
    statBonus,
    createdAt: Date.now(),
  });

  if (backfillGrowth) {
    entry.statBonus = createEmptyStatBonus();
    backfillInstanceGrowth(entry, entry.lv);
  }

  roster[nextId] = entry;
  return entry;
}

function generateInstanceId(saveLike = _save) {
  const seq = Math.max(1, Math.floor(Number(saveLike.nextInstanceSeq) || 1));
  saveLike.nextInstanceSeq = seq + 1;
  return `mon-${String(seq).padStart(6, '0')}`;
}

function updateSpeciesStateSummary(roster = MON_ROSTER) {
  Object.keys(MON_STATE).forEach(key => delete MON_STATE[key]);

  MONS.forEach(mon => {
    const instances = getMonInstances(mon.id, roster);
    if (!instances.length) {
      MON_STATE[mon.id] = { state: 'unknown', lv: 1, exp: 0, statBonus: createEmptyStatBonus() };
      return;
    }

    const preferred = pickPreferredInstance(instances);
    MON_STATE[mon.id] = {
      state: preferred.state || 'captured',
      lv: preferred.lv,
      exp: preferred.exp,
      statBonus: normalizeStatBonus(preferred.statBonus),
      count: instances.length,
      instanceId: preferred.instanceId,
    };
  });
}

function getMonInstances(monId, roster = MON_ROSTER) {
  return Object.values(roster)
    .filter(entry => entry?.monId === monId)
    .map(entry => normalizeRosterEntry(entry.instanceId, entry))
    .sort(compareRosterEntries);
}

function compareRosterEntries(left, right) {
  if ((right.lv || 0) !== (left.lv || 0)) return (right.lv || 0) - (left.lv || 0);
  if ((right.createdAt || 0) !== (left.createdAt || 0)) return (right.createdAt || 0) - (left.createdAt || 0);
  return String(left.instanceId).localeCompare(String(right.instanceId));
}

function pickPreferredInstance(instances) {
  return [...instances].sort(compareRosterEntries)[0] || null;
}

function getPreferredMonInstanceId(roster, monId) {
  return pickPreferredInstance(getMonInstances(monId, roster))?.instanceId || null;
}

function resolveMonReference(monRef, { createIfMissing = false } = {}) {
  if (!monRef) return null;

  if (MON_ROSTER[monRef]) {
    MON_ROSTER[monRef] = normalizeRosterEntry(monRef, MON_ROSTER[monRef]);
    return MON_ROSTER[monRef];
  }

  const monId = String(monRef).padStart(3, '0');
  const preferredInstanceId = getPreferredMonInstanceId(MON_ROSTER, monId);
  if (preferredInstanceId) {
    MON_ROSTER[preferredInstanceId] = normalizeRosterEntry(preferredInstanceId, MON_ROSTER[preferredInstanceId]);
    return MON_ROSTER[preferredInstanceId];
  }

  if (!createIfMissing) return null;

  const created = createMonInstanceInternal(MON_ROSTER, monId, {
    level: 5,
    exp: 0,
    state: 'captured',
    instanceId: generateInstanceId(_save),
  });
  updateSpeciesStateSummary();
  return created;
}

export function getPreferredMonInstance(monId) {
  const preferred = resolveMonReference(monId);
  return preferred ? { ...preferred, statBonus: normalizeStatBonus(preferred.statBonus) } : null;
}

export function getMonProgress(monRef) {
  const entry = resolveMonReference(monRef, { createIfMissing: true });
  return entry
    ? { ...entry, statBonus: normalizeStatBonus(entry.statBonus) }
    : null;
}

export function getMonSpeciesId(monRef) {
  return resolveMonReference(monRef)?.monId || (MON_BY_ID.has(monRef) ? monRef : null);
}

export function getMonLevel(monRef, fallback = 5) {
  const entry = resolveMonReference(monRef);
  return Number.isFinite(entry?.lv) ? entry.lv : fallback;
}

export function getMonStatBonus(monRef) {
  return normalizeStatBonus(resolveMonReference(monRef)?.statBonus);
}

export function expToNextLevel(level) {
  return Math.max(12, level * 10);
}

export function grantExp(monRef, amount) {
  const entry = resolveMonReference(monRef, { createIfMissing: true });
  const gainedExp = Math.max(0, Math.floor(Number(amount) || 0));
  let levelsGained = 0;
  const totalStatGains = createEmptyStatBonus();

  entry.exp += gainedExp;

  while (entry.lv < 100) {
    const required = expToNextLevel(entry.lv);
    if (entry.exp < required) break;
    entry.exp -= required;
    entry.lv += 1;
    levelsGained += 1;
    const levelGains = rollLevelStatGains(entry.monId);
    applyStatBonus(entry.statBonus, levelGains);
    applyStatBonus(totalStatGains, levelGains);
  }

  updateSpeciesStateSummary();
  saveGame();

  return {
    monRef: entry.instanceId,
    monId: entry.monId,
    gainedExp,
    level: entry.lv,
    exp: entry.exp,
    nextLevelExp: expToNextLevel(entry.lv),
    levelsGained,
    statGains: totalStatGains,
  };
}

export function captureMon(monId, level = 5) {
  const entry = createMonInstanceInternal(MON_ROSTER, monId, {
    level: Math.max(1, Math.floor(Number(level) || 5)),
    exp: 0,
    state: 'captured',
    instanceId: generateInstanceId(_save),
    backfillGrowth: true,
  });
  unlockStarter(monId);
  updateSpeciesStateSummary();
  saveGame();
  return { ...entry, statBonus: normalizeStatBonus(entry.statBonus) };
}

export function evolveMon(monRef, toMonId) {
  const entry = resolveMonReference(monRef, { createIfMissing: true });
  if (!entry || !toMonId) return entry;
  entry.monId = toMonId;
  entry.state = 'captured';
  entry.statBonus = normalizeStatBonus(entry.statBonus);
  unlockStarter(toMonId);
  updateSpeciesStateSummary();
  saveGame();
  return { ...entry, statBonus: normalizeStatBonus(entry.statBonus) };
}

export function getMetaProgress() {
  if (!_save.metaProgress) _save.metaProgress = { biomeSeenCounts: {}, biomeClearCounts: {} };
  if (!_save.metaProgress.biomeSeenCounts) _save.metaProgress.biomeSeenCounts = {};
  if (!_save.metaProgress.biomeClearCounts) _save.metaProgress.biomeClearCounts = {};
  return _save.metaProgress;
}

export function getAdventureSession() {
  return _save.adventureSession ?? null;
}

export function setAdventureSession(session) {
  _save.adventureSession = session ? JSON.parse(JSON.stringify(session)) : null;
  saveGame();
  return _save.adventureSession;
}

export function clearAdventureSession() {
  _save.adventureSession = null;
  saveGame();
}

export function recordBiomeSeen(biomeId) {
  const meta = getMetaProgress();
  meta.biomeSeenCounts[biomeId] = (meta.biomeSeenCounts[biomeId] ?? 0) + 1;
  saveGame();
}

export function recordBiomeClear(biomeId) {
  const meta = getMetaProgress();
  meta.biomeClearCounts[biomeId] = (meta.biomeClearCounts[biomeId] ?? 0) + 1;
  saveGame();
}

export function saveGame() {
  updateSpeciesStateSummary();
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    monRoster: MON_ROSTER,
    starterUnlocks: _save.starterUnlocks ?? {},
    metaProgress: getMetaProgress(),
    adventureSession: _save.adventureSession ?? null,
    nextInstanceSeq: _save.nextInstanceSeq ?? 1,
  }));
}

export function isStarterEligible(monId) {
  return !!getPreferredMonInstance(monId) || !!(_save.starterUnlocks ?? {})[monId];
}

export function unlockStarter(monId) {
  if (!_save.starterUnlocks) _save.starterUnlocks = {};
  _save.starterUnlocks[monId] = true;
  saveGame();
}

export function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

function createEmptyStatBonus() {
  return { hp: 0, atk: 0, def: 0, spd: 0, spc: 0 };
}

function normalizeStatBonus(statBonus) {
  const next = createEmptyStatBonus();
  Object.keys(next).forEach(key => {
    next[key] = Math.max(0, Math.floor(Number(statBonus?.[key]) || 0));
  });
  return next;
}

function applyStatBonus(target, gains) {
  Object.keys(target).forEach(key => {
    target[key] += Math.max(0, Math.floor(Number(gains?.[key]) || 0));
  });
}

function backfillInstanceGrowth(entry, targetLevel) {
  const cappedLevel = Math.max(1, Math.floor(Number(targetLevel) || entry.lv || 5));
  for (let level = 5; level < cappedLevel; level += 1) {
    applyStatBonus(entry.statBonus, rollLevelStatGains(entry.monId));
  }
}

function rollLevelStatGains(monId) {
  const mon = MON_BY_ID.get(monId);
  const baseStats = mon?.bs || {};
  return {
    hp: rollSingleStatGain(baseStats.hp, { baseChance: 0.52, highBase: 90, extraChance: 0.12 }),
    atk: rollSingleStatGain(baseStats.atk, { baseChance: 0.36, highBase: 100, extraChance: 0.08 }),
    def: rollSingleStatGain(baseStats.def, { baseChance: 0.36, highBase: 100, extraChance: 0.08 }),
    spd: rollSingleStatGain(baseStats.spd, { baseChance: 0.34, highBase: 95, extraChance: 0.07 }),
    spc: rollSingleStatGain(baseStats.spc, { baseChance: 0.35, highBase: 100, extraChance: 0.08 }),
  };
}

function rollSingleStatGain(baseStat = 60, { baseChance = 0.35, highBase = 100, extraChance = 0.08 } = {}) {
  const stat = Number(baseStat || 60);
  let gain = Math.random() < Math.min(0.88, baseChance + stat / 400) ? 1 : 0;
  if (stat >= highBase && Math.random() < extraChance) gain += 1;
  return gain;
}
