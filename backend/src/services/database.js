const db = require("../db");

async function withConnection(callback) {
  let connection;

  try {
    connection = await db.getConnection();
    return await callback(connection);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function withTransaction(callback) {
  return withConnection(async (connection) => {
    let shouldRollback = true;

    try {
      const result = await callback(connection);

      await connection.commit();
      shouldRollback = false;
      return result;
    } catch (error) {
      if (shouldRollback) {
        await connection.rollback();
      }

      throw error;
    }
  });
}

module.exports = {
  withConnection,
  withTransaction,
};
