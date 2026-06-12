import {
  MonitorSmartphone, KeyRound, Mail, Phone, Eye, BedDouble,
  Gem, MapPinned, UserCheck, CircleDot,
} from "lucide-react";
import { EventItem } from "../lib/types";
import { cn, eventLabels, formatDate, riskHex } from "../lib/utils";

const ICONS: Record<string, any> = {
  login_new_device: MonitorSmartphone,
  password_changed: KeyRound,
  email_changed: Mail,
  phone_changed: Phone,
  balance_viewed: Eye,
  guest_booking_created: BedDouble,
  high_value_redemption: Gem,
  destination_cluster_detected: MapPinned,
  analyst_review: UserCheck,
};

export const Timeline = ({ events }: { events: EventItem[] }) => {
  if (events.length === 0)
    return <p className="text-sm text-txt-2" data-testid="timeline-empty">No events recorded.</p>;

  return (
    <ol className="relative space-y-0" data-testid="event-timeline">
      {events.map((e, i) => {
        const Icon = ICONS[e.event_type] ?? CircleDot;
        const color = riskHex[e.severity] ?? "#3B82F6";
        return (
          <li key={e.id ?? i} className="relative flex gap-4 pb-6 last:pb-0" data-testid={`timeline-event-${i}`}>
            {i < events.length - 1 && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-line" aria-hidden />
            )}
            <span
              className="grid place-items-center w-8 h-8 rounded-full border shrink-0 z-[1]"
              style={{ borderColor: `${color}55`, background: `${color}14`, color }}
            >
              <Icon size={14} strokeWidth={1.5} />
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{eventLabels[e.event_type] ?? e.event_type}</span>
                <span
                  className={cn("font-mono text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 border")}
                  style={{ color, borderColor: `${color}44`, background: `${color}0d` }}
                >
                  {e.severity}
                </span>
                {e.risk_delta > 0 && (
                  <span className="font-mono text-xs text-red-400">+{e.risk_delta}</span>
                )}
              </div>
              <p className="text-xs text-txt-2 mt-0.5">{e.description}</p>
              <p className="font-mono text-[11px] text-txt-3 mt-0.5">{formatDate(e.timestamp)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};
