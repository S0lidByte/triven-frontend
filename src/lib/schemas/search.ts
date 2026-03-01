import { z } from "zod";

/**
 * Schema for search query parameters
 * Used for validating GET request search params
 */
export const searchSchema = z
    .object({
        // The search query string
        query: z.string().optional(),

        // Media type filter
        type: z.enum(["movie", "tv", "both", "person", "company"]).default("both")
    })
    .passthrough();

export type SearchFormData = z.infer<typeof searchSchema>;
