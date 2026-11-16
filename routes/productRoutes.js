const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// 1. GET ALL PRODUCTS (with Filtering, Sorting, Pagination & Search)
router.get('/', async (req, res, next) => {
  try {
    const { category, search, sortBy, order = 'asc', page = 1, limit = 10 } = req.query;
    let query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { supplier: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    let sortOption = {};
    if (sortBy) {
      sortOption[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sortOption.createdAt = -1;
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      total,
      page: pageNum,
      totalPages,
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET LOW-STOCK ITEMS REPORT (Must be placed BEFORE /:id)
router.get('/low-stock', async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    });

    res.status(200).json({
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (error) {
    next(error);
  }
});

// 3. GET CATEGORY-WISE INVENTORY SUMMARY (Aggregation Pipeline - Must be BEFORE /:id)
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $sort: { totalStockValue: -1 }
      }
    ]);

    res.status(200).json({
      categories: summary.length,
      summary
    });
  } catch (error) {
    next(error);
  }
});

// 4. GET SINGLE PRODUCT BY ID
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.statusCode = 404;
      throw new Error('Product not found');
    }
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
});

// 5. CREATE PRODUCT
router.post('/', async (req, res, next) => {
  try {
    const newProduct = await Product.create(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    next(error);
  }
});

// 6. UPDATE PRODUCT DETAILS (PUT)
router.put('/:id', async (req, res, next) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      res.statusCode = 404;
      throw new Error('Product not found');
    }
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
});

// 7. STOCK ADJUSTMENT (PATCH /:id/stock) -> Body: { "change": 10 } or { "change": -5 }
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { change } = req.body;
    if (typeof change !== 'number') {
      res.statusCode = 400;
      throw new Error('Stock change value must be a number');
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.statusCode = 404;
      throw new Error('Product not found');
    }

    const newQuantity = product.quantity + change;
    if (newQuantity < 0) {
      res.statusCode = 400;
      throw new Error('Insufficient stock for this operation');
    }

    product.quantity = newQuantity;
    await product.save();

    res.status(200).json({
      message: 'Stock updated',
      product
    });
  } catch (error) {
    next(error);
  }
});

// 8. DELETE PRODUCT
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.statusCode = 404;
      throw new Error('Product not found');
    }
    res.status(200).json({
      message: 'Product deleted',
      id: req.params.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;