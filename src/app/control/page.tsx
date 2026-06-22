"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const Controller = lazy(() => import("@/components/Controller"));

export default function ControlPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Controller />
    </Suspense>
  );
}
