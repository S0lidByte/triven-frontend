import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("legacy-redirect");

export const GET: RequestHandler = ({ url }) => {
    logger.warn(`Unknown legacy route hit: ${url.pathname}`);
    error(404, "Page not found");
};
