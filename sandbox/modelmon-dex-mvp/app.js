const CSV_URL = "./data/modelmon-dex-001-009.csv";

const TYPE_COLORS = {
  대화: "#729f5a",
  기억: "#85bb74",
  검색: "#4f8c84",
  장문맥: "#7eac9f",
  에이전트: "#926edb",
  생성: "#ea6f55",
  실시간: "#f19c38",
  코드: "#405fcb",
  멀티모달: "#b763c8",
  프런티어: "#27313b",
  정렬: "#56a6a0",
  안정성: "#6cb6a8",
  도구사용: "#9e7e4a",
  인프라: "#6e7d8f"
};

const state = {
  entries: [],
  filteredEntries: [],
  selectedId: null
};

const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const stageFilter = document.getElementById("stage-filter");
const dexGrid = document.getElementById("dex-grid");
const detailPanel = document.getElementById("detail-panel");
const entryCount = document.getElementById("entry-count");
const conceptCount = document.getElementById("concept-count");
const outputCount = document.getElementById("output-count");
const cardTemplate = document.getElementById("card-template");
const embeddedCsv = document.getElementById("dex-csv");

initialize();

async function initialize() {
  try {
    const csvText = await loadCsvText();
    state.entries = parseCsv(csvText).map(normalizeEntry);
    state.selectedId = state.entries[0]?.modelmon_id ?? null;
    populateTypeOptions(state.entries);
    renderStats(state.entries);
    render();
    bindEvents();
  } catch (error) {
    dexGrid.innerHTML = `<div class="empty-state">도감 데이터를 불러오지 못했습니다.<br>${error.message}</div>`;
    detailPanel.innerHTML = `<p class="detail-empty">내장 CSV 또는 외부 CSV를 읽을 수 없는 상태입니다.</p>`;
  }
}

