/**
 * IST date/time utilities.
 * IST = UTC + 5:30
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Get current IST Date object.
 */
function nowIST() {
    const utc = new Date();
    return new Date(utc.getTime() + IST_OFFSET_MS);
}

/**
 * Get start of today in IST as a UTC Date (for SQL comparisons).
 * e.g. if IST is 2024-02-10 14:30, returns UTC representation of 2024-02-10 00:00 IST
 */
function startOfTodayIST() {
    const ist = nowIST();
    const dateStr = ist.toISOString().slice(0, 10); // YYYY-MM-DD
    // Start of day in IST = dateStr 00:00:00 IST = dateStr - 5:30 UTC
    return new Date(`${dateStr}T00:00:00+05:30`);
}

/**
 * Get end of today in IST as a UTC Date.
 */
function endOfTodayIST() {
    const ist = nowIST();
    const dateStr = ist.toISOString().slice(0, 10);
    return new Date(`${dateStr}T23:59:59.999+05:30`);
}

/**
 * Get a date N days ago from today IST start.
 */
function daysAgoIST(n) {
    const start = startOfTodayIST();
    return new Date(start.getTime() - n * 24 * 60 * 60 * 1000);
}

module.exports = { nowIST, startOfTodayIST, endOfTodayIST, daysAgoIST };
