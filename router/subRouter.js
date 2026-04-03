const express = require("express");
const db = require("../jeddit-fake-db-exemp");
const router = express.Router();

// Checking if user is mod of subjeddit
function isMod(sub_name, user_id) {
  if (!user_id) return false;

  const sub = db.subs.get_byName(sub_name, { withMods: true });
  if (!sub || !sub.mods) return false;

  return sub.mods[user_id] === true;
}

// Simple sorting function
// ts = timestamp
function sortArticle(articles, orderBy) {
  if (orderBy === "top") {
    articles.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
  } else if (orderBy === "old") {
    articles.sort((a, b) => a.ts - b.ts);
  } else if (orderBy === "ragebait") {
    articles.sort((a, b) => b.upvotes + b.downvotes - (a.upvotes + a.downvotes));
  } else {
    articles.sort((a, b) => b.ts - a.ts);
  }
}

// Show all subjeddits
router.get("/list", (req, res) => {
  const subs = db.subs.list();
  res.render("subs/list", { subs });
});

// Show one subjeddit with all its articles
router.get("/show/:id", (req, res) => {
  const sub = db.subs.get_byName(req.params.id);

  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  const ordering = req.query.ordering || "new";

  // Get all articles in this sub
  const articles = db.articles.get_byFilter((article) => article.sub_name === sub.name, {
    withCreator: true,
    withVotes: true,
    withCurrentVote: req.session.user_id,
  });

  sortArticle(articles, ordering);

  const isUserMod = isMod(sub.name, req.session.user_id);

  res.render("subs/show", { sub, articles, ordering, isUserMod });
});

// Show form to create new sub
router.get("/create", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  res.render("subs/create", { error: null });
});

// create the sub
router.post("/create", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const { name } = req.body;
  if (!name) {
    return res.render("subs/create", {
      error: "Subjeddit name is required!",
    });
  }

  try {
    db.subs.create({
      name,
      creator: req.session.user_id,
    });
    res.redirect(`/subs/show/${name}`);
  } catch (err) {
    res.render("subs/create", {
      error: err.message,
    });
  }
});

// Listing all mods
router.get("/show/:subname/mods/list", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const sub = db.subs.get_byName(req.params.subname, { withMods: true });
  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  if (!isMod(sub.name, req.session.user_id)) {
    return res.status(403).send("You must be a mod!");
  }

  // getting user Object for Mod
  const modIds = Object.keys(sub.mods || {});
  const mods = modIds.map((id) => db.users.get_byId(id));

  res.render("subs/mods_list", { sub, mods });
});

// shows form for adding mod
router.get("/show/:subname/mods/add", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const sub = db.subs.get_byName(req.params.subname, { withMods: true });
  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  if (!isMod(sub.name, req.session.user_id)) {
    return res.status(403).send("You must be a mod!");
  }

  res.render("subs/mods_add", { sub, error: null });
});

// Handling adding mod
router.post("/show/:subname/mods/add", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const sub = db.subs.get_byName(req.params.subname, { withMods: true });
  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  if (!isMod(sub.name, req.session.user_id)) {
    return res.status(403).send("You must be a mod!");
  }

  const username = req.body.username;
  if (!username) {
    return res.render("subs/mods_add", { sub, error: "Username is required" });
  }

  const user = db.users.get_byUsername(username);
  if (!user) {
    return res.render("subs/mods_add", { sub, error: "User not found!" });
  }

  try {
    db.subs.add_mod({ sub: sub.name, user: user.id });
    res.redirect(`/subs/show/${sub.name}/mods/list`);
  } catch (error) {
    res.render("subs/mods_add", { sub, error: error.message });
  }
});

// showing confirm to remove mod
router.get("/show/:subname/mods/remove/:mod_name", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const sub = db.subs.get_byName(req.params.subname);
  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  if (!isMod(sub.name, req.session.user_id)) {
    return res.status(403).send("You must be a mod!");
  }

  const modToRemove = db.users.get_byUsername(req.params.mod_name);
  if (!modToRemove) {
    return res.status(404).send("User not found!");
  }

  res.render("subs/mods_remove", { sub, modToRemove });
});

// Handles removing mod
router.post("/show/:subname/mods/remove/:mod_name", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  const sub = db.subs.get_byName(req.params.subname);
  if (!sub) {
    return res.status(404).send("Subjeddit not found!");
  }

  if (!isMod(sub.name, req.session.user_id)) {
    return res.status(403).send("You must be a mod!");
  }

  const modToRemove = db.users.get_byUsername(req.params.mod_name);
  if (!modToRemove) {
    return res.status(404).send("User not found!");
  }

  try {
    db.subs.remove_mod({ sub: sub.name, user: modToRemove.id });
    res.redirect(`/subs/show/${sub.name}/mods/list`);
  } catch (error) {
    res.status(500).send("Error removing mod: " + error.message);
  }
});

module.exports = router;
