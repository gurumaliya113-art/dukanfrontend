import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import Navbar from "./components/Navbar";
import AdminPage from "./pages/AdminPage";
import BlogPage from "./pages/BlogPage";
import BlogPostPage from "./pages/BlogPostPage";
import PolicyPage from "./pages/PolicyPage";
import ShopPage from "./pages/ShopPage";
import ProductPage from "./pages/ProductPage";
import RedirectToSlug from "./pages/RedirectToSlug";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentPage from "./pages/PaymentPage";
import CartPage from "./pages/CartPage";
import LoginPage from "./pages/LoginPage";
import AccountPage from "./pages/AccountPage";
import Footer from "./components/Footer";

function App() {
  const location = useLocation();

  React.useEffect(() => {
    // Print sitemap link for SEO
    // Change to your deployed domain if needed
    console.log('Sitemap: https://zubilo.studio/sitemap.xml');
  }, []);
  return (
    <div>
      <Navbar />
      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<ShopPage />} />

            {/* SEO-friendly section URLs (redirect to category query) */}
            <Route path="/new-arrivals" element={<Navigate to="/?category=new#arrivals" replace />} />
            <Route path="/men" element={<Navigate to="/?category=men#arrivals" replace />} />
            <Route path="/women" element={<Navigate to="/?category=women#arrivals" replace />} />
            <Route path="/kids" element={<Navigate to="/?category=kids#arrivals" replace />} />
            <Route path="/new-products" element={<Navigate to="/?category=new#arrivals" replace />} />
            <Route path="/trending" element={<Navigate to="/?category=new#arrivals" replace />} />

            {/* Blog */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />

            {/* Policies */}
            <Route path="/policy/:slug" element={<PolicyPage />} />

            <Route path="/product/:slug" element={<ProductPage />} />
            <Route path="/product/:id" element={<RedirectToSlug />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment" element={<PaymentPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/customer-auth" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </AnimatePresence>
      </LayoutGroup>
      <Footer />
    </div>
  );
}

export default App;
