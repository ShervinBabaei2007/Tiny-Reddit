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

// Showing single comment
router.get("/show/:id", (req, res) => {
  let commentId = req.params.id;
  let comment = db.comments.get_byId(commentId, {
    withCreator: true,
    withVotes: true,
    withCurrentVote: req.session.user_id,
    withNestedComments: true,
  });

  if (!comment) {
    return res.status(404).send("Comment not found!");
  }

  let article = db.articles.get_byId(comment.article_id);
  const isUserMod = isMod(article.sub_name, req.session.user_id);

  res.render("comments/show", { comment, isUserMod });
});

// Handling comment creation
router.post("/create", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let text = req.body.text;
  let articleId = req.body.articleId;
  let parentId = req.body.parentId;

  let newComment = db.comments.create({
    article: articleId,
    creator: req.session.user_id,
    text: text,
    parent: parentId || undefined,
  });

  // Auto-upvote the comment
  db.comments.set_vote({
    comment: newComment.id,
    voter: req.session.user_id,
    vote_value: 1,
  });

  res.redirect(`/articles/show/${articleId}`);
});

// Display edit form
router.get("/edit/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let commentId = req.params.id;
  let comment = db.comments.get_byId(commentId);

  if (!comment) {
    return res.status(404).send("Comment not found");
  }

  if (comment.creator_id !== req.session.user_id) {
    return res.status(403).send("You can only edit YOUR OWN comment!");
  }

  res.render("comments/edit", { comment: comment });
});

// Handling edit
router.post("/edit/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let commentId = req.params.id;
  let comment = db.comments.get_byId(commentId);

  if (!comment) {
    return res.status(404).send("Comment not found!");
  }

  if (comment.creator_id !== req.session.user_id) {
    return res.status(403).send("You can only edit YOUR OWN comment!");
  }

  let text = req.body.text;

  db.comments.update({
    id: commentId,
    text: text,
  });

  res.redirect(`/articles/show/${comment.article_id}`);
});

// Display delete confirmation page
router.get("/delete/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let commentId = req.params.id;
  let comment = db.comments.get_byId(commentId);

  if (!comment) {
    return res.status(404).send("Comment not found!");
  }

  // Article checks sub_name
  let article = db.articles.get_byId(comment.article_id);

  const isOwner = comment.creator_id === req.session.user_id;
  const isUserMod = isMod(article.sub_name, req.session.user_id);

  if (!isOwner && !isUserMod) {
    return res.status(403).send("you can only delete YOUR OWN comment or be a mod!");
  }

  res.render("comments/delete", { comment: comment });
});

// Handling Deletion
router.post("/delete/:id", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let commentId = req.params.id;
  let comment = db.comments.get_byId(commentId);

  if (!comment) {
    return res.status(404).send("Comment not found!");
  }

  // Article checks sub_name
  let article = db.articles.get_byId(comment.article_id);

  const isOwner = comment.creator_id === req.session.user_id;
  const isUserMod = isMod(article.sub_name, req.session.user_id);

  if (!isOwner && !isUserMod) {
    return res.status(403).send("you can only delete YOUR OWN comment or be a mod!");
  }

  let articleId = comment.article_id;
  db.comments.delete(commentId);

  res.redirect(`/articles/show/${articleId}`);
});

// Handles voting on comments
router.post("/vote/:id/:votevalue", (req, res) => {
  if (!req.isLoggedIn) {
    return res.redirect("/users/login");
  }

  let commentId = req.params.id;
  let voteValue = parseInt(req.params.votevalue);
  let returnUrl = req.query.returnUrl || "/";

  try {
    let currentVote = db.comments.get_vote({
      comment: commentId,
      voter: req.session.user_id,
    });

    if (currentVote && currentVote.vote_value === voteValue) {
      db.comments.remove_vote({
        comment: commentId,
        voter: req.session.user_id,
      });
    } else if (voteValue === 1 || voteValue === -1) {
      db.comments.set_vote({
        comment: commentId,
        voter: req.session.user_id,
        vote_value: voteValue,
      });
    } else {
      return res.status(400).send("Invalid vote value!");
    }
    res.redirect(returnUrl);
  } catch (error) {
    res.status(500).send("Error voting: " + error.message);
  }
});

module.exports = router;
