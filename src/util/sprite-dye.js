/**
 * sprite-dye.js — Modelmon 스프라이트 염색 유틸리티
 *
 * Channel Mix (통도혼합) 기반 컬러 변환.
 * 원본 이미지를 64px 픽셀아트로 다운스케일 → 256x256 출력,
 * AI 회사 CI 팔레트로 Channel Mix 매트릭스 자동 계산 후 적용.
 *
 * 사용법:
 *   import { dyeSprite, BRAND_PALETTES } from './util/sprite-dye.js';
 *
 *   const canvas = dyeSprite(sourceImage, 'Fire — Anthropic');
 *   // 또는 커스텀 팔레트:
 *   const canvas = dyeSprite(sourceImage, {
 *     colors: [
 *       { rgb: [204,120,67], weight: 0.35 },
 *       { rgb: [60,40,30],   weight: 0.65 },
 *     ]
 *   });
 */

// ============================================================
// 설정
// ============================================================
export const PIXEL_RES = 64;
export const OUTPUT_SIZE = 256;
export const QUANTIZE_K = 12;
export const DEFAULT_STRENGTH = 0.85;

// ============================================================
// 포켓몬 1기 15타입 = 15 AI 회사 CI 컬러 팔레트
// ============================================================
export const BRAND_PALETTES = {
  'Fire — Anthropic': {
    type: 'Fire', brand: 'Anthropic',
    colors: [
      { rgb: [204, 120, 67],  weight: 0.35 },
      { rgb: [180, 90,  45],  weight: 0.25 },
      { rgb: [242, 224, 200], weight: 0.20 },
      { rgb: [60,  40,  30],  weight: 0.20 },
    ],
  },
  'Grass — OpenAI': {
    type: 'Grass', brand: 'OpenAI',
    colors: [
      { rgb: [16,  163, 127], weight: 0.40 },
      { rgb: [100, 220, 180], weight: 0.25 },
      { rgb: [0,   80,  60],  weight: 0.20 },
      { rgb: [220, 255, 240], weight: 0.15 },
    ],
  },
  'Water — Meta': {
    type: 'Water', brand: 'Meta',
    colors: [
      { rgb: [0,   100, 210], weight: 0.35 },
      { rgb: [55,  0,   200], weight: 0.25 },
      { rgb: [150, 200, 255], weight: 0.20 },
      { rgb: [255, 255, 255], weight: 0.20 },
    ],
  },
  'Electric — Mistral': {
    type: 'Electric', brand: 'Mistral',
    colors: [
      { rgb: [245, 130, 32],  weight: 0.35 },
      { rgb: [255, 195, 0],   weight: 0.30 },
      { rgb: [255, 230, 150], weight: 0.15 },
      { rgb: [0,   0,   0],   weight: 0.20 },
    ],
  },
  'Psychic — Google': {
    type: 'Psychic', brand: 'Google',
    colors: [
      { rgb: [66,  133, 244], weight: 0.25 },
      { rgb: [234, 67,  53],  weight: 0.25 },
      { rgb: [251, 188, 4],   weight: 0.25 },
      { rgb: [52,  168, 83],  weight: 0.15 },
      { rgb: [255, 255, 255], weight: 0.10 },
    ],
  },
  'Fighting — xAI': {
    type: 'Fighting', brand: 'xAI',
    colors: [
      { rgb: [220, 40,  40],  weight: 0.35 },
      { rgb: [0,   0,   0],   weight: 0.35 },
      { rgb: [255, 255, 255], weight: 0.20 },
      { rgb: [150, 20,  20],  weight: 0.10 },
    ],
  },
  'Poison — DeepSeek': {
    type: 'Poison', brand: 'DeepSeek',
    colors: [
      { rgb: [130, 80,  230], weight: 0.35 },
      { rgb: [70,  100, 255], weight: 0.25 },
      { rgb: [200, 180, 255], weight: 0.20 },
      { rgb: [20,  20,  60],  weight: 0.20 },
    ],
  },
  'Ice — Perplexity': {
    type: 'Ice', brand: 'Perplexity',
    colors: [
      { rgb: [32,  178, 170], weight: 0.35 },
      { rgb: [20,  195, 200], weight: 0.25 },
      { rgb: [180, 240, 240], weight: 0.25 },
      { rgb: [10,  60,  70],  weight: 0.15 },
    ],
  },
  'Normal — Cohere': {
    type: 'Normal', brand: 'Cohere',
    colors: [
      { rgb: [57,  89,  77],  weight: 0.30 },
      { rgb: [209, 142, 226], weight: 0.25 },
      { rgb: [140, 200, 180], weight: 0.25 },
      { rgb: [240, 230, 245], weight: 0.20 },
    ],
  },
  'Ground — Amazon': {
    type: 'Ground', brand: 'Amazon',
    colors: [
      { rgb: [255, 153, 0],   weight: 0.40 },
      { rgb: [35,  47,  62],  weight: 0.30 },
      { rgb: [255, 200, 100], weight: 0.15 },
      { rgb: [20,  25,  35],  weight: 0.15 },
    ],
  },
  'Flying — Microsoft': {
    type: 'Flying', brand: 'Microsoft',
    colors: [
      { rgb: [0,   164, 239], weight: 0.30 },
      { rgb: [127, 186, 0],   weight: 0.25 },
      { rgb: [242, 80,  34],  weight: 0.20 },
      { rgb: [255, 185, 0],   weight: 0.15 },
      { rgb: [255, 255, 255], weight: 0.10 },
    ],
  },
  'Bug — HuggingFace': {
    type: 'Bug', brand: 'HuggingFace',
    colors: [
      { rgb: [255, 210, 30],  weight: 0.40 },
      { rgb: [255, 240, 120], weight: 0.20 },
      { rgb: [30,  30,  30],  weight: 0.25 },
      { rgb: [200, 160, 0],   weight: 0.15 },
    ],
  },
  'Rock — Nvidia': {
    type: 'Rock', brand: 'Nvidia',
    colors: [
      { rgb: [118, 185, 0],   weight: 0.40 },
      { rgb: [0,   0,   0],   weight: 0.30 },
      { rgb: [170, 220, 80],  weight: 0.15 },
      { rgb: [60,  100, 0],   weight: 0.15 },
    ],
  },
  'Ghost — Midjourney': {
    type: 'Ghost', brand: 'Midjourney',
    colors: [
      { rgb: [255, 255, 255], weight: 0.30 },
      { rgb: [15,  15,  25],  weight: 0.30 },
      { rgb: [100, 130, 200], weight: 0.25 },
      { rgb: [50,  55,  80],  weight: 0.15 },
    ],
  },
  'Dragon — Apple': {
    type: 'Dragon', brand: 'Apple',
    colors: [
      { rgb: [100, 60,  220], weight: 0.30 },
      { rgb: [255, 45,  85],  weight: 0.25 },
      { rgb: [50,  170, 255], weight: 0.25 },
      { rgb: [10,  10,  15],  weight: 0.20 },
    ],
  },
};

