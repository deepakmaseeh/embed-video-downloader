import { Suspense } from "react";
import ResultsPage from "./ResultsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="panel p-6 text-sm text-stone-600">Loading results…</div>}>
      <ResultsPage />
    </Suspense>
  );
}
