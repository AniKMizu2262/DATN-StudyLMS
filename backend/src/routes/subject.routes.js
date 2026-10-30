const express = require("express");
const router = express.Router();

const {
    getAllSubjects,
    getSubjectById
} = require("../controllers/subject.controller");

// GET /api/subjects
router.get("/", getAllSubjects);

// GET /api/subjects/:id
router.get("/:id", getSubjectById);

module.exports = router;