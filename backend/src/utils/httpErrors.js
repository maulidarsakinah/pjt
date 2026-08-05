function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message = "resource not found") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function conflict(message = "resource already exists") {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

module.exports = {
  badRequest,
  conflict,
  notFound,
};
