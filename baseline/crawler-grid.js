const { Client } = require("@googlemaps/google-maps-services-js");
const turf = require('@turf/turf');

const sleep = require(`${__dirname}/../mymodules/sleep.js`);

const crawlerGrid = async (apiKey, grid, placeType, crawlingArea, cellSide, pagingIsOn) => {
    const googleClient = new Client();

    const cells = grid['features']; // グリッドの座標群
    let cellId = 1;
    for (let cell of cells) {
        console.log(`Cell ${cellId}`);
        cell['cell-id'] = cellId;
        cellId += 1;

        let queryTimes = 0;
        const places = [];
        const queryPoint = cell['geometry']['coordinates'] // lng, lat

        // 1~20件
        const firstResult = await googleClient.placesNearby({
            params: {
                location: [queryPoint[1], queryPoint[0]],
                rankby: 'distance',
                type: placeType,
                key: apiKey
            },
            timeout: 1000
        }).catch((err) => {
            console.log(err);
        });
        places.push(...firstResult.data.results);
        queryTimes += 1;
        console.log('1st Query!');
        if (!firstResult['data']['next_page_token']) {
            console.log('No 2nd Page');
            continue;
        } // ページトークンがない場合は，スキップ

        switch (pagingIsOn) {
            case true:
                // 21~40件
                sleep(3);
                const secondResult = await googleClient.placesNearby({
                    params: {
                        pagetoken: firstResult['data']['next_page_token'],
                        key: apiKey
                    },
                    timeout: 1000
                }).catch((err) => {
                    console.log(err);
                });
                places.push(...secondResult.data.results);
                queryTimes += 1;
                console.log('2nd Query!!');
                if (!secondResult['data']['next_page_token']) {
                    console.log('No 3rd Page');
                    continue;
                }

                // 41~60件
                sleep(3);
                const thirdResult = await googleClient.placesNearby({
                    params: {
                        pagetoken: secondResult['data']['next_page_token'],
                        key: apiKey
                    },
                    timeout: 1000
                }).catch((err) => {
                    console.log(err);
                });
                places.push(...thirdResult.data.results);
                queryTimes += 1;
                console.log('3rd Query!!!');
                break;

            case false:
                break;
        }

        // クエリ点との距離計算・プレイスデータの内包判定
        const inPlaces = [];
        const outPlaces = [];
        for (let place of places) {
            const placeLocation = [place['geometry']['location']['lng'], place['geometry']['location']['lat']];
            const distance = turf.distance(queryPoint, placeLocation, {
                units: 'meters'
            });
            place['distance'] = distance;

            const placeIsIn = turf.booleanPointInPolygon(placeLocation, crawlingArea);
            if (placeIsIn) {
                inPlaces.push(place);
            } else {
                outPlaces.push(place);
            }
        }

        places.sort((a, b) => b.distance - a.distance); // 降順(大 → 小)
        inPlaces.sort((a, b) => b.distance - a.distance);
        outPlaces.sort((a, b) => b.distance - a.distance);

        // クエリ円計算
        const queryCircle = turf.circle(queryPoint, places[0]['distance'], {
            units: 'meters',
            properties: {
                name: 'query-circle'
            }
        });

        cell['data'] = {};
        cell['data']['query-times'] = queryTimes;
        cell['data']['places'] = places;
        cell['data']['in-places'] = inPlaces;
        cell['data']['out-places'] = outPlaces;
        cell['data']['query-circle'] = queryCircle;
    }
    console.log('All Cells Cleared');

    // -- 結果を集計 --
    let totalQueryTimes = 0;
    const totalPlaces = [];
    const totalInPlaces = [];
    const totalOutPlaces = [];

    for (let cell of cells) {
        totalQueryTimes += cell['data']['query-times'];
        cell['data']['places'].forEach((place) => {
            totalPlaces.push(place['place_id']);
        });
        cell['data']['in-places'].forEach((place) => {
            totalInPlaces.push(place['place_id']);
        });
        cell['data']['out-places'].forEach((place) => {
            totalOutPlaces.push(place['place_id']);
        });
    }

    // 固有データの抽出
    const uniquePlaces = new Set(totalPlaces);
    const uniqueInPlaces = new Set(totalInPlaces);
    const uniqueOutPlaces = new Set(totalOutPlaces);

    // -- クライアント送信用データ定義 --
    const features = [];
    for (let cell of cells) {
        const featureQueryPoint = turf.point(cell['geometry']['coordinates'], {
            name: 'cell',
            id: cell['cell-id']
        });
        features.push(featureQueryPoint);
        features.push(cell['data']['query-circle']);
    }

    const result = {
        "detail": {
            "Place Type": placeType,
            "Is Paging": pagingIsOn,
            "Cell Size": `${cellSide}m`,
            "Total Cells": cells.length,
            "Total Query-Times": totalQueryTimes,
            "Total": {
                "Total": totalPlaces.length,
                "Unique": uniquePlaces.size,
                "Duplicated": totalPlaces.length - uniquePlaces.size
            },
            "In": {
                "Total": totalInPlaces.length,
                "Unique": uniqueInPlaces.size,
                "Duplicated": totalInPlaces.length - uniqueInPlaces.size
            },
            "Out": {
                "Total": totalOutPlaces.length,
                "Unique": uniqueOutPlaces.size,
                "Duplicated": totalOutPlaces.length - uniqueOutPlaces.size
            }
        },
        "map": turf.featureCollection(features)
    }

    return result;
};

module.exports = crawlerGrid;