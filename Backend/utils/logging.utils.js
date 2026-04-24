const MAX_STRING_LENGTH = 180;
const MAX_ARRAY_ITEMS = 8;
const MAX_OBJECT_KEYS = 12;
const MAX_TABLE_CELL_LENGTH = 36;

const truncateText = (value, maxLength = MAX_STRING_LENGTH) => {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const summarizeValue = (value, depth = 0) => {
  if (value == null) return value;

  if (typeof value === 'string') {
    return truncateText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((entry) => summarizeValue(entry, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`... +${value.length - MAX_ARRAY_ITEMS} more`);
    }
    return items;
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return `[Object keys:${Object.keys(value).length}]`;
    }

    const keys = Object.keys(value);
    const summary = {};

    keys.slice(0, MAX_OBJECT_KEYS).forEach((key) => {
      summary[key] = summarizeValue(value[key], depth + 1);
    });

    if (keys.length > MAX_OBJECT_KEYS) {
      summary.__truncated__ = `+${keys.length - MAX_OBJECT_KEYS} keys`;
    }

    return summary;
  }

  return String(value);
};

const safeJson = (value) => {
  try {
    return JSON.stringify(summarizeValue(value), null, 2);
  } catch (error) {
    return `[unserializable: ${error.message}]`;
  }
};

const padRight = (value, width) => `${value}${' '.repeat(Math.max(0, width - value.length))}`;

const normalizeTableRows = (rows) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        const rendered =
          value == null
            ? ''
            : typeof value === 'object'
              ? safeJson(value).replace(/\s+/g, ' ')
              : truncateText(value, MAX_TABLE_CELL_LENGTH);
        normalized[key] = rendered;
      });
      return normalized;
    });
};

const buildAsciiTable = (rows, { maxRows = 10 } = {}) => {
  const normalizedRows = normalizeTableRows(rows).slice(0, maxRows);
  if (normalizedRows.length === 0) return '';

  const columns = Array.from(
    normalizedRows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  if (columns.length === 0) return '';

  const widths = columns.map((column) => {
    const maxCellWidth = normalizedRows.reduce((width, row) => {
      const cell = truncateText(row[column] ?? '', MAX_TABLE_CELL_LENGTH);
      return Math.max(width, cell.length);
    }, column.length);

    return Math.min(Math.max(maxCellWidth, column.length), MAX_TABLE_CELL_LENGTH);
  });

  const separator = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const header = `|${columns
    .map((column, index) => ` ${padRight(column, widths[index])} `)
    .join('|')}|`;
  const body = normalizedRows.map((row) => {
    return `|${columns
      .map((column, index) => {
        const cell = truncateText(row[column] ?? '', widths[index]);
        return ` ${padRight(cell, widths[index])} `;
      })
      .join('|')}|`;
  });

  if (rows.length > maxRows) {
    body.push(
      `| ${padRight(`... ${rows.length - maxRows} more row(s)`, widths.reduce((sum, width) => sum + width + 3, -1))} |`
    );
  }

  return [separator, header, separator, ...body, separator].join('\n');
};

const buildKeyValueSummary = (summary = {}) => {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return summary == null ? '' : String(summary);
  }

  return Object.entries(summary)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? truncateText(safeJson(value), 100) : value}`)
    .join(' | ');
};

module.exports = {
  buildAsciiTable,
  buildKeyValueSummary,
  safeJson,
  summarizeValue,
  truncateText,
};
