import type { RiskLevel } from "@terra-pulse/earth-domain";

interface RiskPillProps {
  level: RiskLevel;
  score?: number;
}

export function RiskPill({ level, score }: RiskPillProps) {
  return (
    <span className={`risk-pill risk-${level}`}>
      <span aria-hidden="true" />
      {level}
      {score === undefined ? null : <b>{score}</b>}
    </span>
  );
}
