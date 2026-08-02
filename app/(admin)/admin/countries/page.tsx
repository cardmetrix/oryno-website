"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Country = {
  code: string;
  name: string;
  currency: string;
  services: string;
  gateway: string;
  status: string;
};

export default function AdminCountriesPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    countries: Country[];
  }>("/api/admin/countries");

  return (
    <>
      <AdminPageHeader
        title="Countries"
        subtitle="Enablement, currency, and gateway mapping"
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.countries.length === 0 ? (
            <AdminEmptyBlock message="No countries in the database." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.countries.map((country, index) => (
                <motion.div
                  key={country.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-[18px] border border-border bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {country.name}
                    </p>
                    <StatusBadge status={country.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {country.code} · {country.currency} · {country.gateway}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                    {country.services}
                  </p>
                </motion.div>
              ))}
            </div>
          )
        ) : null}
      </AdminCard>
    </>
  );
}
