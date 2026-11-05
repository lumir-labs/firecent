export type UsageOption = "group" | "personal" | "business" | "team";

export type GoalOption =
  | "save"
  | "control"
  | "split"
  | "travel"
  | "house"
  | "other";

export type OnboardingData = {
  usage: UsageOption;
  goals: GoalOption[];
  spaceName: string;
};

export const ORGANIZATION_STEP_FORM_ID = "onboarding-organization-form";