// ============================================================
// 헬퍼: 타입명 또는 브랜드명으로 팔레트 찾기
// ============================================================
export function findPalette(query) {
  // 정확히 키 매칭
  if (BRAND_PALETTES[query]) return BRAND_PALETTES[query];
  // type 또는 brand로 검색
  const q = query.toLowerCase();
  for (const pal of Object.values(BRAND_PALETTES)) {
    if (pal.type.toLowerCase() === q || pal.brand.toLowerCase() === q) return pal;
  }
  return null;
}

// ============================================================
// Color Utilities
// ============================================================
function lum(r, g, b) {
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

function colorDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

// ============================================================
// K-Means Quantization
// ============================================================
function kMeansQuantize(data, k, maxIter = 12) {
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 10) pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  const step = Math.max(1, Math.floor(pixels.length / k));
  const sorted = [...pixels].sort((a, b) => lum(...a) - lum(...b));
  let centers = [];
  for (let i = 0; i < k; i++) {
    centers.push([...sorted[Math.min(i * step, sorted.length - 1)]]);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    const clusters = Array.from({ length: k }, () => []);
    for (const px of pixels) {
      let minD = Infinity, minJ = 0;
      for (let j = 0; j < k; j++) {
        const d = colorDist(px, centers[j]);
        if (d < minD) { minD = d; minJ = j; }
      }
      clusters[minJ].push(px);
    }
    let moved = false;
    for (let j = 0; j < k; j++) {
      if (clusters[j].length === 0) continue;
      const avg = [0, 0, 0];
      for (const px of clusters[j]) {
        avg[0] += px[0]; avg[1] += px[1]; avg[2] += px[2];
      }
      const n = clusters[j].length;
      const newC = [Math.round(avg[0] / n), Math.round(avg[1] / n), Math.round(avg[2] / n)];
      if (colorDist(newC, centers[j]) > 4) moved = true;
      centers[j] = newC;
    }
    if (!moved) break;
  }

  centers.sort((a, b) => lum(...a) - lum(...b));
  return centers;
}

