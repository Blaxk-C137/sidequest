/**
 * Decorative aurora. Pure CSS (no WebGL) so mid-range Android phones keep a
 * steady frame rate, and it switches off entirely under reduced-motion.
 */
export function Aurora({ intensity = 'normal' }: { intensity?: 'soft' | 'normal' | 'bright' }) {
  const opacity = intensity === 'soft' ? 'opacity-50' : intensity === 'bright' ? 'opacity-100' : 'opacity-80';
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${opacity}`}>
      <div className="animate-aurora absolute -left-[28%] -top-[18%] h-[62vh] w-[82vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,99,146,0.32),transparent_66%)] blur-[46px]" />
      <div
        className="animate-aurora absolute -right-[30%] top-[6%] h-[56vh] w-[78vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(160,92,190,0.34),transparent_68%)] blur-[52px]"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="animate-aurora absolute bottom-[-22%] left-[8%] h-[52vh] w-[88vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(92,72,190,0.28),transparent_70%)] blur-[58px]"
        style={{ animationDelay: '-13s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,transparent_35%,rgba(13,10,19,0.72)_100%)]" />
    </div>
  );
}
