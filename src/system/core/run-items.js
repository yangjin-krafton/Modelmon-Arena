/**
 * 아이템 데이터 CSV 로딩 + 인벤토리 관리
 * 데이터: src/data/items.csv
 * 아이콘: src/asset/items/{icon}.svg
 */

import { loadCSV } from './csv.js';

const rows = await loadCSV('./data/items.csv');

export const ITEMS = Object.fromEntries(
  rows.map(r => [r.item_id, {
    id:           r.item_id,
    name:         r.name_ko,
    nameEn:       r.name_en,
    category:     r.category,
    icon:         `./asset/items/${r.icon}.svg`,
    rarity:       r.rarity,
    shopCost:     parseInt(r.shop_cost) || 0,
    catchMult:    parseFloat(r.catch_mult) || 0,
    typeAffinity: r.type_affinity || null,
    catchTurn:    r.catch_turn || null,
    hpFlat:       parseInt(r.hp_flat) || 0,
    hpFull:       r.hp_full === 'true',
    ppFlat:       parseInt(r.pp_flat) || 0,
    ppAll:        r.pp_all === 'true',
    ppFull:       r.pp_full === 'true',
    revivePct:    parseInt(r.revive_pct) || 0,
    desc:         r.desc_ko,
  }]),
);

export const DEFAULT_INVENTORY = {
  modelball: 10,
  potion: 5,
};

let inventory = {};

export function createDefaultInventory() {
  return { ...DEFAULT_INVENTORY };
}

export function setInventory(nextInventory = DEFAULT_INVENTORY) {
  inventory = Object.fromEntries(
    Object.entries(nextInventory || {})
      .map(([itemId, count]) => [itemId, Math.max(0, Math.floor(Number(count) || 0))])
      .filter(([, count]) => count > 0),
  );
}

export function initRunItems(initialInventory = null) {
  setInventory(initialInventory ?? DEFAULT_INVENTORY);
}

export function getInventory() {
  return { ...inventory };
}

export function getItemCount(itemId) {
  return inventory[itemId] ?? 0;
}

export function hasItem(itemId) {
  return getItemCount(itemId) > 0;
}

export function consumeItem(itemId) {
  if (!hasItem(itemId)) return false;
  inventory[itemId]--;
  if (inventory[itemId] <= 0) delete inventory[itemId];
  return true;
}

export function addItem(itemId, count = 1) {
  inventory[itemId] = (inventory[itemId] ?? 0) + count;
}

export const RARITY_COLOR = {
  common: 'rgba(255,255,255,0.5)',
  uncommon: '#70ffb0',
  rare: '#80ccff',
  legendary: '#f0c020',
};
