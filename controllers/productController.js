const pool = require("../config/db");

// helper
const getImageUrl = (req, img) => {
  if (!img) return null;
  return img.startsWith("http")
    ? img
    : `${req.protocol}://${req.get("host")}/uploads/${img}`;
};

/* =========================
   GET ALL PRODUCTS
========================= */
exports.getAllProducts = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.gender,
        p.image1,
        p.image2,
        p.image3,
        p.image4,
        p.created_at,

        c.name AS category_name,
        sc.name AS subcategory_name,

        -- Product Details
        pd.description,
        pd.ingredients,
        pd.how_to_use,
        pd.description_image,
        pd.features,
        pd.manufacturer_importer,

        -- Stock Aggregates
        COALESCE(SUM(s.stock), 0) AS total_stock,
        COALESCE(SUM(s.pending), 0) AS pending_stock,
        COALESCE(SUM(s.confirmed), 0) AS confirmed_stock,

        -- Variants JSON
        JSON_ARRAYAGG(
          IF(
            s.id IS NULL,
            NULL,
            JSON_OBJECT(
              'variantId', s.id,
              'variant', s.varient,
              'variant_image', s.varient_image,
              'product_image', s.product_image,
              'stock', s.stock,
              'price', s.price,
              'pending', s.pending,
              'confirmed', s.confirmed
            )
          )
        ) AS variants

      FROM ab_products p
      LEFT JOIN ab_categories c ON c.id = p.category_id
      LEFT JOIN ab_subcategories sc ON sc.id = p.subcategory_id
      LEFT JOIN ab_product_details pd ON pd.productid = p.id
      LEFT JOIN ab_stock s ON s.productid = p.id

      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);

    // Clean null variants
    const products = rows.map((p) => ({
      ...p,
      variants: Array.isArray(p.variants)
        ? p.variants.filter((v) => v !== null)
        : [],
    }));

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    console.error("Get Products Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   GET SINGLE PRODUCT
========================= */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        p.*,
        c.name AS category_name,
        s.name AS subcategory_name
      FROM ab_products p
      LEFT JOIN ab_categories c ON p.category_id = c.id
      LEFT JOIN ab_subcategories s ON p.subcategory_id = s.id
      WHERE p.id = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const p = rows[0];

    res.json({
      ...p,
      image1: getImageUrl(req, p.image1),
      image2: getImageUrl(req, p.image2),
      image3: getImageUrl(req, p.image3),
      image4: getImageUrl(req, p.image4),
    });
  } catch (error) {
    console.error("getProductById error:", error);
    res.status(500).json({ error: error.message });
  }
};

/* =========================
   ADD PRODUCT
========================= */
exports.addProduct = async (req, res) => {
  try {
    const BASE_URL = `${req.protocol}://${req.get("host")}/uploads/`;

    const {
      name,
      sku,
      category_id,
      subcategory_id,
      price,
      gender = "unisex",
    } = req.body;

    if (!name || !sku || !category_id) {
      return res.status(400).json({
        message: "Name, SKU and category are required",
      });
    }

    const files = req.files || {};

    const image1 = files.image1?.[0]?.filename
      ? BASE_URL + files.image1[0].filename
      : null;

    const image2 = files.image2?.[0]?.filename
      ? BASE_URL + files.image2[0].filename
      : null;

    const image3 = files.image3?.[0]?.filename
      ? BASE_URL + files.image3[0].filename
      : null;

    const image4 = files.image4?.[0]?.filename
      ? BASE_URL + files.image4[0].filename
      : null;

    const [result] = await pool.query(
      `
      INSERT INTO ab_products
      (name, sku, category_id, subcategory_id, gender, image1, image2, image3, image4)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        sku,
        category_id,
        subcategory_id || null,
        gender,
        image1,
        image2,
        image3,
        image4,
      ]
    );

    res.status(201).json({
      message: "Product added successfully",
      id: result.insertId,
    });
  } catch (error) {
    console.error("addProduct error:", error);
    res.status(500).json({ error: error.message });
  }
};


/* =========================
   UPDATE PRODUCT
========================= */

exports.updateProduct = async (req, res) => {
  try {
    const BASE_URL = `${req.protocol}://${req.get("host")}/uploads/`;
    const { id } = req.params;

    const [existing] = await pool.query(
      "SELECT * FROM ab_products WHERE id = ?",
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    const files = req.files || {};

    const image1 = files.image1?.[0]?.filename
      ? BASE_URL + files.image1[0].filename
      : existing[0].image1;

    const image2 = files.image2?.[0]?.filename
      ? BASE_URL + files.image2[0].filename
      : existing[0].image2;

    const image3 = files.image3?.[0]?.filename
      ? BASE_URL + files.image3[0].filename
      : existing[0].image3;

    const image4 = files.image4?.[0]?.filename
      ? BASE_URL + files.image4[0].filename
      : existing[0].image4;

    await pool.query(
      `
      UPDATE ab_products SET
        name = ?,
        sku = ?,
        category_id = ?,
        subcategory_id = ?,
        gender = ?,
        image1 = ?,
        image2 = ?,
        image3 = ?,
        image4 = ?
      WHERE id = ?
      `,
      [
        req.body.name ?? existing[0].name,
        req.body.sku ?? existing[0].sku,
        req.body.category_id ?? existing[0].category_id,
        req.body.subcategory_id ?? existing[0].subcategory_id,
        req.body.gender ?? existing[0].gender,
        image1,
        image2,
        image3,
        image4,
        id,
      ]
    );

    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("updateProduct error:", error);
    res.status(500).json({ error: error.message });
  }
};


/* =========================
   DELETE PRODUCT
========================= */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "DELETE FROM ab_products WHERE id = ?",
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("deleteProduct error:", error);
    res.status(500).json({ error: error.message });
  }
};
