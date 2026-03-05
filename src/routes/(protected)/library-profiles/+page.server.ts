import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-profiles-page-server");
const PATHS = "filesystem";

async function fetchFilesystem(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to load filesystem settings");
    // Returns { filesystem: { mount_path, library_profiles, ... } }
    return (res.data as Record<string, unknown>)["filesystem"] as Record<string, unknown>;
}

async function saveFilesystem(
    baseUrl: string,
    apiKey: string,
    filesystemData: Record<string, unknown>,
    fetchFn: typeof globalThis.fetch
): Promise<void> {
    const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
        body: { filesystem: filesystemData },
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths: PATHS } }
    });
    if (res.error) throw new Error("Failed to save filesystem settings");
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
    if (locals.user?.role !== "admin") error(403, "Forbidden");

    logger.info("Library profiles load started");

    try {
        const filesystem = await fetchFilesystem(locals.backendUrl, locals.apiKey, fetch);
        const profiles = (filesystem["library_profiles"] ?? {}) as Record<string, unknown>;
        logger.info("Library profiles load completed", { count: Object.keys(profiles).length });
        return { profiles, filesystem };
    } catch (e) {
        logger.error("Library profiles load failed", {
            error: e instanceof Error ? e.message : String(e)
        });
        error(503, "Failed to load library profiles from backend.");
    }
};

export const actions = {
    save: async ({ request, fetch, locals }) => {
        if (locals.user?.role !== "admin") error(403, "Forbidden");

        const formData = await request.formData();
        const profilesJson = formData.get("profiles");
        if (!profilesJson || typeof profilesJson !== "string") {
            return fail(400, { error: "Missing profiles data" });
        }

        let profiles: Record<string, unknown>;
        try {
            profiles = JSON.parse(profilesJson);
        } catch {
            return fail(400, { error: "Invalid profiles JSON" });
        }

        try {
            // Fetch current filesystem to preserve all other fields (mount_path, cache, templates, etc.)
            const filesystem = await fetchFilesystem(locals.backendUrl, locals.apiKey, fetch);
            const merged = { ...filesystem, library_profiles: profiles };
            await saveFilesystem(locals.backendUrl, locals.apiKey, merged, fetch);
            logger.info("Library profiles saved", { count: Object.keys(profiles).length });
            return { success: true };
        } catch (e) {
            logger.error("Library profiles save failed", {
                error: e instanceof Error ? e.message : String(e)
            });
            return fail(500, { error: "Failed to save library profiles" });
        }
    }
} satisfies Actions;
