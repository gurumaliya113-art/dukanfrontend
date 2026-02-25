import React from "react";
import visa from "../assets/visa.png";
import mastercard from "../assets/mastercard.png";
import paypal from "../assets/paypal.png";

export default function PaymentIcons() {
  return (
    <div
      className="payment-icons"
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 28,
        margin: "24px 0 0 0",
      }}
    >
      <img
        src={visa}
        alt="Visa"
        style={{ height: 28, width: "auto", maxWidth: 64 }}
        className="payment-icon-img"
      />
      <img
        src={mastercard}
        alt="Mastercard"
        style={{ height: 28, width: "auto", maxWidth: 64 }}
        className="payment-icon-img"
      />
      <img
        src={paypal}
        alt="PayPal"
        style={{ height: 28, width: "auto", maxWidth: 64 }}
        className="payment-icon-img"
      />
      <style>{`
        @media (max-width: 640px) {
          .payment-icons {
            gap: 16px !important;
            margin-top: 14px !important;
          }
          .payment-icon-img {
            height: 20px !important;
            max-width: 44px !important;
          }
        }
      `}</style>
    </div>
  );
}
