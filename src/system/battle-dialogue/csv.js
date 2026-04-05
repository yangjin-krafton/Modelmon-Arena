export function parseCsv(text) {
  const lines = String(text)
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

export async function loadCsv(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${url} (${response.status})`);
  }

  return parseCsv(await response.text());
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export function stringifyCsv(rows, headers = null) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (!normalizedRows.length && !headers) {
    return "";
  }

  const headerList = headers || Object.keys(normalizedRows[0] || {});
  const lines = [headerList.map(escapeCsvCell).join(",")];

  for (const row of normalizedRows) {
    lines.push(headerList.map((header) => escapeCsvCell(row?.[header] ?? "")).join(","));
  }

  return lines.join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
