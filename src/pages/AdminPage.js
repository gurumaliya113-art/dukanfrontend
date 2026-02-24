import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { slugify } from "../slugify";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { CATEGORIES, normalizeCategory } from "../categories";
import { apiFetch, getApiBase } from "../api";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  DollarSign,
  Download,
  FileText,
  LayoutDashboard,
  MapPin,
  MessageSquareWarning,
  Package,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

const PRODUCT_SIZE_OPTIONS = [
  "0-1 year",
  "1-2 year",
  "2-4 year",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
];

const toggleSize = (list, size) => {
  const allowed = new Set(PRODUCT_SIZE_OPTIONS);
  const set = new Set(Array.isArray(list) ? list.filter((s) => allowed.has(s)) : []);
  if (set.has(size)) set.delete(size);
  else set.add(size);
  const weight = new Map(PRODUCT_SIZE_OPTIONS.map((s, i) => [s, i]));
  return [...set].sort((a, b) => (weight.get(a) ?? 999) - (weight.get(b) ?? 999));
};

const normalizeSizes = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
};

const initialForm = {
  name: "",
  category: "new",
  sku: "",
  barcode: "",
  quantity: "",
  mrp_inr: "",
  mrp_usd: "",
  price_inr: "",
  price_usd: "",
  cost_inr: "",
  cost_usd: "",
  video_url: "",
  description: "",
  sizes: [],
};

const EMPTY_EDIT_IMAGE_URLS = {
  image1: "",
  image2: "",
  image3: "",
  image4: "",
};

const toDateTimeLocalValue = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  } catch {
    return "";
  }
};

const formatDateTime = (value) => {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  } catch {
    return "";
  }
};

