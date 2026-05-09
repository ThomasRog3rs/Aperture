export type UpdateBuildResult = {
  sql: string;
  params: Record<string, string | number | null>;
};

export function buildUpdateByIdSql(
  table: string,
  id: string,
  updates: Record<string, string | number | null | undefined>
): UpdateBuildResult | null {
  const entries = Object.entries(updates).filter(
    (entry): entry is [string, string | number | null] => entry[1] !== undefined
  );
  if (entries.length === 0) return null;

  const setClauses = entries.map(([key]) => `${key} = @${key}`).join(", ");
  const params = entries.reduce(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    { id } as Record<string, string | number | null>
  );

  return {
    sql: `UPDATE ${table} SET ${setClauses} WHERE id = @id`,
    params,
  };
}
