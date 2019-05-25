const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const fs = require("fs"); // This is a Node.js module, not an NPM package

let config = JSON.parse(fs.readFileSync("config.json"));
let mongoURL = config.monogURL;
let port = config.port;
console.log(mongoURL);

const app = express();
const client = new MongoClient(mongoURL, { useNewUrlParser: true });

app.get("/checkURL", function (req, res) {
    const domain = req.query.domain;
    const path = req.query.path;
    console.timeStamp();
    console.log("Domain: " + domain);
    console.log("Path: " + path);
    checkURL(domain, path).then(result => {
        res.send(result);
    })
});

app.post("/submitURL", function (req, res) {
    const domain = req.query.domain
    const path = req.query.path;
    const isSnake = req.query.isSnake;
    submitURL(domain, path, isSnake);
    res.send("Recieved");
});

function checkURL (domain, path) {
    return new Promise(function (resolve, reject) {
        const client = new MongoClient(mongoURL, { useNewUrlParser: true });
        client.connect()
        .then(db => {
            const collection = client.db("no_snake_url").collection("yes_snake");
            return collection.findOne({domain: domain, path: path}).toArray();
        })
        .then(result => {
            if (result.length > 0) { // if document exists at all
                resolve("true");
            } else {
                resolve("false");
            }
            client.close();
        })
    })
}

app.listen(port);
checkURL("www.snake.com","/pictures").then(result => console.log(result));