/**
 * Parse pagination params from query string with safe defaults.
 * @param {object} query - req.query
 * @returns {{ page: number, pageSize: number, offset: number }}
 */
function parsePagination(query) {
    let page = parseInt(query.page, 10);
    let pageSize = parseInt(query.pageSize, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 20;
    if (pageSize > 100) pageSize = 100;

    const offset = (page - 1) * pageSize;

    return { page, pageSize, offset };
}

/**
 * Build pagination metadata for response.
 * @param {number} totalCount
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ page, pageSize, totalCount, totalPages }}
 */
function paginationMeta(totalCount, page, pageSize) {
    return {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}

module.exports = { parsePagination, paginationMeta };
