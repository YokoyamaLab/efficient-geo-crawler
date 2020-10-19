const { Client } = require("@googlemaps/google-maps-services-js");
const turf = require('@turf/turf');

const fs = require('fs');

const sleep = require(`${__dirname}/../mymodules/sleep.js`);

// 1. 最もスコアの大きいノードをクロールする(ページングありorなし)
const crawlQueryPoints = async (apiKey, googleClient, queryPoint, placeType, pagingIsOn) => {
    const location = [queryPoint.coordinate[1], queryPoint.coordinate[0]]; // lat, lng

    const allResults = [];
    let queryTimes = 0;

    // 1ページ目
    const firstResults = await googleClient.placesNearby({
        params: {
            location,
            rankby: 'distance',
            type: placeType,
            key: apiKey
        },
        timeout: 5000
    }).catch((err) => {
        console.log(err);
    });
    queryTimes += 1;
    allResults.push(...firstResults.data.results);
    console.log('1st Query!');
    if (!firstResults['data']['next_page_token']) {
        console.log('No 2nd Page');
    }

    // ページングオンオフの処理
    switch (pagingIsOn) {
        case true:
            // 2ページ目
            sleep(3);
            const secondResults = await googleClient.placesNearby({
                params: {
                    pagetoken: firstResults['data']['next_page_token'],
                    key: apiKey
                },
                timeout: 5000
            }).catch((err) => {
                console.log(err);
            });
            queryTimes += 1;
            allResults.push(...secondResults.data.results);
            console.log('2nd Query!!');
            if (!secondResults['data']['next_page_token']) {
                console.log('No 3rd Page');
            }

            // 3ページ目
            sleep(3);
            const thirdResults = await googleClient.placesNearby({
                params: {
                    pagetoken: secondResults['data']['next_page_token'],
                    key: apiKey
                },
                timeout: 5000
            }).catch((err) => {
                console.log(err);
            });
            queryTimes += 1;
            allResults.push(...thirdResults.data.results);
            console.log('3rd Query!!!');
            break;

        case false:
            break;
    }

    // クエリ点と各プレイスの距離を計算する
    for (const result of allResults) {
        const placeLocation = [result['geometry']['location']['lng'], result['geometry']['location']['lat']];

        const distance = turf.distance(queryPoint.coordinate, placeLocation, {
            units: 'meters'
        });
        result['distance'] = distance;
    }
    allResults.sort((a, b) => b.distance - a.distance); // 降順(大 → 小)

    // クエリ円(中心:クエリ点, 半径:クエリ点と最も離れているプレイス間の距離)を計算
    const queryCircle = turf.circle(queryPoint.coordinate, allResults[0]['distance'], {
        units: 'meters',
        properties: {
            name: 'query-circle'
        }
    });

    queryPoint['queryTimes'] = queryTimes;
    queryPoint['allPlaces'] = allResults;
    queryPoint['queryCircle'] = queryCircle;

    return queryPoint;
};

// 2. ページング制御をしつつ，最もスコアの大きいクエリ点以外のクロールを行う
const crawlWithPagingMethod = async (apiKey, googleClient, queryPoint, crawlingArea, placeType, areaName, doneQueries, thresholdP) => {
    const location = [queryPoint.coordinate[1], queryPoint.coordinate[0]]; // lat, lng
    const places = [];

    let queryTimes = 0; // クエリ回数
    let p = 0; // 割合p
    let pagetoken; // ページトークン
    let queryCircle; // このクエリ点に対するクエリ円

    while (p < thresholdP) {
        // クエリ1回目(1ページ目)
        if (queryTimes === 0) {
            const page = await googleClient.placesNearby({
                params: {
                    location,
                    rankby: 'distance',
                    type: placeType,
                    key: apiKey
                },
                timeout: 5000
            }).catch((err) => {
                console.log(err);
            });
            pagetoken = page['data']['next_page_token'];
            places.push(...page.data.results);
            console.log('1st Query!');
        }

        // クエリ2回目(2ページ目)
        if (queryTimes === 1) {
            sleep(3);
            const page = await googleClient.placesNearby({
                params: {
                    pagetoken,
                    key: apiKey
                },
                timeout: 5000
            }).catch((err) => {
                console.log(err);
            });
            pagetoken = page['data']['next_page_token'];
            places.push(...page.data.results);
            console.log('2nd Query!!');
        }

        // クエリ3回目(3ページ目)
        if (queryTimes === 2) {
            sleep(3);
            const page = await googleClient.placesNearby({
                params: {
                    pagetoken,
                    key: apiKey
                },
                timeout: 5000
            }).catch((err) => {
                console.log(err);
            });
            places.push(...page.data.results);
            console.log('3rd Query!!!');
        }

        // クエリ点とプレイスの距離を計算
        for (const place of places) {
            const placeLocation = [place['geometry']['location']['lng'], place['geometry']['location']['lat']];
            const distance = turf.distance(queryPoint.coordinate, placeLocation, {
                units: 'meters'
            });
            place['distance'] = distance;
        }

        // クエリ円Cnを求める
        places.sort((a, b) => b.distance - a.distance); // 降順(大 → 小)
        queryCircle = turf.circle(queryPoint.coordinate, places[0]['distance'], {
            units: 'meters',
            properties: {
                name: 'query-circle'
            }
        });
        fs.writeFileSync(`${__dirname}/../output/${areaName}/last-query-circle.json`, JSON.stringify(queryCircle, null, '\t'));

        // クエリ円Cnの収集範囲からはみ出ている部分を切り取る(共通部分を抜き出す)
        let intersectWithCrawlingArea = turf.intersect(queryCircle, crawlingArea);
        if (intersectWithCrawlingArea === null) {
            intersectWithCrawlingArea = queryCircle;
        }
        fs.writeFileSync(`${__dirname}/../output/${areaName}/intersect-with-crawling-area.json`, JSON.stringify(intersectWithCrawlingArea, null, '\t'));

        // クエリ円Cnからそれ以外のすべてのクエリ円(doneQueries)との共通部分をくり抜く
        let leftQueryCircle;
        for (let i = 0; i < doneQueries.length; i++) {
            if (i === 0) {
                const differenceFromOtherQueryCircle = turf.difference(intersectWithCrawlingArea, doneQueries[i]['queryCircle']);
                if (differenceFromOtherQueryCircle) {
                    leftQueryCircle = differenceFromOtherQueryCircle;
                }
                // 共通部分がない場合
                if (differenceFromOtherQueryCircle === null) {
                    leftQueryCircle = intersectWithCrawlingArea;
                }
            }

            if (i !== 0) {
                const differenceFromOtherQueryCircle = turf.difference(leftQueryCircle, doneQueries[i]['queryCircle']);
                if (differenceFromOtherQueryCircle) {
                    leftQueryCircle = differenceFromOtherQueryCircle;
                }
                // 共通部分がない場合
                if (differenceFromOtherQueryCircle === null) {
                    continue;
                }
            }
        }
        fs.writeFileSync(`${__dirname}/../output/${areaName}/left-query-circle.json`, JSON.stringify(leftQueryCircle, null, '\t'));

        // クエリ円Cnの面積Snを求める
        const areaQueryCircle = turf.area(queryCircle);
        console.log("Query-Circle Area: " + areaQueryCircle);

        // 残った部分の面積Slを求める
        const areaLeftQueryCircle = turf.area(leftQueryCircle);
        console.log("Left Area: " + areaLeftQueryCircle);

        // くり抜いた部分の面積Suを計算する
        const areaUseless = areaQueryCircle - areaLeftQueryCircle;
        console.log("Useless Area: " + areaUseless);

        // 割合p(収集範囲に対する無駄な部分の割合)を計算する
        p = Math.round((areaUseless / areaLeftQueryCircle) * 10) / 10;
        console.log("p: " + p);

        // クエリ回数カウント
        queryTimes += 1;

        // 終了条件
        if (p >= thresholdP) {
            console.log('Stop paging...\n');
            break;
        }
        if (queryTimes === 3) {
            console.log('Finish max paging...\n');
            break;
        }
    }

    queryPoint['queryTimes'] = queryTimes;
    queryPoint['allPlaces'] = places;
    queryPoint['queryCircle'] = queryCircle;

    return queryPoint;
};


