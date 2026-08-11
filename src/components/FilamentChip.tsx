import { formatGramos } from "@/lib/format";

type Props = {
  colorHex: string;
  label: string;
  sublabel?: string;
  gramos?: number;
  size?: "sm" | "md";
};

/**
 * Chip translúcido tintado con el color real del filamento: el propio material
 * (PETG, PLA translúcido) es la referencia del efecto de vidrio.
 */
export function FilamentChip({
  colorHex,
  label,
  sublabel,
  gramos,
  size = "md",
}: Props) {
  const dot = size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-full border py-1.5 pr-3.5 pl-1.5 backdrop-blur-md"
      style={{
        backgroundColor: `${colorHex}22`,
        borderColor: `${colorHex}59`,
      }}
    >
      <span
        className={`${dot} shrink-0 rounded-full border border-white/25 shadow-[inset_0_1px_2px_rgba(255,255,255,0.35)]`}
        style={{ backgroundColor: colorHex }}
        aria-hidden
      />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium text-white/90">{label}</span>
        {sublabel && (
          <span className="text-[11px] text-white/55">{sublabel}</span>
        )}
      </span>
      {gramos !== undefined && (
        <span className="num ml-1 text-sm text-white/80">
          {formatGramos(gramos)}
        </span>
      )}
    </span>
  );
}
