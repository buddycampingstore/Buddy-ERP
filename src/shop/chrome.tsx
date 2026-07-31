import React from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence, useScroll } from 'motion/react';
import { TRUST_ITEMS } from './shared';

/* ── Signature element ────────────────────────────────────────────────────
   Topographic contour lines — a nod to trail maps / terrain, the world these
   products live in. Deterministic paths (no Math.random) in two fields that
   drift past each other, reused in the hero and footer as the page's memory
   hook.

   Each line alternates quadratic humps on a fixed 160px period and is drawn
   from -400 to 1600 — far wider than the 1200 viewBox — so the ±320px drift
   (two periods) never exposes a bald edge. */
const WAVE_HALF = 80;

const contourPath = (baseY: number, amp: number) => {
  let d = `M -400 ${baseY}`;
  let up = true;
  for (let x = -400; x < 1600; x += WAVE_HALF) {
    d += ` Q ${x + WAVE_HALF / 2} ${baseY + (up ? -amp : amp)} ${x + WAVE_HALF} ${baseY}`;
    up = !up;
  }
  return d;
};

export const ContourField: React.FC<{
  height?: number;
  lines?: number;
  className?: string;
}> = ({ height = 620, lines = 7, className = '' }) => {
  const gap = height / lines;
  const slowLines = Math.ceil(lines / 2);
  return (
    <svg
      viewBox={`0 0 1200 ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="sf-drift">
        {Array.from({ length: lines }).map((_, i) => (
          <path key={i} d={contourPath(gap * (i + 0.5), 14 + (i % 3) * 7)} opacity={0.3 + (i % 3) * 0.1} />
        ))}
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.22" className="sf-drift-slow">
        {Array.from({ length: slowLines }).map((_, i) => (
          <path key={i} d={contourPath(gap * (i * 2 + 1), 10)} />
        ))}
      </g>
    </svg>
  );
};

/* Reading-position bar. Driven by a motion value so scrolling never triggers a
   React render; it sits above the sheet because the 3px accent still reads as
   page furniture there. */
export const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  return (
    <div className="fixed inset-x-0 top-0 h-[3px] z-[60] pointer-events-none">
      <motion.div
        style={{ scaleX: scrollYProgress }}
        className="h-full w-full origin-left rounded-r-[3px] bg-copper"
      />
    </div>
  );
};

/* Service promises. The list is rendered twice and translated by -50%, so the
   seam lands exactly where the first copy ends. Only the duplicate is hidden
   from assistive tech — the promises are real information, so they should be
   read once, not twice and not never. */
export const TrustMarquee: React.FC = () => (
  <div className="bg-copper text-white overflow-hidden">
    <div className="flex w-max gap-11 px-6 py-2.5 whitespace-nowrap text-[12.5px] font-medium tracking-wide sf-marquee">
      {[0, 1].map(copy => (
        <React.Fragment key={copy}>
          {TRUST_ITEMS.map(item => (
            <React.Fragment key={item}>
              <span aria-hidden={copy === 1 ? 'true' : undefined}>{item}</span>
              <span className="text-white/55" aria-hidden="true">◆</span>
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </div>
  </div>
);

export const ScrollTopButton: React.FC<{ show: boolean; onClick: () => void }> = ({ show, onClick }) => (
  <AnimatePresence>
    {show && (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label="กลับขึ้นด้านบน"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="fixed right-4 bottom-4 z-40 w-12 h-12 rounded-full bg-bark text-paper flex items-center justify-center cursor-pointer shadow-[0_14px_30px_-12px_rgba(54,36,15,0.8)]"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    )}
  </AnimatePresence>
);

/* Transient confirmation for actions with no other visible result (favourite
   toggled, model name copied). Announced politely rather than assertively —
   none of it is urgent. */
export const Toast: React.FC<{ message: string }> = ({ message }) => (
  <div aria-live="polite" aria-atomic="true">
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: 14, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 8, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed left-1/2 bottom-6 z-[70] max-w-[calc(100vw-2rem)] bg-bark text-paper text-[13px] font-medium px-5 py-3 rounded-full shadow-[0_18px_36px_-16px_rgba(0,0,0,0.7)] pointer-events-none text-center"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
