
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "products.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]");
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

function readProducts() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

function getDaysLeft(dateString) {
  const expiry = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

app.use(express.static(path.join(__dirname, "client", "dist")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dist", "index.html"));
});

app.get("/api/products", (req, res) => {
  res.json(readProducts());
});

app.post("/api/products", (req, res) => {
  const { name, brand, purchaseDate, warrantyMonths } = req.body;

  if (!name || !purchaseDate || warrantyMonths === undefined ||
      Number(warrantyMonths) < 0) {
    return res.status(400).json({
      message: "Product name, purchase date, and valid warranty duration are required."
    });
  }

  const months = Number(warrantyMonths);
  const purchase = new Date(purchaseDate);

  if (Number.isNaN(purchase.getTime())) {
    return res.status(400).json({ message: "Invalid purchase date." });
  }

  const warrantyExpiry = new Date(purchase);
  warrantyExpiry.setMonth(warrantyExpiry.getMonth() + months);

  const product = {
    id: Date.now().toString(),
    name,
    brand: brand || "",
    purchaseDate,
    warrantyMonths: months,
    warrantyExpiry: warrantyExpiry.toISOString().slice(0, 10),
    documents: [],
    services: [],
    maintenance: []
  };

  const products = readProducts();
  products.push(product);
  saveProducts(products);

  res.status(201).json(product);
});

app.put("/api/products/:id", (req, res) => {
  const products = readProducts();
  const index = products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: "Product not found." });
  }

  products[index] = { ...products[index], ...req.body, id: products[index].id };
  saveProducts(products);
  res.json(products[index]);
});

app.delete("/api/products/:id", (req, res) => {
  const products = readProducts();
  const updated = products.filter(p => p.id !== req.params.id);

  if (updated.length === products.length) {
    return res.status(404).json({ message: "Product not found." });
  }

  saveProducts(updated);
  res.json({ message: "Product deleted successfully." });
});

app.post("/api/products/:id/documents", upload.single("document"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Upload a PDF, JPG, PNG, or WEBP file smaller than 5 MB."
    });
  }

  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: "Product not found." });
  }

  const document = {
    name: req.file.originalname,
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`
  };

  product.documents.push(document);
  saveProducts(products);
  res.status(201).json(document);
});

app.use("/uploads", express.static(UPLOAD_DIR));

app.post("/api/products/:id/services", (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const { date, description, cost } = req.body;

  if (!date || !description) {
    return res.status(400).json({
      message: "Service date and description are required."
    });
  }

  const service = {
    id: Date.now().toString(),
    date,
    description,
    cost: Number(cost) || 0
  };

  product.services.push(service);
  saveProducts(products);
  res.status(201).json(service);
});

app.post("/api/products/:id/maintenance", (req, res) => {
  const products = readProducts();
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ message: "Product not found." });
  }

  const { date, description } = req.body;

  if (!date || !description) {
    return res.status(400).json({
      message: "Maintenance date and description are required."
    });
  }

  const item = {
    id: Date.now().toString(),
    date,
    description,
    completed: false
  };

  product.maintenance.push(item);
  saveProducts(products);
  res.status(201).json(item);
});

app.get("/api/reminders", (req, res) => {
  const reminders = readProducts()
    .map(product => ({
      id: product.id,
      name: product.name,
      warrantyExpiry: product.warrantyExpiry,
      daysLeft: getDaysLeft(product.warrantyExpiry)
    }))
    .filter(item => item.daysLeft <= 30)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  res.json(reminders);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


