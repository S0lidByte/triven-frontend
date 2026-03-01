<script lang="ts">
    import type { FormState } from "@sjsf/form";
    import PageShell from "$lib/components/page-shell.svelte";
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
    import SettingsFormContent from "$lib/components/settings/settings-form-content.svelte";
    import { cn } from "$lib/utils";
    import { goto } from "$app/navigation";
    import { navigating, page } from "$app/stores";
    import { writable } from "svelte/store";

    /** Form ref from keyed SettingsFormContent - updates when tab changes (remount) */
    const formStore = writable<FormState<any> | null>(null);
    const form = $derived($formStore);

    let tabSwitchTarget: string | null = null;
    let showDiscardConfirm = $state(false);

    function submitSettingsForm() {
        const formEl = document.querySelector(".settings-form form");
        (formEl as HTMLFormElement)?.requestSubmit();
    }

    function handleTabClick(tabId: string) {
        if (tabId === $page.data.activeTabId) return;
        if (form?.isChanged) {
            tabSwitchTarget = tabId;
            showDiscardConfirm = true;
        } else {
            goto(`/settings?tab=${tabId}`);
        }
    }

    function confirmDiscardAndSwitch() {
        if (tabSwitchTarget) {
            form?.reset();
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
    const isDirty = $derived(form?.isChanged ?? false);
</script>

<svelte:head>
    <title>Settings - Riven</title>
</svelte:head>

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

                <!-- Right: form - keyed by activeTabId so form remounts and loads correct schema when tab changes -->
                <div class="min-w-0 flex-1 relative">
                    {#if $navigating}
                        <div
                            class="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-muted/50"
                            aria-live="polite">
                            <span class="text-muted-foreground text-sm">Loading…</span>
                        </div>
                    {/if}
                    {#key $page.data.activeTabId}
                        <SettingsFormContent {formStore} />
                    {/key}
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
                        <Button variant="outline" size="sm" onclick={() => form?.reset()}>
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
