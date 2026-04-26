import { ChildIdentityGateway } from "@/components/child-identity-gateway";

type ChildrenPageProps = {
  searchParams?: Promise<{
    theme?: string | string[];
  }>;
};

function parseInitialTheme(theme: string | string[] | undefined) {
  const value = Array.isArray(theme) ? theme[0] : theme;

  return value === "habit" || value === "food" ? value : undefined;
}

export default async function ChildrenPage({ searchParams }: ChildrenPageProps) {
  const params = await searchParams;

  return <ChildIdentityGateway initialTheme={parseInitialTheme(params?.theme)} />;
}
