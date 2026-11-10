type Props = {
  className?: string;
};

export default function CircleHubSymbol({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer circle representing the community */}
      <circle
        cx="20"
        cy="20"
        r="17"
        stroke="#245B45"
        strokeWidth="2.5"
      />

      {/* Connected members */}
      <path
        d="M20 18 L11.5 12.5 M20 18 L28.5 12.5 M20 18 L20 29"
        stroke="#245B45"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      <circle cx="11.5" cy="12.5" r="4" fill="#DDF3E6" stroke="#245B45" strokeWidth="2" />
      <circle cx="28.5" cy="12.5" r="4" fill="#DDF3E6" stroke="#245B45" strokeWidth="2" />
      <circle cx="20" cy="29" r="4" fill="#DDF3E6" stroke="#245B45" strokeWidth="2" />

      {/* Shared centre */}
      <circle cx="20" cy="18" r="3.5" fill="#245B45" />
    </svg>
  );
}
