/** Shared application state, sprite helper, type-info lookup, and base-stat utilities. */

import { MONS } from '../data/mons.js';

/* ════════════════════════════════════════
   Mutable application state
════════════════════════════════════════ */
export const state = {
  currentFilter: '',
  searchQuery:   '',
  activeMonId:   null,
  favorites:     new Set(),
  filteredMons:  [...MONS],
};

/* ════════════════════════════════════════
   Sprite URL helper
════════════════════════════════════════ */
export const SPRITE = id => `./asset/sprites/${id}.webp`;

/* ════════════════════════════════════════
   Type → CSS class mapping
════════════════════════════════════════ */
const TYPE_CLS = {
  '대화':      { type:'chat',  label:'type-chat',  bar:'bar-chat',  glow:'glow-chat'  },
  '추론':      { type:'inf',   label:'type-inf',   bar:'bar-inf',   glow:'glow-inf'   },
  '멀티모달':  { type:'mm',    label:'type-mm',    bar:'bar-mm',    glow:'glow-mm'    },
  '코드':      { type:'code',  label:'type-code',  bar:'bar-code',  glow:'glow-code'  },
  '정렬':      { type:'align', label:'type-align', bar:'bar-align', glow:'glow-align' },
  '실시간':    { type:'rt',    label:'type-rt',    bar:'bar-rt',    glow:'glow-rt'    },
  '생성':      { type:'mm',    label:'type-mm',    bar:'bar-mm',    glow:'glow-mm'    },
  '음성':      { type:'rt',    label:'type-rt',    bar:'bar-rt',    glow:'glow-rt'    },
  '검색':      { type:'inf',   label:'type-inf',   bar:'bar-inf',   glow:'glow-inf'   },
  '에이전트':  { type:'code',  label:'type-code',  bar:'bar-code',  glow:'glow-code'  },
  '메모리':    { type:'align', label:'type-align', bar:'bar-align', glow:'glow-align' },
  '시스템':    { type:'rt',    label:'type-rt',    bar:'bar-rt',    glow:'glow-rt'    },
};

export function typeInfo(concept) {
  return TYPE_CLS[concept] || TYPE_CLS['실시간'];
}

/* ════════════════════════════════════════
   Base-stat metadata and helpers
════════════════════════════════════════ */
export const BS_META = [
  { key:'hp',  lbl:'내구', cls:'bsb-hp',  isHp:true  },
  { key:'atk', lbl:'출력', cls:'bsb-atk', isHp:false },
  { key:'def', lbl:'정렬', cls:'bsb-def', isHp:false },
  { key:'spd', lbl:'속도', cls:'bsb-spd', isHp:false },
  { key:'spc', lbl:'추론', cls:'bsb-spc', isHp:false },
];

/**
 * Gen1 formula (no DV/EV):
 *   HP  = floor(base * 2 * lv / 100) + lv + 10
 *   else = floor(base * 2 * lv / 100) + 5
 */
export function calcStat(base, lv, isHp) {
  const core = Math.floor(base * 2 * lv / 100);
  return isHp ? core + lv + 10 : core + 5;
}

/** Lv.100 maximum estimate (DV:15 filled). */
export function calcStatMax(base, isHp) {
  const core = (base + 15) * 2;
  return isHp ? core + 110 : core + 5;
}

/** Return CSS class for a base-stat value colour band. */
export function bsValCls(v) {
  if (v < 50)  return 'bsv-low';
  if (v < 70)  return 'bsv-mid';
  if (v < 90)  return 'bsv-avg';
  if (v < 110) return 'bsv-high';
  return 'bsv-max';
}
