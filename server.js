const express = require("express");
const app = express();
const rp = require('request-promise');
const $ = require('cheerio');
const _ = require('lodash');
const {Translate} = require('@google-cloud/translate').v2;
const translate = new Translate();
const bodyParser = require('body-parser');

const url = 'https://xn--pevapakkumised-5hb.ee/tallinn';

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.raw());

const NEAR = [
  "Argentiina restoran",
];

const formatText = (items) => {
  const text = items.map(({name, offers, location}) => {
    const link = `<https://www.google.com/maps?q=${location}|${location}>`;
    return `*${name}* | ${link}:\n${offers.join("\n")}\n`;
  }).join("\n");

  return {
    text,
  }
};

async function translateText(text) {
    let [translations] = await translate.translate(text, "en");
    translations = Array.isArray(translations) ? translations : [translations];
    return translations;
}

const dailyMenu = (response, commandText) => {
    rp(url).then(function(html){
      const restaurants = $('.offerLayout', html);
      const restaurant = restaurants[0];
      const offers = Object.values(restaurants).map(restaurant => {
          const offers = Object.values($(".mealInfo > .offer", restaurant)).map(offer => $(offer).text());
          return ({
              name: $("h3", restaurant).text().trim(),
              offers: offers.splice(0, (offers.length - 1) / 2),
              district: $(".district", restaurant).text().trim(),
              likes: Number($(".positiveVotes", restaurant).text()),
              location: $(".icon-location", restaurant).attr("title"),
          });
      })
      .filter(offer => offer.district === "Kesklinn")
      .filter((offer) => {
          if (commandText === "near") {
            return NEAR.includes(offer.name);
          }
          else {
            return true;
          }
        });

      const sorted = _.orderBy(offers, ["likes"], ["desc"])
        .slice(1, 10)
        .map(async (offer) => {
            return {
                ...offer,
                offers: await translateText(offer.offers),
            }
        });

      Promise.all(sorted).then((resolved) => {
        response.send(formatText(resolved));
      });

  })
  .catch(function(err){});
};

app.get("/", function(request, response) {
  dailyMenu(response);
});

app.post("/", function(request, response) {
  dailyMenu(response, request.body.text);
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
