import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { DashboardClient } from "@/app/(app)/dashboard/dashboard-client";
import { ensureAppUser } from "@/lib/auth/current-user";
import { WALLET_QUERY_KEY } from "@/lib/query-keys";
import { loadWalletPayload } from "@/lib/wallet/load-payload";

export default async function DashboardPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
      },
    },
  });

  try {
    const user = await ensureAppUser();
    if (user) {
      await queryClient.prefetchQuery({
        queryKey: WALLET_QUERY_KEY,
        queryFn: () => loadWalletPayload(user),
      });
    }
  } catch (error) {
    console.error("[dashboard-prefetch]", error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
