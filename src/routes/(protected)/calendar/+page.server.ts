import type { PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { error } from "@sveltejs/kit";
import * as dateUtils from "$lib/utils/date";

export const load = (async ({ fetch, locals, url }) => {
    const today = dateUtils.getToday();
    const yearParam = url.searchParams.get("year");
    const monthParam = url.searchParams.get("month");

    let year = today.year;
    let month = today.month;

    if (yearParam && monthParam) {
        year = parseInt(yearParam, 10) || year;
        month = parseInt(monthParam, 10) || month;
    }

    const firstDay = dateUtils.getFirstDayOfMonth(year, month);
    const lastDay = dateUtils.getLastDayOfMonth(year, month);

    const start_date = firstDay.toDate(dateUtils.getLocalTimeZone());
    start_date.setDate(start_date.getDate() - 7);

    const end_date = lastDay.toDate(dateUtils.getLocalTimeZone());
    end_date.setDate(end_date.getDate() + 7);

    const startISO = start_date.toISOString();
    const endISO = end_date.toISOString();

    const calendar = await providers.riven.GET("/api/v1/calendar", {
        baseUrl: locals.backendUrl,
        params: {
            // Use type assertion since the client types might not have these params defined yet if not generated
            query: {
                start_date: startISO,
                end_date: endISO
            } as any
        },
        headers: {
            "x-api-key": locals.apiKey
        },
        fetch: fetch
    });

    if (calendar.error) {
        error(500, "Unable to fetch calendar data");
    }

    return {
        calendar: calendar.data
    };
}) satisfies PageServerLoad;
