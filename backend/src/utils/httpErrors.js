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

module.exports = {
  badRequest,
  notFound,
};
