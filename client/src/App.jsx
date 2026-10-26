
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Bell,
  Plus,
  Search,
  Trash2,
  CalendarDays,
  Clock,
  ShieldCheck,
  Wrench,
  FileText,
  Upload,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  IndianRupee,
  Building2,
  TrendingUp,
  Menu,
} from "lucide-react";
import "./App.css";

const API = "/api";
const SERVER = "";

const emptyForm = {
  name: "",
  brand: "",
  purchaseDate: "",
  warrantyMonths: "12",
};

function getExpiryDate(purchaseDate, warrantyMonths) {
  if (!purchaseDate || warrantyMonths === undefined || warrantyMonths === null) {
    return "";
  }

  const date = new Date(`${purchaseDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  date.setMonth(date.getMonth() + Number(warrantyMonths));
  return date.toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "Not available";

  const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDaysRemaining(expiryDate) {
  if (!expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${String(expiryDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;

  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

function getWarrantyStatus(product) {
  const days = getDaysRemaining(
    product.warrantyExpiry || product.warrantyEndDate
  );

  if (days === null) {
    return { label: "Unknown", className: "status-unknown" };
  }

  if (days < 0) {
    return { label: "Expired", className: "status-expired" };
  }

  if (days <= 30) {
    return { label: "Expiring Soon", className: "status-warning" };
  }

  return { label: "Active", className: "status-active" };
}

function getProductExpiry(product) {
  return (
    product.warrantyExpiry ||
    product.warrantyEndDate ||
    getExpiryDate(product.purchaseDate, product.warrantyMonths)
  );
}

function currency(value) {
  return `â‚¹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getDocumentUrl(document) {
  const url = document.url || document.path || document.filename || "";

  if (!url) return "#";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${SERVER}${url}`;

  return `${SERVER}/uploads/${url}`;
}

function App() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [documentProductId, setDocumentProductId] = useState("");
  const [documentFile, setDocumentFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [serviceProductId, setServiceProductId] = useState("");
  const [serviceForm, setServiceForm] = useState({
    date: new Date().toLocaleDateString("en-CA"),
    description: "",
    cost: "",
  });
  const [savingService, setSavingService] = useState(false);

  const [maintenanceProductId, setMaintenanceProductId] = useState("");
  const [maintenanceForm, setMaintenanceForm] = useState({
    date: "",
    description: "",
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState("");

  async function request(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(
        (data && data.message) ||
          (data && data.error) ||
          `Request failed (${response.status})`
      );
    }

    return data;
  }

  async function loadProducts(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const data = await request(`${API}/products`);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
          ? data.products
          : [];

      setProducts(list);
    } catch (err) {
      setError(
        `${err.message}. Make sure your backend is running at ${SERVER}.`
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function addProduct(event) {
    event.preventDefault();
    setError("");

    if (!form.name.trim() || !form.purchaseDate) {
      setError("Please enter the product name and purchase date.");
      return;
    }

    const warrantyMonths = Number(form.warrantyMonths);

    if (!Number.isFinite(warrantyMonths) || warrantyMonths < 0) {
      setError("Please enter a valid warranty duration.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      purchaseDate: form.purchaseDate,
      warrantyMonths,
      warrantyExpiry: getExpiryDate(form.purchaseDate, warrantyMonths),
    };

    setSaving(true);

    try {
      await request(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setForm(emptyForm);
      await loadProducts(false);
      setPage("Products");
      showNotice("Product registered successfully!");
    } catch (err) {
      setError(err.message || "Could not register the product.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    setError("");

    try {
      await request(`${API}/products/${product.id}`, {
        method: "DELETE",
      });

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );

      if (String(selectedProductId) === String(product.id)) {
        setSelectedProductId("");
      }

      showNotice("Product deleted successfully.");
    } catch (err) {
      setError(err.message || "Could not delete the product.");
    }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    setError("");

    if (!documentProductId) {
      setError("Please select a product.");
      return;
    }

    if (!documentFile) {
      setError("Please select a document to upload.");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      documentFile.type &&
      !allowedTypes.includes(documentFile.type)
    ) {
      setError("Upload only PDF, JPG, PNG, or WEBP files.");
      return;
    }

    if (documentFile.size > 5 * 1024 * 1024) {
      setError("The document must be smaller than 5 MB.");
      return;
    }

    const data = new FormData();
    data.append("document", documentFile);

    setUploading(true);

    try {
      await request(
        `${API}/products/${documentProductId}/documents`,
        {
          method: "POST",
          body: data,
        }
      );

      setDocumentFile(null);
      const fileInput = document.getElementById("document-file");
      if (fileInput) fileInput.value = "";

      await loadProducts(false);
      showNotice("Document uploaded successfully!");
    } catch (err) {
      setError(err.message || "Could not upload the document.");
    } finally {
      setUploading(false);
    }
  }

  async function addService(event) {
    event.preventDefault();
    setError("");

    if (!serviceProductId) {
      setError("Please select a product.");
      return;
    }

    if (!serviceForm.date || !serviceForm.description.trim()) {
      setError("Enter the service date and description.");
      return;
    }

    const cost = Number(serviceForm.cost || 0);

    if (!Number.isFinite(cost) || cost < 0) {
      setError("Enter a valid service cost.");
      return;
    }

    setSavingService(true);

    try {
      await request(
        `${API}/products/${serviceProductId}/services`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: serviceForm.date,
            description: serviceForm.description.trim(),
            cost,
          }),
        }
      );

      setServiceForm({
        date: new Date().toLocaleDateString("en-CA"),
        description: "",
        cost: "",
      });

      await loadProducts(false);
      showNotice("Service history added successfully!");
    } catch (err) {
      setError(err.message || "Could not save service history.");
    } finally {
      setSavingService(false);
    }
  }

  async function addMaintenance(event) {
    event.preventDefault();
    setError("");

    if (!maintenanceProductId) {
      setError("Please select a product.");
      return;
    }

    if (!maintenanceForm.date || !maintenanceForm.description.trim()) {
      setError("Enter the maintenance date and description.");
      return;
    }

    setSavingMaintenance(true);

    try {
      await request(
        `${API}/products/${maintenanceProductId}/maintenance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: maintenanceForm.date,
            description: maintenanceForm.description.trim(),
          }),
        }
      );

      setMaintenanceForm({ date: "", description: "" });
      await loadProducts(false);
      showNotice("Maintenance reminder saved!");
    } catch (err) {
      setError(err.message || "Could not save the maintenance reminder.");
    } finally {
      setSavingMaintenance(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return products;

    return products.filter((product) =>
      [
        product.name,
        product.brand,
        product.serialNumber,
        product.category,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  const dashboardStats = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let expired = 0;

    products.forEach((product) => {
      const status = getWarrantyStatus({
        ...product,
        warrantyExpiry: getProductExpiry(product),
      });

      if (status.label === "Active") active += 1;
      if (status.label === "Expiring Soon") expiring += 1;
      if (status.label === "Expired") expired += 1;
    });

    const services = products.reduce(
      (total, product) =>
        total + (Array.isArray(product.services) ? product.services.length : 0),
      0
    );

    const documents = products.reduce(
      (total, product) =>
        total +
        (Array.isArray(product.documents) ? product.documents.length : 0),
      0
    );

    return {
      total: products.length,
      active,
      expiring,
      expired,
      services,
      documents,
    };
  }, [products]);

  const reminderProducts = useMemo(() => {
    return products
      .map((product) => ({
        ...product,
        warrantyExpiry: getProductExpiry(product),
      }))
      .filter((product) => {
        const days = getDaysRemaining(product.warrantyExpiry);
        return days !== null && days <= 30;
      })
      .sort(
        (a, b) =>
          getDaysRemaining(a.warrantyExpiry) -
          getDaysRemaining(b.warrantyExpiry)
      );
  }, [products]);

  const allServices = useMemo(() => {
    return products
      .flatMap((product) =>
        (Array.isArray(product.services) ? product.services : []).map(
          (service) => ({
            ...service,
            productId: product.id,
            productName: product.name,
            productBrand: product.brand,
          })
        )
      )
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [products]);

  const allDocuments = useMemo(() => {
    return products
      .flatMap((product) =>
        (Array.isArray(product.documents) ? product.documents : []).map(
          (document) => ({
            ...document,
            productId: product.id,
            productName: product.name,
          })
        )
      )
      .sort((a, b) =>
        String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || ""))
      );
  }, [products]);

  const allMaintenance = useMemo(() => {
    return products
      .flatMap((product) =>
        (Array.isArray(product.maintenance) ? product.maintenance : []).map(
          (item) => ({
            ...item,
            productId: product.id,
            productName: product.name,
          })
        )
      )
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }, [products]);

  const selectedProduct = products.find(
    (product) => String(product.id) === String(selectedProductId)
  );

  const navigation = [
    { label: "Dashboard", display: "Dashboard", icon: LayoutDashboard },
    { label: "Products", display: "My Products", icon: Package },
    { label: "Reminders", display: "Reminders", icon: Bell },
    { label: "Services", display: "Service History", icon: Wrench },
    { label: "Documents", display: "Documents", icon: FileText },
    { label: "Maintenance", display: "Maintenance", icon: CalendarDays },
    { label: "Add Product", display: "Add Product", icon: Plus },
  ];

  function navigate(nextPage) {
    setPage(nextPage);
    setError("");
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h2>WarrantyWise</h2>
            <p>Warranty Manager</p>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${page === item.label ? "nav-active" : ""}`}
                onClick={() => navigate(item.label)}
              >
                <Icon size={19} />
                <span>{item.display}</span>
                {item.label === "Reminders" && dashboardStats.expiring > 0 && (
                  <span className="nav-count">{dashboardStats.expiring}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">
            <ShieldCheck size={23} />
          </div>
          <h4>Your products, protected.</h4>
          <p>Keep warranties and service records in one place.</p>
          <button
            className="sidebar-add-button"
            onClick={() => navigate("Add Product")}
          >
            <Plus size={16} /> Add a product
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <div>
              <div className="breadcrumb">Workspace / {page}</div>
              <h1>
                {page === "Products"
                  ? "My Products"
                  : page === "Services"
                    ? "Service History"
                    : page === "Documents"
                      ? "My Documents"
                      : page === "Maintenance"
                        ? "Maintenance Planner"
                        : page}
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              onClick={() => loadProducts()}
              title="Refresh products"
              aria-label="Refresh products"
            >
              <RefreshCw size={18} />
            </button>

            <button
              className="topbar-add-button"
              onClick={() => navigate("Add Product")}
            >
              <Plus size={17} /> Add Product
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={19} />
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={17} />
            </button>
          </div>
        )}

        {notice && (
          <div className="alert alert-success" role="status">
            <CheckCircle2 size={19} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              <X size={17} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <RefreshCw size={28} className="spin" />
            <p>Loading your warranty information...</p>
          </div>
        ) : (
          <>
            {page === "Dashboard" && (
              <section className="page-content">
                <div className="welcome-banner">
                  <div>
                    <span className="eyebrow">YOUR PERSONAL PRODUCT HUB</span>
                    <h2>Welcome to WarrantyWise</h2>
                    <p>
                      Track your warranties, manage documents, and stay ahead
                      of important service dates.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => navigate("Add Product")}
                    >
                      <Plus size={18} /> Register a Product
                    </button>
                  </div>
                  <div className="welcome-art">
                    <ShieldCheck size={92} strokeWidth={1.2} />
                  </div>
                </div>

                <div className="stats-grid">
                  <StatCard
                    icon={Package}
                    label="Total Products"
                    value={dashboardStats.total}
                    description="Products registered"
                    className="stat-blue"
                  />
                  <StatCard
                    icon={ShieldCheck}
                    label="Active Warranties"
                    value={dashboardStats.active}
                    description="Currently protected"
                    className="stat-green"
                  />
                  <StatCard
                    icon={Clock}
                    label="Expiring Soon"
                    value={dashboardStats.expiring}
                    description="Within the next 30 days"
                    className="stat-orange"
                  />
                  <StatCard
                    icon={AlertCircle}
                    label="Expired Warranties"
                    value={dashboardStats.expired}
                    description="Need your attention"
                    className="stat-red"
                  />
                </div>

                <div className="dashboard-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Recently Added Products</h3>
                        <p>Your registered products at a glance</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("Products")}
                      >
                        View all <ExternalLink size={15} />
                      </button>
                    </div>

                    {products.length === 0 ? (
                      <EmptyState
                        icon={Package}
                        title="No products yet"
                        description="Add your first product to start tracking its warranty."
                        action="Add Product"
                        onAction={() => navigate("Add Product")}
                      />
                    ) : (
                      <ProductTable
                        products={[...products].slice(-5).reverse()}
                        onDelete={deleteProduct}
                        onSelect={(product) => {
                          setSelectedProductId(product.id);
                          navigate("Products");
                        }}
                      />
                    )}
                  </section>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Warranty Alerts</h3>
                        <p>Products that need attention</p>
                      </div>
                      <Bell size={19} className="muted-icon" />
                    </div>

                    {reminderProducts.length === 0 ? (
                      <EmptyState
                        icon={CheckCircle2}
                        title="All clear!"
                        description="No warranties are expiring in the next 30 days."
                      />
                    ) : (
                      <div className="reminder-list">
                        {reminderProducts.slice(0, 5).map((product) => {
                          const days = getDaysRemaining(product.warrantyExpiry);

                          return (
                            <div className="reminder-item" key={product.id}>
                              <div className="reminder-icon">
                                <Clock size={18} />
                              </div>
                              <div className="reminder-details">
                                <strong>{product.name}</strong>
                                <span>
                                  Expires {formatDate(product.warrantyExpiry)}
                                </span>
                              </div>
                              <span
                                className={`days-badge ${
                                  days < 0 ? "days-expired" : ""
                                }`}
                              >
                                {days < 0
                                  ? `${Math.abs(days)}d overdue`
                                  : days === 0
                                    ? "Today"
                                    : `${days}d left`}
                              </span>
                            </div>
                          );
                        })}
                        <button
                          className="secondary-button full-width"
                          onClick={() => navigate("Reminders")}
                        >
                          View all reminders
                        </button>
                      </div>
                    )}
                  </section>
                </div>

                <div className="quick-stats-grid">
                  <button
                    className="quick-stat-card"
                    onClick={() => navigate("Services")}
                  >
                    <div className="quick-stat-icon quick-purple">
                      <Wrench size={22} />
                    </div>
                    <div>
                      <strong>{dashboardStats.services}</strong>
                      <span>Service records</span>
                    </div>
                    <ExternalLink size={16} />
                  </button>

                  <button
                    className="quick-stat-card"
                    onClick={() => navigate("Documents")}
                  >
                    <div className="quick-stat-icon quick-blue">
                      <FileText size={22} />
                    </div>
                    <div>
                      <strong>{dashboardStats.documents}</strong>
                      <span>Saved documents</span>
                    </div>
                    <ExternalLink size={16} />
                  </button>

                  <button
                    className="quick-stat-card"
                    onClick={() => navigate("Maintenance")}
                  >
                    <div className="quick-stat-icon quick-orange">
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <strong>{allMaintenance.length}</strong>
                      <span>Maintenance reminders</span>
                    </div>
                    <ExternalLink size={16} />
                  </button>
                </div>
              </section>
            )}

            {page === "Products" && (
              <section className="page-content">
                <div className="page-intro">
                  <div>
                    <h2>Manage your products</h2>
                    <p>
                      Keep track of purchase dates, warranty expiry, and
                      product details.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => navigate("Add Product")}
                  >
                    <Plus size={17} /> Add Product
                  </button>
                </div>

                <div className="search-bar">
                  <Search size={19} />
                  <input
                    type="text"
                    placeholder="Search by product name or brand..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="Clear search">
                      <X size={17} />
                    </button>
                  )}
                </div>

                {filteredProducts.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title={search ? "No matching products" : "No products registered"}
                    description={
                      search
                        ? "Try a different product name or brand."
                        : "Register a product to start managing its warranty."
                    }
                    action={search ? undefined : "Add Product"}
                    onAction={() => navigate("Add Product")}
                  />
                ) : (
                  <div className="product-card-grid">
                    {filteredProducts.map((product) => {
                      const expiry = getProductExpiry(product);
                      const status = getWarrantyStatus({
                        ...product,
                        warrantyExpiry: expiry,
                      });
                      const days = getDaysRemaining(expiry);

                      return (
                        <article className="product-card" key={product.id}>
                          <div className="product-card-top">
                            <div className="product-icon">
                              <Package size={24} />
                            </div>
                            <span className={`status-badge ${status.className}`}>
                              {status.label}
                            </span>
                          </div>

                          <h3>{product.name}</h3>
                          <p className="product-brand">
                            <Building2 size={15} />
                            {product.brand || "Brand not specified"}
                          </p>

                          <div className="product-info-list">
                            <div>
                              <span>Purchase date</span>
                              <strong>{formatDate(product.purchaseDate)}</strong>
                            </div>
                            <div>
                              <span>Warranty expiry</span>
                              <strong>{formatDate(expiry)}</strong>
                            </div>
                            <div>
                              <span>Warranty remaining</span>
                              <strong>
                                {days === null
                                  ? "Not available"
                                  : days < 0
                                    ? `Expired ${Math.abs(days)} days ago`
                                    : days === 0
                                      ? "Expires today"
                                      : `${days} days`}
                              </strong>
                            </div>
                          </div>

                          <div className="product-card-footer">
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setDocumentProductId(String(product.id));
                                navigate("Documents");
                              }}
                            >
                              <FileText size={16} /> Documents
                            </button>
                            <button
                              className="delete-button"
                              onClick={() => deleteProduct(product)}
                              title="Delete product"
                              aria-label={`Delete ${product.name}`}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {selectedProduct && (
                  <section className="panel selected-product-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>{selectedProduct.name}</h3>
                        <p>Product information</p>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setSelectedProductId("")}
                        aria-label="Close product details"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <p>
                      <strong>Brand:</strong>{" "}
                      {selectedProduct.brand || "Not specified"}
                    </p>
                    <p>
                      <strong>Purchase date:</strong>{" "}
                      {formatDate(selectedProduct.purchaseDate)}
                    </p>
                    <p>
                      <strong>Warranty expiry:</strong>{" "}
                      {formatDate(getProductExpiry(selectedProduct))}
                    </p>
                    <p>
                      <strong>Service records:</strong>{" "}
                      {selectedProduct.services?.length || 0}
                    </p>
                    <p>
                      <strong>Documents:</strong>{" "}
                      {selectedProduct.documents?.length || 0}
                    </p>
                  </section>
                )}
              </section>
            )}

            {page === "Add Product" && (
              <section className="page-content form-page">
                <div className="page-intro">
                  <div>
                    <h2>Register a new product</h2>
                    <p>
                      Enter your product details to start tracking its warranty.
                    </p>
                  </div>
                </div>

                <div className="form-layout">
                  <form className="panel document-form" onSubmit={addProduct}>
                    <div className="form-heading">
                      <div className="form-heading-icon">
                        <Package size={22} />
                      </div>
                      <div>
                        <h3>Product details</h3>
                        <p>Fields marked with * are required.</p>
                      </div>
                    </div>

                    <label htmlFor="product-name">Product name *</label>
                    <input
                      id="product-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Laptop, Refrigerator, Smartphone"
                      value={form.name}
                      onChange={updateForm}
                      required
                    />

                    <label htmlFor="product-brand">Brand</label>
                    <input
                      id="product-brand"
                      name="brand"
                      type="text"
                      placeholder="e.g. Dell, Samsung, Apple"
                      value={form.brand}
                      onChange={updateForm}
                    />

                    <label htmlFor="purchase-date">Purchase date *</label>
                    <input
                      id="purchase-date"
                      name="purchaseDate"
                      type="date"
                      value={form.purchaseDate}
                      max={new Date().toLocaleDateString("en-CA")}
                      onChange={updateForm}
                      required
                    />

                    <label htmlFor="warranty-months">Warranty duration *</label>
                    <select
                      id="warranty-months"
                      name="warrantyMonths"
                      value={form.warrantyMonths}
                      onChange={updateForm}
                      required
                    >
                      <option value="0">No warranty</option>
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">1 year (12 months)</option>
                      <option value="18">18 months</option>
                      <option value="24">2 years (24 months)</option>
                      <option value="36">3 years (36 months)</option>
                      <option value="48">4 years (48 months)</option>
                      <option value="60">5 years (60 months)</option>
                    </select>

                    <div className="expiry-preview">
                      <CalendarDays size={20} />
                      <div>
                        <span>Calculated warranty expiry</span>
                        <strong>
                          {form.purchaseDate
                            ? formatDate(
                                getExpiryDate(
                                  form.purchaseDate,
                                  form.warrantyMonths
                                )
                              )
                            : "Select a purchase date"}
                        </strong>
                      </div>
                    </div>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setForm(emptyForm)}
                      >
                        Clear
                      </button>
                      <button
                        type="submit"
                        className="primary-button"
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <RefreshCw size={17} className="spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Plus size={17} /> Register Product
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  <aside className="form-side-info">
                    <div className="info-card">
                      <ShieldCheck size={28} />
                      <h3>Stay protected</h3>
                      <p>
                        Save your purchase information so you can check warranty
                        status whenever you need it.
                      </p>
                    </div>

                    <div className="info-card">
                      <Bell size={27} />
                      <h3>Never miss an expiry</h3>
                      <p>
                        WarrantyWise highlights warranties that have expired or
                        are due to expire within 30 days.
                      </p>
                    </div>

                    <div className="info-card">
                      <FileText size={27} />
                      <h3>Keep records together</h3>
                      <p>
                        Upload invoices, warranty cards, and other supporting
                        documents after registering your product.
                      </p>
                    </div>
                  </aside>
                </div>
              </section>
            )}

            {page === "Reminders" && (
              <section className="page-content">
                <div className="page-intro">
                  <div>
                    <h2>Warranty reminders</h2>
                    <p>
                      Review expired warranties and warranties expiring within
                      the next 30 days.
                    </p>
                  </div>
                  <div className="reminder-total">
                    <Bell size={18} />
                    {reminderProducts.length} alerts
                  </div>
                </div>

                {reminderProducts.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No urgent warranty reminders"
                    description="Your registered products have no known expiry dates within the next 30 days."
                    action="View Products"
                    onAction={() => navigate("Products")}
                  />
                ) : (
                  <div className="panel">
                    <div className="reminder-list">
                      {reminderProducts.map((product) => {
                        const days = getDaysRemaining(product.warrantyExpiry);
                        const expired = days < 0;

                        return (
                          <div
                            className="reminder-item reminder-item-large"
                            key={product.id}
                          >
                            <div
                              className={`reminder-icon ${
                                expired ? "reminder-icon-expired" : ""
                              }`}
                            >
                              {expired ? (
                                <AlertCircle size={21} />
                              ) : (
                                <Clock size={21} />
                              )}
                            </div>

                            <div className="reminder-details">
                              <strong>{product.name}</strong>
                              <span>
                                {product.brand || "Brand not specified"} Â·
                                Expires {formatDate(product.warrantyExpiry)}
                              </span>
                              <small>
                                {expired
                                  ? "This warranty has already expired."
                                  : days === 0
                                    ? "The warranty expires today."
                                    : "Consider contacting the seller or service centre before expiry."}
                              </small>
                            </div>

                            <span
                              className={`days-badge ${
                                expired ? "days-expired" : ""
                              }`}
                            >
                              {expired
                                ? `${Math.abs(days)}d overdue`
                                : days === 0
                                  ? "Today"
                                  : `${days}d left`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="info-note">
                  <AlertCircle size={19} />
                  <p>
                    These are reminders shown inside the app. Automatic email
                    and push notifications are not enabled by this frontend.
                  </p>
                </div>
              </section>
            )}

            {page === "Services" && (
              <section className="page-content">
                <div className="page-intro">
                  <div>
                    <h2>Service history</h2>
                    <p>
                      Record repairs, servicing, and maintenance costs for your
                      products.
                    </p>
                  </div>
                </div>

                <div className="form-layout">
                  <form className="panel document-form" onSubmit={addService}>
                    <div className="form-heading">
                      <div className="form-heading-icon">
                        <Wrench size={22} />
                      </div>
                      <div>
                        <h3>Add a service record</h3>
                        <p>Save details of a repair or service visit.</p>
                      </div>
                    </div>

                    <label htmlFor="service-product">Select product *</label>
                    <select
                      id="service-product"
                      value={serviceProductId}
                      onChange={(event) =>
                        setServiceProductId(event.target.value)
                      }
                      required
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.brand ? ` â€” ${product.brand}` : ""}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="service-date">Service date *</label>
                    <input
                      id="service-date"
                      type="date"
                      value={serviceForm.date}
                      max={new Date().toLocaleDateString("en-CA")}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                    />

                    <label htmlFor="service-description">
                      Service description *
                    </label>
                    <textarea
                      id="service-description"
                      rows="4"
                      placeholder="Describe the repair, parts replaced, or service performed..."
                      value={serviceForm.description}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      required
                    />

                    <label htmlFor="service-cost">Service cost (â‚¹)</label>
                    <input
                      id="service-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1500"
                      value={serviceForm.cost}
                      onChange={(event) =>
                        setServiceForm((current) => ({
                          ...current,
                          cost: event.target.value,
                        }))
                      }
                    />

                    <button
                      className="primary-button full-width"
                      type="submit"
                      disabled={savingService || products.length === 0}
                    >
                      {savingService ? (
                        <>
                          <RefreshCw size={17} className="spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Plus size={17} /> Save Service Record
                        </>
                      )}
                    </button>

                    {products.length === 0 && (
                      <p className="form-help">
                        Register a product before adding service history.
                      </p>
                    )}
                  </form>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Service records</h3>
                        <p>{allServices.length} records saved</p>
                      </div>
                      <Wrench size={20} className="muted-icon" />
                    </div>

                    {allServices.length === 0 ? (
                      <EmptyState
                        icon={Wrench}
                        title="No service records yet"
                        description="Your saved repair and service records will appear here."
                      />
                    ) : (
                      <div className="record-list">
                        {allServices.map((service, index) => (
                          <div
                            className="service-item"
                            key={service.id || `${service.productId}-${index}`}
                          >
                            <div className="record-icon">
                              <Wrench size={19} />
                            </div>
                            <div className="record-content">
                              <strong>{service.productName}</strong>
                              <p>{service.description}</p>
                              <span>{formatDate(service.date)}</span>
                            </div>
                            <div className="service-cost">
                              <strong>{currency(service.cost)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </section>
            )}

            {page === "Documents" && (
              <section className="page-content">
                <div className="page-intro">
                  <div>
                    <h2>Product documents</h2>
                    <p>
                      Store invoices, warranty cards, receipts, and product
                      documents together.
                    </p>
                  </div>
                </div>

                <div className="form-layout">
                  <form className="panel document-form" onSubmit={uploadDocument}>
                    <div className="form-heading">
                      <div className="form-heading-icon">
                        <Upload size={22} />
                      </div>
                      <div>
                        <h3>Upload a document</h3>
                        <p>PDF, JPG, PNG, or WEBP Â· Maximum 5 MB</p>
                      </div>
                    </div>

                    <label htmlFor="document-product">Select product *</label>
                    <select
                      id="document-product"
                      value={documentProductId}
                      onChange={(event) =>
                        setDocumentProductId(event.target.value)
                      }
                      required
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.brand ? ` â€” ${product.brand}` : ""}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="document-file">Choose document *</label>
                    <input
                      id="document-file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) =>
                        setDocumentFile(event.target.files?.[0] || null)
                      }
                      required
                    />

                    {documentFile && (
                      <div className="selected-file">
                        <FileText size={19} />
                        <div>
                          <strong>{documentFile.name}</strong>
                          <span>
                            {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentFile(null);
                            const input =
                              document.getElementById("document-file");
                            if (input) input.value = "";
                          }}
                          aria-label="Remove selected file"
                        >
                          <X size={17} />
                        </button>
                      </div>
                    )}

                    <button
                      className="primary-button full-width"
                      type="submit"
                      disabled={uploading || products.length === 0}
                    >
                      {uploading ? (
                        <>
                          <RefreshCw size={17} className="spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={17} /> Upload Document
                        </>
                      )}
                    </button>

                    {products.length === 0 && (
                      <p className="form-help">
                        Register a product before uploading its documents.
                      </p>
                    )}
                  </form>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Saved documents</h3>
                        <p>{allDocuments.length} files uploaded</p>
                      </div>
                      <FileText size={20} className="muted-icon" />
                    </div>

                    {allDocuments.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No documents uploaded"
                        description="Upload a warranty card, invoice, or receipt to keep it accessible."
                      />
                    ) : (
                      <div className="record-list">
                        {allDocuments.map((document, index) => (
                          <div
                            className="document-item"
                            key={
                              document.id ||
                              `${document.productId}-${document.filename || document.name}-${index}`
                            }
                          >
                            <div className="record-icon document-record-icon">
                              <FileText size={19} />
                            </div>
                            <div className="record-content">
                              <strong>
                                {document.name ||
                                  document.originalname ||
                                  document.filename ||
                                  "Product document"}
                              </strong>
                              <p>{document.productName}</p>
                              {document.uploadedAt && (
                                <span>
                                  Uploaded {formatDate(document.uploadedAt)}
                                </span>
                              )}
                            </div>
                            <a
                              className="document-open-link"
                              href={getDocumentUrl(document)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${document.name || "document"}`}
                              onClick={(event) => {
                                if (getDocumentUrl(document) === "#") {
                                  event.preventDefault();
                                  setError("The document URL is not available.");
                                }
                              }}
                            >
                              <ExternalLink size={17} />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </section>
            )}

            {page === "Maintenance" && (
              <section className="page-content">
                <div className="page-intro">
                  <div>
                    <h2>Maintenance planner</h2>
                    <p>
                      Record upcoming maintenance activities for your registered
                      products.
                    </p>
                  </div>
                </div>

                <div className="form-layout">
                  <form
                    className="panel document-form"
                    onSubmit={addMaintenance}
                  >
                    <div className="form-heading">
                      <div className="form-heading-icon">
                        <CalendarDays size={22} />
                      </div>
                      <div>
                        <h3>Schedule maintenance</h3>
                        <p>Create a maintenance record for a product.</p>
                      </div>
                    </div>

                    <label htmlFor="maintenance-product">Select product *</label>
                    <select
                      id="maintenance-product"
                      value={maintenanceProductId}
                      onChange={(event) =>
                        setMaintenanceProductId(event.target.value)
                      }
                      required
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.brand ? ` â€” ${product.brand}` : ""}
                        </option>
                      ))}
                    </select>

                    <label htmlFor="maintenance-date">Maintenance date *</label>
                    <input
                      id="maintenance-date"
                      type="date"
                      value={maintenanceForm.date}
                      onChange={(event) =>
                        setMaintenanceForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                      required
                    />

                    <label htmlFor="maintenance-description">
                      Activity details *
                    </label>
                    <textarea
                      id="maintenance-description"
                      rows="4"
                      placeholder="e.g. Air conditioner cleaning, laptop servicing..."
                      value={maintenanceForm.description}
                      onChange={(event) =>
                        setMaintenanceForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      required
                    />

                    <button
                      className="primary-button full-width"
                      type="submit"
                      disabled={savingMaintenance || products.length === 0}
                    >
                      {savingMaintenance ? (
                        <>
                          <RefreshCw size={17} className="spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CalendarDays size={17} /> Save Maintenance
                        </>
                      )}
                    </button>

                    {products.length === 0 && (
                      <p className="form-help">
                        Register a product before scheduling maintenance.
                      </p>
                    )}
                  </form>

                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Maintenance records</h3>
                        <p>{allMaintenance.length} records saved</p>
                      </div>
                      <CalendarDays size={20} className="muted-icon" />
                    </div>

                    {allMaintenance.length === 0 ? (
                      <EmptyState
                        icon={CalendarDays}
                        title="No maintenance records"
                        description="Your saved maintenance activities will appear here."
                      />
                    ) : (
                      <div className="record-list">
                        {allMaintenance.map((item, index) => {
                          const days = getDaysRemaining(item.date);

                          return (
                            <div
                              className="service-item"
                              key={item.id || `${item.productId}-${index}`}
                            >
                              <div className="record-icon">
                                <CalendarDays size={19} />
                              </div>
                              <div className="record-content">
                                <strong>{item.productName}</strong>
                                <p>{item.description}</p>
                                <span>{formatDate(item.date)}</span>
                              </div>
                              <span
                                className={`status-badge ${
                                  days !== null && days < 0
                                    ? "status-expired"
                                    : "status-active"
                                }`}
                              >
                                {days === null
                                  ? "Scheduled"
                                  : days < 0
                                    ? "Past date"
                                    : days === 0
                                      ? "Today"
                                      : "Upcoming"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </section>
            )}
          </>
        )}

        <footer className="app-footer">
          <span>Â© {new Date().getFullYear()} WarrantyWise</span>
          <span>
            <ShieldCheck size={15} /> Smart warranty management
          </span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, description, className }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${className}`}>
        <Icon size={23} />
      </div>
      <div className="stat-card-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
      <TrendingUp size={17} className="stat-trend" />
    </article>
  );
}

function ProductTable({ products, onDelete, onSelect }) {
  return (
    <div className="table-wrapper">
      <table className="products-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Warranty expiry</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const expiry = getProductExpiry(product);
            const status = getWarrantyStatus({
              ...product,
              warrantyExpiry: expiry,
            });

            return (
              <tr key={product.id}>
                <td>
                  <button
                    className="table-product-button"
                    onClick={() => onSelect(product)}
                  >
                    <span className="table-product-icon">
                      <Package size={17} />
                    </span>
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.brand || "No brand"}</small>
                    </span>
                  </button>
                </td>
                <td>{formatDate(expiry)}</td>
                <td>
                  <span className={`status-badge ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td>
                  <button
                    className="delete-button"
                    onClick={() => onDelete(product)}
                    title="Delete product"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={29} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction && (
        <button className="primary-button" onClick={onAction}>
          <Plus size={16} /> {action}
        </button>
      )}
    </div>
  );
}

export default App;

