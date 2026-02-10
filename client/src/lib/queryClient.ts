import { QueryClient, QueryFunction } from "@tanstack/react-query";

/** Throw error if response is not OK */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Generic API request wrapper */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const fullUrl = url.startsWith("/api") ? url : `/api${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // ✅ Always include cookies/session
  });

  await throwIfResNotOk(res);
  return res;
}

/** Query fetcher function (used by React Query) */
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn =
  <T>({ on401 }: { on401: UnauthorizedBehavior }): QueryFunction<T> =>
  async ({ queryKey }) => {
    let url = queryKey.join("/");
    if (!url.startsWith("/api")) url = `/api/${url}`;

    const res = await fetch(url, {
      credentials: "include", // ✅ always include credentials
    });

    // Handle unauthorized responses gracefully
    if (res.status === 401) {
      if (on401 === "returnNull") return null as T;
      throw new Error("401: Unauthorized");
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };

/** Global React Query Client */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
