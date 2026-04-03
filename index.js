const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");

const db = require("./jeddit-fake-db-exemp.js");
const usersRouter = require("./router/usersRouter.js");
const subsRouter = require("./router/subRouter.js");
const articlesRouter = require("./router/articlesRouter.js");
const commentsRouter = require("./router/commentsRouter.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  cookieSession({
    name: "session",
    keys: ["put_a_key_here_i_guess"],
  }),
);

// Current user avalaible anywhere.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user_id ? db.users.get_byId(req.session.user_id) : null;
  next();
});

// Helper for authenticiation checks
app.use((req, res, next) => {
  req.isLoggedIn = req.session.user_id !== undefined;
  req.currentUser = req.isLoggedIn ? db.users.get_byId(req.session.user_id) : null;
  next();
});

app.set("view engine", "ejs");

app.use("/subs", subsRouter);
app.use("/articles", articlesRouter);
app.use("/comments", commentsRouter);
app.use("/users", usersRouter);

app.get("/", (req, res) => {
  res.redirect("/subs/list");
});

app.get("/debugpage", (req, res) => {
  res.render("debugpage");
});

app.get("/debug_db", (req, res) => {
  db.debug.log_debug();
  res.send("check the server console.   <a href='/'>To Home</a>");
});

app.post("/reset_db", (req, res) => {
  db.debug.reset_and_seed();
  db.debug.log_debug();
  req.session = null;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${PORT}`);
});
