# Efficient Geo Crawler
This app is a GIS to crawl nearby place data for a target area with [Google Places API](https://developers.google.com/places/web-service/overview) and visualize them quickly.

<!-- ![demo-gif](./demo.gif) -->
[The Sample App is Here.](https://efficient-geo-crawler.herokuapp.com/)

## Quick Start
```
# 1. Clone to your local
$ git clone https://github.com/YokoyamaLab/efficient-geo-crawler.git

# 2. Deploy the app with Heroku CLI
$ heroku create
$ git push heroku prod:master

# 3. Run
$ heroku open
```

# Usage
## Crawling Settings
* Target Area:  <br>
You draw a target area freely with the polygon tool.
* API Key (Google Places API): <br>
[Get your API Key](https://developers.google.com/places/web-service/get-api-key)

* Method Type:<br>
Choose either Intersection-based Method (Proposed Method) or Grid-based Method (Baseline Method), or both.
* Place Type:<br>
Select place type that you want to crawl. ([Place Type List](https://developers.google.com/places/web-service/supported_types))
* Cell Size(m):<br>
This parameter is needed to decide the size of the grid cells in Baseline method. The lower the value of this parameter, the more comprehensively the place data can be crawled.
* Paging:<br>
When this is enabled, you can crawl max 60 place data for a single point. ([Detail](https://developers.google.com/places/web-service/search#PlaceSearchRequests))

# Libraries
* [@derhuerst/query-overpass](https://github.com/derhuerst/query-overpass)
* [@google/maps](https://github.com/googlemaps/google-maps-services-js/tree/%40google/maps)
* [Turf.js](https://turfjs.org/)
* [Socket.io](https://socket.io/)
* [Mapbox-GL-JS](https://github.com/mapbox/mapbox-gl-js)
* [Mapbox-GL-draw](https://github.com/mapbox/mapbox-gl-draw)
* [Mapbox-GL-geocoder](https://github.com/mapbox/mapbox-gl-geocoder)
* [Bulma](https://bulma.io/)