import { ChildIdentityGateway } from "@/components/child-identity-gateway";

type ChildPageProps = {
  params?: Promise<{
    childId?: string;
  }>;
  searchParams?: Promise<{
    theme?: string | string[];
  }>;
};

function parseInitialTheme(theme: string | string[] | undefined) {
  const value = Array.isArray(theme) ? theme[0] : theme;

  return value === "habit" || value === "food" ? value : undefined;
}

export default async function ChildPage({ params, searchParams }: ChildPageProps) {
  const [routeParams, queryParams] = await Promise.all([params, searchParams]);
  const childId = routeParams?.childId ? decodeURIComponent(routeParams.childId) : undefined;

  return (
    <ChildIdentityGateway
      initialChildId={childId}
      initialTheme={parseInitialTheme(queryParams?.theme)}
    />
  );
}
