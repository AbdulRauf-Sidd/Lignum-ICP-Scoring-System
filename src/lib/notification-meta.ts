import { AlertTriangle, HelpCircle, XCircle, MailWarning } from "lucide-react";
import type { NotificationType } from "@/lib/types";

export const NOTIFICATION_ICONS: Record<NotificationType, typeof AlertTriangle> = {
  failed_enrichment: XCircle,
  low_confidence: HelpCircle,
  no_match: AlertTriangle,
  low_email_quality: MailWarning,
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  failed_enrichment: "Failed enrichment",
  low_confidence: "Low data confidence",
  no_match: "No-match flag",
  low_email_quality: "Email quality",
};
