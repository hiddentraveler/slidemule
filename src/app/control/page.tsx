"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const Controller = lazy(() => import("@/components/Controller"));

export default function ControlPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <Controller sessionId={id ?? ""} />
    </Suspense>
  );
}
