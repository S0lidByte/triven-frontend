<script lang="ts">
    import type { ActionData, PageData } from "../../../routes/(protected)/settings/$types";
    import type { FormState } from "@sjsf/form";
    import { BasicForm } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "./form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import HelpCircle from "@lucide/svelte/icons/help-circle";
    import { get } from "svelte/store";
    import { page } from "$app/stores";
    import { getTabById } from "./sections";

    interface Props {
        formStore: { set: (f: FormState<any>) => void };
    }
    let { formStore }: Props = $props();

    setShadcnContext();

    const meta = createMeta<ActionData, PageData>().form;

    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result: { type: string }) => {
            if (result.type === "success") {
                const tabId = get(page).url.searchParams.get("tab") ?? "general";
                const tab = getTabById(tabId);
                if (tab?.restartRequired) {
                    toast.success("Settings saved. Some changes may take effect after restart.");
                } else {
                    toast.success("Settings saved");
                }
            } else {
                toast.error("Failed to save settings");
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving settings");
        }
    });

    $effect(() => {
        formStore.set(form);
    });

    function submitForm() {
        const formEl = document.querySelector(".settings-form form");
        (formEl as HTMLFormElement)?.requestSubmit();
    }
</script>

<style>
    .settings-form [data-slot="field-label"] {
        font-weight: 600;
    }

    .settings-form [data-slot="field-description"] {
        color: var(--color-muted-foreground);
        font-size: 0.8125rem;
        line-height: 1.4;
    }

    .settings-form [data-slot="input"],
    .settings-form [data-slot="textarea"],
    .settings-form [data-slot="select-trigger"] {
        min-height: 2.25rem;
    }

    .settings-form :focus-visible {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
    }
</style>

<Card.Root class="bg-card border-border shadow-sm">
    <Card.Header class="space-y-1.5 pb-4">
        <div class="flex items-center gap-2">
            <Card.Title class="text-lg font-semibold text-neutral-200">
                {$page.data.tabs.find((t: { id: string }) => t.id === $page.data.activeTabId)?.label ?? "Settings"}
            </Card.Title>
            <Tooltip.Root>
                <Tooltip.Trigger>
                    <HelpCircle
                        class="text-muted-foreground hover:text-foreground size-4 shrink-0 cursor-help"
                        aria-label="Help"
                    />
                </Tooltip.Trigger>
                <Tooltip.Content side="right" class="max-w-xs text-balance">
                    Edit values below and click Save to apply. Some options may require a restart.
                </Tooltip.Content>
            </Tooltip.Root>
        </div>
    </Card.Header>
    <Card.Content class="space-y-6">
        <BasicForm {form} method="POST" class="settings-form" />
    </Card.Content>
    <Card.Footer class="flex flex-row items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
        <Button type="button" onclick={submitForm}>
            Save changes
        </Button>
    </Card.Footer>
</Card.Root>
