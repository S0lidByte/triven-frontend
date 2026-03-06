<script lang="ts">
    import { getFormContext, labelAttributes, type ComponentProps } from "@sjsf/form";
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import Info from "@lucide/svelte/icons/info";

    const { title, config }: ComponentProps["label"] = $props();

    const ctx = getFormContext();

    // Extract description from the schema or ui config
    const rawUiSchema = $derived(config.uiSchema as Record<string, unknown> | undefined);
    const rawSchema = $derived(config.schema as Record<string, unknown> | undefined);
    const description = $derived(
        (rawUiSchema?.["ui:description"] ?? rawSchema?.description) as string | undefined
    );
</script>

<div class="flex items-center gap-2">
    <!-- Use shadcn4Label as base theming key if we want it to pick up default Shadcn form label styles -->
    <label
        {...labelAttributes(ctx, config, "shadcn4Label", {
            class: "font-semibold text-[0.92rem]"
        })}>
        {title}
        {#if config.required}
            <span class="text-destructive ml-1">*</span>
        {/if}
    </label>

    {#if description}
        <Tooltip.Provider>
            <Tooltip.Root>
                <Tooltip.Trigger
                    class="text-muted-foreground hover:text-foreground mt-0.5 cursor-help">
                    <Info class="size-3.5" />
                </Tooltip.Trigger>
                <Tooltip.Content side="top" sideOffset={6} class="max-w-xs text-sm break-words">
                    <p>{description}</p>
                </Tooltip.Content>
            </Tooltip.Root>
        </Tooltip.Provider>
    {/if}
</div>
