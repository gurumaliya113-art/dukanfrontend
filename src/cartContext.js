import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const CART_KEY = "rk_cart_v1";

const CartContext = createContext(null);

const readCart = () => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCart = (items) => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readCart());

  useEffect(() => {
    writeCart(items);
  }, [items]);

  const count = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
    [items]
  );

  const addItem = ({ productId, name, price, price_inr, price_usd, image1, size }) => {
    const id = Number(productId);
    if (Number.isNaN(id)) return;
    const normalizedSize = String(size || "").trim();
    if (!normalizedSize) return;

    const inr = Number(price_inr ?? price) || 0;
    const usd = Number(price_usd) || 0;

    setItems((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.productId === id && x.size === normalizedSize);
      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: (Number(next[idx].qty) || 0) + 1 };
        return next;
      }
      next.push({
        productId: id,
        name: String(name || "").trim() || "Product",
        // Legacy price is kept for old UI/back-compat
        price: inr,
        price_inr: inr,
        price_usd: usd,
        image1: image1 || "",
        size: normalizedSize,
        qty: 1,
      });
      return next;
    });
  };

  const removeItem = ({ productId, size }) => {
    const id = Number(productId);
    const normalizedSize = String(size || "").trim();
    setItems((prev) => prev.filter((x) => !(x.productId === id && x.size === normalizedSize)));
  };

  const clear = () => setItems([]);

  const value = useMemo(
    () => ({ items, count, addItem, removeItem, clear }),
    [items, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
