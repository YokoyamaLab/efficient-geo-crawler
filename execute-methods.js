const fs = require('fs');
const turf = require('@turf/turf');

const calcBbox = require(`${__dirname}/mymodules/calc-bbox.js`);
const createSubdirectory = require(`${__dirname}/mymodules/create-subdirectory.js`);

// 提案手法
const crawlRoadMaps = require(`${__dirname}/algorithm/crawl-road-maps`);
const scoreNodes = require(`${__dirname}/algorithm/score-nodes.js`);
const crawlerNodes = require(`${__dirname}/algorithm/crawler-nodes`);

// ベースライン手法
const calcPointGrid = require(`${__dirname}/baseline/point-grid`);
const crawlerGrid = require(`${__dirname}/baseline/crawler-grid`);


exports.executeProposed = async (parameter, apiKey) => {
    console.log('-- Proposed Method --');
    // ユーザ側から得られたパラメータ
    const coordinates = parameter['polygon']['features'][0]['geometry']['coordinates'];
    const placeType = parameter['place-type'];
    const areaName = parameter['area-name'];
    const pagingIsOn = parameter['paging-is-on'];

    // ページングメソッドのパラメータ
    const pagingMethodIsOn = parameter['paging-method-is-on'];
    const thresholdP = Number(parameter['threshold-p']);

    // 結果を保存するoutput直下のサブディレクトリを準備
    createSubdirectory(areaName);

    // 0. ユーザが指定した収集範囲をGeoJSONで定義
    const targetPolygon = turf.polygon(coordinates, {
        'name': 'target-polygon'
    });

    // 1. ロードマップ収集
    console.log('-- 1. Crawl OSM Road Maps --');
    const targetBbox = calcBbox(coordinates[0], "overpass");
    const roadMaps = await crawlRoadMaps(targetBbox);
    fs.writeFileSync(`${__dirname}/output/${areaName}/all-road-maps.json`, JSON.stringify(roadMaps, null, '\t'));

    // 2. 交差点抽出
    console.log('-- 2. Score Nodes --');
    const sortedScoredNodes = await scoreNodes(roadMaps, targetPolygon);
    fs.writeFileSync(`${__dirname}/output/${areaName}/scored-nodes.json`, JSON.stringify(sortedScoredNodes, null, '\t'));

    // 3. Intersection-based Methodを実行
    console.log('-- 3. Execute Proposed Method --');
    const results = await crawlerNodes(apiKey, sortedScoredNodes, targetPolygon, placeType, pagingIsOn, areaName, pagingMethodIsOn, thresholdP);
    const proposedResult = results['result-for-web'];
    proposedResult['target-polygon'] = targetPolygon;
    fs.writeFileSync(`${__dirname}/output/${areaName}/proposed-result.json`, JSON.stringify(proposedResult, null, '\t'));

    return results;
};

exports.executeBaseline = async (parameter, apiKey) => {
    console.log('\n-- Baseline Method --');

    const coordinates = parameter['polygon']['features'][0]['geometry']['coordinates'];
    const placeType = parameter['place-type'];
    const areaName = parameter['area-name'];
    const cellSide = parameter['cell-size']; // メートル
    const pagingIsOn = parameter['paging-is-on'];

    // 結果を保存するoutput直下のサブディレクトリを準備
    createSubdirectory(areaName);

    // 0. ユーザが指定した収集範囲をGeoJSONで定義
    const targetPolygon = turf.polygon(coordinates, {
        'name': 'target-polygon'
    });

    // 1. グリッド生成
    console.log('-- 1. Calculate Grid --');
    const targetBbox = calcBbox(coordinates[0], "turf");
    const pointGrid = calcPointGrid(targetBbox, cellSide, targetPolygon);
    console.log(`Cell Number: ${pointGrid['features'].length}`);
    console.log(`Total Query Times (On Paging): ${(pointGrid['features'].length) * 3}\n`);

    // 2. Grid-based Methodを実行 → クライアントに結果を送信
    console.log('-- 2. Execute Baseline Method --');
    const results = await crawlerGrid(apiKey, pointGrid, placeType, targetPolygon, cellSide, pagingIsOn);
    const baselineResult = results['result-for-web'];
    baselineResult['target-polygon'] = targetPolygon;
    fs.writeFileSync(`${__dirname}/output/${areaName}/${cellSide}m-baseline-result.json`, JSON.stringify(baselineResult, null, '\t'));

    return results;
};
