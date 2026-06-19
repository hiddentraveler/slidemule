"use client";

import { lazy, Suspense, useEffect, useState } from "react";

const Presenter = lazy(() => import("@/components/Presenter"));

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <Presenter />
    </Suspense>
  );
}
