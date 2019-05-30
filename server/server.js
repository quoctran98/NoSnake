const express = require("express");
const MongoClient = require("mongodb").MongoClient;
const fs = require("fs"); // This is a Node.js module, not an NPM package

let config = JSON.parse(fs.readFileSync("server_config.json"));
console.log("NoSnake server started with config: ");
console.log(config);

const app = express();
const client = new MongoClient(config.mongoURL, { useNewUrlParser: true });

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

app.get("/submitURL", function (req, res) {
    const domain = req.query.domain
    const path = req.query.path;
    const isSnake = req.query.isSnake;
    submitURL(domain, path, isSnake);
    res.send("Recieved");
});

function checkURL (domain, path) {
    return new Promise(function (resolve, reject) {
        const client = new MongoClient(config.mongoURL, {useNewUrlParser: true});
        client.connect()
        .then(db => {
            const collection = client.db("no_snake_url").collection("no_snake"); // checks list of OK webpages
            return collection.find({domain: domain, path: path}).toArray();
        })
        .then(result => {
            if (result.length > 0) { // if webpage doc exists in collection
                resolve("no_snakes_here");
            } else {
                resolve("no_data");
            }
            client.close();
        })
    })
}

function submitURL (domain, path, isSnake) {
    if (isSnake == "false") {
        const client = new MongoClient(config.mongoURL, {useNewUrlParser: true});
        client.connect()
        .then(db => {
            const collection = client.db("no_snake_url").collection("no_snake_beta")
            collection.insertOne({
                domain: domain,
                path: path
            })
        })
    } else if (isSnake == "true") {
        const client = new MongoClient(config.mongoURL, {useNewUrlParser: true});
        client.connect()
        .then(db => {
            const collection = client.db("no_snake_url").collection("yes_snake_beta")
            collection.insertOne({
                domain: domain,
                path: path
            })
        })
    }
    client.close();
}

app.listen(config.port);
checkURL("www.ncbi.nlm.nih.gov","/").then(result => console.log(result));