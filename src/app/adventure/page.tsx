import { StoryExperience } from "@/components/story-experience";

type AdventurePageProps = {
  searchParams?: Promise<{
    theme?: string | string[];
    child?: string | string[];
  }>;
};

function parseInitialTheme(theme: string | string[] | undefined) {
  const value = Array.isArray(theme) ? theme[0] : theme;

  return value === "habit" || value === "food" ? value : undefined;
}

export default async function AdventurePage({ searchParams }: AdventurePageProps) {
  const params = await searchParams;
  const childId = Array.isArray(params?.child) ? params?.child[0] : params?.child;

  return <StoryExperience initialTheme={parseInitialTheme(params?.theme)} initialChildId={childId} />;
}
