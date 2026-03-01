import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";
import type { UiSchemaRoot } from "@sjsf/form";

/** Human-readable section titles and display order for cognitive layout (general → core services → infra). */
const SECTION_ORDER_AND_TITLES: [string, string][] = [
    ["version", "Application version"],
    ["api_key", "API key"],
    ["log_level", "Log level"],
    ["enable_network_tracing", "Network tracing"],
    ["enable_stream_tracing", "Stream tracing"],
    ["retry_interval", "Retry interval"],
    ["tracemalloc", "Memory tracking (debug)"],
    ["filesystem", "Filesystem & VFS"],
    ["updaters", "Library updaters (Plex, Jellyfin, Emby)"],
    ["downloaders", "Downloaders (Real-Debrid, AllDebrid, etc.)"],
    ["content", "Content lists (Trakt, Overseerr, Mdblist, etc.)"],
    ["scraping", "Scraping"],
    ["ranking", "Ranking"],
    ["indexer", "Indexer"],
    ["database", "Database"],
    ["notifications", "Notifications"],
    ["post_processing", "Post-processing"],
    ["logging", "Logging"],
    ["stream", "Streaming"]
];

function buildSettingsUiSchema(properties: Record<string, unknown>): UiSchemaRoot {
    const order = SECTION_ORDER_AND_TITLES.map(([key]) => key).filter((k) => properties[k] !== undefined);
    return {
        "ui:order": order.length > 0 ? order : undefined
    };
}

function applySectionTitles(schema: Record<string, unknown>): Record<string, unknown> {
    const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!props) return schema;
    const out = { ...schema, properties: { ...props } };
    for (const [key, title] of SECTION_ORDER_AND_TITLES) {
        if (out.properties[key]) {
            (out.properties as Record<string, Record<string, unknown>>)[key] = {
                ...(out.properties as Record<string, Record<string, unknown>>)[key],
                title: (out.properties as Record<string, Record<string, unknown>>)[key].title ?? title
            };
        }
    }
    return out;
}

async function getSchemaAndUiSchema(
    baseUrl: string,
    apiKey: string,
    fetch: typeof globalThis.fetch
): Promise<{ schema: Record<string, unknown>; uiSchema: UiSchemaRoot }> {
    const res = await providers.riven.GET("/api/v1/settings/schema", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch
    });
    if (res.error) {
        throw new Error("Failed to load settings schema");
    }
    const raw = res.data as Record<string, unknown>;
    const schema = applySectionTitles(raw);
    const uiSchema = buildSettingsUiSchema((schema.properties as Record<string, unknown>) ?? {});
    return { schema, uiSchema };
}

const SETTINGS_FETCH_TIMEOUT_MS = 20_000;

function createFetchWithTimeout(timeoutMs: number = SETTINGS_FETCH_TIMEOUT_MS): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
    };
}

export const load: PageServerLoad = async ({ fetch, locals }: { fetch: typeof globalThis.fetch; locals: App.Locals }) => {
    if (locals.user?.role !== "admin") {
        error(403, "Forbidden");
    }

    const fetchWithTimeout = createFetchWithTimeout();

    let allSettings: Awaited<ReturnType<typeof providers.riven.GET>>;
    let schemaPayload: { schema: Record<string, unknown>; uiSchema: UiSchemaRoot };

    try {
        [allSettings, schemaPayload] = await Promise.all([
            providers.riven.GET("/api/v1/settings/get/all", {
                baseUrl: locals.backendUrl,
                headers: { "x-api-key": locals.apiKey },
                fetch: fetchWithTimeout
            }),
            getSchemaAndUiSchema(locals.backendUrl, locals.apiKey, fetchWithTimeout)
        ]);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("abort")) {
            error(504, "Settings request timed out. Is the backend running and reachable?");
        }
        throw e;
    }

    if (allSettings.error) {
        error(500, "Failed to load settings");
    }

    return {
        form: {
            schema: schemaPayload.schema,
            initialValue: allSettings.data,
            uiSchema: schemaPayload.uiSchema
        } satisfies InitialFormData
    };
};

export const actions = {
    default: async ({ request, fetch, locals }: { request: Request; fetch: typeof globalThis.fetch; locals: App.Locals }) => {
        if (locals.user?.role !== "admin") {
            error(403, "Forbidden");
        }

        const { schema, uiSchema } = await getSchemaAndUiSchema(locals.backendUrl, locals.apiKey, fetch);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleForm = createFormHandler<any, true>({
            ...defaults,
            schema,
            uiSchema,
            sendData: true
        });

        const [form] = await handleForm(request.signal, await request.formData());
        if (!form.isValid) {
            return fail(400, { form });
        }

        // const res = await setAllSettings({
        //     fetch: fetch,
        //     body: form.data
        // });
        const res = await providers.riven.POST("/api/v1/settings/set/all", {
            body: form.data,
            baseUrl: locals.backendUrl,
            headers: {
                "x-api-key": locals.apiKey
            },
            fetch: fetch
        });

        if (res.error) {
            return fail(500, { form });
        }

        return { form };
    }
} satisfies Actions;
