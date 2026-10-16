import { TodayContent } from "@/components/today-view";
import { readCore } from "@/lib/core";

export const metadata = { title: "Today" };

export default async function TodayPage() {
  const core = await readCore();
  return <TodayContent view={core.today()} />;
}
