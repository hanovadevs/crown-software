import Image from "next/image";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`brand ${className ?? ""}`}>
      <Image
        alt="Crown Accumulator"
        className="brand-mark"
        height={291}
        preload={compact}
        src="/CrownAccumulatorbox.jpeg"
        width={300}
      />
      {!compact && (
        <div className="brand-copy">
          <span className="brand-name">Crown Accumulator</span>
          <span className="brand-subtitle">Factory management system</span>
        </div>
      )}
    </div>
  );
}
