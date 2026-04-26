import { ParentPortal } from "@/components/parent-portal";

type ParentChildPageProps = {
  params?: Promise<{
    childId?: string;
  }>;
};

export default async function ParentChildPage({ params }: ParentChildPageProps) {
  const routeParams = await params;
  const childId = routeParams?.childId ? decodeURIComponent(routeParams.childId) : undefined;

  return <ParentPortal initialChildId={childId} />;
}
