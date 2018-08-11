"use strict";

var express = require("express");
var mongo = require("mongodb");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var dns = require("dns");

var cors = require("cors");

var app = express();

// Basic Configuration
var port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGOLAB_URI);

var urlMappingSchema = new mongoose.Schema({
  original_url: String,
  short_url: String
});

var UrlMapping = mongoose.model("UrlMapping", urlMappingSchema);

app.use(cors());

app.use(bodyParser.urlencoded({ entended: false }));

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.get("/api/hello", function(req, res) {
  res.json({ greeting: "hello API" });
});

app.post("/api/shorturl/new", function(req, res) {
  var url = req.body.url;
  var dnsLookup = new Promise(function(resolve, reject) {
    var result = url.replace(/(^\w+:|^)\/\//, "");
    dns.lookup(result, function(err, addresses, family) {
      if (err) reject(err);
      resolve(addresses);
    });
  });

  dnsLookup
    .then(function() {
      return checkIfExists(url);
    })
    .then(function(data) {
      if (data.status) {
        return res.json({ original_url: url, short_url: data.short_url });
      } else {
        var shortUrl = shorterUrl();
        var urlMapping = new UrlMapping({
          original_url: url,
          short_url: shortUrl
        });
        return saveUrlMapping(urlMapping);
      }
    })
    .then(function(original_url) {
      var shortUrl = shorterUrl();
      return res.json({ original_url: url, short_url: shortUrl });
    });
  dnsLookup.catch(function(reason) {
    return res.json({ error: "invalid URL" });
  });
});

app.get("/api/shorturl/:shortUrl", function(req, res) {
  var redirectPromise = redirectToOriginalUrl(req.params.shortUrl);
  redirectPromise.then(function(original_url) {
    return res.redirect(original_url);
  });
  redirectPromise.catch(function(reason) {
    return res.json({ error: "invalid URL" });
  });
});

function redirectToOriginalUrl(short_url) {
  return new Promise(function(resolve, reject) {
    UrlMapping.findOne({ short_url: short_url }, function(err, doc) {
      if (err || doc === null) return reject(err);
      else return resolve(doc.original_url);
    });
  });
}

function checkIfExists(original_url) {
  return new Promise(function(resolve, reject) {
    UrlMapping.findOne({ original_url: original_url }, function(err, doc) {
      if (doc === null || err) resolve({ status: false });
      else resolve({ status: true, short_url: doc.short_url });
    });
  });
}

function saveUrlMapping(mapping) {
  return new Promise(function(resolve, reject) {
    mapping.save(function(err, data) {
      if (err) return reject(err);
      else return resolve(null, data);
    });
  });
}

function shorterUrl() {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

app.listen(port, function() {
  console.log("Node.js listening ...");
});
