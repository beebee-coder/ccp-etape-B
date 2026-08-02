import { ErrorBoundary } from "@/components/error-boundary";
import { ProcedureGuidePageClient } from "./ProcedureGuidePageClient";

interface PageProps {
  params: { id: string };
}

export default function ProcedureGuidePage({ params }: PageProps) {
  return (
    <ErrorBoundary>
      <ProcedureGuidePageClient id={params.id} />
    </ErrorBoundary>
  );
}
