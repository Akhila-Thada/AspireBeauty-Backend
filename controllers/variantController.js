const pool = require("../config/db");

// Add Variant
exports.addVariant = async (req, res) => {
  try {
    const { productid, varient, stock, price } = req.body;

    if (!productid || !varient) {
      return res.status(400).json({ message: "Product & variant required" });
    }

    const BASE_URL = `${req.protocol}://${req.get("host")}/uploads/`;
    const varientImage = req.files?.varient_image?.[0]?.filename || null;
    const productImage = req.files?.product_image?.[0]?.filename || null;

    const VariantImage = varientImage ? `${BASE_URL}${varientImage}` : null;
    const ProductImage = productImage ? `${BASE_URL}${productImage}` : null;

    const [result] = await pool.query(
      `INSERT INTO ab_stock 
      (productid, varient, price, varient_image, product_image, stock, pending, confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productid,
        varient,
        price || 0,
        VariantImage,
        ProductImage,
        stock || 0,
        0, 
        0  
      ]
    );

const variantData = {
  variantId: result.insertId,
  productid,
  varient,
  price: price || 0,
  stock: stock || 0,
  variant_image: VariantImage,
  product_image: ProductImage,
  pending: 0,
  confirmed: 0
};

global.io.emit("variant:created", variantData);


    res.json({
      message: "Variant added successfully",
      variant: variantData
    });
  } catch (err) {
    console.error("Add Variant Error:", err);
    res.status(500).json({ message: err.message });
  }
};


// Get All Variants
exports.getAllVariants = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      
      SELECT 
  s.id AS stockId,
  s.productid,              
  p.name AS productname,
  s.varient,
  s.price,
  s.varient_image,
  s.product_image,
  s.stock,
  s.pending,
  s.confirmed
FROM ab_stock s
JOIN ab_products p ON p.id = s.productid
ORDER BY p.name, s.varient;

    `);
    res.json(rows);
  } catch (err) {
    console.error("Get Variants Error:", err);
    res.status(500).json({ message: err.message });
  }
};



exports.deleteVariant = async (req, res) => {
  try {
    const { id } = req.params;

    // Get variant info BEFORE deleting
    const [rows] = await pool.query(
      `SELECT id AS variantId, productid FROM ab_stock WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Variant not found" });
    }

    const { variantId, productid } = rows[0];

    //  Delete variant
    await pool.query(`DELETE FROM ab_stock WHERE id = ?`, [id]);

    // Emit socket event
    console.log("EMITTING variant:deleted", { productid, variantId });

    global.io.emit("variant:deleted", {
      productid,
      variantId,
    });

    res.json({
      message: "Variant deleted successfully",
      variantId,
    });
  } catch (err) {
    console.error("Delete Variant Error:", err);
    res.status(500).json({ message: err.message });
  }
};



exports.updateVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { varient, price, stock } = req.body;

    const BASE_URL = `${req.protocol}://${req.get("host")}/uploads/`;
    const varientImage = req.files?.varient_image?.[0]?.filename || null;
    const productImage = req.files?.product_image?.[0]?.filename || null;

    let query = `
      UPDATE ab_stock SET
        varient = COALESCE(?, varient),
        price = COALESCE(?, price),
        stock = COALESCE(?, stock)
    `;

    const values = [varient, price, stock];

    if (varientImage) {
      query += `, varient_image = ?`;
      values.push(`${BASE_URL}${varientImage}`);
    }

    if (productImage) {
      query += `, product_image = ?`;
      values.push(`${BASE_URL}${productImage}`);
    }

    query += ` WHERE id = ?`;
    values.push(id);

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Variant not found" });
    }

    // Fetch updated variant to emit via socket
    const [updatedRows] = await pool.query(
      `SELECT * FROM ab_stock WHERE id = ?`,
      [id]
    );
    const updatedVariant = updatedRows[0];

    // Emit socket event
    global.io.emit("variant:updated", updatedVariant);

    res.json({
      message: "Variant updated successfully",
      variant: updatedVariant
    });
  } catch (err) {
    console.error("Update Variant Error:", err);
    res.status(500).json({ message: err.message });
  }
};
