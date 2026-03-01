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

function createFetchWithTimeout(timeoutMs: number = SETTINGS_FETCH_TIMEOUT_MS): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
    };
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

    const fetchWithTimeout = createFetchWithTimeout();

    let schema: Record<string, unknown>;
    let initialValue: Record<string, unknown>;

    try {
        [schema, initialValue] = (await Promise.all([
            getSchemaForKeys(locals.backendUrl, locals.apiKey, keys, fetchWithTimeout),
            getSettingsForPaths(locals.backendUrl, locals.apiKey, paths, fetchWithTimeout)
        ])) as [Record<string, unknown>, Record<string, unknown>];
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("abort")) {
            error(504, "Settings request timed out. Is the backend running and reachable?");
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
