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
    import {
        AlertDialog,
        AlertDialogAction,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle
    } from "$lib/components/ui/alert-dialog/index.js";
    import HelpCircle from "@lucide/svelte/icons/help-circle";
    import { cn } from "$lib/utils";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { page } from "$app/stores";
    import { getTabById } from "$lib/components/settings/sections";

    setShadcnContext();

    const meta = createMeta<ActionData, PageData>().form;

    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result) => {
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

    let cardRef: HTMLDivElement | null = null;
    let tabSwitchTarget: string | null = null;
    let showDiscardConfirm = $state(false);

    function submitSettingsForm() {
        const formEl = cardRef?.querySelector("form");
        formEl?.requestSubmit();
    }

    function handleTabClick(tabId: string) {
        if (tabId === $page.data.activeTabId) return;
        if (form.isChanged) {
            tabSwitchTarget = tabId;
            showDiscardConfirm = true;
        } else {
            goto(`/settings?tab=${tabId}`);
        }
    }

    function confirmDiscardAndSwitch() {
        if (tabSwitchTarget) {
            form.reset();
            goto(`/settings?tab=${tabSwitchTarget}`);
            tabSwitchTarget = null;
        }
        showDiscardConfirm = false;
    }

    function cancelTabSwitch() {
        tabSwitchTarget = null;
        showDiscardConfirm = false;
    }

    /** Form store exposes isChanged (not isDirty) - use for save bar and tab-switch guard */
    const isDirty = $derived(form.isChanged);
</script>

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

<style>
    /* Typography and a11y polish for settings form */
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

<PageShell class="h-full">
    <Tooltip.Provider>
        <div class="mx-auto max-w-5xl px-4 md:px-6">
            <header class="mb-4 flex flex-col gap-2 md:mb-6 md:flex-row md:items-start md:justify-between">
                <div>
                    <p class="text-muted-foreground text-sm font-medium">Admin</p>
                    <h1 class="mt-1 text-3xl font-bold tracking-tight text-neutral-50">Settings</h1>
                    <p class="mt-2 max-w-2xl text-neutral-400">
                        Configure Riven backend. Use tabs to switch sections. Save changes when done.
                    </p>
                </div>
                <Button
                    type="button"
                    class="mt-2 shrink-0 md:mt-0"
                    onclick={submitSettingsForm}
                    disabled={!isDirty}>
                    Save changes
                </Button>
            </header>

            <Separator class="mb-6 md:mb-8" />

            <div class="flex flex-col gap-6 lg:flex-row lg:gap-8">
                <!-- Left: tab nav -->
                <nav
                    class="flex shrink-0 flex-row flex-wrap gap-1 lg:flex-col lg:flex-nowrap lg:gap-0.5"
                    aria-label="Settings sections">
                    {#each $page.data.tabs as tab}
                        <button
                            type="button"
                            class={cn(
                                "flex items-center gap-1.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                                $page.data.activeTabId === tab.id
                                    ? "bg-muted text-foreground"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                            onclick={() => handleTabClick(tab.id)}
                            aria-current={$page.data.activeTabId === tab.id ? "true" : undefined}>
                            <span>{tab.label}</span>
                            {#if tab.restartRequired}
                                <span
                                    class="bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                    title="Changes require restart">Restart</span>
                            {/if}
                        </button>
                    {/each}
                </nav>

                <!-- Right: form -->
                <div class="min-w-0 flex-1">
                    <Card.Root bind:ref={cardRef} class={cn("bg-card border-border shadow-sm")}>
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
                            <Button type="button" onclick={submitSettingsForm}>
                                Save changes
                            </Button>
                        </Card.Footer>
                    </Card.Root>
                </div>
            </div>

            <!-- Sticky save bar when dirty -->
            {#if isDirty}
                <div
                    class="border-border bg-card fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 border-t px-4 py-3 shadow-lg md:left-auto md:right-4 md:bottom-4 md:max-w-md md:rounded-lg md:border md:shadow-xl"
                    role="status"
                    aria-live="polite">
                    <span class="text-sm text-muted-foreground">You have unsaved changes</span>
                    <div class="flex gap-2">
                        <Button variant="outline" size="sm" onclick={() => form.reset()}>
                            Discard
                        </Button>
                        <Button size="sm" onclick={submitSettingsForm}>
                            Save changes
                        </Button>
                    </div>
                </div>
            {/if}
        </div>

        <AlertDialog bind:open={showDiscardConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Discard and switch tabs?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onclick={cancelTabSwitch}>Stay</AlertDialogCancel>
                    <AlertDialogAction onclick={confirmDiscardAndSwitch}>Discard and switch</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Tooltip.Provider>
</PageShell>
