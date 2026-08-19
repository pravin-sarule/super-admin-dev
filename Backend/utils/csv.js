/**
 * Minimal RFC 4180 CSV serializer.
 *
 * There is no CSV dependency in this project (no json2csv / papaparse) and none is added
 * for this. Mirrors the frontend helper in features/jurinex-voice/components/voiceCallUtils.js,
 * hardened with three things it lacks:
 *   - a UTF-8 BOM, or Excel mangles the ₹ symbol
 *   - CRLF line endings, per RFC 4180
 *   - a formula-injection guard: values beginning = + - @ are prefixed with an apostrophe.
 *     user_name and error_message are attacker-influenced strings that finance users open
 *     in Excel, where a leading '=' would execute.
 */
const CSV_BOM = '﻿';

function csvEscape(value) {
    if (value === null || value === undefined) return '';

    let s;
    if (Array.isArray(value)) s = value.join('; ');
    else if (value instanceof Date) s = value.toISOString();
    else if (typeof value === 'object') s = JSON.stringify(value);
    else s = String(value);

    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;

    return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(values) {
    return values.map(csvEscape).join(',') + '\r\n';
}

function csvHeader(columns) {
    return csvLine(columns.map((c) => c.header));
}

function csvRow(columns, row) {
    return csvLine(columns.map((c) => (c.get ? c.get(row) : row[c.key])));
}

module.exports = { CSV_BOM, csvEscape, csvLine, csvHeader, csvRow };
