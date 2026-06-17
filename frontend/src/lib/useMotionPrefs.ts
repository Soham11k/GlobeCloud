import { useEffect, useState } from "react";

export function useMotionPrefs() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(mq.matches);
    updateMotion();
    mq.addEventListener("change", updateMotion);

    const checkMobile = () => setMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      mq.removeEventListener("change", updateMotion);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return { reducedMotion, mobile, enableBloom: !mobile && !reducedMotion };
}
