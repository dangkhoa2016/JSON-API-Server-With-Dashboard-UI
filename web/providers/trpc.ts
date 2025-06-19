import { createTRPCVue } from "@trpc-vue-query/client";
import type { AppRouter } from "../../api/router";

export const trpc = createTRPCVue<AppRouter>();