// 3. 提案手法本体
// スコアの大きいノードからクエリを打つ
// 既に収集したクエリ円内に存在するノードはスキップする
const crawlerNodes = async (apiKey, scoredNodes, crawlingArea, placeType, pagingIsOn, areaName) => {
    const googleClient = new Client();

    const doneQueries = [];
    for (let i = 0; i < scoredNodes.length; i++) {
        if (i === 0) { // 最もスコアの大きい交差点
            console.log(`Start with ${scoredNodes[i].id} (score: ${scoredNodes[i].score})`);

            const doneQuery = await crawlQueryPoints(apiKey, googleClient, scoredNodes[i], placeType, pagingIsOn);
            doneQueries.push(doneQuery);
        } else { // それ以外
            const nextQueryIsOutAllQueryCircles = [];

            for (const doneQuery of doneQueries) {
                // クエリ円外 → True, クエリ円内 → False
                const nextQueryIsOut = !turf.booleanPointInPolygon(scoredNodes[i].coordinate, doneQuery.queryCircle);

                if (nextQueryIsOut) {
                    nextQueryIsOutAllQueryCircles.push(nextQueryIsOut);
                } else { // どれかひとつのクエリ円内(False)ならスキップ
                    console.log(`Skip ${scoredNodes[i].id} (score: ${scoredNodes[i].score})`);
                    break;
                }
            }

            // 全クエリ円外ならクロールする
            if (nextQueryIsOutAllQueryCircles.length === doneQueries.length) {
                console.log(`\nNext Query is ${scoredNodes[i].id} (score: ${scoredNodes[i].score})`);

                // ページング制御なし
                // const doneQuery = await crawlQueryPoints(apiKey, googleClient, scoredNodes[i], placeType, pagingIsOn);

                // ページング制御あり
                const thresholdP = 1.5; // 閾値
                const doneQuery = await crawlWithPagingMethod(apiKey, googleClient, scoredNodes[i], crawlingArea, placeType, areaName, doneQueries, thresholdP)

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

            // 全プレイスを収集範囲内・外に仕分ける
            const placeLocation = [place['geometry']['location']['lng'], place['geometry']['location']['lat']];
            const placeIsIn = turf.booleanPointInPolygon(placeLocation, crawlingArea);
            if (placeIsIn) {
                allInPlaces.push(place['place_id']);
            }
            if (!placeIsIn) {
                allOutPlaces.push(place['place_id']);
            }
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

    // 収集効率Eを計算
    let efficiency = uniqueInPlaces.size / allQueryTimes;
    efficiency = Math.round(efficiency * 1000) / 1000;

    const result = {
        "detail": {
            "Place Type": placeType,
            "Is Paging": pagingIsOn,
            "Total Query-Points": scoredNodes.length,
            "Used Query-Points": doneQueries.length,
            "Total Query-Times": allQueryTimes,
            "Efficiency": efficiency,
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

    // DB保存用全プレイスデータ
    const dbAllPlaces = [];

    for (const doneQuery of doneQueries) {
        dbAllPlaces.push(...doneQuery['allPlaces']);
    }

    return {
        "result-for-web": result,
        "result-for-db": dbAllPlaces
    };
};

module.exports = crawlerNodes;
