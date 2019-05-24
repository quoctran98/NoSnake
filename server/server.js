const express = require("express");

const app = express();

app.get("/urlChecker", function (req, res) {
    const domain = req.query.domain;
    const path = req.query.path;
    console.timeStamp();
    console.log("Domain: " + domain);
    console.log("Path: " + path);
    res.send("true");
});

app.post("/urlSubmit", function (req, res) {
    const domain = req.query.domain
    const path = req.query.path;
    const isSnake = req.query.isSnake;
    res.send("Recieved");
});

app.listen(8080);