import React from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import Navbar from "./components/Navbar";
import AdminPage from "./pages/AdminPage";
import ShopPage from "./pages/ShopPage";
import ProductPage from "./pages/ProductPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import CartPage from "./pages/CartPage";
import Footer from "./components/Footer";

function App() {
  const location = useLocation();

  return (
    <div>
      <Navbar />

      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<ShopPage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </AnimatePresence>
      </LayoutGroup>

      <Footer />
    </div>
  );
}

export default App;
