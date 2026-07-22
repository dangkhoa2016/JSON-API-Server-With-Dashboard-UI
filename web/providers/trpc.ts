import { createTRPCVue } from "@trpc-vue-query/client";
import { TRPCUntypedClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import { getAuthToken } from "../lib/authToken";

export const trpcClient = new TRPCUntypedClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      headers() {
        const t = getAuthToken()
        return t ? { Authorization: `Bearer ${t}` } : {}
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: 'include',
        })
      },
    }),
  ],
})

export const trpc = createTRPCVue<AppRouter>();
