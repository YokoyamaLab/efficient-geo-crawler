const fs = require('fs');
const turf = require('@turf/turf');

const calcBbox = require(`${__dirname}/mymodules/calc-bbox.js`);
const createSubdirectory = require(`${__dirname}/mymodules/create-subdirectory.js`);

// 提案手法
const crawlRoadMaps = require(`${__dirname}/algorithm/crawl-road-maps`);
const extractIntersections = require(`${__dirname}/algorithm/extract-intersections`);
const crawlerIntersections = require(`${__dirname}/algorithm/crawler-intersections`);

// ベースライン手法
const calcPointGrid = require(`${__dirname}/baseline/point-grid`);
const crawlerGrid = require(`${__dirname}/baseline/crawler-grid`);


exports.executeProposed = async (parameter) => {
    console.log('-- Proposed Method --');

    // ユーザ側から得られたパラメータ
    const apiKey = parameter['api-key'];
    const coordinates = parameter['polygon']['features'][0]['geometry']['coordinates'];
    const placeType = parameter['place-type'];
    const areaName = parameter['area-name'];
    const pagingIsOn = parameter['paging-is-on'];

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
    console.log('-- 2. Extract Intersections --');
    const intersections = await extractIntersections(roadMaps, targetPolygon);
    fs.writeFileSync(`${__dirname}/output/${areaName}/intersections.json`, JSON.stringify(intersections, null, '\t'));

    // 3. Intersection-based Methodを実行
    console.log('-- 3. Execute Proposed Method --');
    const proposedResult = await crawlerIntersections(apiKey, intersections, targetPolygon, placeType, pagingIsOn);
    proposedResult['target-polygon'] = targetPolygon;
    fs.writeFileSync(`${__dirname}/output/${areaName}/proposed-result.json`, JSON.stringify(proposedResult, null, '\t'));

    return proposedResult;
};

exports.executeBaseline = async (parameter) => {
    console.log('\n-- Baseline Method --');

    const apiKey = parameter['api-key'];
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

    // 2. Grid-based Methodを実行 → クライアントに結果を送信
    console.log('-- 2. Execute Baseline Method --');
    const baselineResult = await crawlerGrid(apiKey, pointGrid, placeType, targetPolygon, cellSide, pagingIsOn);
    baselineResult['target-polygon'] = targetPolygon;
    fs.writeFileSync(`${__dirname}/output/${areaName}/${cellSide}m-baseline-result.json`, JSON.stringify(baselineResult, null, '\t'));

    return baselineResult;
};
