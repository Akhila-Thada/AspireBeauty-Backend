const express = require("express");
const router = express.Router();
const variantController = require("../controllers/variantController");
const { uploadFields } = require("../middlewares/multerConfig");

router.post(
  "/",
  uploadFields([{ name: "varient_image" }, { name: "product_image" }]),
  variantController.addVariant
);
router.put(
  "/:id",
  uploadFields([{ name: "varient_image" }, { name: "product_image" }]),
  variantController.updateVariant
);

router.get("/", variantController.getAllVariants);
router.delete("/:id", variantController.deleteVariant);

module.exports = router;