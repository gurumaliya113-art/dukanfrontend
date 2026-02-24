import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

export default function RedirectToSlug() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch(`/products/${id}`)
      .then(res => res.json())
      .then(product => {
        if (product && product.slug) {
          navigate(`/product/${product.slug}`, { replace: true });
        } else {
          navigate("/not-found", { replace: true });
        }
      });
  }, [id, navigate]);

  return null;
}
