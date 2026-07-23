const { badRequest } = require("./httpErrors");

function parsePositiveInteger(value, field = "id") {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw badRequest(`${field} must be a positive integer`);
  }

  return number;
}

function parseLimit(value, { defaultLimit = 100, maxLimit = 500 } = {}) {
  if (value === undefined) {
    return defaultLimit;
  }

  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw badRequest(`limit must be an integer between 1 and ${maxLimit}`);
  }

  return limit;
}

function optionalString(value, field, maxLength = 255) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest(`${field} must be a string or null`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or less`);
  }

  return trimmed;
}

function requiredString(value, field, maxLength = 255) {
  const string = optionalString(value, field, maxLength);

  if (!string) {
    throw badRequest(`${field} is required`);
  }

  return string;
}

module.exports = {
  optionalString,
  parseLimit,
  parsePositiveInteger,
  requiredString,
};
