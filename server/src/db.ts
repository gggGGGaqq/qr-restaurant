import mysql, { PoolConnection } from "mysql2/promise";
import { config } from "./config";

export const pool = mysql.createPool({
  ...config.database,
  waitForConnections: true,
  decimalNumbers: true,
  timezone: "Z",
});

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function pingDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}
