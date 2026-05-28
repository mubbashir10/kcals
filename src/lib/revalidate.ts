import { revalidatePath } from "next/cache";

// Revalidate the surfaces that show diary data after a mutation. `extra` adds
// page-specific paths (e.g. "/weight", "/diary"). Must be called from a Server
// Action or route handler.
export function revalidateDiary(...extra: string[]) {
  revalidatePath("/");
  revalidatePath("/day/[date]", "page");
  revalidatePath("/calendar");
  for (const path of extra) revalidatePath(path);
}
