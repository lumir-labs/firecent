import { ok } from "../_lib/api-response";

/**
 * Get API Info
 * @description Returns the API info (boilerplate health)
 * @tag Info
 * @openapi
 */
export async function GET() {
  return ok({
    service: "app",
    ok: true,
    time: new Date().toISOString(),
  });
}
