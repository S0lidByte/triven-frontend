<script lang="ts">
    import type { ActionData, PageData } from "./$types";
    import { BasicForm } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "$lib/components/settings/form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import PageShell from "$lib/components/page-shell.svelte";
    import * as Card from "$lib/components/ui/card/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { HelpCircle } from "lucide-svelte";
    import { cn } from "$lib/utils";
    setShadcnContext();

    const meta = createMeta<ActionData, PageData>().form;

    // @ts-expect-error - Schema is provided by page data
    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result) => {
            if (result.type === "success") {
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving settings");
        }
    });

    let cardRef: HTMLDivElement | null = null;
    function submitSettingsForm() {
        const formEl = cardRef?.querySelector("form");
        formEl?.requestSubmit();
    }
</script>

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

<PageShell class="h-full">
    <!-- Cognitive layout: identity → purpose → actions -->
    <header class="mb-4 md:mb-6" role="banner">
        <p class="text-muted-foreground text-sm font-medium">Admin</p>
        <h1 class="mt-1 text-3xl font-bold tracking-tight text-neutral-50">Settings</h1>
        <p class="mt-2 max-w-2xl text-neutral-400">
            Configure Riven backend. Sections are ordered: general → filesystem → downloaders → content → scraping → infra.
            Save at the bottom to apply; some changes may need a restart.
        </p>
    </header>

    <Separator class="mb-6 md:mb-8" />

    <Card.Root bind:ref={cardRef} class={cn("bg-card border-border shadow-sm", "max-w-4xl")}>
        <Card.Header class="space-y-1.5 pb-4">
            <div class="flex items-center gap-2">
                <Card.Title class="text-lg font-semibold text-neutral-200">All settings</Card.Title>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <HelpCircle
                            class="text-muted-foreground hover:text-foreground size-4 shrink-0 cursor-help"
                            aria-label="Help"
                        />
                    </Tooltip.Trigger>
                    <Tooltip.Content side="right" class="max-w-xs text-balance">
                        Field descriptions come from the backend schema and appear below each control.
                        Expand a section to edit; use Save at the bottom to apply changes.
                    </Tooltip.Content>
                </Tooltip.Root>
            </div>
            <Card.Description class="text-neutral-500">
                Edit values below and click Save to apply. Some options may require a service restart.
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
            <BasicForm {form} method="POST" class="settings-form" />
        </Card.Content>
        <Card.Footer class="flex flex-row items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
            <Button type="button" onclick={submitSettingsForm}>
                Save settings
            </Button>
        </Card.Footer>
    </Card.Root>
</PageShell>
