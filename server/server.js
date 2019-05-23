const Promise = require("promise");
const express = require("express");

const app = express();

app.set("view engine", "pug");

app.get("/", function (req, res) {
    res.render()
    res.send('hello world');
    console.log(req);
});

app.listen(8080);