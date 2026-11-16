export function GET() {
  return Response.json({ ok: true, app: "easy-pos", time: new Date().toISOString() });
}