// ============================================================
// Target Palette Builder
// ============================================================
function buildTargetPalette(palette, k) {
  const src = palette.colors
    .map(c => ({ rgb: c.rgb, weight: c.weight, lum: lum(...c.rgb) }))
    .sort((a, b) => a.lum - b.lum);

  const cumulative = [];
  let acc = 0;
  for (const s of src) {
    cumulative.push({ start: acc, end: acc + s.weight, rgb: s.rgb });
    acc += s.weight;
  }

  const result = [];
  for (let i = 0; i < k; i++) {
    const t = (i + 0.5) / k;
    let seg = cumulative[cumulative.length - 1];
    for (const c of cumulative) {
      if (t <= c.end) { seg = c; break; }
    }
    result.push([...seg.rgb]);
  }
  return result;
}

// ============================================================
// Channel Mix Matrix — Least Squares Solver
// ============================================================
function solveLeastSquares(pairs, channel) {
  const ATA = Array.from({ length: 4 }, () => new Float64Array(4));
  const ATb = new Float64Array(4);

  for (const p of pairs) {
    const row = [p.src[0] / 255, p.src[1] / 255, p.src[2] / 255, 1.0];
    const target = p.dst[channel] / 255;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) ATA[i][j] += row[i] * row[j];
      ATb[i] += row[i] * target;
    }
  }

  // Tikhonov regularization
  const lambda = 0.01;
  for (let i = 0; i < 4; i++) ATA[i][i] += lambda;

  // Gaussian elimination with partial pivoting
  const aug = ATA.map((row, i) => [...row, ATb[i]]);
  for (let col = 0; col < 4; col++) {
    let maxRow = col, maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) continue;
    for (let j = col; j <= 4; j++) aug[col][j] /= pivot;
    for (let row = 0; row < 4; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= 4; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map(row => row[4]);
}

function computeChannelMixMatrix(origColors, targetColors) {
  const pairs = [];
  for (let i = 0; i < origColors.length; i++) {
    pairs.push({ src: origColors[i], dst: targetColors[i] });
  }
  // Anchors: preserve black, white, midgray
  pairs.push({ src: [0, 0, 0],       dst: [0, 0, 0] });
  pairs.push({ src: [255, 255, 255], dst: [255, 255, 255] });
  pairs.push({ src: [128, 128, 128], dst: [128, 128, 128] });

  const coeffR = solveLeastSquares(pairs, 0);
  const coeffG = solveLeastSquares(pairs, 1);
  const coeffB = solveLeastSquares(pairs, 2);

  return {
    matrix: [
      [coeffR[0], coeffR[1], coeffR[2]],
      [coeffG[0], coeffG[1], coeffG[2]],
      [coeffB[0], coeffB[1], coeffB[2]],
    ],
    constant: [coeffR[3], coeffG[3], coeffB[3]],
  };
}

// ============================================================
// Pixelate: 원본 이미지 → 작은 캔버스로 다운스케일
// ============================================================
function pixelate(img, res) {
  const small = document.createElement('canvas');
  small.width = res;
  small.height = res;
  const ctx = small.getContext('2d');
  ctx.clearRect(0, 0, res, res);

  const scale = Math.min(res / img.width, res / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (res - w) / 2, (res - h) / 2, w, h);

  return ctx.getImageData(0, 0, res, res);
}

