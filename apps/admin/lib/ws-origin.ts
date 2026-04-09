/** Socket.IO connects to API origin (no `/v1` path). */
export function wsOrigin(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";
  try {
    return new URL(api).origin;
  } catch {
    return "http://localhost:3000";
  }
}
