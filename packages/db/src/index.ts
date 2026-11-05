export { db } from "./client";
// Types only: safe to import without dragging `pg` to the client
export type * from "../prisma/generated/client/client";
