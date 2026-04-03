const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../jeddit-fake-db-exemp");
// const db = require("../jeddit-fake-db-pass");

const router = express.Router();

// Show registration form
router.get("/register", (req, res) => {
  if (req.isLoggedIn) {
    return res.redirect("/");
  }
  res.render("users/register", { error: null });
});

// Handles registration
router.post("/register", async (req, res) => {
  // Security check
  if (req.isLoggedIn) {
    return res.redirect("/");
  }

  // Getting data from form
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.render("users/register", {
      error: "Username and password is required!",
    });
  }

  // Hash password for safety
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const user = db.users.create({ username, password_hash });

    req.session.user_id = user.id;
    res.redirect("/");
  } catch (err) {
    res.render("users/register", {
      error: err.message,
    });
  }
});

// Showing login form
router.get("/login", (req, res) => {
  if (req.isLoggedIn) {
    return res.redirect("/");
  }
  res.render("users/login", { error: null });
});

// Handle login
router.post("/login", async (req, res) => {
  if (req.isLoggedIn) {
    return res.redirect("/");
  }

  const { username, password } = req.body;
  const user = db.users.get_byUsername(username);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.render("users/login", {
      error: "Invalid credentials!",
    });
  }

  req.session.user_id = user.id;
  res.redirect("/");
});

// Handles logout
router.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

// Showing user profile
router.get("/profile/:id", (req, res) => {
  const user = db.users.get_byId(req.params.id, {
    withArticles: true,
    withComments: true,
  });

  if (!user) {
    return res.status(404).send("User not found!");
  }

  res.render("users/profile", { user });
});

module.exports = router;
