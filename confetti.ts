import confetti from "canvas-confetti";

export function fireLevelUpConfetti() {
  try {
    const duration = 1100;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.75 },
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.75 },
      });

      if (Date.now() < end) requestAnimationFrame(frame);
    };

    frame();
  } catch {
    // ignore
  }
}
