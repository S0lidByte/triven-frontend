import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, url }) => {
    redirect(308, `/details/person/${params.id}${url.search}`);
};