export default function AdminPage() {
  const trackingSectionRef = useRef(null);

  const [form, setForm] = useState(initialForm);
  const [images, setImages] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [authMode, setAuthMode] = useState("login"); // login | create
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [admin, setAdmin] = useState(null);

  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [inventoryEdits, setInventoryEdits] = useState({});
  const [inventorySavingId, setInventorySavingId] = useState(null);

  const [editingProductId, setEditingProductId] = useState(null);
  const [editForm, setEditForm] = useState(initialForm);
  const [editImages, setEditImages] = useState([]);
  const [editVideoFile, setEditVideoFile] = useState(null);
  const [isUpdatingId, setIsUpdatingId] = useState(null);
  const [editImageUrls, setEditImageUrls] = useState(EMPTY_EDIT_IMAGE_URLS);

  const [orders, setOrders] = useState([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [isOrderDeletingId, setIsOrderDeletingId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderCostModal, setOrderCostModal] = useState(null);
  const [orderRtoModal, setOrderRtoModal] = useState(null);
  const [rtoCostDraft, setRtoCostDraft] = useState("");
  const [isRtoSaving, setIsRtoSaving] = useState(false);
  const [orderCostDraft, setOrderCostDraft] = useState({
    delivery_cost: "",
    packing_cost: "",
    ads_cost: "",
    rto_cost: "",
  });
  const [isOrderCostSaving, setIsOrderCostSaving] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [trackingForm, setTrackingForm] = useState({
    estimatedDeliveryAt: "",
    pickedUpFrom: "",
    pickedUpAt: "",
    outForDelivery: "no",
    outForDeliveryAt: "",
    deliveredAt: "",
  });
  const [receivedLocation, setReceivedLocation] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [receivedNote, setReceivedNote] = useState("");
  const [isTrackingBusy, setIsTrackingBusy] = useState(false);
  const [trackingDirty, setTrackingDirty] = useState(false);

  const orderStats = useMemo(() => {
    const byStatus = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      rto: 0,
    };

    const amountByCurrency = {};
    const costsByCurrency = {};
    let lastCreatedAt = null;
    let lastId = null;

    (orders || []).forEach((o) => {
      const s = String(o?.status || "").trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(byStatus, s)) byStatus[s] += 1;

      const isRto = s === "rto";

      const cur = String(o?.currency || "").trim().toUpperCase();
      const amt = Number(o?.amount);
      if (cur && Number.isFinite(amt) && !isRto) {
        amountByCurrency[cur] = (amountByCurrency[cur] || 0) + amt;
      }

      if (cur) {
        if (!costsByCurrency[cur]) {
          costsByCurrency[cur] = {
            delivery_cost: 0,
            packing_cost: 0,
            ads_cost: 0,
            rto_cost: 0,
          };
        }

        const delivery = Number(o?.delivery_cost);
        const packing = Number(o?.packing_cost);
        const ads = Number(o?.ads_cost);
        const rto = Number(o?.rto_cost);

        // For RTO orders: remove revenue/ads/delivery from dashboard; keep packing + RTO.
        if (!isRto) {
          if (Number.isFinite(delivery)) costsByCurrency[cur].delivery_cost += delivery;
          if (Number.isFinite(ads)) costsByCurrency[cur].ads_cost += ads;
        }
        if (Number.isFinite(packing)) costsByCurrency[cur].packing_cost += packing;
        if (Number.isFinite(rto)) costsByCurrency[cur].rto_cost += rto;
      }

      const created = o?.created_at ? new Date(o.created_at).getTime() : 0;
      const best = lastCreatedAt ? new Date(lastCreatedAt).getTime() : 0;
      if (created && created > best) {
        lastCreatedAt = o.created_at;
        lastId = o.id;
      }
    });

    return {
      total: Array.isArray(orders) ? orders.length : 0,
      byStatus,
      amountByCurrency,
      costsByCurrency,
      last: lastId ? { id: lastId, created_at: lastCreatedAt } : null,
    };
  }, [orders]);

  const [activePage, setActivePage] = useState("dashboard");
  const [paymentsRegion, setPaymentsRegion] = useState("IN");

  const EMPTY_BLOG_FORM = useMemo(
    () => ({ id: null, title: "", summary: "", content: "", image_url: "", author: "" }),
    []
  );
  const [blogs, setBlogs] = useState([]);
  const [blogForm, setBlogForm] = useState(EMPTY_BLOG_FORM);
  const [isBlogLoading, setIsBlogLoading] = useState(false);
  const [isBlogSaving, setIsBlogSaving] = useState(false);
  const [blogStatus, setBlogStatus] = useState({ type: "", message: "" });

  const EMPTY_POLICY_FORM = useMemo(
    () => ({ id: null, title: "", slug: "", footer_group: "Privacy & Legal", content: "" }),
    []
  );
  const [policies, setPolicies] = useState([]);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY_FORM);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(false);
  const [isPolicySaving, setIsPolicySaving] = useState(false);
  const [policyStatus, setPolicyStatus] = useState({ type: "", message: "" });

  const EMPTY_SITE_SETTINGS = useMemo(
    () => ({
      contact_email: "",
      contact_phone: "",
      contact_address: "",
      instagram_url: "",
      facebook_url: "",
      twitter_url: "",
      youtube_url: "",
    }),
    []
  );
  const [siteSettings, setSiteSettings] = useState(EMPTY_SITE_SETTINGS);
  const [isSiteSettingsLoading, setIsSiteSettingsLoading] = useState(false);
  const [isSiteSettingsSaving, setIsSiteSettingsSaving] = useState(false);
  const [siteSettingsStatus, setSiteSettingsStatus] = useState({ type: "", message: "" });

  const loadSiteSettings = useCallback(async () => {
    setIsSiteSettingsLoading(true);
    setSiteSettingsStatus({ type: "", message: "" });
    try {
      const res = await apiFetch("/site-settings");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Failed to load settings (${res.status})`);
      setSiteSettings((prev) => ({ ...prev, ...(data || {}) }));
    } catch (e) {
      console.error(e);
      setSiteSettings((prev) => ({ ...prev }));
      setSiteSettingsStatus({ type: "error", message: e?.message || "Failed to load settings" });
    } finally {
      setIsSiteSettingsLoading(false);
    }
  }, []);

  const loadBlogs = useCallback(async () => {
    setIsBlogLoading(true);
    try {
      const res = await apiFetch("/blogs");
      const data = await res.json().catch(() => ([]));
      setBlogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setBlogs([]);
    } finally {
      setIsBlogLoading(false);
    }
  }, []);

  const loadPolicies = useCallback(async () => {
    setIsPoliciesLoading(true);
    try {
      const res = await apiFetch("/policies");
      const data = await res.json().catch(() => ([]));
      if (!res.ok) throw new Error(data?.error || `Failed to load policies (${res.status})`);
      setPolicies(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setPolicies([]);
      setPolicyStatus({ type: "error", message: e?.message || "Failed to load policies" });
    } finally {
      setIsPoliciesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) return;
    if (activePage !== "blogs") return;
    loadBlogs();
  }, [admin, activePage, loadBlogs]);

  useEffect(() => {
    if (!admin) return;
    if (activePage !== "settings") return;
    loadSiteSettings();
  }, [admin, activePage, loadSiteSettings]);

  useEffect(() => {
    if (!admin) return;
    if (activePage !== "policies") return;
    loadPolicies();
  }, [admin, activePage, loadPolicies]);

  const onPolicyInput = (e) => {
    const { name, value } = e.target;
    setPolicyForm((prev) => ({ ...prev, [name]: value }));
  };

  const onPolicyEdit = (p) => {
    setPolicyStatus({ type: "", message: "" });
    setPolicyForm({
      id: p?.id ?? null,
      title: p?.title ?? "",
      slug: p?.slug ?? "",
      footer_group: p?.footer_group ?? "Privacy & Legal",
      content: p?.content ?? "",
    });
  };

  const onPolicyReset = () => {
    setPolicyStatus({ type: "", message: "" });
    setPolicyForm(EMPTY_POLICY_FORM);
  };

  const onPolicyDelete = async (id) => {
    const policyId = id ?? policyForm?.id;
    if (!policyId) return;
    if (!window.confirm("Delete this policy?")) return;

    setIsPolicySaving(true);
    setPolicyStatus({ type: "", message: "" });
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required");

      const res = await apiFetch(`/policies/${policyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Delete failed (${res.status})`);

      setPolicyStatus({ type: "success", message: "Deleted" });
      setPolicyForm(EMPTY_POLICY_FORM);
      await loadPolicies();
    } catch (e) {
      setPolicyStatus({ type: "error", message: e?.message || "Delete failed" });
    } finally {
      setIsPolicySaving(false);
    }
  };

  const onPolicySubmit = async (e) => {
    e.preventDefault();

    const title = String(policyForm?.title || "").trim();
    if (!title) {
      setPolicyStatus({ type: "error", message: "Title required" });
      return;
    }

    setIsPolicySaving(true);
    setPolicyStatus({ type: "", message: "" });
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required");

      const isEdit = Boolean(policyForm?.id);
      const url = isEdit ? `/policies/${policyForm.id}` : "/policies";
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          slug: policyForm?.slug || "",
          footer_group: policyForm?.footer_group || "Privacy & Legal",
          content: policyForm?.content || "",
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Save failed (${res.status})`);

      setPolicyStatus({ type: "success", message: isEdit ? "Updated" : "Added" });
      setPolicyForm(EMPTY_POLICY_FORM);
      await loadPolicies();
    } catch (e2) {
      setPolicyStatus({ type: "error", message: e2?.message || "Save failed" });
    } finally {
      setIsPolicySaving(false);
    }
  };

  const onSiteSettingsInput = (e) => {
    const { name, value } = e.target;
    setSiteSettings((prev) => ({ ...prev, [name]: value }));
  };

  const onSaveSiteSettings = async (e) => {
    e.preventDefault();
    setIsSiteSettingsSaving(true);
    setSiteSettingsStatus({ type: "", message: "" });

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required");

      const res = await apiFetch("/site-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(siteSettings || {}),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Save failed (${res.status})`);

      setSiteSettingsStatus({ type: "success", message: "Saved" });
      setSiteSettings((prev) => ({ ...prev, ...(payload?.settings || {}) }));
    } catch (e2) {
      setSiteSettingsStatus({ type: "error", message: e2?.message || "Save failed" });
    } finally {
      setIsSiteSettingsSaving(false);
    }
  };

  const onBlogInput = (e) => {
    const { name, value } = e.target;
    setBlogForm((prev) => ({ ...prev, [name]: value }));
  };

  const onBlogEdit = (b) => {
    setBlogStatus({ type: "", message: "" });
    setBlogForm({
      id: b?.id ?? null,
      title: b?.title ?? "",
      summary: b?.summary ?? "",
      content: b?.content ?? "",
      image_url: b?.image_url ?? "",
      author: b?.author ?? "",
    });
  };

  const onBlogReset = () => {
    setBlogStatus({ type: "", message: "" });
    setBlogForm(EMPTY_BLOG_FORM);
  };

  const onBlogDelete = async (id) => {
    const blogId = id ?? blogForm?.id;
    if (!blogId) return;
    if (!window.confirm("Delete this blog?")) return;

    setIsBlogSaving(true);
    setBlogStatus({ type: "", message: "" });
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required");
      const res = await apiFetch(`/blogs/${blogId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || `Delete failed (${res.status})`);
      setBlogStatus({ type: "success", message: "Deleted" });
      setBlogForm(EMPTY_BLOG_FORM);
      await loadBlogs();
    } catch (e) {
      setBlogStatus({ type: "error", message: e?.message || "Delete failed" });
    } finally {
      setIsBlogSaving(false);
    }
  };

  const onBlogSubmit = async (e) => {
    e.preventDefault();

    const title = String(blogForm?.title || "").trim();
    const content = String(blogForm?.content || "").trim();
    if (!title || !content) {
      setBlogStatus({ type: "error", message: "Title and content required" });
      return;
    }

    setIsBlogSaving(true);
    setBlogStatus({ type: "", message: "" });
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Login required");

      const isEdit = Boolean(blogForm?.id);
      const url = isEdit ? `/blogs/${blogForm.id}` : "/blogs";
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          summary: blogForm?.summary || "",
          image_url: blogForm?.image_url || "",
          author: blogForm?.author || "",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || payload?.message || `Save failed (${res.status})`);

      setBlogStatus({ type: "success", message: isEdit ? "Updated" : "Added" });
      setBlogForm(EMPTY_BLOG_FORM);
      await loadBlogs();
    } catch (e2) {
      setBlogStatus({ type: "error", message: e2?.message || "Save failed" });
    } finally {
      setIsBlogSaving(false);
    }
  };
  const EMPTY_MANUAL_SUBMIT = useMemo(
    () => ({
      date: "",
      deliveryPartnerInr: "",
      paypalInr: "",
      upiWhatsappInr: "",
      deliveryPartnerTo: "bank", // bank | hand
      paypalTo: "bank", // bank | hand
      upiWhatsappTo: "bank", // bank | hand
      savedMessage: "",
    }),
    []
  );
  const [manualSubmitOpen, setManualSubmitOpen] = useState(false);
  const [manualSubmitByRegion, setManualSubmitByRegion] = useState({
    IN: { ...EMPTY_MANUAL_SUBMIT },
    USA: { ...EMPTY_MANUAL_SUBMIT },
  });
  const manualSubmitDateRef = useRef(null);
  const [manualSubmitLoading, setManualSubmitLoading] = useState(false);
  const [manualSubmitError, setManualSubmitError] = useState("");
  const [manualRecentByRegion, setManualRecentByRegion] = useState({ IN: [], USA: [] });
  const [manualRecentLoading, setManualRecentLoading] = useState(false);
  const [manualRecentError, setManualRecentError] = useState("");
  const [manualSummaryByRegion, setManualSummaryByRegion] = useState({
    IN: { cashInBankInr: "0.00", cashInHandInr: "0.00" },
    USA: { cashInBankInr: "0.00", cashInHandInr: "0.00" },
  });
  const [manualSummaryMetaByRegion, setManualSummaryMetaByRegion] = useState({
    IN: { mode: "api" },
    USA: { mode: "api" },
  });
  const [manualSummaryLoading, setManualSummaryLoading] = useState(false);
  const [manualSummaryError, setManualSummaryError] = useState("");

  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState("");

  const TAKEOUT_PURPOSES = useMemo(
    () => [
      "Personal expense",
      "Stock buy",
      "Delivery Partner App Payment",
      "Ads",
      "Branded Packets Buy",
      "Salary",
      "Packaging",
      "Printer Essentials Office Essentials",
      "Taken Out By Azad",
      "Taken Out By Mukul",
      "Cost Price Taken Out",
    ],
    []
  );
  const [takeoutAmountInr, setTakeoutAmountInr] = useState("");
  const [takeoutDate, setTakeoutDate] = useState("");
  const [takeoutSource, setTakeoutSource] = useState("hand"); // bank | hand
  const [takeoutPurpose, setTakeoutPurpose] = useState("Personal expense");
  const [takeoutSaving, setTakeoutSaving] = useState(false);
  const [takeoutError, setTakeoutError] = useState("");
  const [takeoutsRecent, setTakeoutsRecent] = useState([]);
  const [takeoutsLoading, setTakeoutsLoading] = useState(false);
  const [takeoutsError, setTakeoutsError] = useState("");
  const [ordersTab, setOrdersTab] = useState("Pending");

  useEffect(() => {
    if (activePage !== "payments") {
      setManualSubmitOpen(false);
    }
  }, [activePage]);

  useEffect(() => {
    if (!manualSubmitOpen) return;
    const el = manualSubmitDateRef.current;
    if (!el) return;
    try {
      el.focus();
      if (typeof el.showPicker === "function") el.showPicker();
    } catch {
      // ignore
    }
  }, [manualSubmitOpen, paymentsRegion]);

  const loadManualPaymentForDate = async ({ region, date }) => {
    if (!admin) return;
    if (!region || !date) return;

    setManualSubmitLoading(true);
    setManualSubmitError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const qs = new URLSearchParams({ region, date }).toString();
      const res = await apiFetch(`/admin/manual-payments?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      const entry = payload?.entry || null;
      if (!entry) return;

      setManualSubmitByRegion((prev) => ({
        ...prev,
        [region]: {
          ...(prev[region] || { ...EMPTY_MANUAL_SUBMIT }),
          date: entry.pay_date || date,
          deliveryPartnerInr: String(entry.delivery_partner_inr ?? ""),
          paypalInr: String(entry.paypal_inr ?? ""),
          upiWhatsappInr: String(entry.upi_whatsapp_inr ?? ""),
          deliveryPartnerTo: String(entry.delivery_partner_to || "bank"),
          paypalTo: String(entry.paypal_to || "bank"),
          upiWhatsappTo: String(entry.upi_whatsapp_to || "bank"),
          savedMessage: "",
        },
      }));
    } catch (e) {
      setManualSubmitError(e?.message || "Failed to load entry");
    } finally {
      setManualSubmitLoading(false);
    }
  };

  const saveManualPayment = async ({ region, manual }) => {
    if (!admin) throw new Error("Missing admin session");
    const token = await getAccessToken();
    if (!token) throw new Error("Missing admin session");

    const res = await apiFetch("/admin/manual-payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        region,
        date: manual.date,
        deliveryPartnerInr: manual.deliveryPartnerInr,
        paypalInr: manual.paypalInr,
        upiWhatsappInr: manual.upiWhatsappInr,
        deliveryPartnerTo: manual.deliveryPartnerTo,
        paypalTo: manual.paypalTo,
        upiWhatsappTo: manual.upiWhatsappTo,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = payload?.error || payload?.message || `Failed (${res.status})`;
      throw new Error(msg);
    }

    return payload?.entry || null;
  };

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || "";
  }, []);

  const toPaiseSafe = (value) => {
    if (value === undefined || value === null || value === "") return 0;
    const raw0 = String(value).trim();
    if (!raw0) return 0;

    let raw = raw0.replace(/\s+/g, "");
    raw = raw.replace(/[^0-9,.\-+]/g, "");
    if (!raw) return 0;
    if (raw.includes(",") && raw.includes(".")) raw = raw.replace(/,/g, "");
    else if (raw.includes(",") && !raw.includes(".")) raw = raw.replace(/,/g, ".");
    if (raw.startsWith("+")) raw = raw.slice(1);
    if (raw.startsWith("-.")) raw = raw.replace("-.", "-0.");
    if (raw.startsWith(".")) raw = `0${raw}`;

    const neg = raw.startsWith("-");
    const s = neg ? raw.slice(1) : raw;
    if (!/^\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.round(n * 100));
    }

    const parts = s.split(".");
    const whole = parts[0] || "0";
    const frac = parts[1] || "";
    const frac3 = (frac + "000").slice(0, 3);
    const cents = parseInt(frac3.slice(0, 2), 10) || 0;
    const roundDigit = parseInt(frac3.slice(2, 3), 10) || 0;
    let paise = (parseInt(whole, 10) || 0) * 100 + cents + (roundDigit >= 5 ? 1 : 0);
    if (neg) paise = -paise;
    if (!Number.isFinite(paise)) return 0;
    return Math.max(0, Math.trunc(paise));
  };

  const paiseToStr2Safe = (paise) => {
    const p = Number.isFinite(Number(paise)) ? Math.max(0, Math.trunc(Number(paise))) : 0;
    const whole = Math.trunc(p / 100);
    const frac = String(p % 100).padStart(2, "0");
    return `${whole}.${frac}`;
  };

  const exportPaymentsPdf = useCallback(async () => {
    if (!admin) return;
    setExportingPdf(true);
    setExportPdfError("");

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const region = paymentsRegion;
      const currency = "₹";

      const qsSummary = new URLSearchParams({ region }).toString();
      const qsRecent = new URLSearchParams({ region, limit: "200" }).toString();
      const qsTakeouts = new URLSearchParams({ region, limit: "200" }).toString();

      const [summaryRes, recentRes, takeoutsRes] = await Promise.all([
        apiFetch(`/admin/manual-payments/summary?${qsSummary}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch(`/admin/manual-payments/recent?${qsRecent}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        apiFetch(`/admin/cash-takeouts/recent?${qsTakeouts}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const recentPayload = await recentRes.json().catch(() => ({}));
      if (!recentRes.ok) {
        const msg = recentPayload?.error || recentPayload?.message || `Failed (${recentRes.status})`;
        throw new Error(msg);
      }
      const entries = Array.isArray(recentPayload?.entries) ? recentPayload.entries : [];

      const takeoutsPayload = await takeoutsRes.json().catch(() => ({}));
      if (!takeoutsRes.ok) {
        const msg = takeoutsPayload?.error || takeoutsPayload?.message || `Failed (${takeoutsRes.status})`;
        throw new Error(msg);
      }
      const takeouts = Array.isArray(takeoutsPayload?.takeouts) ? takeoutsPayload.takeouts : [];

      let totals = { cash_in_bank_inr: "0.00", cash_in_hand_inr: "0.00" };
      let bestEffort = false;

      if (summaryRes.status === 404) {
        bestEffort = true;
        const bankPaise = entries.reduce((s, x) => s + toPaiseSafe(x?.cash_in_bank_inr), 0);
        const handPaise = entries.reduce((s, x) => s + toPaiseSafe(x?.cash_in_hand_inr), 0);
        const takeBankPaise = takeouts
          .filter((t) => String(t?.source || "").toLowerCase() !== "hand")
          .reduce((s, t) => s + toPaiseSafe(t?.amount_inr), 0);
        const takeHandPaise = takeouts
          .filter((t) => String(t?.source || "").toLowerCase() === "hand")
          .reduce((s, t) => s + toPaiseSafe(t?.amount_inr), 0);

        const netBankPaise = Math.max(0, bankPaise - takeBankPaise);
        const netHandPaise = Math.max(0, handPaise - takeHandPaise);
        totals = {
          cash_in_bank_inr: paiseToStr2Safe(netBankPaise),
          cash_in_hand_inr: paiseToStr2Safe(netHandPaise),
        };
      } else {
        const summaryPayload = await summaryRes.json().catch(() => ({}));
        if (!summaryRes.ok) {
          const msg = summaryPayload?.error || summaryPayload?.message || `Failed (${summaryRes.status})`;
          throw new Error(msg);
        }
        totals = summaryPayload?.totals || totals;
      }

      const { default: jsPDF } = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule.autoTable || autoTableModule;

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      const now = new Date();
      const stamp = now.toISOString().slice(0, 19).replace("T", " ");
      const filenameDate = now.toISOString().slice(0, 10);

      doc.setFontSize(16);
      doc.text(`Payments Report (${region})`, 40, 50);
      doc.setFontSize(10);
      doc.text(`Generated: ${stamp}`, 40, 68);
      if (bestEffort) doc.text("Note: Totals are best-effort (summary endpoint not available).", 40, 84);

      const bankTotalStr = String(totals?.cash_in_bank_inr ?? "0.00");
      const handTotalStr = String(totals?.cash_in_hand_inr ?? "0.00");

      autoTable(doc, {
        startY: bestEffort ? 100 : 92,
        head: [["Cash in Bank", "Cash in Hand"]],
        body: [[`${currency}${bankTotalStr}`, `${currency}${handTotalStr}`]],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [17, 24, 39] },
      });

      const entriesBody = entries.map((r) => {
        const d = String(r?.pay_date || "");
        const dpPaise = toPaiseSafe(r?.delivery_partner_inr);
        const upiPaise = toPaiseSafe(r?.upi_whatsapp_inr);
        const ppPaise = toPaiseSafe(r?.paypal_inr);
        const bankPaise = toPaiseSafe(r?.cash_in_bank_inr);
        const handPaise = toPaiseSafe(r?.cash_in_hand_inr);
        const totalPaise = dpPaise + upiPaise + ppPaise;
        return [
          d,
          `${currency}${paiseToStr2Safe(bankPaise)}`,
          `${currency}${paiseToStr2Safe(handPaise)}`,
          `${currency}${paiseToStr2Safe(dpPaise)}`,
          `${currency}${paiseToStr2Safe(upiPaise)}`,
          `${currency}${paiseToStr2Safe(ppPaise)}`,
          `${currency}${paiseToStr2Safe(totalPaise)}`,
        ];
      });

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 92) + 18,
        head: [["Date", "Bank", "Hand", "Delivery", "UPI/WhatsApp", "PayPal", "Total"]],
        body: entriesBody.length ? entriesBody : [["—", "—", "—", "—", "—", "—", "—"]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [17, 24, 39] },
      });

      const takeoutsBody = takeouts.map((t) => {
        const d = String(t?.take_date || "");
        const src = String(t?.source || "").toLowerCase() === "hand" ? "Hand" : "Bank";
        const purpose = String(t?.purpose || "");
        const amtPaise = toPaiseSafe(t?.amount_inr);
        return [d, src, purpose || "—", `${currency}${paiseToStr2Safe(amtPaise)}`];
      });

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY || 92) + 18,
        head: [["Date", "Source", "Purpose", "Amount"]],
        body: takeoutsBody.length ? takeoutsBody : [["—", "—", "—", "—"]],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [17, 24, 39] },
      });

      doc.save(`payments-${region}-${filenameDate}.pdf`);
    } catch (e) {
      setExportPdfError(e?.message || "Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }, [admin, paymentsRegion, getAccessToken]);

  const loadManualRecent = useCallback(async (region) => {
    if (!admin) return;
    if (!region) return;
    setManualRecentLoading(true);
    setManualRecentError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");
      const qs = new URLSearchParams({ region, limit: "30" }).toString();
      const res = await apiFetch(`/admin/manual-payments/recent?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      setManualRecentByRegion((prev) => ({ ...prev, [region]: entries }));
    } catch (e) {
      setManualRecentError(e?.message || "Failed to load recent entries");
    } finally {
      setManualRecentLoading(false);
    }
  }, [admin, getAccessToken]);

  const loadManualSummary = useCallback(async (region) => {
    if (!admin) return;
    if (!region) return;
    setManualSummaryLoading(true);
    setManualSummaryError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");
      const qs = new URLSearchParams({ region }).toString();
      const res = await apiFetch(`/admin/manual-payments/summary?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If backend deployment doesn't have /summary yet, avoid showing 404 in UI.
      if (res.status === 404) {
        // Fallback: sum from recent list (best-effort).
        const rQs = new URLSearchParams({ region, limit: "200" }).toString();
        const rRes = await apiFetch(`/admin/manual-payments/recent?${rQs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rPayload = await rRes.json().catch(() => ({}));
        if (rRes.ok) {
          const entries = Array.isArray(rPayload?.entries) ? rPayload.entries : [];
          const bankPaise = entries.reduce((s, x) => s + toPaiseSafe(x?.cash_in_bank_inr), 0);
          const handPaise = entries.reduce((s, x) => s + toPaiseSafe(x?.cash_in_hand_inr), 0);
          setManualSummaryByRegion((prev) => ({
            ...prev,
            [region]: {
              cashInBankInr: paiseToStr2Safe(bankPaise),
              cashInHandInr: paiseToStr2Safe(handPaise),
            },
          }));
          setManualSummaryMetaByRegion((prev) => ({
            ...prev,
            [region]: { mode: "fallback" },
          }));
          setManualSummaryError("");
          return;
        }
      }

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }
      const totals = payload?.totals || {};
      setManualSummaryByRegion((prev) => ({
        ...prev,
        [region]: {
          cashInBankInr: String(totals.cash_in_bank_inr ?? "0.00"),
          cashInHandInr: String(totals.cash_in_hand_inr ?? "0.00"),
        },
      }));
      setManualSummaryMetaByRegion((prev) => ({
        ...prev,
        [region]: { mode: "api" },
      }));
    } catch (e) {
      setManualSummaryError(e?.message || "Failed to load cash totals");
    } finally {
      setManualSummaryLoading(false);
    }
  }, [admin, getAccessToken]);

  const loadTakeoutsRecent = useCallback(async (region) => {
    if (!admin) return;
    setTakeoutsLoading(true);
    setTakeoutsError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");
      const qs = new URLSearchParams({ region, limit: "50" }).toString();
      const res = await apiFetch(`/admin/cash-takeouts/recent?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }
      setTakeoutsRecent(Array.isArray(payload?.takeouts) ? payload.takeouts : []);
    } catch (e) {
      setTakeoutsError(e?.message || "Failed to load takeouts");
    } finally {
      setTakeoutsLoading(false);
    }
  }, [admin, getAccessToken]);

  const saveTakeout = useCallback(async ({ region, date, source, amountInr, purpose }) => {
    if (!admin) throw new Error("Missing admin session");
    const token = await getAccessToken();
    if (!token) throw new Error("Missing admin session");

    const res = await apiFetch("/admin/cash-takeouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        region,
        date,
        source,
        amountInr,
        purpose,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = payload?.error || payload?.message || `Failed (${res.status})`;
      throw new Error(msg);
    }
    return payload?.takeout || null;
  }, [admin, getAccessToken]);

  useEffect(() => {
    if (!admin) return;
    if (activePage !== "payments") return;
    loadManualRecent(paymentsRegion);
    loadManualSummary(paymentsRegion);
    loadTakeoutsRecent(paymentsRegion);
  }, [admin, activePage, paymentsRegion, loadManualRecent, loadManualSummary, loadTakeoutsRecent]);

  const goto = (page) => {
    setActivePage(page);
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // ignore
    }
  };

  const formatOrderDate = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  };

  const formatOrderTime = (value) => {
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatOrderAddress = (o) => {
    const parts = [o?.address, o?.city, o?.state, o?.pincode]
      .map((x) => (x === undefined || x === null ? "" : String(x).trim()))
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  };

  const statusPillClass = (status) => {
    const s = String(status || "").trim().toLowerCase();
    if (s === "delivered" || s === "completed") return "z-badge-pill z-pill-green";
    if (s === "shipped" || s === "in progress" || s === "processing") return "z-badge-pill z-pill-blue";
    if (s === "pending") return "z-badge-pill z-pill-yellow";
    if (s === "confirmed") return "z-badge-pill z-pill-purple";
    if (s === "rto") return "z-badge-pill z-pill-red";
    if (s === "cancelled" || s === "failed" || s === "rejected") return "z-badge-pill z-pill-red";
    return "z-badge-pill z-pill-purple";
  };

  const filteredOrdersForTab = useMemo(() => {
    const map = {
      "On Hold": "on hold",
      Pending: "pending",
      "Ready to Ship": "confirmed",
      Shipped: "shipped",
      Cancelled: "cancelled",
      RTO: "rto",
    };
    const target = map[ordersTab] || "pending";
    return (orders || []).filter((o) => String(o?.status || "").trim().toLowerCase() === target);
  }, [orders, ordersTab]);

  const outOfStockCount = useMemo(() => {
    return (products || []).filter((p) => Number(p?.quantity) === 0).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    const threshold = 5;
    return (products || []).filter((p) => {
      const q = Number(p?.quantity);
      return Number.isFinite(q) && q > 0 && q <= threshold;
    }).length;
  }, [products]);

  const ordersTabCounts = useMemo(() => {
    const mapping = {
      "On Hold": "on hold",
      Pending: "pending",
      "Ready to Ship": "confirmed",
      Shipped: "shipped",
      Cancelled: "cancelled",
      RTO: "rto",
    };
    const result = {};
    Object.keys(mapping).forEach((tab) => {
      const target = mapping[tab];
      result[tab] = (orders || []).filter(
        (o) => String(o?.status || "").trim().toLowerCase() === target
      ).length;
    });
    return result;
  }, [orders]);

  const refreshAdmin = async () => {
    const token = await getAccessToken();
    if (!token) {
      setAdmin(null);
      return;
    }

    const res = await apiFetch("/admin/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setAdmin(null);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setAdmin(data?.admin || null);
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch("/products");
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || data?.message || "Failed to load products";
        throw new Error(msg);
      }
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!admin) return;
    setIsOrdersLoading(true);
    setOrdersError("");
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      const list = Array.isArray(payload?.orders) ? payload.orders : [];
      const weight = {
        pending: 0,
        confirmed: 1,
        shipped: 2,
        delivered: 3,
        cancelled: 4,
        rto: 5,
      };

      const sorted = [...list].sort((a, b) => {
        const sa = String(a?.status || "").toLowerCase();
        const sb = String(b?.status || "").toLowerCase();
        const wa = Object.prototype.hasOwnProperty.call(weight, sa) ? weight[sa] : 99;
        const wb = Object.prototype.hasOwnProperty.call(weight, sb) ? weight[sb] : 99;
        if (wa !== wb) return wa - wb;

        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      setOrders(sorted);
      if (!selectedOrderId && list.length) {
        setSelectedOrderId(String(list[0].id));
      }
    } catch (e) {
      console.error(e);
      const msg = e.message || "Failed to load orders";
      setOrdersError(msg);
      setStatus({ type: "error", message: msg });
    } finally {
      setIsOrdersLoading(false);
    }
  };

  useEffect(() => {
    refreshAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (admin) {
      loadProducts();
      loadOrders();
    } else {
      setProducts([]);
      setOrders([]);
      setSelectedOrderId("");
      setOrdersError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin]);

  // Auto-refresh orders so newly placed orders show up quickly.
  useEffect(() => {
    if (!admin) return undefined;

    const id = setInterval(() => {
      if (isTrackingBusy) return;
      if (trackingDirty) return;
      loadOrders();
    }, 15000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, isTrackingBusy, trackingDirty]);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (trackingDirty) return;
    const o = orders.find((x) => String(x.id) === String(selectedOrderId));
    if (!o) return;

    setTrackingForm({
      estimatedDeliveryAt: toDateTimeLocalValue(o.estimated_delivery_at),
      pickedUpFrom: o.picked_up_from || "",
      pickedUpAt: toDateTimeLocalValue(o.picked_up_at),
      outForDelivery: o.out_for_delivery ? "yes" : "no",
      outForDeliveryAt: toDateTimeLocalValue(o.out_for_delivery_at),
      deliveredAt: toDateTimeLocalValue(o.delivered_at),
    });

    setReceivedLocation("");
    setReceivedAt("");
    setReceivedNote("");
  }, [selectedOrderId, orders, trackingDirty]);

  const selectOrderForTracking = (orderId) => {
    const next = String(orderId || "");
    setTrackingDirty(false);
    setSelectedOrderId(next);
    goto("tracking");

    try {
      // Native anchor navigation as a fallback.
      window.location.hash = "order-tracking";
    } catch {
      // ignore
    }

    setTimeout(() => {
      try {
        trackingSectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      } catch {
        // ignore
      }
    }, 0);
  };

  const onTrackingChange = (e) => {
    const { name, value } = e.target;
    setTrackingDirty(true);
    setTrackingForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSaveTracking = async () => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }
    if (!selectedOrderId) {
      setStatus({ type: "error", message: "Please select an order" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(selectedOrderId)}/tracking`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          estimatedDeliveryAt: trackingForm.estimatedDeliveryAt || null,
          pickedUpFrom: trackingForm.pickedUpFrom || null,
          pickedUpAt: trackingForm.pickedUpAt || null,
          outForDelivery: trackingForm.outForDelivery === "yes",
          outForDeliveryAt: trackingForm.outForDeliveryAt || null,
          deliveredAt: trackingForm.deliveredAt || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Tracking updated" });
      setTrackingDirty(false);
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Tracking update failed" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onAddReceived = async () => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }
    if (!selectedOrderId) {
      setStatus({ type: "error", message: "Please select an order" });
      return;
    }
    if (!receivedLocation.trim()) {
      setStatus({ type: "error", message: "Please enter received location" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(selectedOrderId)}/tracking/received`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          location: receivedLocation.trim(),
          receivedAt: receivedAt || null,
          note: receivedNote.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Received location added" });
      setReceivedLocation("");
      setReceivedAt("");
      setReceivedNote("");
      setTrackingDirty(false);
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to add received location" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onUpdateOrderStatus = async (orderId, nextStatus) => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    setIsTrackingBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus({ type: "success", message: "Order status updated" });
      await loadOrders();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to update order status" });
    } finally {
      setIsTrackingBusy(false);
    }
  };

  const onDeleteOrder = async (orderId) => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const ok = window.confirm(`Delete order #${orderId}? This cannot be undone.`);
    if (!ok) return;

    setIsOrderDeletingId(orderId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Delete failed (${res.status})`;
        throw new Error(msg);
      }

      setOrders((prev) => prev.filter((o) => String(o.id) !== String(orderId)));
      if (String(selectedOrderId) === String(orderId)) {
        setSelectedOrderId("");
        setTrackingDirty(false);
      }
      setStatus({ type: "success", message: `Deleted order: ${orderId}` });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to delete order" });
    } finally {
      setIsOrderDeletingId(null);
    }
  };

  const parseCostInputOrNull = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const openRtoModal = (order) => {
    if (!order?.id) return;
    setOrderRtoModal(order);
    setRtoCostDraft(order?.rto_cost ?? "");
  };

  const onConfirmMarkAsRto = async () => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const orderId = orderRtoModal?.id;
    if (!orderId) return;

    const rtoCost = parseCostInputOrNull(rtoCostDraft);
    if (rtoCost !== null && rtoCost < 0) {
      setStatus({ type: "error", message: "RTO cost cannot be negative" });
      return;
    }

    setIsRtoSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const sRes = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "rto" }),
      });
      const sPayload = await sRes.json().catch(() => ({}));
      if (!sRes.ok) {
        const msg = sPayload?.error || sPayload?.message || `Failed (${sRes.status})`;
        throw new Error(msg);
      }

      const cRes = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/costs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rtoCost }),
      });
      const updated = await cRes.json().catch(() => ({}));
      if (!cRes.ok) {
        const msg = updated?.error || updated?.message || `Failed (${cRes.status})`;
        throw new Error(msg);
      }

      setOrders((prev) => prev.map((o) => (String(o.id) === String(orderId) ? updated : o)));
      if (String(orderDetails?.id) === String(orderId)) setOrderDetails(updated);
      if (String(orderCostModal?.id) === String(orderId)) setOrderCostModal(updated);

      setOrderRtoModal(null);
      setRtoCostDraft("");

      const warning = updated?.warning ? ` ${updated.warning}` : "";
      setStatus({ type: "success", message: `Marked as RTO.${warning}` });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to mark as RTO" });
    } finally {
      setIsRtoSaving(false);
    }
  };

  const onSaveOrderCosts = async () => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const orderId = orderCostModal?.id || orderDetails?.id;
    if (!orderId) return;

    const deliveryCost = parseCostInputOrNull(orderCostDraft.delivery_cost);
    const packingCost = parseCostInputOrNull(orderCostDraft.packing_cost);
    const adsCost = parseCostInputOrNull(orderCostDraft.ads_cost);
    const rtoCost = parseCostInputOrNull(orderCostDraft.rto_cost);

    const vals = [deliveryCost, packingCost, adsCost, rtoCost];
    for (const v of vals) {
      if (v !== null && v < 0) {
        setStatus({ type: "error", message: "Costs cannot be negative" });
        return;
      }
    }

    setIsOrderCostSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/admin/orders/${encodeURIComponent(orderId)}/costs`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deliveryCost,
          packingCost,
          adsCost,
          rtoCost,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = payload?.error || payload?.message || `Failed (${res.status})`;
        throw new Error(msg);
      }

      setOrders((prev) => prev.map((o) => (String(o.id) === String(orderId) ? payload : o)));
      if (String(orderDetails?.id) === String(orderId)) setOrderDetails(payload);
      if (String(orderCostModal?.id) === String(orderId)) setOrderCostModal(payload);

      const warning = payload?.warning ? ` ${payload.warning}` : "";
      setStatus({ type: "success", message: `Order costs saved.${warning}` });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to save order costs" });
    } finally {
      setIsOrderCostSaving(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    if (!form.name.trim() || form.price_inr === "" || form.price_usd === "") {
      setStatus({ type: "error", message: "Name + Price INR + Price USD required hai" });
      return;
    }

    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const slug = slugify(form.name);

      const body = new FormData();
      body.append("category", normalizeCategory(form.category));
      body.append("name", form.name);
      body.append("slug", slug);
      if (form.sku !== undefined) body.append("sku", form.sku);
      if (form.barcode !== undefined) body.append("barcode", form.barcode);
      if (form.quantity !== undefined) body.append("quantity", form.quantity);
      body.append("mrp_inr", form.mrp_inr);
      body.append("mrp_usd", form.mrp_usd);
      body.append("price_inr", form.price_inr);
      body.append("price_usd", form.price_usd);
      body.append("cost_inr", form.cost_inr);
      body.append("cost_usd", form.cost_usd);
      body.append("video_url", form.video_url);
      body.append("price", form.price_inr);
      body.append("description", form.description);
      body.append("sizes", JSON.stringify(form.sizes || []));
      // Patch: Always send image slots for new products
      body.append("image1", "");
      body.append("image2", "");
      body.append("image3", "");
      body.append("image4", "");
      images.slice(0, 4).forEach((file) => body.append("images", file));
      if (videoFile) body.append("video", videoFile);

      const res = await apiFetch("/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || data?.message || "Product add failed";
        throw new Error(message);
      }

      const warning = data?.warning ? `\n${data.warning}` : "";
      setStatus({ type: "success", message: `Added: ${data.name}${warning}` });
      setForm(initialForm);
      setImages([]);
      setVideoFile(null);
      loadProducts();
    } catch (err) {
      console.error(err);
      setStatus({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async (productId, productName) => {
    setStatus({ type: "", message: "" });

    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const ok = window.confirm(`Delete "${productName}"?`);
    if (!ok) return;

    setIsDeletingId(productId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/products/${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Delete failed (${res.status})`;
        throw new Error(msg);
      }

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setStatus({ type: "success", message: `Deleted: ${productName}` });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message });
    } finally {
      setIsDeletingId(null);
    }
  };

  const onStartEditProduct = (p) => {
    setStatus({ type: "", message: "" });
    setEditingProductId(p.id);
    setEditForm({
      name: p.name || "",
      category: normalizeCategory(p.category),
      sku: p.sku ?? "",
      barcode: p.barcode ?? "",
      quantity: p.quantity ?? "",
      mrp_inr: p.mrp_inr ?? "",
      mrp_usd: p.mrp_usd ?? "",
      price_inr: p.price_inr ?? p.price ?? "",
      price_usd: p.price_usd ?? "",
      cost_inr: p.cost_inr ?? "",
      cost_usd: p.cost_usd ?? "",
      video_url: p.video_url ?? "",
      description: p.description || "",
      sizes: normalizeSizes(p.sizes),
    });
    setEditImages([]);
    setEditVideoFile(null);

    setEditImageUrls({
      image1: p.image1 || "",
      image2: p.image2 || "",
      image3: p.image3 || "",
      image4: p.image4 || "",
    });
  };

  const moveEditImage = (index, delta) => {
    setEditImages((prev) => {
      if (!Array.isArray(prev) || prev.length < 2) return prev;
      const from = index;
      const to = index + delta;
      if (from < 0 || from >= prev.length) return prev;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const removeEditImage = (index) => {
    setEditImages((prev) => {
      if (!Array.isArray(prev) || index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const onCancelEditProduct = () => {
    setEditingProductId(null);
    setEditForm(initialForm);
    setEditImages([]);
    setEditVideoFile(null);
    setEditImageUrls(EMPTY_EDIT_IMAGE_URLS);
  };

  const moveExistingImageSlot = (fromIdx, delta) => {
    const slots = ["image1", "image2", "image3", "image4"];
    const toIdx = fromIdx + delta;
    if (fromIdx < 0 || fromIdx >= slots.length) return;
    if (toIdx < 0 || toIdx >= slots.length) return;
    const a = slots[fromIdx];
    const b = slots[toIdx];
    setEditImageUrls((prev) => {
      const next = { ...prev };
      const t = next[a];
      next[a] = next[b];
      next[b] = t;
      return next;
    });
  };

  const clearExistingImageSlot = (idx) => {
    const slots = ["image1", "image2", "image3", "image4"];
    const key = slots[idx];
    setEditImageUrls((prev) => ({ ...prev, [key]: "" }));
  };

  const onSaveEditProduct = async () => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }
    if (!editingProductId) return;

    if (!editForm.name.trim() || editForm.price_inr === "" || editForm.price_usd === "") {
      setStatus({ type: "error", message: "Name + Price INR + Price USD required" });
      return;
    }

    setIsUpdatingId(editingProductId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const body = new FormData();
      body.append("category", normalizeCategory(editForm.category));
      body.append("name", editForm.name);
      body.append("sku", editForm.sku);
      body.append("barcode", editForm.barcode);
      body.append("quantity", editForm.quantity);
      body.append("mrp_inr", editForm.mrp_inr);
      body.append("mrp_usd", editForm.mrp_usd);
      body.append("price_inr", editForm.price_inr);
      body.append("price_usd", editForm.price_usd);
      body.append("cost_inr", editForm.cost_inr);
      body.append("cost_usd", editForm.cost_usd);
      body.append("video_url", editForm.video_url);
      body.append("price", editForm.price_inr);
      body.append("description", editForm.description);
      body.append("sizes", JSON.stringify(editForm.sizes || []));

      // Allow reordering existing images even when no new files are uploaded.
      body.append("image1", editImageUrls.image1 || "");
      body.append("image2", editImageUrls.image2 || "");
      body.append("image3", editImageUrls.image3 || "");
      body.append("image4", editImageUrls.image4 || "");

      editImages.slice(0, 4).forEach((file) => body.append("images", file));
      if (editVideoFile) body.append("video", editVideoFile);

      const res = await apiFetch(`/products/${encodeURIComponent(editingProductId)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Update failed (${res.status})`;
        throw new Error(msg);
      }

      setProducts((prev) => prev.map((p) => (p.id === editingProductId ? data : p)));
      const warning = data?.warning ? `\n${data.warning}` : "";
      setStatus({ type: "success", message: `Updated: ${data.name}${warning}` });
      onCancelEditProduct();
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to update product" });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const onSaveInventoryQuantity = async (productId) => {
    setStatus({ type: "", message: "" });
    if (!admin) {
      setStatus({ type: "error", message: "Please login as admin first" });
      return;
    }

    const draft = inventoryEdits?.[productId];
    const raw = draft?.quantity;

    if (raw === undefined) return;

    const nextQuantity = raw === "" || raw === null ? null : Number(raw);
    if (nextQuantity !== null) {
      if (!Number.isFinite(nextQuantity) || !Number.isInteger(nextQuantity)) {
        setStatus({ type: "error", message: "Quantity must be an integer" });
        return;
      }
      if (nextQuantity < 0) {
        setStatus({ type: "error", message: "Quantity cannot be negative" });
        return;
      }
    }

    setInventorySavingId(productId);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Missing admin session");

      const res = await apiFetch(`/products/${encodeURIComponent(productId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity: nextQuantity }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Update failed (${res.status})`;
        throw new Error(msg);
      }

      setProducts((prev) => prev.map((p) => (p.id === productId ? data : p)));
      setStatus({ type: "success", message: "Inventory updated" });
      setInventoryEdits((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: "error", message: e.message || "Failed to update inventory" });
    } finally {
      setInventorySavingId(null);
    }
  };

  const onLogin = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!authEmail.trim() || !authPassword) {
      setStatus({ type: "error", message: "Email and password required" });
      return;
    }

    setIsAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) throw error;

      await refreshAdmin();
      setStatus({ type: "success", message: "Logged in" });
    } catch (e2) {
      console.error(e2);
      setStatus({ type: "error", message: e2.message || "Login failed" });
    } finally {
      setIsAuthBusy(false);
    }
  };

  const onCreateAccount = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!authEmail.trim() || !authPassword) {
      setStatus({ type: "error", message: "Email and password required" });
      return;
    }

    if (!inviteCode.trim()) {
      setStatus({ type: "error", message: "Invite code required" });
      return;
    }

    setIsAuthBusy(true);
    try {
      const res = await apiFetch("/admin/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          inviteCode: inviteCode.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.message || `Create failed (${res.status})`;
        throw new Error(msg);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) throw error;

      await refreshAdmin();
      setStatus({ type: "success", message: "Admin account created and logged in" });
    } catch (e2) {
      console.error(e2);
      const raw = String(e2?.message || "");
      const looksLikeNetwork = /failed to fetch|networkerror|load failed|fetch/i.test(raw);
      if (looksLikeNetwork) {
        const base = getApiBase() || "(empty)";
        setStatus({
          type: "error",
          message:
            `Failed to reach backend (${base}). Replit backend run/deploy karo aur Netlify env me REACT_APP_API_URL ko public URL (replit.app / repl.co) pe set karke redeploy karo.`,
        });
      } else {
        setStatus({ type: "error", message: raw || "Create account failed" });
      }
    } finally {
      setIsAuthBusy(false);
    }
  };

  const onLogout = async () => {
    setStatus({ type: "", message: "" });
    await supabase.auth.signOut();
    setAdmin(null);
    setProducts([]);
    setActivePage("dashboard");
    setStatus({ type: "success", message: "Logged out" });
  };

  const renderDashboard = () => {
    const revenueInr = orderStats.amountByCurrency?.INR || 0;
    const revenueUsd = orderStats.amountByCurrency?.USD || 0;

    const inrCosts = orderStats.costsByCurrency?.INR || {
      delivery_cost: 0,
      packing_cost: 0,
      ads_cost: 0,
      rto_cost: 0,
    };
    const usdCosts = orderStats.costsByCurrency?.USD || {
      delivery_cost: 0,
      packing_cost: 0,
      ads_cost: 0,
      rto_cost: 0,
    };

    const deliveryPackingRtoAdsInr =
      (inrCosts.delivery_cost || 0) + (inrCosts.packing_cost || 0) + (inrCosts.rto_cost || 0) + (inrCosts.ads_cost || 0);
    const deliveryPackingRtoAdsUsd =
      (usdCosts.delivery_cost || 0) + (usdCosts.packing_cost || 0) + (usdCosts.rto_cost || 0) + (usdCosts.ads_cost || 0);

    // As requested: Net Profit = Revenue − (Ads + Packing + Delivery)
    const netProfitInr = revenueInr - ((inrCosts.ads_cost || 0) + (inrCosts.packing_cost || 0) + (inrCosts.delivery_cost || 0));
    const netProfitUsd = revenueUsd - ((usdCosts.ads_cost || 0) + (usdCosts.packing_cost || 0) + (usdCosts.delivery_cost || 0));

    const fmt = (cur, value) => {
      const n = Number(value);
      const rounded = Number.isFinite(n) ? Math.round(n) : 0;
      if (cur === "INR") return `₹${rounded.toLocaleString()}`;
      if (cur === "USD") return `$${rounded.toLocaleString()}`;
      return `${cur} ${rounded.toLocaleString()}`;
    };

    const recent = (orders || []).slice(0, 5);

    return (
      <div>
        <div className="z-page-head">
          <div>
            <div className="z-title">Zubilo Business Dashboard</div>
            <div className="z-subtitle">Overview of orders and revenue</div>
          </div>
        </div>

        <div className="z-grid-stats">
          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Total Orders</div>
                <div className="z-stat-value">{orderStats.total}</div>
              </div>
              <div className="z-icon-box z-icon-blue">
                <ShoppingCart size={24} />
              </div>
            </div>
          </div>

          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Delivered</div>
                <div className="z-stat-value">{orderStats.byStatus.delivered}</div>
              </div>
              <div className="z-icon-box z-icon-green">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>

          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Revenue (INR)</div>
                <div className="z-stat-value">₹{Math.round(revenueInr)}</div>
              </div>
              <div className="z-icon-box z-icon-purple">
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Revenue (USD)</div>
                <div className="z-stat-value">${Math.round(revenueUsd)}</div>
              </div>
              <div className="z-icon-box z-icon-orange">
                <DollarSign size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="z-card" style={{ marginTop: 16 }}>
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Profit Snapshot
          </div>
          <div className="z-table-wrap">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Revenue</th>
                  <th>Ads</th>
                  <th>Packing</th>
                  <th>Delivery</th>
                  <th>RTO</th>
                  <th>Delivery + Packing + RTO + Ads</th>
                  <th>Net Profit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="z-strong">INR</td>
                  <td className="z-strong">{fmt("INR", revenueInr)}</td>
                  <td>{fmt("INR", inrCosts.ads_cost || 0)}</td>
                  <td>{fmt("INR", inrCosts.packing_cost || 0)}</td>
                  <td>{fmt("INR", inrCosts.delivery_cost || 0)}</td>
                  <td>{fmt("INR", inrCosts.rto_cost || 0)}</td>
                  <td>{fmt("INR", deliveryPackingRtoAdsInr)}</td>
                  <td className="z-strong">{fmt("INR", netProfitInr)}</td>
                </tr>
                <tr>
                  <td className="z-strong">USD</td>
                  <td className="z-strong">{fmt("USD", revenueUsd)}</td>
                  <td>{fmt("USD", usdCosts.ads_cost || 0)}</td>
                  <td>{fmt("USD", usdCosts.packing_cost || 0)}</td>
                  <td>{fmt("USD", usdCosts.delivery_cost || 0)}</td>
                  <td>{fmt("USD", usdCosts.rto_cost || 0)}</td>
                  <td>{fmt("USD", deliveryPackingRtoAdsUsd)}</td>
                  <td className="z-strong">{fmt("USD", netProfitUsd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="z-card">
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Recent Orders
          </div>
          <div className="z-table-wrap">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.length ? (
                  recent.map((o) => (
                    <tr key={o.id}>
                      <td className="z-strong">{o.id}</td>
                      <td>{o.customer_name || "—"}</td>
                      <td>
                        <span className={statusPillClass(o.status)}>{o.status || "—"}</span>
                      </td>
                      <td className="z-strong">
                        {o.currency || ""} {o.amount ?? "—"}
                      </td>
                      <td>{formatDateTime(o.created_at) || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: 18, color: "#6b7280" }}>
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderOrders = () => {
    const empty = filteredOrdersForTab.length === 0;
    return (
      <div>
        <div className="z-page-head">
          <div>
            <div className="z-title">Orders</div>
            <div className="z-subtitle">Manage incoming orders</div>
          </div>

          <button className="z-btn danger" type="button" onClick={() => loadOrders()}>
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <Download size={18} /> Download Orders Data
            </span>
          </button>
        </div>

        <div className="z-card" style={{ marginBottom: 16 }}>
          <div className="z-tabs">
            {["On Hold", "Pending", "Ready to Ship", "Shipped", "Cancelled", "RTO"].map((t) => (
              <button
                key={t}
                type="button"
                className={ordersTab === t ? "z-tab active" : "z-tab"}
                onClick={() => setOrdersTab(t)}
              >
                {t} ({ordersTabCounts[t] ?? 0})
              </button>
            ))}
          </div>

          <div className="z-filters">
            <label className="z-label">
              SLA Status
              <select className="z-input" defaultValue="">
                <option value="">All</option>
                <option value="onTime">On Time</option>
                <option value="delayed">Delayed</option>
              </select>
            </label>
            <label className="z-label">
              Dispatch Date
              <select className="z-input" defaultValue="">
                <option value="">Any</option>
                <option value="today">Today</option>
                <option value="7">Last 7 days</option>
              </select>
            </label>
            <label className="z-label">
              Order Date
              <select className="z-input" defaultValue="">
                <option value="">Any</option>
                <option value="today">Today</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="z-label">
              Search SKU
              <div style={{ position: "relative" }}>
                <input className="z-input" placeholder="SKU ID" />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}>
                  <Search size={18} />
                </span>
              </div>
            </label>
          </div>

          {isOrdersLoading ? <div className="z-subtitle">Loading…</div> : null}
          {ordersError ? <div className="z-subtitle" style={{ color: "#dc2626" }}>{ordersError}</div> : null}

          {empty ? (
            <div style={{ display: "grid", placeItems: "center", padding: 28, color: "#6b7280" }}>
              <img
                alt=""
                src="https://images.unsplash.com/photo-1605902711622-cfb43c4437d1?auto=format&fit=crop&w=220&q=60"
                style={{ width: 180, height: 180, objectFit: "cover", opacity: 0.4, filter: "grayscale(1)" }}
              />
              <div className="z-strong" style={{ marginTop: 10 }}>
                No orders in this tab.
              </div>
            </div>
          ) : (
            <div className="z-table-wrap">
              <table className="z-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrdersForTab.map((o) => (
                    <tr key={o.id}>
                      <td className="z-strong">{o.id}</td>
                      <td>{o.customer_name || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <span className={statusPillClass(o.status)}>{o.status || "—"}</span>
                          <select
                            className="z-input"
                            style={{ width: 160, padding: "8px 10px" }}
                            value={String(o.status || "pending")}
                            onChange={(e) => onUpdateOrderStatus(o.id, e.target.value)}
                            disabled={isTrackingBusy}
                            aria-label={`Update status for order ${o.id}`}
                          >
                            <option value="pending">pending</option>
                            <option value="confirmed">confirmed</option>
                            <option value="shipped">shipped</option>
                            <option value="delivered">delivered</option>
                            <option value="cancelled">cancelled</option>
                            <option value="rto">rto</option>
                          </select>
                        </div>
                      </td>
                      <td className="z-strong">
                        {o.currency || ""} {o.amount ?? "—"}
                      </td>
                      <td>{formatDateTime(o.created_at) || "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <button
                            className="z-btn primary"
                            type="button"
                            onClick={() => {
                              setOrderCostModal(o);
                              setOrderCostDraft({
                                delivery_cost: o?.delivery_cost ?? "",
                                packing_cost: o?.packing_cost ?? "",
                                ads_cost: o?.ads_cost ?? "",
                                rto_cost: o?.rto_cost ?? "",
                              });
                            }}
                            disabled={isTrackingBusy}
                          >
                            Add/Edit Costs
                          </button>

                          {String(o?.status || "").trim().toLowerCase() === "confirmed" ? (
                            <button
                              className="z-btn secondary"
                              type="button"
                              onClick={() => openRtoModal(o)}
                              disabled={isTrackingBusy}
                              style={{ background: "#111", borderColor: "#111", color: "#fff" }}
                            >
                              Mark as RTO
                            </button>
                          ) : null}

                          <button
                            className="z-btn secondary"
                            type="button"
                            onClick={() => {
                              setOrderDetails(o);
                            }}
                            disabled={isTrackingBusy}
                          >
                            Details
                          </button>
                          <button
                            className="z-btn secondary"
                            type="button"
                            onClick={() => selectOrderForTracking(o.id)}
                            disabled={isTrackingBusy}
                          >
                            Track
                          </button>
                          <button
                            className="z-btn secondary"
                            type="button"
                            onClick={() => onDeleteOrder(o.id)}
                            disabled={isTrackingBusy || isOrderDeletingId === o.id}
                          >
                            {isOrderDeletingId === o.id ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {orderDetails ? (
            <div
              className="z-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Order ${orderDetails?.id} details`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setOrderDetails(null);
              }}
            >
              <div className="z-modal">
                <div className="z-modal-head">
                  <div>
                    <div className="z-strong" style={{ fontSize: 18 }}>
                      Order #{orderDetails?.id}
                    </div>
                    <div className="z-subtitle">
                      Date: {formatOrderDate(orderDetails?.created_at) || "—"} · Time: {formatOrderTime(orderDetails?.created_at) || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {String(orderDetails?.status || "").trim().toLowerCase() === "confirmed" ? (
                      <button
                        className="z-btn secondary"
                        type="button"
                        onClick={() => openRtoModal(orderDetails)}
                        style={{ background: "#111", borderColor: "#111", color: "#fff" }}
                      >
                        Mark as RTO
                      </button>
                    ) : null}
                    <button className="z-btn secondary" type="button" onClick={() => setOrderDetails(null)}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="z-modal-grid">
                  <div className="z-modal-field">
                    <div className="z-modal-label">Name</div>
                    <div className="z-strong">{orderDetails?.customer_name || "—"}</div>
                  </div>
                  <div className="z-modal-field">
                    <div className="z-modal-label">Payment Method</div>
                    <div className="z-strong">{orderDetails?.payment_method || "—"}</div>
                  </div>

                  <div className="z-modal-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="z-modal-label">Product</div>
                    <div className="z-strong">{orderDetails?.product_name || "—"}</div>
                  </div>

                  <div className="z-modal-field">
                    <div className="z-modal-label">Size</div>
                    <div className="z-strong">{orderDetails?.size || "—"}</div>
                  </div>
                  <div className="z-modal-field">
                    <div className="z-modal-label">Mobile</div>
                    <div className="z-strong">{orderDetails?.phone || "—"}</div>
                  </div>
                  <div className="z-modal-field">
                    <div className="z-modal-label">Email</div>
                    <div className="z-strong">{orderDetails?.email || "—"}</div>
                  </div>
                  <div className="z-modal-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="z-modal-label">Address</div>
                    <div className="z-strong">{formatOrderAddress(orderDetails)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {orderCostModal ? (
            <div
              className="z-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit costs for order ${orderCostModal?.id}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setOrderCostModal(null);
              }}
            >
              <div className="z-modal">
                <div className="z-modal-head">
                  <div>
                    <div className="z-strong" style={{ fontSize: 18 }}>
                      Costs · Order #{orderCostModal?.id}
                    </div>
                    <div className="z-subtitle">Add / edit delivery, packing, ads, RTO</div>
                  </div>
                  <button className="z-btn secondary" type="button" onClick={() => setOrderCostModal(null)} disabled={isOrderCostSaving}>
                    Close
                  </button>
                </div>

                <div className="z-modal-grid">
                  <div className="z-modal-field">
                    <div className="z-modal-label">Customer</div>
                    <div className="z-strong">{orderCostModal?.customer_name || "—"}</div>
                  </div>
                  <div className="z-modal-field">
                    <div className="z-modal-label">Amount</div>
                    <div className="z-strong">
                      {orderCostModal?.currency || ""} {orderCostModal?.amount ?? "—"}
                    </div>
                  </div>

                  <div className="z-modal-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="z-modal-label">Costs</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                      <label className="z-label" style={{ margin: 0 }}>
                        Delivery Cost
                        <input
                          className="z-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={orderCostDraft.delivery_cost}
                          onChange={(e) => setOrderCostDraft((p) => ({ ...p, delivery_cost: e.target.value }))}
                        />
                      </label>
                      <label className="z-label" style={{ margin: 0 }}>
                        Packing Cost
                        <input
                          className="z-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={orderCostDraft.packing_cost}
                          onChange={(e) => setOrderCostDraft((p) => ({ ...p, packing_cost: e.target.value }))}
                        />
                      </label>
                      <label className="z-label" style={{ margin: 0 }}>
                        Ads Cost
                        <input
                          className="z-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={orderCostDraft.ads_cost}
                          onChange={(e) => setOrderCostDraft((p) => ({ ...p, ads_cost: e.target.value }))}
                        />
                      </label>
                      <label className="z-label" style={{ margin: 0 }}>
                        RTO Cost
                        <input
                          className="z-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={orderCostDraft.rto_cost}
                          onChange={(e) => setOrderCostDraft((p) => ({ ...p, rto_cost: e.target.value }))}
                        />
                      </label>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="z-btn primary" type="button" onClick={onSaveOrderCosts} disabled={isOrderCostSaving}>
                        {isOrderCostSaving ? "Saving…" : "Save Costs"}
                      </button>
                      <button
                        className="z-btn secondary"
                        type="button"
                        onClick={() => {
                          setOrderCostDraft({ delivery_cost: "", packing_cost: "", ads_cost: "", rto_cost: "" });
                        }}
                        disabled={isOrderCostSaving}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {orderRtoModal ? (
            <div
              className="z-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={`Mark order ${orderRtoModal?.id} as RTO`}
              onClick={(e) => {
                if (e.target === e.currentTarget) setOrderRtoModal(null);
              }}
            >
              <div className="z-modal">
                <div className="z-modal-head">
                  <div>
                    <div className="z-strong" style={{ fontSize: 18 }}>
                      Mark as RTO · Order #{orderRtoModal?.id}
                    </div>
                    <div className="z-subtitle">Enter total RTO cost and confirm</div>
                  </div>
                  <button className="z-btn secondary" type="button" onClick={() => setOrderRtoModal(null)} disabled={isRtoSaving}>
                    Close
                  </button>
                </div>

                <div className="z-modal-grid">
                  <div className="z-modal-field" style={{ gridColumn: "1 / -1" }}>
                    <div className="z-modal-label">Total RTO Cost</div>
                    <input
                      className="z-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={rtoCostDraft}
                      onChange={(e) => setRtoCostDraft(e.target.value)}
                      placeholder="0"
                    />
                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="z-btn primary" type="button" onClick={onConfirmMarkAsRto} disabled={isRtoSaving}>
                        {isRtoSaving ? "Saving…" : "Confirm RTO"}
                      </button>
                      <button className="z-btn secondary" type="button" onClick={() => setOrderRtoModal(null)} disabled={isRtoSaving}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderTracking = () => {
    return (
      <div>
        <div className="z-page-head">
          <div>
            <div className="z-title">Tracking</div>
            <div className="z-subtitle">Update tracking status for an order</div>
          </div>
        </div>

        <div className="z-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <label className="z-label" style={{ flex: 1, minWidth: 240 }}>
              Search Order ID
              <input
                className="z-input"
                placeholder="Enter order id"
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
              />
            </label>
            <button className="z-btn primary" type="button" onClick={loadOrders} disabled={isOrdersLoading || isTrackingBusy}>
              Track
            </button>
          </div>
        </div>

        <div id="order-tracking" ref={trackingSectionRef} className="z-card">
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Order Tracking
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label className="z-label">
              Select Order*
              <select
                className="z-input"
                value={selectedOrderId}
                onChange={(e) => selectOrderForTracking(e.target.value)}
              >
                <option value="">-- Select --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.product_name || "Order"} · {o.customer_name || ""}
                  </option>
                ))}
              </select>
            </label>

            {selectedOrderId ? (
              <>
                <label className="z-label">
                  Estimated delivery (date & time)
                  <input
                    className="z-input"
                    name="estimatedDeliveryAt"
                    type="datetime-local"
                    value={trackingForm.estimatedDeliveryAt}
                    onChange={onTrackingChange}
                  />
                </label>

                <label className="z-label">
                  Picked up from
                  <input
                    className="z-input"
                    name="pickedUpFrom"
                    type="text"
                    placeholder="e.g., Delhi"
                    value={trackingForm.pickedUpFrom}
                    onChange={onTrackingChange}
                  />
                </label>

                <label className="z-label">
                  Picked up at (date & time)
                  <input
                    className="z-input"
                    name="pickedUpAt"
                    type="datetime-local"
                    value={trackingForm.pickedUpAt}
                    onChange={onTrackingChange}
                  />
                </label>

                <label className="z-label">
                  Out for delivery (Yes/No)
                  <select
                    className="z-input"
                    name="outForDelivery"
                    value={trackingForm.outForDelivery}
                    onChange={onTrackingChange}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>

                <label className="z-label">
                  Out for delivery at (date & time)
                  <input
                    className="z-input"
                    name="outForDeliveryAt"
                    type="datetime-local"
                    value={trackingForm.outForDeliveryAt}
                    onChange={onTrackingChange}
                  />
                </label>

                <label className="z-label">
                  Delivered at (date & time)
                  <input
                    className="z-input"
                    name="deliveredAt"
                    type="datetime-local"
                    value={trackingForm.deliveredAt}
                    onChange={onTrackingChange}
                  />
                </label>

                <button className="z-btn primary" type="button" onClick={onSaveTracking} disabled={isTrackingBusy}>
                  {isTrackingBusy ? "Saving…" : "Save Tracking"}
                </button>

                <div style={{ marginTop: 6 }}>
                  <div className="z-strong">Received at (multiple)</div>
                  <div className="z-subtitle">Add as many checkpoints as needed</div>
                </div>

                <label className="z-label">
                  Received location*
                  <input
                    className="z-input"
                    type="text"
                    placeholder="e.g., Gurgaon"
                    value={receivedLocation}
                    onChange={(e) => {
                      setTrackingDirty(true);
                      setReceivedLocation(e.target.value);
                    }}
                  />
                </label>

                <label className="z-label">
                  Date & time (optional)
                  <input
                    className="z-input"
                    type="datetime-local"
                    value={receivedAt}
                    onChange={(e) => {
                      setTrackingDirty(true);
                      setReceivedAt(e.target.value);
                    }}
                  />
                </label>

                <label className="z-label">
                  Note (optional)
                  <input
                    className="z-input"
                    type="text"
                    value={receivedNote}
                    onChange={(e) => {
                      setTrackingDirty(true);
                      setReceivedNote(e.target.value);
                    }}
                  />
                </label>

                <button className="z-btn secondary" type="button" onClick={onAddReceived} disabled={isTrackingBusy}>
                  {isTrackingBusy ? "Adding…" : "Add Received Location"}
                </button>
              </>
            ) : (
              <div className="z-subtitle">Select an order to update tracking.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAddProducts = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Add Products</div>
          <div className="z-subtitle">Add a new product to your store</div>
        </div>
      </div>

      <div className="z-card">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label className="z-label">
            Category*
            <select className="z-input" name="category" value={form.category} onChange={onChange}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="z-label">
            Name*
            <input className="z-input" name="name" value={form.name} onChange={onChange} />
          </label>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              SKU (optional)
              <input className="z-input" name="sku" value={form.sku} onChange={onChange} placeholder="SKU" />
            </label>
            <label className="z-label">
              Barcode (optional)
              <input className="z-input" name="barcode" value={form.barcode} onChange={onChange} placeholder="Barcode" />
            </label>
            <label className="z-label">
              Quantity (optional)
              <input className="z-input" name="quantity" value={form.quantity} onChange={onChange} type="number" min={0} step={1} placeholder="0" />
            </label>
          </div>

          <label className="z-label">
            Description
            <textarea className="z-input" name="description" value={form.description} onChange={onChange} rows={4} />
          </label>

          <label className="z-label">
            Video URL (optional)
            <input className="z-input" name="video_url" value={form.video_url} onChange={onChange} placeholder="https://..." />
          </label>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Price INR*
              <input className="z-input" name="price_inr" value={form.price_inr} onChange={onChange} type="number" />
            </label>
            <label className="z-label">
              MRP INR
              <input className="z-input" name="mrp_inr" value={form.mrp_inr} onChange={onChange} type="number" />
            </label>
            <label className="z-label">
              Cost INR (optional)
              <input className="z-input" name="cost_inr" value={form.cost_inr} onChange={onChange} type="number" min={0} step="0.01" placeholder="0" />
            </label>
          </div>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Price USD*
              <input className="z-input" name="price_usd" value={form.price_usd} onChange={onChange} type="number" />
            </label>
            <label className="z-label">
              MRP USD
              <input className="z-input" name="mrp_usd" value={form.mrp_usd} onChange={onChange} type="number" />
            </label>
            <label className="z-label">
              Cost USD (optional)
              <input className="z-input" name="cost_usd" value={form.cost_usd} onChange={onChange} type="number" min={0} step="0.01" placeholder="Cost USD" />
            </label>
          </div>

          <div>
            <div className="z-strong" style={{ marginBottom: 8 }}>
              Sizes
            </div>
            <div className="sizes">
              {PRODUCT_SIZE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={form.sizes?.includes(s) ? "size-btn active" : "size-btn"}
                  onClick={() => setForm((prev) => ({ ...prev, sizes: toggleSize(prev.sizes, s) }))}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="z-label">
            Product Images (max 4)
            <input
              className="z-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => setImages(Array.from(e.target.files || []))}
            />
          </label>

          <label className="z-label">
            Product Video (optional)
            <input
              className="z-input"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setVideoFile((e.target.files && e.target.files[0]) || null)}
            />
          </label>

          {images.length ? <div className="z-subtitle">Selected images: {images.slice(0, 4).map((f) => f.name).join(", ")}</div> : null}
          {videoFile ? <div className="z-subtitle">Selected video: {videoFile.name}</div> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="z-btn primary" type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Add Product"}
            </button>
            <button
              className="z-btn secondary"
              type="button"
              onClick={() => {
                setForm(initialForm);
                setImages([]);
                setVideoFile(null);
              }}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  const renderInventory = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Inventory</div>
          <div className="z-subtitle">Inventory UI (stock fields not configured in DB yet)</div>
        </div>
      </div>

      <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="z-card">
          <div className="z-stat">
            <div>
              <div className="z-stat-label">Total Products</div>
              <div className="z-stat-value">{products.length}</div>
            </div>
            <div className="z-icon-box z-icon-blue">
              <Boxes size={24} />
            </div>
          </div>
        </div>
        <div className="z-card">
          <div className="z-stat">
            <div>
              <div className="z-stat-label">Low Stock</div>
              <div className="z-stat-value">{lowStockCount}</div>
            </div>
            <div className="z-icon-box z-icon-orange">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
        <div className="z-card">
          <div className="z-stat">
            <div>
              <div className="z-stat-label">Out of Stock</div>
              <div className="z-stat-value">{outOfStockCount}</div>
            </div>
            <div className="z-icon-box z-icon-red" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="z-card">
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          Products
        </div>
        {isLoading ? <div className="z-subtitle">Loading…</div> : null}
        <div className="z-table-wrap">
          <table className="z-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Barcode</th>
                <th>Qty</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(products || []).map((p) => (
                <tr key={p.id}>
                  <td className="z-strong">{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.sku || "—"}</td>
                  <td>{p.barcode || "—"}</td>
                  <td style={{ width: 120 }}>
                    <input
                      className="z-input"
                      style={{ padding: "8px 10px" }}
                      type="number"
                      min={0}
                      step={1}
                      value={
                        inventoryEdits?.[p.id]?.quantity !== undefined
                          ? inventoryEdits[p.id].quantity
                          : p.quantity ?? ""
                      }
                      onChange={(e) =>
                        setInventoryEdits((prev) => ({
                          ...prev,
                          [p.id]: { ...(prev?.[p.id] || {}), quantity: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>{p.category || "—"}</td>
                  <td className="z-strong">₹{p.price_inr ?? p.price ?? "—"}</td>
                  <td>
                    {Number(p?.quantity) === 0 ? (
                      <span className="z-badge-pill z-pill-red">Out</span>
                    ) : (
                      <span className="z-badge-pill z-pill-green">In</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="z-btn secondary"
                        type="button"
                        onClick={() => onStartEditProduct(p)}
                        disabled={isDeletingId === p.id || inventorySavingId === p.id || isUpdatingId === p.id}
                      >
                        Edit
                      </button>
                      <button
                        className="z-btn primary"
                        type="button"
                        onClick={() => onSaveInventoryQuantity(p.id)}
                        disabled={inventorySavingId === p.id}
                      >
                        {inventorySavingId === p.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        className="z-btn secondary"
                        type="button"
                        onClick={() => onDelete(p.id, p.name)}
                        disabled={isDeletingId === p.id || inventorySavingId === p.id}
                      >
                        {isDeletingId === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingProductId ? (
        <div className="z-card" style={{ marginTop: 16 }}>
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Edit Product #{editingProductId}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label className="z-label">
              Category*
              <select className="z-input" name="category" value={editForm.category} onChange={onEditChange}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="z-label">
              Name*
              <input className="z-input" name="name" value={editForm.name} onChange={onEditChange} />
            </label>

            <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
              <label className="z-label">
                SKU
                <input className="z-input" name="sku" value={editForm.sku} onChange={onEditChange} />
              </label>
              <label className="z-label">
                Barcode
                <input className="z-input" name="barcode" value={editForm.barcode} onChange={onEditChange} />
              </label>
              <label className="z-label">
                Quantity
                <input className="z-input" name="quantity" type="number" min={0} step={1} value={editForm.quantity} onChange={onEditChange} />
              </label>
            </div>

            <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
              <label className="z-label">
                Price INR*
                <input className="z-input" name="price_inr" type="number" value={editForm.price_inr} onChange={onEditChange} />
              </label>
              <label className="z-label">
                Price USD*
                <input className="z-input" name="price_usd" type="number" value={editForm.price_usd} onChange={onEditChange} />
              </label>
            </div>

            <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
              <label className="z-label">
                MRP INR
                <input className="z-input" name="mrp_inr" type="number" value={editForm.mrp_inr} onChange={onEditChange} />
              </label>
              <label className="z-label">
                MRP USD
                <input className="z-input" name="mrp_usd" type="number" value={editForm.mrp_usd} onChange={onEditChange} />
              </label>
            </div>

            <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
              <label className="z-label">
                Cost INR (optional)
                <input className="z-input" name="cost_inr" type="number" min={0} step="0.01" value={editForm.cost_inr} onChange={onEditChange} />
              </label>
              <label className="z-label">
                Cost USD (optional)
                <input className="z-input" name="cost_usd" type="number" min={0} step="0.01" value={editForm.cost_usd} onChange={onEditChange} />
              </label>
            </div>

            <label className="z-label">
              Description
              <textarea className="z-input" name="description" value={editForm.description} onChange={onEditChange} rows={4} />
            </label>

            <label className="z-label">
              Video URL (optional)
              <input className="z-input" name="video_url" value={editForm.video_url} onChange={onEditChange} placeholder="https://..." />
            </label>

            <label className="z-label">
              Replace Video (optional)
              <input
                className="z-input"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setEditVideoFile((e.target.files && e.target.files[0]) || null)}
              />
            </label>

            {editVideoFile ? <div className="z-subtitle">Selected video: {editVideoFile.name}</div> : editForm.video_url ? <div className="z-subtitle">Current video: {editForm.video_url}</div> : null}

            <div>
              <div className="z-strong" style={{ marginBottom: 8 }}>
                Sizes
              </div>
              <div className="sizes">
                {PRODUCT_SIZE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={editForm.sizes?.includes(s) ? "size-btn active" : "size-btn"}
                    onClick={() => setEditForm((prev) => ({ ...prev, sizes: toggleSize(prev.sizes, s) }))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="z-strong" style={{ marginBottom: 8 }}>
                Existing Images (rearrange)
              </div>
              <div className="z-subtitle" style={{ marginBottom: 10 }}>
                Up/Down controls change Image 1→4 order.
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {["image1", "image2", "image3", "image4"].map((slot, idx, list) => {
                  const url = editImageUrls?.[slot] || "";
                  return (
                    <div
                      key={slot}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        background: "#fff",
                      }}
                    >
                      <div className="z-strong" style={{ width: 70 }}>
                        Image {idx + 1}
                      </div>

                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 10,
                          overflow: "hidden",
                          border: "1px solid #e5e7eb",
                          background: "#f3f4f6",
                        }}
                      >
                        {url ? (
                          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : null}
                      </div>

                      <div style={{ flex: 1, minWidth: 220, color: url ? "#111827" : "#6b7280" }}>
                        {url ? url : "(empty)"}
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="z-btn secondary"
                          onClick={() => moveExistingImageSlot(idx, -1)}
                          disabled={idx === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="z-btn secondary"
                          onClick={() => moveExistingImageSlot(idx, 1)}
                          disabled={idx === list.length - 1}
                        >
                          Down
                        </button>
                        <button type="button" className="z-btn secondary" onClick={() => clearExistingImageSlot(idx)}>
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="z-label">
              Replace Images (optional, max 4)
              <input
                className="z-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => setEditImages(Array.from(e.target.files || []))}
              />
            </label>
            {editImages.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div className="z-subtitle">Selected (top → bottom = Image 1 → 4):</div>
                {editImages.slice(0, 4).map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      background: "#fff",
                    }}
                  >
                    <div className="z-strong" style={{ width: 26 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      {f.name}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="z-btn secondary"
                        onClick={() => moveEditImage(idx, -1)}
                        disabled={idx === 0}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="z-btn secondary"
                        onClick={() => moveEditImage(idx, 1)}
                        disabled={idx === Math.min(editImages.length, 4) - 1}
                      >
                        Down
                      </button>
                      <button type="button" className="z-btn secondary" onClick={() => removeEditImage(idx)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="z-btn primary" type="button" onClick={onSaveEditProduct} disabled={isUpdatingId === editingProductId}>
                {isUpdatingId === editingProductId ? "Saving…" : "Save Changes"}
              </button>
              <button className="z-btn secondary" type="button" onClick={onCancelEditProduct} disabled={isUpdatingId === editingProductId}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
  const renderPayments = () => {
    const currency = "₹";

    const manual = manualSubmitByRegion[paymentsRegion] || EMPTY_MANUAL_SUBMIT;

    const paiseToDisplay = (paise) => `${currency}${paiseToStr2Safe(paise)}`;

    const deliveryPartnerPaise = toPaiseSafe(manual.deliveryPartnerInr);
    const paypalPaise = toPaiseSafe(manual.paypalInr);
    const upiWhatsappPaise = toPaiseSafe(manual.upiWhatsappInr);
    const totalIndianPaise = deliveryPartnerPaise + upiWhatsappPaise;
    const totalInternationalPaise = paypalPaise;
    const grandTotalPaise = totalIndianPaise + totalInternationalPaise;

    const toBucket = (v) => (String(v || "").toLowerCase() === "hand" ? "hand" : "bank");
    const deliveryPartnerBucket = toBucket(manual.deliveryPartnerTo);
    const paypalBucket = toBucket(manual.paypalTo);
    const upiWhatsappBucket = toBucket(manual.upiWhatsappTo);

    const cashInBankComputedPaise =
      (deliveryPartnerBucket === "bank" ? deliveryPartnerPaise : 0) +
      (paypalBucket === "bank" ? paypalPaise : 0) +
      (upiWhatsappBucket === "bank" ? upiWhatsappPaise : 0);
    const cashInHandComputedPaise =
      (deliveryPartnerBucket === "hand" ? deliveryPartnerPaise : 0) +
      (paypalBucket === "hand" ? paypalPaise : 0) +
      (upiWhatsappBucket === "hand" ? upiWhatsappPaise : 0);

    const setManualField = (key, value) => {
      setManualSubmitByRegion((prev) => ({
        ...prev,
        [paymentsRegion]: {
          ...(prev[paymentsRegion] || { ...EMPTY_MANUAL_SUBMIT }),
          [key]: value,
        },
      }));
    };

    if (manualSubmitOpen) {
      return (
        <div>
          <div className="z-page-head">
            <div>
              <div className="z-title">Manual Submit — Payments</div>
              <div className="z-subtitle">Enter amounts in ₹ (saved to database)</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="z-btn secondary"
                type="button"
                onClick={() => {
                  setManualSubmitByRegion((prev) => ({
                    ...prev,
                    [paymentsRegion]: { ...EMPTY_MANUAL_SUBMIT },
                  }));
                  setManualSubmitError("");
                }}
              >
                + New Entry
              </button>
              <button className="z-btn secondary" type="button" onClick={() => setManualSubmitOpen(false)}>
                ← Back
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
            <div className="z-card">
              <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
                Choose Date
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
                <div>
                  <div className="z-subtitle" style={{ marginBottom: 6 }}>
                    Date
                  </div>
                  <input
                    className="z-input"
                    type="date"
                    ref={manualSubmitDateRef}
                    autoFocus
                    value={manual.date}
                    onChange={(e) => {
                      setManualField("date", e.target.value);
                      setManualField("savedMessage", "");
                      setManualSubmitError("");
                      const next = e.target.value;
                      if (next) {
                        loadManualPaymentForDate({ region: paymentsRegion, date: next });
                      }
                    }}
                    onFocus={(e) => {
                      try {
                        if (typeof e.target.showPicker === "function") e.target.showPicker();
                      } catch {
                        // ignore
                      }
                    }}
                  />
                </div>
              </div>

              {manualSubmitLoading ? <div className="z-subtitle" style={{ marginTop: 10 }}>Loading…</div> : null}
              {manualSubmitError ? <div className="z-subtitle" style={{ marginTop: 10, color: "#b91c1c" }}>{manualSubmitError}</div> : null}

              {manual.date ? (
                <>
                  <div className="z-strong" style={{ fontSize: 18, marginTop: 18, marginBottom: 12 }}>
                    Total Payments Received Today
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    <div>
                      <div className="z-subtitle" style={{ marginBottom: 6 }}>
                        Delivery partner app (₹)
                      </div>
                      <input
                        className="z-input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        value={manual.deliveryPartnerInr}
                        onChange={(e) => {
                          setManualField("deliveryPartnerInr", e.target.value);
                          setManualField("savedMessage", "");
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="z-subtitle" style={{ margin: 0 }}>
                          Save to
                        </div>
                        <select
                          className="z-input"
                          value={manual.deliveryPartnerTo || "bank"}
                          onChange={(e) => {
                            setManualField("deliveryPartnerTo", e.target.value);
                            setManualField("savedMessage", "");
                          }}
                          style={{ maxWidth: 170 }}
                        >
                          <option value="bank">Cash in Bank</option>
                          <option value="hand">Cash in Hand</option>
                        </select>
                      </div>
                      <div className="z-subtitle" style={{ marginTop: 6 }}>
                        e.g. 50 ₹ from delivery partner app
                      </div>
                    </div>

                    <div>
                      <div className="z-subtitle" style={{ marginBottom: 6 }}>
                        Receive from PayPal (₹)
                      </div>
                      <input
                        className="z-input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        value={manual.paypalInr}
                        onChange={(e) => {
                          setManualField("paypalInr", e.target.value);
                          setManualField("savedMessage", "");
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="z-subtitle" style={{ margin: 0 }}>
                          Save to
                        </div>
                        <select
                          className="z-input"
                          value={manual.paypalTo || "bank"}
                          onChange={(e) => {
                            setManualField("paypalTo", e.target.value);
                            setManualField("savedMessage", "");
                          }}
                          style={{ maxWidth: 170 }}
                        >
                          <option value="bank">Cash in Bank</option>
                          <option value="hand">Cash in Hand</option>
                        </select>
                      </div>
                      <div className="z-subtitle" style={{ marginTop: 6 }}>
                        e.g. 700 ₹ received from PayPal
                      </div>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div className="z-subtitle" style={{ marginBottom: 6 }}>
                        Payment from UPI / WhatsApp (₹)
                      </div>
                      <input
                        className="z-input"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        value={manual.upiWhatsappInr}
                        onChange={(e) => {
                          setManualField("upiWhatsappInr", e.target.value);
                          setManualField("savedMessage", "");
                        }}
                      />
                      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                        <div className="z-subtitle" style={{ margin: 0 }}>
                          Save to
                        </div>
                        <select
                          className="z-input"
                          value={manual.upiWhatsappTo || "bank"}
                          onChange={(e) => {
                            setManualField("upiWhatsappTo", e.target.value);
                            setManualField("savedMessage", "");
                          }}
                          style={{ maxWidth: 170 }}
                        >
                          <option value="bank">Cash in Bank</option>
                          <option value="hand">Cash in Hand</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="z-card" style={{ marginTop: 14 }}>
                    <div className="z-strong" style={{ marginBottom: 10 }}>
                      Totals (₹)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                      <div>
                        <div className="z-subtitle">Indian</div>
                        <div className="z-strong" style={{ fontSize: 18 }}>{paiseToDisplay(totalIndianPaise)}</div>
                      </div>
                      <div>
                        <div className="z-subtitle">International</div>
                        <div className="z-strong" style={{ fontSize: 18 }}>{paiseToDisplay(totalInternationalPaise)}</div>
                      </div>
                      <div>
                        <div className="z-subtitle">Grand Total</div>
                        <div className="z-strong" style={{ fontSize: 18 }}>{paiseToDisplay(grandTotalPaise)}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        className="z-btn primary"
                        type="button"
                        disabled={manualSubmitLoading}
                        onClick={async () => {
                          try {
                            setManualSubmitError("");
                            setManualSubmitLoading(true);
                            const saved = await saveManualPayment({ region: paymentsRegion, manual });
                            setManualField("savedMessage", `Saved for ${saved?.pay_date || manual.date}`);
                            await loadManualRecent(paymentsRegion);
                            await loadManualSummary(paymentsRegion);
                          } catch (e) {
                            setManualSubmitError(e?.message || "Save failed");
                          } finally {
                            setManualSubmitLoading(false);
                          }
                        }}
                      >
                        Submit
                      </button>
                      <button
                        className="z-btn secondary"
                        type="button"
                        onClick={() => {
                          setManualSubmitByRegion((prev) => ({
                            ...prev,
                            [paymentsRegion]: { ...EMPTY_MANUAL_SUBMIT },
                          }));
                          setManualSubmitError("");
                        }}
                      >
                        Clear
                      </button>
                    </div>
                    {manual.savedMessage ? <div className="z-subtitle" style={{ marginTop: 10 }}>{manual.savedMessage}</div> : null}
                  </div>
                </>
              ) : (
                <div className="z-subtitle" style={{ marginTop: 12 }}>
                  Select a date to enter today’s received payments.
                </div>
              )}
            </div>

            {manual.date ? (
              <div className="z-card">
                <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
                  Selected Date Split
                </div>

                <div className="z-subtitle" style={{ marginTop: -6, marginBottom: 10 }}>
                  This split is only for {manual.date || "the selected date"}.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
                  <div>
                    <div className="z-subtitle">Cash in Bank (₹)</div>
                    <div className="z-strong" style={{ fontSize: 18 }}>{paiseToDisplay(cashInBankComputedPaise)}</div>
                  </div>
                  <div>
                    <div className="z-subtitle">Cash in Hand (₹)</div>
                    <div className="z-strong" style={{ fontSize: 18 }}>{paiseToDisplay(cashInHandComputedPaise)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="z-card">
                <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
                  Selected Date Split
                </div>
                <div className="z-subtitle">Select a date first to enable cash entry.</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="z-page-head">
          <div>
            <div className="z-title">Payments</div>
            <div className="z-subtitle">Manual entries + takeouts summary</div>
            {exportPdfError ? (
              <div className="z-subtitle" style={{ marginTop: 6, color: "#b91c1c" }}>
                {exportPdfError}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="z-btn secondary" type="button" onClick={() => setManualSubmitOpen(true)}>
              Add / Edit
            </button>
            <button className="z-btn primary" type="button" onClick={exportPaymentsPdf} disabled={exportingPdf}>
              {exportingPdf ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        </div>

        <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Lifetime Net — Cash in Bank</div>
                <div className="z-stat-value">
                  {manualSummaryLoading
                    ? "Loading…"
                    : `${currency}${manualSummaryByRegion[paymentsRegion]?.cashInBankInr || "0.00"}`}
                </div>
                <div className="z-subtitle" style={{ marginTop: 6 }}>
                  After takeouts
                  {manualSummaryMetaByRegion[paymentsRegion]?.mode === "fallback" ? " (approx — recent entries only)" : ""}
                </div>
                {manualSummaryError ? (
                  <div className="z-subtitle" style={{ marginTop: 6, color: "#b91c1c" }}>{manualSummaryError}</div>
                ) : null}
              </div>
              <div className="z-icon-box z-icon-green">
                <DollarSign size={24} />
              </div>
            </div>
          </div>

          <div className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">Lifetime Net — Cash in Hand</div>
                <div className="z-stat-value">
                  {manualSummaryLoading
                    ? "Loading…"
                    : `${currency}${manualSummaryByRegion[paymentsRegion]?.cashInHandInr || "0.00"}`}
                </div>
                <div className="z-subtitle" style={{ marginTop: 6 }}>
                  After takeouts
                  {manualSummaryMetaByRegion[paymentsRegion]?.mode === "fallback" ? " (approx — recent entries only)" : ""}
                </div>
              </div>
              <div className="z-icon-box z-icon-blue">
                <DollarSign size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="z-subtitle" style={{ marginTop: 8 }}>
          Tip: “Lifetime Net” is across all dates (minus takeouts). “Selected Date Split” is only inside Add / Edit.
        </div>

        <div className="z-card">
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Recent Manual Entries
          </div>

          {manualRecentLoading ? <div className="z-subtitle">Loading…</div> : null}
          {manualRecentError ? <div className="z-subtitle" style={{ color: "#b91c1c" }}>{manualRecentError}</div> : null}

          <div style={{ overflowX: "auto" }}>
            <table className="z-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cash in Account (₹)</th>
                  <th>Cash in Hand (₹)</th>
                  <th>Indian (₹)</th>
                  <th>International (₹)</th>
                  <th>Total (₹)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(manualRecentByRegion[paymentsRegion] || []).length ? (
                  (manualRecentByRegion[paymentsRegion] || []).map((r) => {
                    const d = String(r?.pay_date || "");
                    const dp = toPaiseSafe(r?.delivery_partner_inr);
                    const upi = toPaiseSafe(r?.upi_whatsapp_inr);
                    const pp = toPaiseSafe(r?.paypal_inr);
                    const indian = dp + upi;
                    const intl = pp;
                    const total = indian + intl;
                    return (
                      <tr key={String(r?.id || d)}>
                        <td>{d || "—"}</td>
                        <td>{paiseToDisplay(toPaiseSafe(r?.cash_in_bank_inr))}</td>
                        <td>{paiseToDisplay(toPaiseSafe(r?.cash_in_hand_inr))}</td>
                        <td>{paiseToDisplay(indian)}</td>
                        <td>{paiseToDisplay(intl)}</td>
                        <td>{paiseToDisplay(total)}</td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="z-btn secondary"
                            type="button"
                            onClick={async () => {
                              setManualSubmitByRegion((prev) => ({
                                ...prev,
                                [paymentsRegion]: {
                                  ...(prev[paymentsRegion] || { ...EMPTY_MANUAL_SUBMIT }),
                                  date: d,
                                  savedMessage: "",
                                },
                              }));
                              setManualSubmitOpen(true);
                              if (d) await loadManualPaymentForDate({ region: paymentsRegion, date: d });
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="z-subtitle">
                      No manual entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="z-card" style={{ marginTop: 14 }}>
          <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
            Cash Takeout
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, alignItems: "end" }}>
            <div>
              <div className="z-subtitle" style={{ marginBottom: 6 }}>Date</div>
              <input className="z-input" type="date" value={takeoutDate} onChange={(e) => setTakeoutDate(e.target.value)} />
            </div>
            <div>
              <div className="z-subtitle" style={{ marginBottom: 6 }}>From</div>
              <select className="z-input" value={takeoutSource} onChange={(e) => setTakeoutSource(e.target.value)}>
                <option value="hand">Cash in Hand</option>
                <option value="bank">Cash in Bank</option>
              </select>
            </div>
            <div>
              <div className="z-subtitle" style={{ marginBottom: 6 }}>Amount (₹)</div>
              <input className="z-input" type="number" min={0} step="0.01" placeholder="0" value={takeoutAmountInr} onChange={(e) => setTakeoutAmountInr(e.target.value)} />
            </div>
            <div>
              <button
                className="z-btn primary"
                type="button"
                disabled={takeoutSaving}
                onClick={async () => {
                  try {
                    setTakeoutError("");
                    setTakeoutSaving(true);
                    await saveTakeout({
                      region: paymentsRegion,
                      date: takeoutDate,
                      source: takeoutSource,
                      amountInr: takeoutAmountInr,
                      purpose: takeoutPurpose,
                    });
                    setTakeoutAmountInr("");
                    await loadTakeoutsRecent(paymentsRegion);
                    await loadManualSummary(paymentsRegion);
                  } catch (e) {
                    setTakeoutError(e?.message || "Save failed");
                  } finally {
                    setTakeoutSaving(false);
                  }
                }}
              >
                Add Takeout
              </button>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="z-subtitle" style={{ marginBottom: 6 }}>Purpose</div>
              <select className="z-input" value={takeoutPurpose} onChange={(e) => setTakeoutPurpose(e.target.value)}>
                {TAKEOUT_PURPOSES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {takeoutError ? <div className="z-subtitle" style={{ marginTop: 10, color: "#b91c1c" }}>{takeoutError}</div> : null}

          <div className="z-strong" style={{ marginTop: 16, marginBottom: 10 }}>Recent Takeouts</div>
          {takeoutsLoading ? <div className="z-subtitle">Loading…</div> : null}
          {takeoutsError ? <div className="z-subtitle" style={{ color: "#b91c1c" }}>{takeoutsError}</div> : null}

          <div style={{ overflowX: "auto" }}>
            <table className="z-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>Purpose</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {takeoutsRecent.length ? (
                  takeoutsRecent.map((t) => (
                    <tr key={String(t?.id || "") + String(t?.take_date || "")}>
                      <td>{String(t?.take_date || "—")}</td>
                      <td>{String(t?.source || "").toLowerCase() === "bank" ? "Cash in Bank" : "Cash in Hand"}</td>
                      <td>{String(t?.purpose || "—")}</td>
                      <td style={{ textAlign: "right" }}>{paiseToDisplay(toPaiseSafe(t?.amount_inr))}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="z-subtitle">No takeouts yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderComplaints = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Complaints</div>
          <div className="z-subtitle">Complaints UI (not connected yet)</div>
        </div>
      </div>

      <div className="z-grid-stats">
        {["Total", "Open", "In Progress", "Resolved"].map((x, idx) => (
          <div key={x} className="z-card">
            <div className="z-stat">
              <div>
                <div className="z-stat-label">{x}</div>
                <div className="z-stat-value">—</div>
              </div>
              <div className={idx === 0 ? "z-icon-box z-icon-blue" : idx === 1 ? "z-icon-box z-icon-orange" : idx === 2 ? "z-icon-box z-icon-purple" : "z-icon-box z-icon-green"}>
                <MessageSquareWarning size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="z-card">
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          Complaint Cards
        </div>
        <div className="z-subtitle">Connect complaints backend to list cards here.</div>
      </div>
    </div>
  );

  const renderBlogs = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Blogs</div>
          <div className="z-subtitle">Add / Edit blog posts</div>
        </div>
      </div>

      {blogStatus?.message ? (
        <div
          className="z-subtitle"
          style={{
            color: blogStatus.type === "error" ? "#b91c1c" : "#16a34a",
            marginBottom: 12,
          }}
        >
          {blogStatus.message}
        </div>
      ) : null}

      <div className="z-card">
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          {blogForm?.id ? `Edit Blog #${blogForm.id}` : "Add Blog"}
        </div>

        <form onSubmit={onBlogSubmit} style={{ display: "grid", gap: 12 }}>
          <label className="z-label">
            Title*
            <input className="z-input" name="title" value={blogForm.title} onChange={onBlogInput} />
          </label>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Author
              <input className="z-input" name="author" value={blogForm.author} onChange={onBlogInput} placeholder="Author name" />
            </label>
            <label className="z-label">
              Image URL
              <input className="z-input" name="image_url" value={blogForm.image_url} onChange={onBlogInput} placeholder="https://..." />
            </label>
          </div>

          <label className="z-label">
            Summary
            <textarea className="z-input" name="summary" value={blogForm.summary} onChange={onBlogInput} rows={3} />
          </label>

          <label className="z-label">
            Content*
            <textarea className="z-input" name="content" value={blogForm.content} onChange={onBlogInput} rows={10} />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="z-btn primary" type="submit" disabled={isBlogSaving}>
              {isBlogSaving ? "Saving…" : blogForm?.id ? "Update Blog" : "Add Blog"}
            </button>
            <button className="z-btn secondary" type="button" onClick={onBlogReset} disabled={isBlogSaving}>
              Reset
            </button>
            {blogForm?.id ? (
              <button className="z-btn secondary" type="button" onClick={() => onBlogDelete(blogForm.id)} disabled={isBlogSaving}>
                Delete
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="z-card" style={{ marginTop: 16 }}>
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          All Blogs
        </div>

        {isBlogLoading ? <div className="z-subtitle">Loading…</div> : null}

        <div style={{ overflowX: "auto" }}>
          <table className="z-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Slug</th>
                <th>Author</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(blogs || []).length ? (
                (blogs || []).map((b) => (
                  <tr key={b.id || b.slug}>
                    <td className="z-strong">{b.title || "—"}</td>
                    <td>{b.slug || "—"}</td>
                    <td>{b.author || "—"}</td>
                    <td>{formatDateTime(b.published_at || b.created_at) || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="z-btn secondary" type="button" onClick={() => onBlogEdit(b)} disabled={isBlogSaving}>
                          Edit
                        </button>
                        <button className="z-btn secondary" type="button" onClick={() => onBlogDelete(b.id)} disabled={isBlogSaving}>
                          Delete
                        </button>
                        {b.slug ? (
                          <Link className="z-btn secondary" to={`/blog/${b.slug}`} target="_blank" rel="noreferrer">
                            View
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="z-subtitle">No blogs yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Settings</div>
          <div className="z-subtitle">Edit footer contact & social links</div>
        </div>
      </div>

      {siteSettingsStatus?.message ? (
        <div
          className="z-subtitle"
          style={{
            color: siteSettingsStatus.type === "error" ? "#b91c1c" : "#16a34a",
            marginBottom: 12,
          }}
        >
          {siteSettingsStatus.message}
        </div>
      ) : null}

      <div className="z-card">
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          Footer
        </div>

        {isSiteSettingsLoading ? <div className="z-subtitle">Loading…</div> : null}

        <form onSubmit={onSaveSiteSettings} style={{ display: "grid", gap: 12 }}>
          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Contact Email
              <input
                className="z-input"
                name="contact_email"
                value={siteSettings.contact_email}
                onChange={onSiteSettingsInput}
                placeholder="support@example.com"
              />
            </label>

            <label className="z-label">
              Contact Phone
              <input
                className="z-input"
                name="contact_phone"
                value={siteSettings.contact_phone}
                onChange={onSiteSettingsInput}
                placeholder="+91..."
              />
            </label>
          </div>

          <label className="z-label">
            Contact Address
            <input
              className="z-input"
              name="contact_address"
              value={siteSettings.contact_address}
              onChange={onSiteSettingsInput}
              placeholder="City, Country"
            />
          </label>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Instagram URL
              <input
                className="z-input"
                name="instagram_url"
                value={siteSettings.instagram_url}
                onChange={onSiteSettingsInput}
                placeholder="https://instagram.com/..."
              />
            </label>

            <label className="z-label">
              Facebook URL
              <input
                className="z-input"
                name="facebook_url"
                value={siteSettings.facebook_url}
                onChange={onSiteSettingsInput}
                placeholder="https://facebook.com/..."
              />
            </label>
          </div>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              X (Twitter) URL
              <input
                className="z-input"
                name="twitter_url"
                value={siteSettings.twitter_url}
                onChange={onSiteSettingsInput}
                placeholder="https://twitter.com/..."
              />
            </label>

            <label className="z-label">
              YouTube URL
              <input
                className="z-input"
                name="youtube_url"
                value={siteSettings.youtube_url}
                onChange={onSiteSettingsInput}
                placeholder="https://youtube.com/..."
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="z-btn primary" type="submit" disabled={isSiteSettingsSaving}>
              {isSiteSettingsSaving ? "Saving…" : "Save"}
            </button>
            <button
              className="z-btn secondary"
              type="button"
              onClick={loadSiteSettings}
              disabled={isSiteSettingsSaving || isSiteSettingsLoading}
            >
              Reload
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderPolicies = () => (
    <div>
      <div className="z-page-head">
        <div>
          <div className="z-title">Policies</div>
          <div className="z-subtitle">Add / Edit footer policy pages</div>
        </div>
      </div>

      {policyStatus?.message ? (
        <div
          className="z-subtitle"
          style={{
            color: policyStatus.type === "error" ? "#b91c1c" : "#16a34a",
            marginBottom: 12,
          }}
        >
          {policyStatus.message}
        </div>
      ) : null}

      <div className="z-card">
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          {policyForm?.id ? `Edit Policy #${policyForm.id}` : "Add Policy"}
        </div>

        <form onSubmit={onPolicySubmit} style={{ display: "grid", gap: 12 }}>
          <label className="z-label">
            Title*
            <input className="z-input" name="title" value={policyForm.title} onChange={onPolicyInput} />
          </label>

          <div className="z-grid-stats" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 0 }}>
            <label className="z-label">
              Footer Section
              <select className="z-input" name="footer_group" value={policyForm.footer_group} onChange={onPolicyInput}>
                <option value="Help">Help</option>
                <option value="Privacy & Legal">Privacy & Legal</option>
                <option value="Blog">Blog</option>
              </select>
            </label>

            <label className="z-label">
              Slug (optional)
              <input className="z-input" name="slug" value={policyForm.slug} onChange={onPolicyInput} placeholder="terms-conditions" />
            </label>
          </div>

          <label className="z-label">
            Content
            <textarea className="z-input" name="content" value={policyForm.content} onChange={onPolicyInput} rows={10} />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="z-btn primary" type="submit" disabled={isPolicySaving}>
              {isPolicySaving ? "Saving…" : policyForm?.id ? "Update" : "Add"}
            </button>
            <button className="z-btn secondary" type="button" onClick={onPolicyReset} disabled={isPolicySaving}>
              Reset
            </button>
            {policyForm?.id ? (
              <button className="z-btn secondary" type="button" onClick={() => onPolicyDelete(policyForm.id)} disabled={isPolicySaving}>
                Delete
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="z-card" style={{ marginTop: 16 }}>
        <div className="z-strong" style={{ fontSize: 18, marginBottom: 12 }}>
          All Policies
        </div>

        {isPoliciesLoading ? <div className="z-subtitle">Loading…</div> : null}

        <div style={{ overflowX: "auto" }}>
          <table className="z-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Section</th>
                <th>Slug</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(policies || []).length ? (
                (policies || []).map((p) => (
                  <tr key={p.id || p.slug}>
                    <td className="z-strong">{p.title || "—"}</td>
                    <td>{p.footer_group || "—"}</td>
                    <td>{p.slug || "—"}</td>
                    <td>{formatDateTime(p.updated_at || p.created_at) || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="z-btn secondary" type="button" onClick={() => onPolicyEdit(p)} disabled={isPolicySaving}>
                          Edit
                        </button>
                        <button className="z-btn secondary" type="button" onClick={() => onPolicyDelete(p.id)} disabled={isPolicySaving}>
                          Delete
                        </button>
                        {p.slug ? (
                          <Link className="z-btn secondary" to={`/policy/${p.slug}`} target="_blank" rel="noreferrer">
                            View
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="z-subtitle">No policies yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  return (
    <div className="zubilo-admin">
      <div className="z-shell">
        <aside className="z-sidebar" aria-label="Zubilo sidebar">
          <div className="z-logo">
            <div className="z-logo-dot" aria-hidden="true" />
            <div className="z-logo-meta">
              <div className="z-logo-name">ZUBILO</div>
              <div className="z-logo-tag">BUSINESS DASHBOARD</div>
            </div>
            <div style={{ marginLeft: "auto", color: "rgba(209,213,219,0.75)" }}>
              <ChevronDown size={16} />
            </div>
          </div>

          <div className="z-nav" style={{ marginTop: 12 }}>
            <button
              type="button"
              className={activePage === "dashboard" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("dashboard")}
            >
              <LayoutDashboard size={20} /> Business Dashboard
            </button>

            <button
              type="button"
              className={activePage === "orders" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("orders")}
            >
              <ShoppingCart size={20} /> Orders
            </button>

            <button
              type="button"
              className={activePage === "tracking" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("tracking")}
            >
              <MapPin size={20} /> Tracking
            </button>

            <button
              type="button"
              className={activePage === "addProducts" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("addProducts")}
            >
              <Package size={20} /> Add Products
            </button>

            <button
              type="button"
              className={activePage === "inventory" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("inventory")}
            >
              <Boxes size={20} /> Inventory
              <span className="z-nav-right">
                <span className="z-badge">out of stock: {outOfStockCount}</span>
              </span>
            </button>

            <button
              type="button"
              className={activePage === "payments" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => {
                setPaymentsRegion("IN");
                goto("payments");
              }}
            >
              <DollarSign size={20} /> Payments
            </button>

            <button
              type="button"
              className={activePage === "blogs" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("blogs")}
            >
              <FileText size={20} /> Blogs
            </button>

            <button
              type="button"
              className={activePage === "settings" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("settings")}
            >
              <Settings size={20} /> Settings
            </button>

            <button
              type="button"
              className={activePage === "policies" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("policies")}
            >
              <Shield size={20} /> Policies
            </button>

            <button
              type="button"
              className={activePage === "complaints" ? "z-nav-btn active" : "z-nav-btn"}
              onClick={() => goto("complaints")}
            >
              <MessageSquareWarning size={20} /> Complaints
            </button>
          </div>
        </aside>

        <main className="z-main">
          <div className="z-page">

          <div className="auth-card" style={{ marginTop: 0 }}>
          <div className="auth-head">
            <div>
              <div className="summary-title">Admin Login</div>
              <div className="summary-meta">
                {admin?.email ? `Logged in as: ${admin.email}` : "Login required to add/delete products"}
              </div>
            </div>
            {admin ? (
              <button className="secondary-btn" type="button" onClick={onLogout}>
                Logout
              </button>
            ) : null}
          </div>

          <div className="summary-meta" style={{ marginTop: 10 }}>
            Need customer login?{" "}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Login
            </Link>
          </div>

          {!admin ? (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Admin auth">
                <button
                  type="button"
                  className={authMode === "login" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={authMode === "create" ? "auth-tab active" : "auth-tab"}
                  onClick={() => setAuthMode("create")}
                >
                  Create Account
                </button>
              </div>

              <form
                onSubmit={authMode === "login" ? onLogin : onCreateAccount}
                className="auth-form"
              >
                <label>
                  Email*
                  <input
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                  />
                </label>

                <label>
                  Password*
                  <input
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                  />
                </label>

                {authMode === "create" ? (
                  <label>
                    Invite Code*
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="ADMIN_INVITE_CODE"
                    />
                  </label>
                ) : null}

                <button className="primary-btn" type="submit" disabled={isAuthBusy}>
                  {isAuthBusy
                    ? "Please wait…"
                    : authMode === "login"
                      ? "Login"
                      : "Create Admin Account"}
                </button>
              </form>
            </>
          ) : null}
        </div>

      {status.message ? (
        <p style={{ color: status.type === "error" ? "crimson" : "green" }}>
          {status.message}
        </p>
      ) : null}

            {status.message ? (
              <div className="z-subtitle" style={{ color: status.type === "error" ? "#dc2626" : "#16a34a", marginBottom: 12 }}>
                {status.message}
              </div>
            ) : null}

            {!admin ? null : (
              <>
                {activePage === "dashboard" ? renderDashboard() : null}
                {activePage === "orders" ? renderOrders() : null}
                {activePage === "tracking" ? renderTracking() : null}
                {activePage === "addProducts" ? renderAddProducts() : null}
                {activePage === "inventory" ? renderInventory() : null}
                {activePage === "payments" ? renderPayments() : null}
                {activePage === "blogs" ? renderBlogs() : null}
                {activePage === "settings" ? renderSettings() : null}
                {activePage === "policies" ? renderPolicies() : null}
                {activePage === "complaints" ? renderComplaints() : null}
              </>
            )}

          </div>
        </main>
      </div>

    </div>
  );
}
