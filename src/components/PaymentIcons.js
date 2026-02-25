import React from "react";
import visa from "../assets/visa.png";
import mastercard from "../assets/mastercard.png";
import paypal from "../assets/paypal.png";

export default function PaymentIcons() {
  return (
    <div className="payment-icons" style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 40,
      margin: "32px 0 0 0"
    }}>
      <img src={visa} alt="Visa" style={{ height: 38, width: "auto" }} />
      <img src={mastercard} alt="Mastercard" style={{ height: 38, width: "auto" }} />
      <img src={paypal} alt="PayPal" style={{ height: 38, width: "auto" }} />
    </div>
  );
}
