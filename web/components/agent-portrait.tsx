// web/components/agent-portrait.tsx
import { assetUrl, type AgentCard } from "../lib/api";

// The expert's photo, or their initials set in the display serif when there
// is no photo. Business agents get the first letter of the agent's name.
export function AgentPortrait({ agent, className = "" }: { agent: AgentCard; className?: string }) {
  const photo = assetUrl(agent.expert_photo_url);
  const source = agent.expert_name ?? agent.name;
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, agent.expert_name ? 2 : 1)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={agent.expert_name ?? agent.name} className={`object-cover ${className}`} />
    );
  }
  return (
    <span aria-hidden="true" className={`flex items-center justify-center bg-panel-2 font-display text-brand-soft ${className}`}>
      {initials}
    </span>
  );
}
