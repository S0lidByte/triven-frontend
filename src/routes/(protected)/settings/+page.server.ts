import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler, type FormHandlerOptions } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";
import type { UiSchemaRoot } from "@sjsf/form";
import { DEFAULT_TAB_ID, getPathsForTab, getTabById, SETTINGS_TABS } from "$lib/components/settings/sections";

function buildSettingsUiSchema(properties: Record<string, unknown>, keys: string[]): UiSchemaRoot {
    const order = keys.filter((k) => properties[k] !== undefined);
    const ui: Record<string, unknown> = {
        "ui:order": order.length > 0 ? order : undefined
    };
    if (keys.includes("api_key")) {
        ui["api_key"] = { "ui:components": { textWidget: "apiKeyWidget" } };
    }
    return ui as UiSchemaRoot;
}

async function getSchemaForKeys(
    baseUrl: string,
    apiKey: string,
    keys: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/schema/keys", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { query: { keys, title: "Settings" } }
    });
    if (res.error) {
        throw new Error("Failed to load settings schema");
    }
    return res.data as Record<string, unknown>;
}

async function getSettingsForPaths(
    baseUrl: string,
    apiKey: string,
    paths: string,
    fetchFn: typeof globalThis.fetch
): Promise<Record<string, unknown>> {
    const res = await providers.riven.GET("/api/v1/settings/get/{paths}", {
        baseUrl,
        headers: { "x-api-key": apiKey },
        fetch: fetchFn,
        params: { path: { paths } }
    });
    if (res.error) {
        throw new Error("Failed to load settings");
    }
    return res.data as Record<string, unknown>;
}

const SETTINGS_FETCH_TIMEOUT_MS = 20_000;
const SETTINGS_FETCH_RETRY_TIMEOUT_MS = 60_000;
const SETTINGS_FETCH_MAX_ATTEMPTS = 2;

class SettingsFetchTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Settings fetch timed out after ${timeoutMs}ms`);
        this.name = "SettingsFetchTimeoutError";
    }
}

function mergeAbortSignals(
    primary: AbortSignal,
    secondary: AbortSignal | null | undefined
): AbortSignal {
    if (!secondary) return primary;

    const controller = new AbortController();
    const abortFrom = (signal: AbortSignal) => {
        try {
            const signalWithReason = signal as AbortSignal & { reason?: unknown };
            controller.abort(signalWithReason.reason);
        } catch {
            controller.abort();
        }
    };

    if (primary.aborted) {
        abortFrom(primary);
        return controller.signal;
    }

    if (secondary.aborted) {
        abortFrom(secondary);
        return controller.signal;
    }

    primary.addEventListener("abort", () => abortFrom(primary), { once: true });
    secondary.addEventListener("abort", () => abortFrom(secondary), { once: true });
    return controller.signal;
}

function createFetchWithTimeout(timeoutMs: number = SETTINGS_FETCH_TIMEOUT_MS): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
        const timeoutController = new AbortController();
        let didTimeout = false;
        const id = setTimeout(() => {
            didTimeout = true;
            timeoutController.abort();
        }, timeoutMs);

        try {
            const signal = mergeAbortSignals(timeoutController.signal, init?.signal);
            return await fetch(input, { ...init, signal });
        } catch (e) {
            if (didTimeout) {
                throw new SettingsFetchTimeoutError(timeoutMs);
            }
            throw e;
        } finally {
            clearTimeout(id);
        }
    };
}

function isTimeoutError(e: unknown): boolean {
    if (e instanceof SettingsFetchTimeoutError) return true;
    const message = e instanceof Error ? e.message : String(e);
    const normalized = message.toLowerCase();
    return normalized.includes("timeout") || normalized.includes("timed out");
}

async function loadSettingsDataWithRetry(
    backendUrl: string,
    apiKey: string,
    keys: string,
    paths: string
): Promise<[Record<string, unknown>, Record<string, unknown>]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= SETTINGS_FETCH_MAX_ATTEMPTS; attempt++) {
        const timeoutMs =
            attempt === 1 ? SETTINGS_FETCH_TIMEOUT_MS : SETTINGS_FETCH_RETRY_TIMEOUT_MS;
        const fetchWithTimeout = createFetchWithTimeout(timeoutMs);

        try {
            return (await Promise.all([
                getSchemaForKeys(backendUrl, apiKey, keys, fetchWithTimeout),
                getSettingsForPaths(backendUrl, apiKey, paths, fetchWithTimeout)
            ])) as [Record<string, unknown>, Record<string, unknown>];
        } catch (e) {
            lastError = e;
            if (!isTimeoutError(e) || attempt === SETTINGS_FETCH_MAX_ATTEMPTS) {
                break;
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const load: PageServerLoad = async ({
    fetch,
    locals,
    url
}: {
    fetch: typeof globalThis.fetch;
    locals: App.Locals;
    url: URL;
}) => {
    if (locals.user?.role !== "admin") {
        error(403, "Forbidden");
    }

    const tabId = url.searchParams.get("tab") ?? DEFAULT_TAB_ID;
    const tab = getTabById(tabId) ?? getTabById(DEFAULT_TAB_ID)!;
    const paths = getPathsForTab(tab);
    const keys = paths;

    let schema: Record<string, unknown>;
    let initialValue: Record<string, unknown>;

    try {
        [schema, initialValue] = await loadSettingsDataWithRetry(
            locals.backendUrl,
            locals.apiKey,
            keys,
            paths
        );
    } catch (e) {
        if (isTimeoutError(e)) {
            error(
                504,
                "Settings request timed out after retry. Backend may be slow or temporarily unreachable."
            );
        }
        throw e;
    }

    const props = (schema.properties ?? {}) as Record<string, unknown>;
    const uiSchema = buildSettingsUiSchema(props, tab.keys) as unknown as UiSchemaRoot;

    return {
        tabs: SETTINGS_TABS,
        activeTabId: tab.id,
        paths,
        form: {
            schema,
            initialValue,
            uiSchema
        } satisfies InitialFormData
    };
};

export const actions = {
    default: async ({
        request,
        fetch,
        locals,
        url
    }: {
        request: Request;
        fetch: typeof globalThis.fetch;
        locals: App.Locals;
        url: URL;
    }) => {
        if (locals.user?.role !== "admin") {
            error(403, "Forbidden");
        }

        const tabId = url.searchParams.get("tab") ?? DEFAULT_TAB_ID;
        const tab = getTabById(tabId) ?? getTabById(DEFAULT_TAB_ID)!;
        const paths = getPathsForTab(tab);

        const schema = await getSchemaForKeys(
            locals.backendUrl,
            locals.apiKey,
            paths,
            fetch
        );
        const uiSchema = buildSettingsUiSchema(
            (schema.properties ?? {}) as Record<string, unknown>,
            tab.keys
        );

        const handleForm = createFormHandler<any, true>({
            ...defaults,
            schema,
            uiSchema: uiSchema as any,
            sendData: true
        } as FormHandlerOptions<any, true>);

        const [form] = await handleForm(request.signal, await request.formData());
        if (!form.isValid) {
            return fail(400, { form });
        }

        const res = await providers.riven.POST("/api/v1/settings/set/{paths}", {
            body: form.data as Record<string, unknown>,
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            params: { path: { paths } }
        });

        if (res.error) {
            return fail(500, { form });
        }

        return { form };
    }
} satisfies Actions;
