import React, { useEffect, useMemo, useState } from "react";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const shuffle = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const Stars = ({ rating }) => {
  const r = clamp(Number(rating) || 0, 0, 5);
  const full = Math.floor(r);
  const hasHalf = r - full >= 0.5;

  const items = [];
  for (let i = 1; i <= 5; i += 1) {
    const isFull = i <= full;
    const isHalf = !isFull && hasHalf && i === full + 1;
    items.push(
      <span
        key={i}
        className={
          isFull ? "review-star full" : isHalf ? "review-star half" : "review-star empty"
        }
        aria-hidden="true"
      >
        ★
      </span>
    );
  }

  return (
    <div className="reviews-stars" aria-label={`${r.toFixed(1)} out of 5 stars`}>
      {items}
      <span className="reviews-rating">{r.toFixed(1)}/5</span>
    </div>
  );
};

export default function ReviewsSlider({
  title = "Reviews",
  subtitle = "What customers are saying",
  mix = false,
}) {
  const baseReviews = useMemo(
    () => [
      {
        id: "ffj-1",
        rating: 5,
        name: "Emily R.",
        location: "Austin, TX, USA",
        product: "Faux Fur Jacket",
        text:
          "Bought this for my little one — it’s insanely soft, warm, and looks premium. The stitching is clean and the fur feels luxe. Perfect winter pick!",
      },
      {
        id: "ffj-2",
        rating: 4.5,
        name: "Jessica M.",
        location: "San Jose, CA, USA",
        product: "Faux Fur Jacket",
        text:
          "So cozy and cute. My kid didn’t want to take it off. Looks amazing in photos and feels comfortable even after a long day out.",
      },
      {
        id: "ffj-3",
        rating: 4,
        name: "Hannah T.",
        location: "Chicago, IL, USA",
        product: "Faux Fur Jacket",
        text:
          "Great quality for the price. The faux fur feels plush and doesn’t shed much. I would love a bit more length, but overall super happy.",
      },
      {
        id: "ffj-4",
        rating: 5,
        name: "Mia K.",
        location: "Orlando, FL, USA",
        product: "Faux Fur Jacket",
        text:
          "Absolutely worth it. Looks like a designer piece. Warm, stylish, and the fit is perfect. Compliments nonstop!",
      },
      {
        id: "ffj-5",
        rating: 4,
        name: "Olivia S.",
        location: "Seattle, WA, USA",
        product: "Faux Fur Jacket",
        text:
          "Soft and elegant. The jacket feels premium and keeps my child comfortable in cold weather. Overall experience was smooth.",
      },
    ],
    []
  );

  const [reviews, setReviews] = useState(baseReviews);
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const next = mix ? shuffle(baseReviews) : baseReviews;
    setReviews(next);

    const start = mix && next.length ? Math.floor(Math.random() * next.length) : 0;
    setActive(start);
    setTick((t) => t + 1);
  }, [mix, baseReviews]);

  const average = useMemo(() => {
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return reviews.length ? sum / reviews.length : 0;
  }, [reviews]);

  useEffect(() => {
    if (reviews.length <= 1) return undefined;

    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % reviews.length);
      setTick((t) => t + 1);
    }, 4200);

    return () => clearInterval(id);
  }, [reviews.length]);

  const current = reviews[active];

  return (
    <section className="reviews" aria-label={title}>
      <div className="container">
        <div className="section-head">
          <div>
            <h2 className="section-title">{title}</h2>
            <div className="section-subtitle">{subtitle}</div>
          </div>
          <div className="reviews-average">
            <Stars rating={average} />
            <div className="reviews-count">{reviews.length} reviews</div>
          </div>
        </div>

        <div className="reviews-card">
          <div key={`${current.id}-${tick}`} className="review-slide">
            <Stars rating={current.rating} />

            <div className="review-text">“{current.text}”</div>

            <div className="review-meta">
              <span className="review-name">{current.name}</span>
              <span className="review-dot">•</span>
              <span className="review-loc">{current.location}</span>
            </div>

            <div className="review-product">Review for: {current.product}</div>
          </div>

          <div className="reviews-dots" aria-label="Review navigation">
            {reviews.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                className={idx === active ? "reviews-dot active" : "reviews-dot"}
                onClick={() => {
                  setActive(idx);
                  setTick((t) => t + 1);
                }}
                aria-label={`Show review ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
