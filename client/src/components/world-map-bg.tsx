import { useEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";

type Props = {
  imageUrl?: string;     // example: "/world-map.jpg"
  opacity?: number;      // 0.10 to 0.35 recommended
  maxShiftPx?: number;   // movement range
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function WorldMapBg({
  imageUrl = "/world-map.jpg",
  opacity = 0.28,
  maxShiftPx = 70,
}: Props) {
  const controls = useAnimationControls();

  useEffect(() => {
    let cancelled = false;

    async function loop() {
      // Start at center
      await controls.start({ x: 0, y: 0, transition: { duration: 0.1 } });

      while (!cancelled) {
        // Random direction shift (small slow movement)
        const x = rand(-maxShiftPx, maxShiftPx);
        const y = rand(-maxShiftPx * 0.7, maxShiftPx * 0.7);

        await controls.start({
          x,
          y,
          transition: { duration: rand(8, 16), ease: "easeInOut" },
        });
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [controls, maxShiftPx]);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
      {/* ✅ This is the moving background layer (BIGGER than the card so no edges show) */}
      <motion.div
        animate={controls}
        className="absolute -inset-24"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "cover", // ✅ fills full background (no edges)
          opacity,                 // ✅ keep colors visible
        }}
      />

      {/* ✅ optional: add a soft dark vignette so cards text stays readable */}
      <div className="absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.20)]" />
    </div>
  );
}
