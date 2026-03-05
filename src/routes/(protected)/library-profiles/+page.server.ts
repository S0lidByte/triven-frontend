import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler, type FormHandlerOptions } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";
import type { UiSchemaRoot } from "@sjsf/form";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("library-profiles-page-server");

/** The backend settings key for filesystem (which contains library_profiles). */
const PATHS = "filesystem";

async function getFilesystemSettings(
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
    if (res.error) {
        throw new Error("Failed to load filesystem settings");
    }
    return res.data as Record<string, unknown>;
}

async function getLibraryProfilesSchema(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/schema/keys", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { query: { keys: PATHS, title: "Library Profiles" } }
    });
    if (res.error) {
        throw new Error("Failed to load library profiles schema");
    }
    return res.data as Record<string, unknown>;
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
    if (locals.user?.role !== "admin") {
        error(403, "Forbidden");
    }

    logger.info("Library profiles page load started");

    let schema: Record<string, unknown>;
    let initialValue: Record<string, unknown>;

    try {
        [schema, initialValue] = await Promise.all([
            getLibraryProfilesSchema(locals.backendUrl, locals.apiKey, fetch),
            getFilesystemSettings(locals.backendUrl, locals.apiKey, fetch)
        ]);
    } catch (e) {
        logger.error("Library profiles page load failed", {
            error: e instanceof Error ? e.message : String(e)
        });
        error(503, "Failed to load library profiles from backend.");
    }

    /**
     * Narrow the schema to only expose the library_profiles field so the
     * SJSF form renders just that section (not all of FilesystemModel).
     */
    const fullProperties = (schema.properties ?? {}) as Record<string, unknown>;
    const narrowedSchema: Record<string, unknown> = {
        ...schema,
        title: "Library Profiles",
        properties: {
            library_profiles: fullProperties["library_profiles"]
        },
        required: []
    };

    const uiSchema: UiSchemaRoot = {
        "ui:order": ["library_profiles"]
    } as UiSchemaRoot;

    logger.info("Library profiles page load completed");

    return {
        form: {
            schema: narrowedSchema,
            initialValue: {
                library_profiles:
                    (initialValue["filesystem"] as Record<string, unknown> | undefined)?.[
                    "library_profiles"
                    ] ??
                    initialValue["library_profiles"] ??
                    {}
            },
            uiSchema
        } satisfies InitialFormData
    };
};

export const actions = {
    default: async ({ request, fetch, locals, url }) => {
        if (locals.user?.role !== "admin") {
            error(403, "Forbidden");
        }

        logger.info("Library profiles save started");

        // Build a narrowed schema matching what load() returned
        let fullSchema: Record<string, unknown>;
        try {
            fullSchema = await getLibraryProfilesSchema(locals.backendUrl, locals.apiKey, fetch);
        } catch (e) {
            logger.error("Failed to fetch schema for save", {
                error: e instanceof Error ? e.message : String(e)
            });
            error(503, "Failed to load schema from backend.");
        }

        const fullProperties = (fullSchema.properties ?? {}) as Record<string, unknown>;
        const narrowedSchema: Record<string, unknown> = {
            ...fullSchema,
            title: "Library Profiles",
            properties: { library_profiles: fullProperties["library_profiles"] },
            required: []
        };

        const uiSchema: UiSchemaRoot = { "ui:order": ["library_profiles"] } as UiSchemaRoot;

        const requestFormData = await request.formData();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleForm = createFormHandler<any, true>({
            ...defaults,
            schema: narrowedSchema,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            uiSchema: uiSchema as any,
            sendData: true
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as FormHandlerOptions<any, true>);

        const [form] = await handleForm(request.signal, requestFormData);
        if (!form.isValid) {
            logger.warn("Library profiles form validation failed");
            return fail(400, { form });
        }

        /**
         * We must merge the updated library_profiles back into the full
         * filesystem settings object to avoid resetting unrelated fields.
         */
        let currentFilesystem: Record<string, unknown>;
        try {
            const current = await getFilesystemSettings(locals.backendUrl, locals.apiKey, fetch);
            currentFilesystem = (current["filesystem"] ?? current) as Record<string, unknown>;
        } catch (e) {
            logger.error("Failed to fetch current filesystem settings for merge", {
                error: e instanceof Error ? e.message : String(e)
            });
            error(503, "Failed to load current settings for merge.");
        }

        const updatedData = form.data as Record<string, unknown>;
        const mergedFilesystem = {
            ...currentFilesystem,
            library_profiles: updatedData["library_profiles"]
        };

        const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
            body: { filesystem: mergedFilesystem },
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            params: { path: { paths: PATHS } }
        });

        if (res.error) {
            logger.error("Library profiles save failed");
            return fail(500, { form });
        }

        logger.info("Library profiles saved successfully");
        return { form };
    }
} satisfies Actions;
