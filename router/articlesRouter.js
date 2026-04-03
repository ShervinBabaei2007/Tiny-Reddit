const express = require("express");
const router = express.Router();
const db = require("../jeddit-fake-db-exemp");

// isMod helper function
function isMod(sub_name, user_id) {
  if (!user_id) return false;

  const sub = db.subs.get_byName(sub_name, { withMods: true });
  if (!sub || !sub.mods) return false;

  return sub.mods[user_id] === true;
}

// Simple sorting function
// ts = timestamp
function sortComments(comments, orderBy) {
  if (orderBy === "top") {
    comments.sort((a, b) => b.upvotes - b.downvotes - (a.upvotes - a.downvotes));
  } else if (orderBy === "old") {
    comments.sort((a, b) => a.ts - b.ts);
  } else if (orderBy === "ragebait") {
    comments.sort((a, b) => b.upvotes + b.downvotes - (a.upvotes + a.downvotes));
  } else {
    // Default: new
    comments.sort((a, b) => b.ts - a.ts);
  }
}

// Helper function --> detection URL --> Image
function isImageUrl(url) {
  if (!url) return false;

  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".gif")
  );
}

// Display single article
router.get("/show/:id", (req, res) => {
  let articleId = req.params.id;
  const ordering = req.query.ordering || "new";

  let article = db.articles.get_byId(articleId, {
    withComments: true,
    withCreator: true,
    withVotes: true,
    withCurrentVote: req.session.user_id,
    withNestedComments: true,
  });

  if (!article) {
    return res.status(404).send("Article does not exist!");
  }

  sortComments(article.comments, ordering);

  // image detection
  article.isImage = isImageUrl(article.link);

  const isUserMod = isMod(article.sub_name, req.session.user_id);

  res.render("articles/show", { article: article, ordering, isUserMod });
});

// Displaying form to create the article
router.get("/create", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let subName = req.query.subName;

  if (!subName) {
    return res.status(404).send("Missing Subjeddit!");
  }

  let sub = db.subs.get_byName(subName);

  if (!sub) {
    return res.status(404).send("Subjeddit Not found!");
  }

  res.render("articles/create", {
    subName: subName,
    sub: sub,
  });
});

// Handles the article creation
router.post("/create", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let formTitle = req.body.title;
  let formLink = req.body.link;
  let formText = req.body.text;
  let formSubName = req.body.subName;

  if (!formTitle || !formSubName) {
    return res.status(400).send("Title or SubJeddit are required!");
  }

  let newArticle = db.articles.create({
    title: formTitle,
    link: formLink,
    text: formText,
    sub: formSubName,
    creator: req.session.user_id,
  });

  // Auto upvote (+1) article
  db.articles.set_vote({
    article: newArticle.id,
    voter: req.session.user_id,
    vote_value: 1,
  });

  res.redirect(`/articles/show/${newArticle.id}`);
});

// Display edit form
router.get("/edit/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let articleId = req.params.id;
  let article = db.articles.get_byId(articleId);

  if (!article) {
    return res.status(404).send("Article not found!");
  }

  if (article.creator_id !== req.session.user_id) {
    return res.status(403).send("You can only edit YOUR OWN article!");
  }

  res.render("articles/edit", {
    article: article,
  });
});

// Handle edit
router.post("/edit/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let articleId = req.params.id;
  let article = db.articles.get_byId(articleId);

  if (!article) {
    return res.status(404).send("Article not found!");
  }

  if (article.creator_id !== req.session.user_id) {
    return res.status(403).send("You can only edit YOUR OWN article!");
  }

  db.articles.update({
    id: articleId,
    title: req.body.title,
    link: req.body.link,
    text: req.body.text,
  });

  res.redirect(`/articles/show/${articleId}`);
});

// Display deletion confirm
router.get("/delete/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let article = db.articles.get_byId(req.params.id);

  if (!article) {
    return res.status(404).send("Article not found!");
  }

  const isOwner = article.creator_id === req.session.user_id;
  const isUserMod = isMod(article.sub_name, req.session.user_id);

  if (!isOwner && !isUserMod) {
    return res.status(403).send("You can only delete your own articles or be a mod!");
  }

  res.render("articles/delete", { article });
});

// Handle deletion
router.post("/delete/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let articleId = req.params.id;
  let article = db.articles.get_byId(articleId);

  if (!article) {
    return res.status(404).send("Article not found!");
  }

  const isOwner = article.creator_id === req.session.user_id;
  const isUserMod = isMod(article.sub_name, req.session.user_id);

  if (!isOwner && !isUserMod) {
    return res.status(403).send("You can only delete your own articles or be a mod!");
  }

  let subName = article.sub_name;

  db.articles.delete(articleId);

  res.redirect(`/subs/show/${subName}`);
});

// Handles Voting articles
router.post("/vote/:id/:votevalue", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let articleId = req.params.id;
  let voteValue = parseInt(req.params.votevalue);
  let returnUrl = req.query.returnUrl || "/";

  try {
    let currentVote = db.articles.get_vote({
      article: articleId,
      voter: req.session.user_id,
    });

    // If same button clicked  user already voted --> removes votes
    if (currentVote && currentVote.vote_value === voteValue) {
      db.articles.remove_vote({
        article: articleId,
        voter: req.session.user_id,
      });
    } else if (voteValue === 1 || voteValue === -1) {
      // set the new vote either new and also switching from up to down
      db.articles.set_vote({
        article: articleId,
        voter: req.session.user_id,
        vote_value: voteValue,
      });
    } else {
      return res.status(400).send("Invalid vote value!");
    }

    res.redirect(returnUrl);
  } catch (error) {
    res.status(500).send("Error Voting: " + error.message);
  }
});
module.exports = router;
