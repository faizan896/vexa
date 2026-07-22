"use client";

/**
 * Cinematic hero backdrop — the real facade photo, fixed behind the page,
 * with a warm scrim so the cream headline stays readable.
 */
export default function HeroBackdrop() {
  return (
    <div className="hero-photo" aria-hidden="true">
      <div className="hero-photo-img" />
      <div className="hero-photo-veil" />
      <div className="hero-photo-grain" />
    </div>
  );
}