async function loadCsvText() {
  const inlineText = embeddedCsv?.textContent?.trim();
  if (inlineText) {
    return inlineText;
  }

  if (window.location.protocol === "file:") {
    throw new Error("file:// 환경에서는 내장 CSV가 필요합니다.");
  }

  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status}`);
  }
  return response.text();
}

function bindEvents() {
  searchInput.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  stageFilter.addEventListener("change", render);
}

function render() {
  state.filteredEntries = applyFilters(state.entries);
  renderGrid(state.filteredEntries);

  const selected = state.filteredEntries.find((entry) => entry.modelmon_id === state.selectedId)
    ?? state.filteredEntries[0]
    ?? null;

  state.selectedId = selected?.modelmon_id ?? null;
  renderDetail(selected);
}

function applyFilters(entries) {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedStage = stageFilter.value;

  return [...entries].filter((entry) => {
    const matchesQuery =
      !query ||
      [
        entry.dex_no,
        entry.name_ko,
        entry.name_en,
        entry.core_concept,
        entry.sub_concept,
        entry.input_mode,
        entry.output_mode,
        entry.model_params,
        entry.motif,
        entry.temperament,
        entry.flavor_text_ko
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    const matchesType =
      !selectedType ||
      entry.core_concept === selectedType ||
      entry.sub_concept === selectedType;

    const matchesStage = !selectedStage || entry.stage === selectedStage;

    return matchesQuery && matchesType && matchesStage;
  });
}

function renderStats(entries) {
  const concepts = new Set(entries.flatMap((entry) => [entry.core_concept, entry.sub_concept].filter(Boolean)));
  const outputs = new Set(entries.map((entry) => entry.output_mode));
  entryCount.textContent = String(entries.length).padStart(2, "0");
  conceptCount.textContent = String(concepts.size).padStart(2, "0");
  outputCount.textContent = String(outputs.size).padStart(2, "0");
}

function populateTypeOptions(entries) {
  const types = [...new Set(entries.flatMap((entry) => [entry.core_concept, entry.sub_concept].filter(Boolean)))];
  types.sort((a, b) => a.localeCompare(b));

  types.forEach((typeName) => {
    const option = document.createElement("option");
    option.value = typeName;
    option.textContent = typeName;
    typeFilter.append(option);
  });
}

function renderGrid(entries) {
  dexGrid.innerHTML = "";

  if (!entries.length) {
    dexGrid.innerHTML = `<div class="empty-state">현재 필터에 맞는 모델몬이 없습니다.</div>`;
    return;
  }

  entries.forEach((entry) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".card-button");
    const img = fragment.querySelector(".card-art");
    const dexNo = fragment.querySelector(".dex-no");
    const title = fragment.querySelector(".card-title");
    const subtitle = fragment.querySelector(".card-subtitle");
    const typeRow = fragment.querySelector(".type-row");

    if (entry.modelmon_id === state.selectedId) {
      button.classList.add("is-active");
    }

    button.addEventListener("click", () => {
      state.selectedId = entry.modelmon_id;
      render();
    });

    img.src = entry.image_path;
    img.alt = `${entry.name_ko} 이미지`;
    dexNo.textContent = `No. ${entry.dex_no}`;
    title.textContent = entry.name_ko;
    subtitle.textContent = `${entry.core_concept} · ${entry.sub_concept}`;
    typeRow.append(createTypeChip(entry.core_concept));

    if (entry.sub_concept) {
      typeRow.append(createTypeChip(entry.sub_concept));
    }

    dexGrid.append(fragment);
  });
}

function renderDetail(entry) {
  if (!entry) {
    detailPanel.innerHTML = `<p class="detail-empty">카드를 선택하면 도감 상세 정보가 표시됩니다.</p>`;
    return;
  }

  detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="detail-number">No. ${entry.dex_no}</p>
        <h2 class="detail-title">${entry.name_ko}<small>도감 샘플 엔트리</small></h2>
      </div>
      <div class="detail-stage">${entry.stage}단계</div>
    </div>
    <div class="detail-art-wrap">
      <img class="detail-art" src="${entry.image_path}" alt="${entry.name_ko} 이미지">
    </div>
    <section class="detail-section">
      <h3>AI 개념</h3>
      <div class="detail-type-row">
        ${renderTypeChipMarkup(entry.core_concept)}
        ${entry.sub_concept ? renderTypeChipMarkup(entry.sub_concept) : ""}
      </div>
    </section>
    <div class="detail-grid">
      <div class="info-card">
        <span>입력 방식</span>
        <strong>${entry.input_mode}</strong>
      </div>
      <div class="info-card">
        <span>출력 방식</span>
        <strong>${entry.output_mode}</strong>
      </div>
      <div class="info-card">
        <span>모델 파라미터</span>
        <strong>${entry.model_params}</strong>
      </div>
      <div class="info-card">
        <span>파일 크기</span>
        <strong>${entry.file_size_kb} KB</strong>
      </div>
      <div class="info-card">
        <span>모티프</span>
        <strong>${entry.motif}</strong>
      </div>
      <div class="info-card">
        <span>성향</span>
        <strong>${entry.temperament}</strong>
      </div>
    </div>
    <section class="detail-section">
      <h3>설명</h3>
      <p>${entry.flavor_text_ko}</p>
    </section>
  `;
}

function createTypeChip(typeName) {
  const chip = document.createElement("span");
  chip.className = "type-chip";
  chip.textContent = typeName;
  chip.style.background = TYPE_COLORS[typeName] ?? "#526257";
  return chip;
}

function renderTypeChipMarkup(typeName) {
  const color = TYPE_COLORS[typeName] ?? "#526257";
  return `<span class="type-chip" style="background:${color}">${typeName}</span>`;
}

function normalizeEntry(entry) {
  return entry;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (insideQuotes && nextChar === "\"") {
        value += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, idx) => [header, record[idx] ?? ""])));
}
