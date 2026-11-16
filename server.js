const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const productRoutes = require('./routes/productRoutes');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables from .env
dotenv.config();

const app = express();

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Port and DB URI configuration
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/inventory_db';

// Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`Server running on port http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });

// Mount Product Routes
app.use('/api/products', productRoutes);

// Root health check route
app.get('/', (req, res) => {
  res.send('Inventory and Data Management API is running...');
});

// Centralized Error Handler Middleware (Must be last)
app.use(errorHandler);