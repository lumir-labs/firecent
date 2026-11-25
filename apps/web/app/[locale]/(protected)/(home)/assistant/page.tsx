import type { Metadata } from "next";
import { AI_ASSISTANT_NAME } from "@app/lib";
import { AssistantView } from "./_components/assistant-view";

export const metadata: Metadata = {
  title: AI_ASSISTANT_NAME,
};

export default function AssistantPage() {
  return <AssistantView />;
}
