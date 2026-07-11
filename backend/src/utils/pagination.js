const { badRequest } = require("./httpErrors");

function parsePagination(query, { defaultLimit = 100, maxLimit = 500 } = {}) {
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw badRequest(`limit must be an integer between 1 and ${maxLimit}`);
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw badRequest("offset must be an integer greater than or equal to 0");
  }

  return {
    limit,
    offset,
    pageEnd: offset + limit + 1,
  };
}

function buildListResponse(rows, pagination) {
  const data = rows.slice(0, pagination.limit);
  const hasMore = rows.length > pagination.limit;

  return {
    data,
    count: data.length,
    limit: pagination.limit,
    offset: pagination.offset,
    has_more: hasMore,
  };
}

module.exports = {
  buildListResponse,
  parsePagination,
};
