import { Bell } from "lucide-react";
import { ComingSoonPage } from "../_components/shell/coming-soon-page";

export default function NotificationsPage() {
  return (
    <ComingSoonPage
      titleKey="nav.notifications"
      icon={Bell}
      back="/"
    />
  );
}
