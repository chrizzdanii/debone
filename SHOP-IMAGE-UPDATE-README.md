# DEBONE Shop — 50 image-matched products

- Imported 50 supplied image files and created exactly 50 physical-shop products.
- Original physical-shop seed (20 items) saved in backups/original-shop-products.json.
- Product images are stored in public/assets/debone-products/ and referenced by both public/data/products.json and server/products.json.
- A one-time bootstrap migration replaces existing live physical-shop products on first deployment; back up server/data/db.json or your persistent DB before deploying. Existing physical-shop orders are not deleted but may reference old product IDs.
- Digital products, courses, students and other sections are not intentionally modified.
- AI-generated images are illustrative; inspect exact model and specifications before claiming that a product pictured is the physical item for sale.
- Review IMAGE-TO-PRODUCT-MAPPING.csv before deploying.