// ============================================================
// Render: 픽셀 데이터 → 256x256 캔버스 (nearest-neighbor upscale)
// ============================================================
function renderPixelArt(pixelData, pixelRes, outSize) {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  const pxSize = outSize / pixelRes;

  for (let y = 0; y < pixelRes; y++) {
    for (let x = 0; x < pixelRes; x++) {
      const i = (y * pixelRes + x) * 4;
      const a = pixelData.data[i + 3];
      if (a < 10) continue;
      const r = pixelData.data[i], g = pixelData.data[i + 1], b = pixelData.data[i + 2];
      ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
      ctx.fillRect(
        Math.floor(x * pxSize), Math.floor(y * pxSize),
        Math.ceil(pxSize), Math.ceil(pxSize),
      );
    }
  }
  return canvas;
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * 원본 이미지에 Channel Mix 염색을 적용하여 256x256 픽셀아트 캔버스를 반환.
 *
 * @param {HTMLImageElement} img - 원본 이미지
 * @param {string|object} palette - 팔레트 키 (예: 'Fire — Anthropic', 'anthropic', 'fire')
 *                                   또는 { colors: [{rgb, weight}, ...] } 직접 전달
 * @param {object} [opts] - 옵션
 * @param {number} [opts.pixelRes=64]       - 다운스케일 해상도
 * @param {number} [opts.outputSize=256]    - 출력 크기
 * @param {number} [opts.quantizeK=12]      - K-means 색 수
 * @param {number} [opts.strength=0.85]     - 팔레트 적용 강도 (0~1)
 * @returns {HTMLCanvasElement} 256x256 픽셀아트 캔버스
 */
export function dyeSprite(img, palette, opts = {}) {
  const pixelRes  = opts.pixelRes   ?? PIXEL_RES;
  const outSize   = opts.outputSize ?? OUTPUT_SIZE;
  const k         = opts.quantizeK  ?? QUANTIZE_K;
  const str       = opts.strength   ?? DEFAULT_STRENGTH;

  // 팔레트 해석
  let pal = typeof palette === 'string' ? findPalette(palette) : palette;
  if (!pal) throw new Error(`Unknown palette: ${palette}`);

  // 1. 픽셀아트로 다운스케일
  const pixelData = pixelate(img, pixelRes);
  const data = pixelData.data;

  // 2. K-means로 원본 대표색 추출
  const origColors = kMeansQuantize(data, k);
  if (origColors.length === 0) return renderPixelArt(pixelData, pixelRes, outSize);

  // 3. 타겟 팔레트 생성
  const targetColors = buildTargetPalette(pal, origColors.length);

  // 4. Channel Mix 매트릭스 계산
  const { matrix: M, constant: C } = computeChannelMixMatrix(origColors, targetColors);

  // 5. 전체 픽셀에 매트릭스 적용
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const nr = (M[0][0] * r + M[0][1] * g + M[0][2] * b + C[0]) * 255;
    const ng = (M[1][0] * r + M[1][1] * g + M[1][2] * b + C[1]) * 255;
    const nb = (M[2][0] * r + M[2][1] * g + M[2][2] * b + C[2]) * 255;

    data[i]     = Math.max(0, Math.min(255, Math.round(data[i]     * (1 - str) + nr * str)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * (1 - str) + ng * str)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * (1 - str) + nb * str)));
  }

  // 6. Nearest-neighbor upscale → 캔버스 반환
  return renderPixelArt(pixelData, pixelRes, outSize);
}

/**
 * 팔레트 없이 원본 픽셀아트만 생성.
 *
 * @param {HTMLImageElement} img
 * @param {object} [opts]
 * @returns {HTMLCanvasElement}
 */
export function pixelateSprite(img, opts = {}) {
  const pixelRes = opts.pixelRes   ?? PIXEL_RES;
  const outSize  = opts.outputSize ?? OUTPUT_SIZE;
  const pixelData = pixelate(img, pixelRes);
  return renderPixelArt(pixelData, pixelRes, outSize);
}

/**
 * 캔버스를 PNG data URL로 변환.
 */
export function canvasToPng(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * 캔버스를 PNG Blob으로 변환 (async).
 */
export function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * 모든 팔레트 키 목록 반환.
 */
export function listPalettes() {
  return Object.entries(BRAND_PALETTES).map(([key, pal]) => ({
    key,
    type: pal.type,
    brand: pal.brand,
    colors: pal.colors,
  }));
}
