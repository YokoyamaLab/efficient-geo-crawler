const googleMaps = require('@google/maps');
const turf = require('@turf/turf');
const { sleep } = require('sleep');


// 1. 単一のクエリ点を用いてクローリングする
// ※ページングを考慮
const crawlQueryPoint = async (googleMapsClient, queryPoint, crawlingArea, placeType, pagingIsOn) => {
    const location = [queryPoint.coordinate[1], queryPoint.coordinate[0]]; // lat, lng

    const allResults = [];
    let queryTimes = 0;

    // 1~20件
    const firstResults = await googleMapsClient.placesNearby({
        location,
        rankby: 'distance',
        type: placeType
    }).asPromise()
        .catch((err) => {
            console.log(err);
        });
    queryTimes += 1;
    allResults.push(...firstResults.json.results);
    console.log('1st Query!');
    if (!firstResults['json']['next_page_token']) {
        console.log('No 2nd Page');
    }

    // ページングオンオフの処理
    switch (pagingIsOn) {
        case true:
            // 21~40件
            sleep(3);
            const secondResults = await googleMapsClient.placesNearby({
                pagetoken: firstResults['json']['next_page_token']
            }).asPromise()
                .catch((err) => {
                    console.log(err);
                });
            queryTimes += 1;
            allResults.push(...secondResults.json.results);
            console.log('2nd Query!!');
            if (!secondResults['json']['next_page_token']) {
                console.log('No 3rd Page');
            }

            // 41~60件
            sleep(3);
            const thirdResults = await googleMapsClient.placesNearby({
                pagetoken: secondResults['json']['next_page_token']
            }).asPromise()
                .catch((err) => {
                    console.log(err);
                });
            queryTimes += 1;
            allResults.push(...thirdResults.json.results);
            console.log('3rd Query!!!');
            break;

        case false:
            break;
    }

    // プレイスデータを収集範囲内・外に分類する
    const inPlaces = [];
    const outPlaces = [];

    for (const result of allResults) {
        const placeLocation = [result['geometry']['location']['lng'], result['geometry']['location']['lat']];

        const distance = turf.distance(queryPoint.coordinate, placeLocation, {
            units: 'meters'
        });
        result['distance'] = distance;

        const placeIsIn = turf.booleanPointInPolygon(placeLocation, crawlingArea);
        if (placeIsIn) {
            inPlaces.push(result);
        } else {
            outPlaces.push(result);
        }
    }

    allResults.sort((a, b) => b.distance - a.distance); // 降順(大 → 小)
    inPlaces.sort((a, b) => b.distance - a.distance);
    outPlaces.sort((a, b) => b.distance - a.distance);

    // クエリ円を計算
    // 返り値型: GeoJSON
    const queryCircle = turf.circle(queryPoint.coordinate, allResults[0]['distance'], {
        units: 'meters',
        properties: {
            name: 'query-circle'
        }
    });

    queryPoint['queryTimes'] = queryTimes;
    queryPoint['allPlaces'] = allResults;
    queryPoint['inPlaces'] = inPlaces;
    queryPoint['outPlaces'] = outPlaces;
    queryPoint['queryCircle'] = queryCircle;

    return queryPoint;
};

