export async function getActiveTrack() {
  const result = await db
    .select()
    .from(tracks)
    .where(eq(tracks.isActive, true))
    .limit(1);

  return result[0] ?? null;
}
