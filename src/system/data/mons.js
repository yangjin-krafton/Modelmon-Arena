/**
 * 몬스터 정의 (MONS) + 유저 언락 상태 (MON_STATE)
 *
 * 데이터 소스 (src/data/ 런타임 로딩):
 *   MONS      ← data/modelmon-dex-gen1.csv
 *   evo lines ← data/gen1-evo-lines.csv
 *
 * MON_STATE : 유저 진행 상태 (런타임 전용, CSV 관리 대상 아님)
 *             추후 localStorage / 서버 API 로 이전 예정
 */

import { loadCSV } from '../core/csv.js';

/* ─── 정규화 기준값 ──────────────────────────────── */
const MAX_PARAMS_B = 120;  // Claude Opus 120B (Gen1 최대)
const MAX_SIZE_KB  = 207;  // Gemini Ultra 207 KB (Gen1 최대)

/** "7B" → 7, "120B" → 120 */
const parseB  = str => parseFloat(str)  || 0;

/** "91.5KB" → 91.5, "91.5 KB" → 91.5 */
const parseKB = str => parseFloat(str)  || 0;

/* ─── gen1-evo-lines.csv → { monId: [members] } ─── */
async function buildEvoMap() {
  const rows = await loadCSV('./data/gen1-evo-lines.csv');
  const map  = {};
  for (const row of rows) {
    const members = row.members.split('/').map(s => s.trim());
    for (const id of members) map[id] = members;
  }
  return map;
}

/* ─── CSV rows → MONS 배열 ───────────────────────── */
function transformMons(rows, evoMap) {
  return rows.map(r => ({
    id:          r.id,
    modelId:     r.modelId,
    nameKo:      r.nameKo,
    nameEn:      r.nameEn,
    stage:       parseInt(r.stage),
    coreConcept: r.coreConcept,
    subConcept:  r.subConcept,
    inputMode:   r.inputMode,
    outputMode:  r.outputMode,
    params:      r.params,
    paramPct:    Math.min(Math.round(parseB(r.params)  / MAX_PARAMS_B * 100), 100),
    sizePct:     Math.min(Math.round(parseKB(r.fileSize) / MAX_SIZE_KB  * 100), 100),
    size:        r.fileSize,
    motif:       r.motif,
    temperament: r.temperament,
    flavor:      r.flavor,
    evoLine:     evoMap[r.id] || [r.id],
    evoLevel:    r.evoLevel ? parseInt(r.evoLevel) : null,
    bs: {
      hp:  parseInt(r.bs_hp),
      atk: parseInt(r.bs_atk),
      def: parseInt(r.bs_def),
      spd: parseInt(r.bs_spd),
      spc: parseInt(r.bs_spc),
    },
  }));
}

/* ─── 병렬 로딩 후 export ───────────────────────── */
const [monRows, evoMap] = await Promise.all([
  loadCSV('./data/modelmon-dex-gen1.csv'),
  buildEvoMap(),
]);

/** 전체 모델몬 목록 */
export const MONS = transformMons(monRows, evoMap);

/* ─── 유저 언락 상태 (런타임 전용) ─────────────────
   state : 'unknown' | 'encountered' | 'captured'
   lv    : 보유 레벨 (스킬 트리 공개 범위 기준)
────────────────────────────────────────────────── */
export const MON_STATE = {
  '001': { state: 'captured',    lv: 25  },
  '002': { state: 'encountered', lv: 1   },
  '003': { state: 'captured',    lv: 40  },
  '004': { state: 'captured',    lv: 100 },
  '005': { state: 'captured',    lv: 62  },
  '006': { state: 'unknown',     lv: 1   },
  '007': { state: 'encountered', lv: 1   },
  '008': { state: 'captured',    lv: 35  },
  '009': { state: 'unknown',     lv: 1   },
};
