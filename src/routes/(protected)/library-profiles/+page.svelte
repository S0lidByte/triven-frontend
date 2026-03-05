<script lang="ts">
    /**
     * Library Profiles management page.
     *
     * Responsibilities:
     * - Display and edit all library profiles via SJSF (scoped to filesystem.library_profiles)
     * - Breadcrumb: Admin › Library Profiles
     * - Header save-status indicator and primary Save button
     * - Sticky save bar with Ctrl/Cmd+S keyboard shortcut
     */
    import type { FormState } from "@sjsf/form";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import { BasicForm } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "$lib/components/settings/form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { icons } from "@sjsf/lucide-icons";
    import { toast } from "svelte-sonner";
    import { navigating } from "$app/stores";
    import { writable } from "svelte/store";
    import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert/index.js";
    import type { ActionData, PageData } from "./$types";

    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Check from "@lucide/svelte/icons/check";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import BookOpen from "@lucide/svelte/icons/book-open";

    setShadcnContext();

    const meta = createMeta<ActionData, PageData>().form;

    let saveStatus = $state<"idle" | "success" | "error">("idle");

    const formStore = writable<FormState<unknown> | null>(null);

    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result: { type: string }) => {
            if (result.type === "success") {
                toast.success("Library profiles saved");
                saveStatus = "success";
            } else {
                toast.error("Failed to save library profiles");
                saveStatus = "error";
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving");
            saveStatus = "error";
        }
    });

    $effect(() => {
        formStore.set(form);
    });

    $effect(() => {
        if (form?.isChanged) saveStatus = "idle";
    });

    const isDirty = $derived(form?.isChanged ?? false);
    const isNavigating = $derived(Boolean($navigating));

    function submitForm(): void {
        if ($navigating) return;
        const formEl = document.querySelector(".library-profiles-form form");
        (formEl as HTMLFormElement)?.requestSubmit();
    }

    function handleKeydown(e: KeyboardEvent): void {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            if (isDirty && !isNavigating) submitForm();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
    <title>Library Profiles - Riven</title>
</svelte:head>

<PageShell class="h-full px-4 md:px-6 lg:px-8">
    <Tooltip.Provider>
        <div class="w-full">
            <!-- ── Page header ─────────────────────────────────────────────── -->
            <header
                class="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-start md:justify-between">
                <div>
                    <!-- Breadcrumb -->
                    <nav
                        class="text-muted-foreground flex items-center gap-1 text-sm font-medium"
                        aria-label="Breadcrumb">
                        <span>Admin</span>
                        <ChevronRight class="size-3.5 shrink-0 opacity-60" />
                        <span class="text-foreground">Library Profiles</span>
                    </nav>

                    <div class="mt-1 flex flex-wrap items-center gap-2">
                        <h1 class="text-3xl font-bold tracking-tight text-neutral-50">
                            Library Profiles
                        </h1>
                    </div>

                    <p class="text-muted-foreground mt-2 max-w-3xl text-sm md:text-[0.92rem]">
                        Organize media into separate library folders based on metadata rules
                        (genres, content type, ratings, anime flag, etc.). Each profile creates a
                        dedicated VFS path prefix.
                    </p>
                </div>

                <!-- Save status + primary Save button -->
                <div class="mt-2 flex items-center gap-2 md:mt-0">
                    {#if isDirty}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                            <AlertCircle class="size-3.5" />
                            Unsaved changes
                        </div>
                    {:else}
                        <div class="flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                            <Check class="size-3.5" />
                            All changes saved
                        </div>
                    {/if}

                    <Tooltip.Root>
                        <Tooltip.Trigger>
                            <Button
                                type="button"
                                class="min-w-[11rem]"
                                onclick={submitForm}
                                disabled={!isDirty || isNavigating}
                                aria-live="polite">
                                {#if isNavigating}
                                    <Loader2 class="size-4 animate-spin" />
                                    Saving...
                                {:else if isDirty}
                                    <AlertCircle class="size-4" />
                                    Save changes
                                {:else}
                                    <Check class="size-4" />
                                    All changes saved
                                {/if}
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content side="bottom">
                            Save ({navigator?.platform?.includes("Mac") ? "⌘S" : "Ctrl+S"})
                        </Tooltip.Content>
                    </Tooltip.Root>
                </div>
            </header>

            <Separator class="mb-6 md:mb-8" />

            <!-- ── Form panel ──────────────────────────────────────────────── -->
            <div
                class="border-border/70 bg-card/35 relative min-w-0 rounded-xl border p-4 md:p-6"
                aria-busy={isNavigating}>
                <!-- Panel title row -->
                <div
                    class="border-border/60 mb-4 flex items-center gap-1.5 border-b pb-4 text-sm font-semibold text-neutral-200">
                    <BookOpen class="size-3.5 shrink-0" />
                    Library Profiles
                </div>

                {#if saveStatus === "error"}
                    <Alert variant="destructive" class="mb-4 py-2">
                        <AlertCircle class="size-4" />
                        <AlertTitle>Save failed</AlertTitle>
                        <AlertDescription>
                            Profiles were not persisted. Review any errors and retry.
                        </AlertDescription>
                    </Alert>
                {/if}

                <BasicForm {form} method="POST" class="library-profiles-form" />
            </div>

            <!-- ── Sticky save bar ─────────────────────────────────────────── -->
            {#if isDirty}
                <div
                    class="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-40 flex items-center justify-between gap-4 border-t px-4 py-3 shadow-lg backdrop-blur md:right-4 md:bottom-4 md:left-auto md:max-w-md md:rounded-lg md:border md:shadow-xl"
                    role="status"
                    aria-live="polite">
                    <div class="min-w-0">
                        <span class="text-sm font-medium text-amber-500">Unsaved changes</span>
                        <p class="text-muted-foreground truncate text-xs">
                            Review and save to persist your library profile changes.
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => form?.reset()}
                            disabled={isNavigating}>
                            Discard
                        </Button>
                        <Button size="sm" onclick={submitForm} disabled={isNavigating}>
                            {#if isNavigating}
                                <Loader2 class="size-4 animate-spin" />
                                Saving...
                            {:else}
                                Save (Ctrl+S)
                            {/if}
                        </Button>
                    </div>
                </div>
            {/if}
        </div>
    </Tooltip.Provider>
</PageShell>

<style>
    :global(.library-profiles-form) {
        display: grid;
        gap: 0.875rem;
    }

    :global(.library-profiles-form [data-slot="field"]) {
        border: 1px solid color-mix(in oklab, var(--color-border) 80%, transparent);
        border-radius: 0.625rem;
        background: color-mix(in oklab, var(--color-card) 92%, transparent);
        padding: 0.75rem 0.875rem;
    }

    :global(.library-profiles-form [data-slot="field-label"]) {
        font-weight: 600;
        color: color-mix(in oklab, var(--color-foreground) 90%, transparent);
    }

    :global(.library-profiles-form [data-slot="field-description"]) {
        color: var(--color-muted-foreground);
        font-size: 0.78rem;
        line-height: 1.4;
        margin-top: 0.15rem;
    }

    :global(.library-profiles-form [data-slot="input"]),
    :global(.library-profiles-form [data-slot="textarea"]),
    :global(.library-profiles-form [data-slot="select-trigger"]) {
        min-height: 2.2rem;
    }

    :global(.library-profiles-form :focus-visible) {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
    }

    :global(.library-profiles-form [data-slot="field-error"]) {
        font-size: 0.78rem;
        margin-top: 0.25rem;
    }
</style>
