const { Client } = require("@googlemaps/google-maps-services-js");
const turf = require('@turf/turf');

const sleep = require(`${__dirname}/../mymodules/sleep.js`);

// 1. 最もスコアの大きいノードをクロールする(ページングあり)
const crawlFirstQueryPoint = async (apiKey, googleClient, queryPoint, crawlingArea, placeType, pagingIsOn) => {
    const location = [queryPoint.coordinate[1], queryPoint.coordinate[0]]; // lat, lng

    const allResults = [];
    let queryTimes = 0;

    // 1~20件
    const firstResults = await googleClient.placesNearby({
        params: {
            location,
            rankby: 'distance',
            type: placeType,
            key: apiKey
        },
        timeout: 1000
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
            // 21~40件
            sleep(3);
            const secondResults = await googleClient.placesNearby({
                params: {
                    pagetoken: firstResults['data']['next_page_token'],
                    key: apiKey
                }
            }).catch((err) => {
                console.log(err);
            });
            queryTimes += 1;
            allResults.push(...secondResults.data.results);
            console.log('2nd Query!!');
            if (!secondResults['data']['next_page_token']) {
                console.log('No 3rd Page');
            }

            // 41~60件
            sleep(3);
            const thirdResults = await googleClient.placesNearby({
                params: {
                    pagetoken: secondResults['data']['next_page_token'],
                    key: apiKey
                }
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

// ページングを制御しつつ，クロールを行う
const crawlOtherQueryPoints = async (apiKey, googleClient, queryPoint, crawlingArea, placeType, pagingIsOn, doneQueries, thresholdUselessArea) => {
    const location = [queryPoint.coordinate[1], queryPoint.coordinate[0]]; // lat, lng

    const places = [];
    const inPlaces = [];
    const outPlaces = [];

    let queryTimes = 0; // クエリ回数
    let p = 0; // 割合p
    let pagetoken; // ページトークン
    let queryCircle; // このクエリ点に対するクエリ円

    while (p < thresholdUselessArea) {
        // クエリ1回目(1ページ目)
        if (queryTimes === 0) {
            const page = await googleClient.placesNearby({
                params: {
                    location,
                    rankby: 'distance',
                    type: placeType,
                    key: apiKey
                },
                timeout: 1000
            }).catch((err) => {
                console.log(err);
            });
            // queryTimes += 1;
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
                timeout: 1000
            }).catch((err) => {
                console.log(err);
            });
            // queryTimes += 1;
            pagetoken = page['data']['next_page_token'];
            places.push(...page.data.results);
            console.log('2nd Query!');
        }

        // クエリ3回目(3ページ目)
        if (queryTimes === 2) {
            sleep(3);
            const page = await googleClient.placesNearby({
                params: {
                    pagetoken,
                    key: apiKey
                },
                timeout: 1000
            }).catch((err) => {
                console.log(err);
            });
            // queryTimes += 1;
            places.push(...page.data.results);
            console.log('3rd Query!');
        }

        for (const place of places) {
            // クエリ点とプレイスの距離を計算
            const placeLocation = [place['geometry']['location']['lng'], place['geometry']['location']['lat']];
            const distance = turf.distance(queryPoint.coordinate, placeLocation, {
                units: 'meters'
            });
            place['distance'] = distance;

            // プレイスを収集範囲内・外に仕分ける
            const placeIsIn = turf.booleanPointInPolygon(placeLocation, crawlingArea);
            if (placeIsIn) {
                inPlaces.push(place);
            } else {
                outPlaces.push(place);
            }
        }

        // クエリ円Cnとその面積地Snを計算する
        places.sort((a, b) => b.distance - a.distance); // 降順(大 → 小)
        queryCircle = turf.circle(queryPoint.coordinate, places[0]['distance'], {
            units: 'meters',
            properties: {
                name: 'query-circle'
            }
        });
        const areaQueryCircle = turf.area(queryCircle);
        console.log("Sn: " + areaQueryCircle);

        // クエリ円Cnと収集範囲の共通部分をくり抜く
        let leftQueryCircle = queryCircle;
        if (turf.difference(leftQueryCircle, crawlingArea)) {
            leftQueryCircle = turf.difference(leftQueryCircle, crawlingArea);
        }

        // 共通部分がない場合はそのまま
        if (turf.difference(leftQueryCircle, crawlingArea) === null) {
            leftQueryCircle = queryCircle;
        }

        // クエリ円Cnからそれ以外のすべてのクエリ円(doneQueries)との共通部分をくり抜く
        for (const doneQuery of doneQueries) {
            // 共通部分がない場合はスキップ
            if (turf.difference(leftQueryCircle, crawlingArea) === null) {
                continue;
            }

            leftQueryCircle = turf.difference(leftQueryCircle, doneQuery['queryCircle']);
        }

        // 残った部分の面積値Slを求める
        const areaLeftQueryCircle = turf.area(leftQueryCircle);
        console.log("Sl: " + areaLeftQueryCircle);

        // くり抜いた部分の面積値Suを計算する
        const uselessArea = areaQueryCircle - areaLeftQueryCircle;
        console.log("Su: " + uselessArea);

        // 割合p(収集範囲に対する無駄な部分の割合)を計算する
        p = Math.round((uselessArea / areaLeftQueryCircle));
        console.log("p: " + p);

        // クエリ回数カウント
        queryTimes += 1;

        // 終了条件
        if (p >= thresholdUselessArea) {
            break;
        }
        if (queryTimes === 3) {
            break;
        }
    }

    queryPoint['queryTimes'] = queryTimes;
    queryPoint['allPlaces'] = places;
    queryPoint['inPlaces'] = inPlaces;
    queryPoint['outPlaces'] = outPlaces;
    queryPoint['queryCircle'] = queryCircle;

    return queryPoint;
};


// 提案手法本体
const crawlerNodes = async (apiKey, scoredNodes, crawlingArea, placeType, pagingIsOn) => {
    const googleClient = new Client();

    const doneQueries = [];
    for (let i = 0; i < scoredNodes.length; i++) {
        if (i === 0) { // 最もスコアの大きい交差点
            console.log(`Start with ${scoredNodes[i].id} (score: ${scoredNodes[i].score})`);

            const doneQuery = await crawlFirstQueryPoint(apiKey, googleClient, scoredNodes[i], crawlingArea, placeType, pagingIsOn);
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
                console.log(`Next Query is ${scoredNodes[i].id} (score: ${scoredNodes[i].score})`);
                sleep(1);

                // 閾値(%)
                const thresholdUselessArea = 50;
                const doneQuery = await crawlOtherQueryPoints(apiKey, googleClient, scoredNodes[i], crawlingArea, placeType, pagingIsOn, doneQueries, thresholdUselessArea)

                // const doneQuery = await crawlQueryPoint(apiKey, googleClient, scoredNodes[i], crawlingArea, placeType, pagingIsOn);
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
            "Total Query-Points": scoredNodes.length,
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
