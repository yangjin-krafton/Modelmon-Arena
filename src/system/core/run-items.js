/**
 * 아이템 시스템 — CSV 로딩 + 런 인벤토리 관리
 *
 * 데이터: src/data/items.csv
 * 아이콘: src/asset/items/{icon}.svg
 *
 * 런 시작 시 지급:
 *   모델볼 × 10, 회복약 × 5
 */

import { loadCSV } from './csv.js';

/* ════════════════════════════════════════
   아이템 정의 로딩 (CSV → 딕셔너리)
════════════════════════════════════════ */
const rows = await loadCSV('./data/items.csv');

/** 전체 아이템 정의  { item_id: ItemDef } */
export const ITEMS = Object.fromEntries(
  rows.map(r => [r.item_id, {
    id:           r.item_id,
    name:         r.name_ko,
    nameEn:       r.name_en,
    category:     r.category,        // ball | potion | pp | combo
    icon:         `./asset/items/${r.icon}.svg`,
    rarity:       r.rarity,          // common | uncommon | rare | legendary
    catchMult:    parseFloat(r.catch_mult)   || 0,
    typeAffinity: r.type_affinity            || null,
    catchTurn:    r.catch_turn               || null,  // early | late | low_hp
    hpFlat:       parseInt(r.hp_flat)        || 0,
    hpFull:       r.hp_full   === 'true',
    ppFlat:       parseInt(r.pp_flat)        || 0,
    ppAll:        r.pp_all    === 'true',
    ppFull:       r.pp_full   === 'true',
    revivePct:    parseInt(r.revive_pct)     || 0,
    desc:         r.desc_ko,
  }]),
);

/* ════════════════════════════════════════
   런 인벤토리 (인메모리 — 여정마다 초기화)
════════════════════════════════════════ */
const DEFAULT_INVENTORY = {
  modelball: 10,
  potion:    5,
};

let inventory = {};

/** 여정 시작 시 호출 — 기본 아이템 지급 */
export function initRunItems() {
  inventory = { ...DEFAULT_INVENTORY };
}

/** 현재 인벤토리 스냅샷 반환 */
export function getInventory() {
  return { ...inventory };
}

export function getItemCount(itemId) {
  return inventory[itemId] ?? 0;
}

export function hasItem(itemId) {
  return getItemCount(itemId) > 0;
}

/** 아이템 1개 소비. 성공하면 true */
export function consumeItem(itemId) {
  if (!hasItem(itemId)) return false;
  inventory[itemId]--;
  if (inventory[itemId] <= 0) delete inventory[itemId];
  return true;
}

/** 아이템 획득 (전투 보상 등) */
export function addItem(itemId, count = 1) {
  inventory[itemId] = (inventory[itemId] ?? 0) + count;
}

/** rarity 희귀도 표시 색상 */
export const RARITY_COLOR = {
  common:    'rgba(255,255,255,0.5)',
  uncommon:  '#70ffb0',
  rare:      '#80ccff',
  legendary: '#f0c020',
};