// 2. intersection-based method本体
const crawlerIntersections = async (apiKey, intersections, crawlingArea, placeType, pagingIsOn) => {
    // Places APIのAPIキー
    const googleMapsClient = googleMaps.createClient({
        key: apiKey,
        Promise
    });

    const doneQueries = [];
    for (let i = 0; i < intersections.length; i++) {
        if (i === 0) { // 最もスコアの大きい交差点
            console.log(`Start with ${intersections[i].id} (score: ${intersections[i].score})`);

            const doneQuery = await crawlQueryPoint(googleMapsClient, intersections[i], crawlingArea, placeType, pagingIsOn);
            doneQueries.push(doneQuery);
        } else { // それ以外
            const nextQueryIsOutAllQueryCircles = [];

            for (const doneQuery of doneQueries) {
                // クエリ円外 → True, クエリ円内 → False
                const nextQueryIsOut = !turf.booleanPointInPolygon(intersections[i].coordinate, doneQuery.queryCircle);

                if (nextQueryIsOut) {
                    nextQueryIsOutAllQueryCircles.push(nextQueryIsOut);
                } else { // どれかひとつのクエリ円内(False)ならスキップ
                    console.log(`Skip ${intersections[i].id} (score: ${intersections[i].score})`);
                    break;
                }
            }

            // 全クエリ円外ならクロールする
            if (nextQueryIsOutAllQueryCircles.length === doneQueries.length) {
                console.log(`Next Query is ${intersections[i].id} (score: ${intersections[i].score})`);
                sleep(1);
                const doneQuery = await crawlQueryPoint(googleMapsClient, intersections[i], crawlingArea, placeType, pagingIsOn);
                doneQueries.push(doneQuery);
            }
        }
    }

    // ---- 収集結果を集計・表示 ----
    let allQueryTimes = 0;
    const allPlaces = [];
    const allInPlaces = [];
    const allOutPlaces = [];

    for (const doneQuery of doneQueries) {
        allQueryTimes += doneQuery['queryTimes'];
        doneQuery['allPlaces'].forEach((place) => {
            allPlaces.push(place['place_id']);
        });
        doneQuery['inPlaces'].forEach((inPlace) => {
            allInPlaces.push(inPlace['place_id']);
        });
        doneQuery['outPlaces'].forEach((outPlace) => {
            allOutPlaces.push(outPlace['place_id']);
        });
    }

    const uniquePlaces = new Set(allPlaces); // 固有データの抽出
    const uniqueInPlaces = new Set(allInPlaces);
    const uniqueOutPlaces = new Set(allOutPlaces);

    // 地図描画用の結果をGeoJSON形式で保存
    // 用いた交差点とそれに対応するクエリ円
    const featureQueries = [];
    for (const doneQuery of doneQueries) {
        const featureQueryPoint = turf.point(doneQuery.coordinate, {
            name: 'intersection',
            id: doneQuery.id,
            score: doneQuery.score,
        });
        featureQueries.push(featureQueryPoint);
        featureQueries.push(doneQuery.queryCircle);

        // クロールしたプレイスデータをcollectionに保存
        // for (let i = 0; i < doneQuery.allPlaces.length; i++) {
        //     if (i === 0) {
        //     const mostFarPlace = doneQuery.allPlaces[i];
        //     const mostFarPlaceLocation = [mostFarPlace.geometry.location.lng, mostFarPlace.geometry.location.lat];
        //     const featureMostFarPlace = turf.point(mostFarPlaceLocation, {
        //         id: doneQuery.id,
        //         distance: doneQuery.allPlaces[i].distance,
        //         'marker-color': '#f44336'
        //     });
        //     featureCollection.push(featureMostFarPlace);
        //     } else {
        //         const placeLocation = [doneQuery.allPlaces[i].geometry.location.lng, doneQuery.allPlaces[i].geometry.location.lat];
        //         const featurePlace = turf.point(placeLocation, {
        //             id: doneQuery.id,
        //             distance: doneQuery.allPlaces[i].distance,
        //         });
        //         featureCollection.push(featurePlace);
        //     }
        // }
    }

    const result = {
        "detail": {
            "Place Type": placeType,
            "Is Paging": pagingIsOn,
            "Total Query-Points": intersections.length,
            "Used Query-Points": doneQueries.length,
            "Total Query-Times": allQueryTimes,
            "Total": {
                "Total": allPlaces.length,
                "Unique": uniquePlaces.size,
                "Duplicated": allPlaces.length - uniquePlaces.size
            },
            "In": {
                "Total": allInPlaces.length,
                "Unique": uniqueInPlaces.size,
                "Duplicated": allInPlaces.length - uniqueInPlaces.size
            },
            "Out": {
                "Total": allOutPlaces.length,
                "Unique": uniqueOutPlaces.size,
                "Duplicated": allOutPlaces.length - uniqueOutPlaces.size
            },
        },
        "map": turf.featureCollection(featureQueries)
    }

    return result;
};

module.exports = crawlerIntersections;
