export function CinematicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="grid-backdrop absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_75%)]" />

      <div
        className="animate-aura absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--aura-1), transparent 68%)" }}
      />
      <div
        className="animate-aura absolute -right-40 top-24 h-[34rem] w-[34rem] rounded-full blur-[130px]"
        style={{
          background: "radial-gradient(circle, var(--aura-2), transparent 68%)",
          animationDelay: "-7s",
        }}
      />
      <div
        className="animate-aura absolute bottom-[-14rem] left-1/3 h-[32rem] w-[32rem] rounded-full blur-[140px]"
        style={{
          background: "radial-gradient(circle, var(--aura-3), transparent 70%)",
          animationDelay: "-13s",
        }}
      />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </div>
  );
}
