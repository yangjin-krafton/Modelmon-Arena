/**
 * comfyui-regen.mjs — ComfyUI를 이용한 Modelmon 스프라이트 재생성
 *
 * Flux2 Klein Image Edit 워크플로를 사용하여
 * 각 몬스터 스프라이트를 해당 회사 CI 스타일로 다시 생성합니다.
 *
 * 사용법:
 *   node src/util/comfyui-regen.mjs                    # 전체 151마리 (각 8장)
 *   node src/util/comfyui-regen.mjs --range 1-10       # 도감번호 1~10
 *   node src/util/comfyui-regen.mjs --dex 25           # 피카츄만
 *   node src/util/comfyui-regen.mjs --brand Anthropic   # Anthropic 소속만
 *   node src/util/comfyui-regen.mjs --variants 4       # 몬스터당 4장 (기본 8)
 *   node src/util/comfyui-regen.mjs --dry-run          # 실제 생성 없이 매핑만 출력
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 설정
// ============================================================
const COMFYUI_URL = process.env.COMFYUI_URL || 'http://100.66.10.225:8188';
const SPRITES_DIR = path.resolve(__dirname, '..', '..', 'sandbox', 'originals');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'asset', 'sprites_ci');
const CSV_PATH = path.resolve(__dirname, '..', 'data', 'gen1-evo-lines.csv');
const WORKFLOW_PATH = path.resolve(__dirname, '..', 'asset', 'image_flux2_klein_image_edit_9b_distilled.json');
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5분
const DEFAULT_VARIANTS = 8; // 몬스터당 생성 장수
const DEFAULT_STEPS = 4;   // 샘플링 스텝 수 (높을수록 스타일 변환 강함, 원본: 4)
const DEFAULT_CFG = 1.0;    // CFG 강도 (높을수록 프롬프트 반영 강함, 원본: 1)

// ============================================================
// 브랜드별 CI 프롬프트 정의
// 각 회사의 시각적 아이덴티티를 텍스트로 표현
// ============================================================
const BRAND_CI_PROMPTS = {
  'OpenAI': {
    prompt: 'minimalist clean design, emerald green and white color scheme, sleek modern tech aesthetic, OpenAI style, soft gradients, professional corporate look',
    colors: '#10A37F #FFFFFF',
  },
  'Anthropic': {
    prompt: 'warm earthy tones, terracotta orange and cream color scheme, organic natural aesthetic, Anthropic style, warm brown accents, elegant minimalist design',
    colors: '#CC7843 #F2E0C8',
  },
  'Google DeepMind': {
    prompt: 'Google brand colors, blue red yellow green multicolor accents, clean material design aesthetic, vibrant primary colors, modern tech style',
    colors: '#4285F4 #EA4335 #FBBC04 #34A853',
  },
  'Stability AI': {
    prompt: 'purple and white color scheme, gradient purple tones, creative artistic aesthetic, Stability AI style, deep violet accents, modern generative art look',
    colors: '#7B61FF #FFFFFF',
  },
  'Upstage (Solar)': {
    prompt: 'bright solar orange and dark navy color scheme, sunrise gradient, energetic Korean tech aesthetic, warm golden highlights, bold modern design',
    colors: '#FF6B00 #1A1A2E',
  },
  'Meta AI': {
    prompt: 'Meta blue gradient, infinity loop inspired, blue and purple color scheme, modern social tech aesthetic, clean digital design, vibrant blue tones',
    colors: '#0064D2 #3700C8',
  },
  'Cohere': {
    prompt: 'teal green and soft purple color scheme, natural organic palette, coral and sage accents, Cohere style, calm professional aesthetic',
    colors: '#39594D #D18EE2',
  },
  'xAI': {
    prompt: 'bold black and red color scheme, high contrast, aggressive tech aesthetic, xAI Grok style, sharp edges, futuristic dark theme',
    colors: '#DC2828 #000000',
  },
  'Scale AI': {
    prompt: 'purple and electric blue color scheme, data-driven aesthetic, gradient purple to blue, Scale AI style, professional enterprise tech look',
    colors: '#7B2FFF #4A90D9',
  },
  'Mistral': {
    prompt: 'orange and black color scheme, bold Mistral AI branding, warm amber and golden tones, French tech elegance, striking orange gradients',
    colors: '#F58220 #FFC300',
  },
  'Amazon Bedrock': {
    prompt: 'Amazon orange and dark navy color scheme, corporate cloud aesthetic, warm orange on dark background, AWS Bedrock style, professional enterprise look',
    colors: '#FF9900 #232F3E',
  },
  'Tencent (Hunyuan)': {
    prompt: 'blue and white color scheme, Chinese tech corporate style, Tencent blue branding, clean modern aesthetic, digital technology look',
    colors: '#1DA1F2 #FFFFFF',
  },
  'Kakao Brain': {
    prompt: 'bright yellow and dark brown color scheme, Kakao style, warm friendly Korean aesthetic, cheerful golden tones, playful tech branding',
    colors: '#FEE500 #3C1E1E',
  },
  'Moonshot (Kimi)': {
    prompt: 'deep navy and silver moonlight color scheme, lunar aesthetic, dark blue with silver accents, mysterious night sky theme, elegant Chinese tech style',
    colors: '#1A1A3E #C0C0C0',
  },
  'Runway': {
    prompt: 'creative gradient, purple to pink color scheme, artistic runway aesthetic, bold creative technology look, vibrant gradient design',
    colors: '#8B5CF6 #EC4899',
  },
  'ElevenLabs': {
    prompt: 'black and electric green color scheme, audio waveform aesthetic, dark futuristic design, neon green on black, sleek modern tech style',
    colors: '#00FF88 #000000',
  },
  'ByteDance (Doubao)': {
    prompt: 'vibrant red and blue color scheme, TikTok/ByteDance aesthetic, energetic bold design, Chinese tech style, dynamic colorful branding',
    colors: '#FF0050 #00F2EA',
  },
  'Flux (BFL)': {
    prompt: 'dark slate and electric purple color scheme, generative AI aesthetic, deep dark tones with purple accents, Black Forest Labs style, atmospheric design',
    colors: '#6B21A8 #1E293B',
  },
  'LangChain': {
    prompt: 'green chain link theme, dark green and teal color scheme, developer tool aesthetic, LangChain style, connected nodes design, code-oriented look',
    colors: '#2E7D32 #1DE9B6',
  },
  'Perplexity': {
    prompt: 'teal and cyan color scheme, search and knowledge aesthetic, clean aqua gradients, Perplexity style, bright turquoise accents, modern search engine look',
    colors: '#20B2AA #14C3C8',
  },
  'Pinecone': {
    prompt: 'dark teal and white color scheme, vector database aesthetic, forest green tones, Pinecone style, clean data infrastructure look',
    colors: '#0A6B5C #FFFFFF',
  },
  'Jasper': {
    prompt: 'purple gradient color scheme, creative marketing aesthetic, bold violet and magenta tones, Jasper AI style, creative writing design',
    colors: '#8B5CF6 #D946EF',
  },
  'Minimax': {
    prompt: 'blue and orange color scheme, Chinese AI startup aesthetic, contrasting warm and cool tones, modern tech branding, dynamic design',
    colors: '#2563EB #F97316',
  },
  'Groq': {
    prompt: 'orange and black color scheme, blazing fast inference aesthetic, bold fiery orange, Groq style, high-performance chip design, dark background',
    colors: '#F97316 #000000',
  },
  'Brave Leo': {
    prompt: 'orange and white lion theme, brave browser aesthetic, warm sunset orange, Brave style, privacy-focused design, lion mane gradient',
    colors: '#FB542B #FFFFFF',
  },
  'Naver (HyperCLOVA)': {
    prompt: 'Naver green and white color scheme, Korean portal aesthetic, bright green corporate branding, clean modern design, HyperCLOVA style',
    colors: '#03C75A #FFFFFF',
  },
  'AI21 Labs': {
    prompt: 'deep blue and gold color scheme, futuristic AI lab aesthetic, navy blue with golden accents, AI21 style, sophisticated tech design',
    colors: '#1E3A5F #FFD700',
  },
  'Cerebras': {
    prompt: 'blue and white color scheme, wafer-scale chip aesthetic, corporate tech blue, Cerebras style, clean semiconductor design, professional look',
    colors: '#0066CC #FFFFFF',
  },
  'Together AI': {
    prompt: 'purple and blue gradient color scheme, collaborative AI aesthetic, vibrant purple to blue transition, Together AI style, community-driven design',
    colors: '#7C3AED #3B82F6',
  },
  'Sourcegraph (Cody)': {
    prompt: 'purple and orange color scheme, code intelligence aesthetic, Sourcegraph style, developer tool design, bright accent colors on dark background',
    colors: '#A112FF #FF5543',
  },
  'LG (EXAONE)': {
    prompt: 'LG red and white color scheme, Korean corporate aesthetic, bold magenta red, EXAONE AI style, premium electronics design, clean professional look',
    colors: '#A50034 #FFFFFF',
  },
  'Samsung (Gauss)': {
    prompt: 'Samsung blue and white color scheme, Korean tech giant aesthetic, deep blue corporate branding, Gauss AI style, premium modern design',
    colors: '#1428A0 #FFFFFF',
  },
  'Baidu (Ernie)': {
    prompt: 'Baidu blue and red color scheme, Chinese search engine aesthetic, bold blue with red paw accent, Ernie Bot style, modern Chinese tech design',
    colors: '#2319DC #DE0A22',
  },
  'SenseTime': {
    prompt: 'blue and gradient color scheme, Chinese AI vision aesthetic, deep tech blue, SenseTime style, computer vision design, futuristic surveillance look',
    colors: '#0055FF #00C2FF',
  },
  'Reka AI': {
    prompt: 'warm orange and dark color scheme, multimodal AI aesthetic, sunset orange tones, Reka style, innovative research lab design',
    colors: '#FF6B35 #1A1A1A',
  },
  'Twelve Labs': {
    prompt: 'dark purple and cyan color scheme, video AI aesthetic, neon accents on dark background, Twelve Labs style, video intelligence design',
    colors: '#6D28D9 #06B6D4',
  },
  'Hume AI': {
    prompt: 'soft pink and warm color scheme, emotional AI aesthetic, gentle empathetic tones, Hume style, human expression design, soft pastel palette',
    colors: '#F472B6 #FDF2F8',
  },
  'Weaviate': {
    prompt: 'green and dark color scheme, vector database aesthetic, bright lime green on dark, Weaviate style, geometric data design',
    colors: '#00E639 #1A1A2E',
  },
  'Codeium': {
    prompt: 'teal and green gradient color scheme, code completion aesthetic, bright emerald coding theme, Codeium style, developer tool design',
    colors: '#09B6A2 #00D4AA',
  },
  'Midjourney': {
    prompt: 'white and deep dark color scheme, artistic AI aesthetic, minimalist black and white with blue accent, Midjourney style, creative imagination design',
    colors: '#FFFFFF #0F0F19',
  },
  'Intel': {
    prompt: 'Intel blue and white color scheme, semiconductor aesthetic, classic tech blue, Intel style, chip architecture design, corporate blue gradient',
    colors: '#0071C5 #FFFFFF',
  },
  'Character.AI': {
    prompt: 'purple and blue gradient color scheme, conversational AI aesthetic, social chatbot design, Character.AI style, friendly interactive look',
    colors: '#8B5CF6 #6366F1',
  },
  'Weights & Biases': {
    prompt: 'yellow and dark color scheme, ML experiment tracking aesthetic, golden amber on dark background, W&B style, data visualization design',
    colors: '#FACC15 #1E1E1E',
  },
  'Inflection': {
    prompt: 'blue gradient color scheme, personal AI aesthetic, calm serene blue tones, Inflection Pi style, friendly approachable design',
    colors: '#3B82F6 #93C5FD',
  },
  'You.com': {
    prompt: 'purple and blue color scheme, AI search engine aesthetic, modern search design, You.com style, clean information layout',
    colors: '#7C3AED #2563EB',
  },
  '01.AI (Yi)': {
    prompt: 'orange and dark color scheme, Chinese AI startup aesthetic, bold warm orange, 01.AI style, innovative tech design, Yi model branding',
    colors: '#F97316 #18181B',
  },
  'Tabnine': {
    prompt: 'blue and dark color scheme, code completion aesthetic, deep blue developer tool design, Tabnine style, IDE integration look',
    colors: '#2563EB #0F172A',
  },
  'GitHub Copilot': {
    prompt: 'GitHub dark and blue color scheme, code assistant aesthetic, dark mode developer design, Copilot style, Octocat inspired, neon blue accents',
    colors: '#238636 #0D1117',
  },
  'PlayHT': {
    prompt: 'gradient pink to purple color scheme, voice AI aesthetic, audio generation design, PlayHT style, modern creative tool look',
    colors: '#EC4899 #8B5CF6',
  },
  'SambaNova': {
    prompt: 'red and dark color scheme, AI chip aesthetic, bold samba red on dark background, SambaNova style, enterprise AI infrastructure design',
    colors: '#DC2626 #1E1E1E',
  },
  'Sanctuary AI': {
    prompt: 'blue and silver color scheme, humanoid robot aesthetic, futuristic robotics design, Sanctuary AI style, metallic tones, embodied intelligence look',
    colors: '#60A5FA #C0C0C0',
  },
  'Hugging Face': {
    prompt: 'yellow and warm color scheme, friendly open-source aesthetic, cheerful golden hugging face emoji design, HuggingFace style, community warmth',
    colors: '#FFD21E #FF9D00',
  },
  'SK Telecom (A.)': {
    prompt: 'SK red and white color scheme, Korean telecom aesthetic, bold red corporate branding, A. AI assistant style, premium mobile design',
    colors: '#E60012 #FFFFFF',
  },
  'Aleph Alpha': {
    prompt: 'dark blue and gold color scheme, European AI aesthetic, sophisticated navy with golden accents, Aleph Alpha style, premium research design',
    colors: '#1E3A5F #C5A55A',
  },
  'Leonardo AI': {
    prompt: 'purple and creative color scheme, image generation aesthetic, artistic purple gradient, Leonardo AI style, renaissance meets tech design',
    colors: '#7C3AED #A855F7',
  },
  'Luma AI': {
    prompt: 'blue and white color scheme, 3D generation aesthetic, bright luminous design, Luma AI style, light and airy spatial computing look',
    colors: '#3B82F6 #E0F2FE',
  },
  'Zhipu AI (GLM)': {
    prompt: 'blue and dark color scheme, Chinese AI research aesthetic, deep tech blue, Zhipu GLM style, academic research design, knowledge graph look',
    colors: '#1D4ED8 #1E293B',
  },
  'Writer': {
    prompt: 'purple and white color scheme, enterprise AI writing aesthetic, clean modern purple, Writer style, professional content design',
    colors: '#7C3AED #FFFFFF',
  },
  'Cursor': {
    prompt: 'dark theme with blue accent color scheme, code editor aesthetic, sleek IDE design, Cursor style, developer-focused dark mode, neon blue highlights',
    colors: '#3B82F6 #0A0A0A',
  },
  'Suno': {
    prompt: 'gradient warm color scheme, music AI aesthetic, sunset orange to pink, Suno style, audio waveform design, creative music generation look',
    colors: '#F97316 #EC4899',
  },
  'Replit': {
    prompt: 'orange and dark color scheme, online IDE aesthetic, bold coding orange, Replit style, collaborative development design, cloud coding look',
    colors: '#F26522 #0D101E',
  },
  'iFlytek (Spark)': {
    prompt: 'blue and red spark color scheme, Chinese voice AI aesthetic, dynamic spark design, iFlytek style, voice recognition tech look',
    colors: '#2563EB #EF4444',
  },
  'Databricks': {
    prompt: 'red and white color scheme, data lakehouse aesthetic, bold Databricks red, enterprise data design, Apache Spark inspired look',
    colors: '#FF3621 #FFFFFF',
  },
  'Pika': {
    prompt: 'colorful gradient color scheme, video generation aesthetic, playful vibrant design, Pika style, creative video AI look, rainbow gradient',
    colors: '#8B5CF6 #EC4899 #F97316',
  },
  'Kling (Kuaishou)': {
    prompt: 'orange and dark color scheme, Chinese video AI aesthetic, Kuaishou style, bold warm orange, short video platform design',
    colors: '#FF6A00 #1A1A1A',
  },
  'Snowflake (Arctic)': {
    prompt: 'ice blue and white color scheme, arctic snowflake aesthetic, crystalline frozen design, Snowflake style, cold data warehouse look',
    colors: '#29B5E8 #FFFFFF',
  },
  'Ditto (Synthetic)': {
    prompt: 'pink and purple shape-shifting color scheme, synthetic data aesthetic, morphing gradient design, amorphous fluid look',
    colors: '#D946EF #A855F7',
  },
  'Ideogram': {
    prompt: 'black and white with colorful accent, typography AI aesthetic, clean modern design, Ideogram style, text-to-image generation look',
    colors: '#000000 #FF6B6B #4ECDC4',
  },
  'Figure AI': {
    prompt: 'dark and silver color scheme, humanoid robot aesthetic, sleek metallic design, Figure AI style, futuristic robotics look, premium tech',
    colors: '#1E1E1E #C0C0C0',
  },
  'Boston Dynamics': {
    prompt: 'yellow and dark color scheme, athletic robot aesthetic, industrial yellow on dark, Boston Dynamics style, mechanical engineering design',
    colors: '#FFC107 #212121',
  },
  'Udio': {
    prompt: 'dark and neon color scheme, music generation aesthetic, vibrant neon on dark background, Udio style, audio waveform design',
    colors: '#00FF88 #1A1A2E',
  },
  'Tesla (Optimus)': {
    prompt: 'red and silver color scheme, Tesla aesthetic, bold electric red with metallic silver, Optimus robot design, futuristic automotive tech look',
    colors: '#CC0000 #C0C0C0',
  },
  'Alibaba (Qwen)': {
    prompt: 'orange and white color scheme, Alibaba aesthetic, warm Chinese tech orange, Qwen AI style, e-commerce meets AI design',
    colors: '#FF6A00 #FFFFFF',
  },
  'Apple Intelligence': {
    prompt: 'gradient rainbow on dark color scheme, Apple aesthetic, smooth colorful gradient, premium minimalist design, Apple Intelligence style, Siri aurora',
    colors: '#6441FF #FF2D55 #32ADE6',
  },
  'AMD': {
    prompt: 'AMD green and dark color scheme, semiconductor aesthetic, bold Radeon green on black, AMD style, high-performance computing design',
    colors: '#00A651 #1A1A1A',
  },
  'Adobe Firefly': {
    prompt: 'red and dark color scheme, creative tool aesthetic, Adobe red with dark background, Firefly style, creative cloud design, artistic professional look',
    colors: '#FF0000 #1A1A1A',
  },
  'DeepSeek': {
    prompt: 'blue and purple gradient color scheme, Chinese AI research aesthetic, deep ocean blue to violet, DeepSeek style, deep learning exploration design',
    colors: '#4F46E5 #7C3AED',
  },
  'Nvidia': {
    prompt: 'Nvidia green and black color scheme, GPU aesthetic, bold neon green on dark background, Nvidia style, high-performance computing design, GeForce look',
    colors: '#76B900 #000000',
  },
  'IBM': {
    prompt: 'IBM blue and white color scheme, enterprise computing aesthetic, classic corporate blue, IBM style, mainframe heritage design, Watson AI look',
    colors: '#0530AD #FFFFFF',
  },
};

// ============================================================
// CSV 파서
// ============================================================
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
    return obj;
  });
}

// ============================================================
// 도감번호 → 브랜드 매핑 빌드
// ============================================================
function buildDexToBrandMap(csvData) {
  const map = new Map();
  for (const row of csvData) {
    const brand = row.assigned_brand;
    const members = row.members.split('/');
    for (const dexStr of members) {
      const dex = parseInt(dexStr, 10);
      map.set(dex, {
        brand,
        evoLine: row.evo_line_name,
        evoLineId: row.evo_line_id,
      });
    }
  }
  return map;
}

// ============================================================
// ComfyUI API 클라이언트
// ============================================================

async function uploadImage(imagePath, filename) {
  const imageBuffer = fs.readFileSync(imagePath);

  // FormData를 수동으로 구성 (Node.js 18+ fetch 호환)
  const boundary = '----ComfyUIBoundary' + Date.now();
  const CRLF = '\r\n';

  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="${filename}"`,
    'Content-Type: image/png',
    '',
  ].join(CRLF);

  const footer = `${CRLF}--${boundary}--${CRLF}`;

  const headerBuf = Buffer.from(header + CRLF, 'utf-8');
  const footerBuf = Buffer.from(footer, 'utf-8');
  const body = Buffer.concat([headerBuf, imageBuffer, footerBuf]);

  const resp = await fetch(`${COMFYUI_URL}/upload/image`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!resp.ok) {
    throw new Error(`이미지 업로드 실패 (${resp.status}): ${await resp.text()}`);
  }
  return await resp.json();
}

function buildWorkflow(baseWorkflow, inputImageName, promptText, seed, opts = {}) {
  const wf = JSON.parse(JSON.stringify(baseWorkflow));
  const steps = opts.steps ?? DEFAULT_STEPS;
  const cfg = opts.cfg ?? DEFAULT_CFG;

  // 입력 이미지 설정 (node 76)
  wf['76'].inputs.image = inputImageName;

  // 프롬프트 설정 (node 75:74)
  wf['75:74'].inputs.text = promptText;

  // 시드 설정 (node 75:73)
  wf['75:73'].inputs.noise_seed = seed ?? Math.floor(Math.random() * 1e15);

  // 스텝 수 (node 75:62 Flux2Scheduler) — 높을수록 스타일 변환 강함
  wf['75:62'].inputs.steps = steps;

  // CFG 강도 (node 75:63 CFGGuider) — 높을수록 프롬프트 반영 강함
  wf['75:63'].inputs.cfg = cfg;

  return wf;
}

async function queuePrompt(workflow) {
  const resp = await fetch(`${COMFYUI_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!resp.ok) {
    throw new Error(`워크플로 큐 실패 (${resp.status}): ${await resp.text()}`);
  }
  return await resp.json();
}

async function pollResult(promptId) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const resp = await fetch(`${COMFYUI_URL}/history/${promptId}`);
    if (!resp.ok) continue;

    const history = await resp.json();
    const entry = history[promptId];
    if (!entry) continue;

    if (entry.status?.status_str === 'error') {
      throw new Error(`생성 실패: ${JSON.stringify(entry.status)}`);
    }

    if (entry.outputs?.['9']?.images?.length > 0) {
      return entry.outputs['9'].images[0];
    }
  }
  throw new Error(`타임아웃: prompt ${promptId} 결과를 받지 못했습니다.`);
}

async function downloadImage(imageInfo, outputPath) {
  const params = new URLSearchParams({
    filename: imageInfo.filename,
    subfolder: imageInfo.subfolder || '',
    type: imageInfo.type || 'output',
  });

  const resp = await fetch(`${COMFYUI_URL}/view?${params}`);
  if (!resp.ok) {
    throw new Error(`이미지 다운로드 실패 (${resp.status})`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

// ============================================================
// 시스템 프롬프트 (공통 스타일 지시)
// ============================================================
const SYSTEM_PROMPT = [
  'Transform this monster sprite into a brand-themed redesign.',
  'Completely recolor and restyle the creature to match the target brand identity.',
  'Change the body colors, markings, patterns, and visual accents to reflect the brand palette.',
  'Add brand-inspired design elements: glowing effects, textures, or iconic shapes from the brand.',
  'Maintain the original monster silhouette and pose but make the visual style dramatically different.',
  'Pixel art style, 2D game sprite, clean edges, solid colors, white background, centered.',
].join(' ');

// ============================================================
// 프롬프트 생성
// ============================================================
function buildPromptForBrand(brand, dexNum) {
  const ci = BRAND_CI_PROMPTS[brand];
  const brandPrompt = ci
    ? ci.prompt
    : `${brand} brand style corporate colors`;
  return `${SYSTEM_PROMPT} Brand style: ${brandPrompt}`;
}

// ============================================================
// 메인 로직
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const seedArg = args.indexOf('--seed');
  const baseSeed = seedArg >= 0 ? parseInt(args[seedArg + 1], 10) : null;

  // 몬스터당 생성 장수
  const variantsIdx = args.indexOf('--variants');
  const numVariants = variantsIdx >= 0 ? parseInt(args[variantsIdx + 1], 10) : DEFAULT_VARIANTS;

  // 스타일 변환 강도 옵션
  const stepsIdx = args.indexOf('--steps');
  const steps = stepsIdx >= 0 ? parseInt(args[stepsIdx + 1], 10) : DEFAULT_STEPS;
  const cfgIdx = args.indexOf('--cfg');
  const cfg = cfgIdx >= 0 ? parseFloat(args[cfgIdx + 1]) : DEFAULT_CFG;

  // 필터 파싱
  let filterRange = null;
  let filterDex = null;
  let filterBrand = null;

  const rangeIdx = args.indexOf('--range');
  if (rangeIdx >= 0) {
    const [start, end] = args[rangeIdx + 1].split('-').map(Number);
    filterRange = { start, end };
  }

  const dexIdx = args.indexOf('--dex');
  if (dexIdx >= 0) filterDex = parseInt(args[dexIdx + 1], 10);

  const brandIdx = args.indexOf('--brand');
  if (brandIdx >= 0) filterBrand = args[brandIdx + 1];

  // CSV 로드
  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
  const csvData = parseCSV(csvText);
  const dexMap = buildDexToBrandMap(csvData);

  // 워크플로 로드
  const baseWorkflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf-8'));

  // 출력 디렉토리 생성
  if (!dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 대상 목록 생성
  const targets = [];
  for (let dex = 1; dex <= 151; dex++) {
    if (filterDex != null && dex !== filterDex) continue;
    if (filterRange && (dex < filterRange.start || dex > filterRange.end)) continue;

    const info = dexMap.get(dex);
    if (!info) continue;

    if (filterBrand && !info.brand.toLowerCase().includes(filterBrand.toLowerCase())) continue;

    const dexStr = String(dex).padStart(3, '0');
    const spritePath = path.join(SPRITES_DIR, `${dexStr}.png`);

    if (!fs.existsSync(spritePath)) {
      console.warn(`[SKIP] ${dexStr} - 스프라이트 파일 없음: ${spritePath}`);
      continue;
    }

    targets.push({
      dex,
      dexStr,
      brand: info.brand,
      evoLine: info.evoLine,
      spritePath,
    });
  }

  const totalJobs = targets.length * numVariants;
  console.log(`\n=== Modelmon 스프라이트 CI 재생성 ===`);
  console.log(`ComfyUI: ${COMFYUI_URL}`);
  console.log(`대상: ${targets.length}마리 × ${numVariants}장 = 총 ${totalJobs}장`);
  console.log(`스타일 강도: steps=${steps}, cfg=${cfg}\n`);

  if (dryRun) {
    console.log('--- DRY RUN (매핑만 출력) ---\n');
    for (const t of targets) {
      const prompt = buildPromptForBrand(t.brand, t.dex);
      console.log(`#${t.dexStr} ${t.evoLine} → ${t.brand} (${numVariants}장)`);
      console.log(`  프롬프트: ${prompt.substring(0, 80)}...`);
      console.log();
    }
    return;
  }

  // ComfyUI 연결 확인
  try {
    const resp = await fetch(`${COMFYUI_URL}/system_stats`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    console.log('[OK] ComfyUI 연결 성공\n');
  } catch (e) {
    console.error(`[ERROR] ComfyUI에 연결할 수 없습니다: ${COMFYUI_URL}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  // 순차 처리 (ComfyUI가 한 번에 하나씩 처리)
  let successCount = 0;
  let failCount = 0;
  let jobIndex = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];

    // 몬스터별 하위 디렉토리 생성
    const monsterDir = path.join(OUTPUT_DIR, t.dexStr);
    fs.mkdirSync(monsterDir, { recursive: true });

    // 이미 완료된 variant 확인
    const existingVariants = [];
    for (let v = 1; v <= numVariants; v++) {
      const vPath = path.join(monsterDir, `${t.dexStr}_s${v}.png`);
      if (fs.existsSync(vPath)) existingVariants.push(v);
    }

    if (existingVariants.length >= numVariants) {
      jobIndex += numVariants;
      console.log(`[${i + 1}/${targets.length}] #${t.dexStr} SKIP (${numVariants}장 모두 존재)`);
      successCount += numVariants;
      continue;
    }

    console.log(`[${i + 1}/${targets.length}] #${t.dexStr} ${t.evoLine} → ${t.brand}`);

    // 이미지 업로드 (몬스터당 1번)
    const uploadName = `modelmon_${t.dexStr}.png`;
    try {
      await uploadImage(t.spritePath, uploadName);
    } catch (e) {
      console.error(`  [FAIL] 업로드 실패: ${e.message}`);
      failCount += numVariants;
      jobIndex += numVariants;
      continue;
    }

    const promptText = buildPromptForBrand(t.brand, t.dex);

    // 각 variant 생성
    for (let v = 1; v <= numVariants; v++) {
      jobIndex++;
      const outputPath = path.join(monsterDir, `${t.dexStr}_s${v}.png`);

      // 이미 존재하면 건너뛰기
      if (existingVariants.includes(v)) {
        console.log(`  시드 ${v}/${numVariants} SKIP (이미 존재)`);
        successCount++;
        continue;
      }

      try {
        // 시드: baseSeed가 있으면 baseSeed + dex*100 + variant, 아니면 랜덤
        const seed = baseSeed != null
          ? baseSeed + t.dex * 100 + v
          : Math.floor(Math.random() * 1e15);

        const workflow = buildWorkflow(baseWorkflow, uploadName, promptText, seed, { steps, cfg });

        const { prompt_id } = await queuePrompt(workflow);
        process.stdout.write(`  시드 ${v}/${numVariants} (seed=${seed}) 생성중...`);

        const imageInfo = await pollResult(prompt_id);
        await downloadImage(imageInfo, outputPath);

        console.log(` OK [${jobIndex}/${totalJobs}]`);
        successCount++;
      } catch (e) {
        console.log(` FAIL`);
        console.error(`    ${e.message}`);
        failCount++;
      }
    }
  }

  console.log(`\n=== 완료 ===`);
  console.log(`성공: ${successCount}장, 실패: ${failCount}장`);
  console.log(`출력 디렉토리: ${OUTPUT_DIR}`);
  console.log(`구조: ${OUTPUT_DIR}/<도감번호>/<도감번호>_s1~s${numVariants}.png`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
