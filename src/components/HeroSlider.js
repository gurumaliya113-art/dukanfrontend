import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroSlider({ images, intervalMs = 3800 }) {
  const slides = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const [index, setIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [animNonce, setAnimNonce] = useState(0);
  const [textOut, setTextOut] = useState(false);
  const timeoutsRef = useRef([]);

  const clearTransitionTimeouts = useCallback(() => {
    for (const t of timeoutsRef.current) window.clearTimeout(t);
    timeoutsRef.current = [];
  }, []);

  const requestIndex = useCallback((nextIndex) => {
    if (slides.length <= 1) return;
    const next = ((nextIndex % slides.length) + slides.length) % slides.length;

    clearTransitionTimeouts();
    setAnimNonce((n) => n + 1);

    if (prefersReducedMotion()) {
      setIsTransitioning(false);
      setTextOut(false);
      setIndex(next);
      return;
    }

    setIsTransitioning(true);
    setTextOut(true);
    // Swap the image while the blackout is near-opaque.
    timeoutsRef.current.push(
      window.setTimeout(() => {
        setIndex(next);
      }, 180)
    );

    // Bring new text in shortly after the image swap.
    timeoutsRef.current.push(
      window.setTimeout(() => {
        setTextOut(false);
      }, 240)
    );

    // End transition after the blackout fades out.
    timeoutsRef.current.push(
      window.setTimeout(() => {
        setIsTransitioning(false);
      }, 900)
    );
  }, [clearTransitionTimeouts, slides.length]);

  const goPrev = () => {
    if (slides.length <= 1) return;
    requestIndex(index - 1);
  };

  const goNext = () => {
    if (slides.length <= 1) return;
    requestIndex(index + 1);
  };

  useEffect(() => {
    if (slides.length <= 1) return;
    if (prefersReducedMotion()) return;

    const id = window.setInterval(() => {
      requestIndex(index + 1);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, index, requestIndex, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") clearTransitionTimeouts();
    };
  }, [clearTransitionTimeouts]);

  if (slides.length === 0) return null;

  const active = slides[Math.min(index, slides.length - 1)];
  const kicker = active?.kicker || "";
  const headline = active?.headline || "";
  const hasText = Boolean(kicker || headline);
  const textStyle = hasText
    ? {
        "--heroTextTop": active?.textTop,
        "--heroTextTopMobile": active?.textTopMobile,
      }
    : undefined;

  return (
    <div className="hero-slider" aria-label="Featured images">
      {slides.length > 1 ? (
        <>
          <button
            className="hero-arrow hero-arrow-left"
            type="button"
            aria-label="Previous image"
            onClick={goPrev}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M14.5 5.5 8.5 12l6 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            className="hero-arrow hero-arrow-right"
            type="button"
            aria-label="Next image"
            onClick={goNext}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M9.5 5.5 15.5 12l-6 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      ) : null}

      {!prefersReducedMotion() && slides.length > 1 ? (
        <div
          className={isTransitioning ? "hero-blackout transitioning" : "hero-blackout"}
          key={`blackout-${animNonce}`}
          aria-hidden="true"
        />
      ) : null}

      {hasText ? (
        <div
          className={textOut ? "hero-text hero-text-out" : "hero-text"}
          key={`text-${index}-${animNonce}`}
          style={textStyle}
          aria-hidden="true"
        >
          {kicker ? <div className="hero-text-kicker">{kicker}</div> : null}
          {headline ? <div className="hero-text-headline">{headline}</div> : null}
        </div>
      ) : null}

      <div className="hero-slide" key={`slide-${index}`}>
        <img
          className={
            !prefersReducedMotion() && slides.length > 1
              ? "hero-slide-img hero-slide-img-anim"
              : "hero-slide-img"
          }
          key={`img-${index}-${animNonce}`}
          src={active.src}
          alt={active.alt || "Featured"}
          loading={index === 0 ? "eager" : "lazy"}
          draggable={false}
        />
      </div>
    </div>
  );
}
