const MongoClient = require("mongodb").MongoClient;
const mongoURL = "mongodb+srv://NoSnakeServer-1:i0otEXF2sEeGweUn@cluster0-toyuh.mongodb.net/test?retryWrites=true";

function checkURL (domain, path) {
return new Promise(function (resolve, reject) {
    const client = new MongoClient(mongoURL, { useNewUrlParser: true });

    client.connect()
    .then(db => {
        const collection = client.db("no_snake_url").collection("yes_snake");
        return collection.find({domain: domain}).toArray();
    })
    .then(result => {
        resolve(result);
        client.close();
    })
})
}

checkURL("www.snake.com", "/pictures/").then(result => {console.log(result);})