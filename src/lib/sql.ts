/** Minimal SQL formatter: uppercases clause keywords and puts each on its own line */

const CLAUSE_KEYWORDS = [
  "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "FULL OUTER JOIN",
  "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "FULL JOIN",
  "UNION ALL", "UNION", "EXCEPT ALL", "EXCEPT", "INTERSECT ALL", "INTERSECT",
  "INSERT INTO", "ON DUPLICATE KEY UPDATE", "DELETE FROM",
  "CREATE TABLE", "ALTER TABLE", "DROP TABLE", "TRUNCATE TABLE",
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING",
  "LIMIT", "OFFSET", "VALUES", "UPDATE", "SET", "DELETE",
  "ON",
].sort((a, b) => b.length - a.length); // longest first to avoid partial matches

export function formatSQL(sql: string): string {
  let result = sql.trim();

  for (const kw of CLAUSE_KEYWORDS) {
    // Match keyword at word boundary, case-insensitive, surrounded by whitespace or start
    const re = new RegExp(`(?<=\\s|^|;)(${kw.replace(/ /g, "\\s+")})(?=\\s|$)`, "gi");
    result = result.replace(re, `\n${kw}`);
  }

  return result
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}
