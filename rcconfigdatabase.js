warning: in the working copy of 'backend/package.json', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/backend/package.json b/backend/package.json[m
[1mindex a79aa74..3bd2f11 100644[m
[1m--- a/backend/package.json[m
[1m+++ b/backend/package.json[m
[36m@@ -4,8 +4,8 @@[m
   "description": "",[m
   "main": "src/server.js",[m
   "scripts": {[m
[31m-  "start": "node src/server.js",[m
[31m-  "dev": "nodemon src/server.js"[m
[32m+[m[32m    "start": "node src/server.js",[m
[32m+[m[32m    "dev": "nodemon src/server.js"[m
   },[m
   "keywords": [],[m
   "author": "",[m
[36m@@ -14,7 +14,8 @@[m
   "dependencies": {[m
     "cors": "^2.8.6",[m
     "dotenv": "^18.0.8",[m
[31m-    "express": "^5.3.0"[m
[32m+[m[32m    "express": "^5.3.0",[m
[32m+[m[32m    "mysql2": "^3.24.6"[m
   },[m
   "devDependencies": {[m
     "nodemon": "^3.1.14"[m
[1mdiff --git a/backend/src/server.js b/backend/src/server.js[m
[1mindex 2d767f4..1e1560b 100644[m
[1m--- a/backend/src/server.js[m
[1m+++ b/backend/src/server.js[m
[36m@@ -1,7 +1,10 @@[m
[32m+[m
 const express = require("express");[m
 const cors = require("cors");[m
 require("dotenv").config();[m
 [m
[32m+[m[32mconst pool = require("./config/database");[m
[32m+[m
 const app = express();[m
 const PORT = process.env.PORT || 3000;[m
 [m
[36m@@ -9,7 +12,7 @@[m [mconst PORT = process.env.PORT || 3000;[m
 app.use(cors());[m
 app.use(express.json());[m
 [m
[31m-// API kiểm tra server[m
[32m+[m[32m// Kiem tra server[m
 app.get("/api/health", (req, res) => {[m
     res.json({[m
         success: true,[m
[36m@@ -17,7 +20,29 @@[m [mapp.get("/api/health", (req, res) => {[m
     });[m
 });[m
 [m
[32m+[m[32m// Kiem tra ket noi MySQL[m
[32m+[m[32mapp.get("/api/health/db", async (req, res) => {[m
[32m+[m[32m    try {[m
[32m+[m[32m        const [rows] = await pool.query([m
[32m+[m[32m            "SELECT DATABASE() AS database_name, 1 AS connection_test"[m
[32m+[m[32m        );[m
[32m+[m
[32m+[m[32m        res.json({[m
[32m+[m[32m            success: true,[m
[32m+[m[32m            message: "MySQL connection successful",[m
[32m+[m[32m            database: rows[0].database_name[m
[32m+[m[32m        });[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error("MySQL connection error:", error.message);[m
[32m+[m
[32m+[m[32m        res.status(500).json({[m
[32m+[m[32m            success: false,[m
[32m+[m[32m            message: "MySQL connection failed"[m
[32m+[m[32m        });[m
[32m+[m[32m    }[m
[32m+[m[32m});[m
[32m+[m
 // Start server[m
 app.listen(PORT, () => {[m
     console.log(`Server is running at http://localhost:${PORT}`);[m
[31m-});[m
\ No newline at end of file[m
[32m+[m[32m});[m
