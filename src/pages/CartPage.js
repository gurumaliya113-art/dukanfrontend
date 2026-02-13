import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../cartContext";
import { useRegion } from "../regionContext";
import { formatMoney, getCartItemUnitPrice } from "../pricing";

export default function CartPage() {
  const cart = useCart();
  const { region } = useRegion();

  const proceedHref = "/checkout?fromCart=1";

  const total = useMemo(() => {
    return cart.items.reduce(
      (sum, item) => {
        const unit = getCartItemUnitPrice(item, region);
        return sum + (Number(unit.amount) || 0) * (Number(item.qty) || 0);
      },
      0
    );
  }, [cart.items, region]);

  const totalCurrency = useMemo(() => {
    const first = cart.items.find((x) => (Number(getCartItemUnitPrice(x, region).amount) || 0) > 0);
    return first ? getCartItemUnitPrice(first, region).currency : (region === "US" ? "USD" : "INR");
  }, [cart.items, region]);

  return (
    <div className="section">
      <div className="container">
        <div className="section-head">
          <h2 className="section-title">Cart</h2>
          <div className="section-count">{cart.count} ITEMS</div>
        </div>

        <div className="cart-card">
          {cart.items.length === 0 ? (
            <div className="cart-empty">
              <p className="status">Your cart is empty.</p>
              <p style={{ marginTop: 12 }}>
                <Link to="/">Continue shopping →</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="cart-list" role="list">
                {cart.items.map((item) => (
                  <div
                    key={`${item.productId}_${item.size}`}
                    className="cart-row"
                    role="listitem"
                  >
                    <div className="cart-thumb">
                      {item.image1 ? (
                        <img src={item.image1} alt="" />
                      ) : (
                        <div className="cart-thumb-fallback" />
                      )}
                    </div>

                    <div className="cart-main">
                      <div className="cart-name">{item.name}</div>
                      <div className="cart-meta">
                        Size {item.size} · Qty {item.qty}
                      </div>
                    </div>

                    <div className="cart-right">
                      <div className="cart-price">
                        {(() => {
                          const unit = getCartItemUnitPrice(item, region);
                          return formatMoney(unit.amount, unit.currency);
                        })()}
                      </div>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          cart.removeItem({
                            productId: item.productId,
                            size: item.size,
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-footer">
                <div className="cart-total">
                  <div className="cart-total-label">Total</div>
                  <div className="cart-total-value">{formatMoney(total, totalCurrency)}</div>
                </div>

                <div className="cart-actions">
                  <button type="button" className="secondary-btn" onClick={cart.clear}>
                    Clear Cart
                  </button>
                  <Link
                    to={proceedHref}
                    className="primary-btn"
                    style={{ textAlign: "center" }}
                  >
                    Proceed to Buy Now
                  </Link>
                  <Link to="/" className="secondary-btn" style={{ textAlign: "center" }}>
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
