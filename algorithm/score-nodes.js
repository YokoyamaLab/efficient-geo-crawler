const turf = require('@turf/turf');

const scoreNodes = (roadMaps, crawlingArea) => {
    const scoreTable = {
        'motorway': 10,
        'trunk': 9,
        'primary': 8,
        'secondary': 7,
        'tertiary': 6,
        'unclassified': 4,
        'residential': 3,
        'motorway_link': 2,
        'trunk_link': 2,
        'primary_link': 1,
        'secondary_link': 1,
        'tertiary_link': 1,
        'living_street': 2,
        'service': 2,
        'pedestrian': 3,
        'track': 1,
        'bus_guideway': 2,
        'raceway': 2,
        'road': 2,
        'footway': 1,
        'bridleway': 1,
        'steps': 2,
        'path': 1,
        'cycleway': 1,
    };

    // nodeにフラグを付与
    for (const roadMap of roadMaps) {
        if (roadMap['type'] === 'way') {
            continue;
        }
        roadMap['flag'] = false;
    }
    // console.log(roadMaps);


    // 交差点抽出 + スコア付け
    const scoredNodes = [];

    for (let i = 0; i < roadMaps.length; i++) {
        let score = 0;

        if (roadMaps[i]['type'] === 'way') {
            continue;
        }
        if (roadMaps[i]['flag']) {
            continue;
        }

        // 基準ノードのスコア付け
        for (let j = i + 1; j < roadMaps.length; j++) {
            if (roadMaps[j]['type'] === 'node') {
                continue;
            }

            if (roadMaps[j]['nodes'].includes(roadMaps[i]['id'])) {
                const tags = roadMaps[j]['tags']['highway'];
                if (tags in scoreTable) {
                    score += scoreTable[tags];
                }
                break;
            }
        }

        // 共通ノードを探索
        for (let k = i + 1; k < roadMaps.length; k++) {
            if (roadMaps[k]['type'] === 'way') {
                continue;
            }
            if (roadMaps[k]['flag']) {
                continue;
            }

            if (roadMaps[i]['id'] === roadMaps[k]['id']) {
                roadMaps[i]['flag'] = true;
                roadMaps[k]['flag'] = true;

                // 共通ノードのスコア付け
                for (let l = k + 1; l < roadMaps.length; l++) {
                    if (roadMaps[l]['type'] === 'node') {
                        continue;
                    }

                    if (roadMaps[l]['nodes'].includes(roadMaps[k]['id'])) {
                        const tags = roadMaps[l]['tags']['highway'];
                        if (tags in scoreTable) {
                            score += scoreTable[tags];
                        }
                        break;
                    }
                }
            }
        }

        const id = roadMaps[i]['id'];
        const coordinate = [roadMaps[i]['lon'], roadMaps[i]['lat']];
        const flag = roadMaps[i]['flag'];

        const isIn = turf.booleanPointInPolygon(coordinate, crawlingArea);

        // 交差点
        if (flag && isIn) {
            scoredNodes.push({
                id,
                coordinate,
                score,
                flag
            });
        }

        // 交差点以外の道路を構成するノード
        if (flag === false && isIn) {
            scoredNodes.push({
                id,
                coordinate,
                score,
                flag
            });
        }
    }

    const sortedScoredNodes = scoredNodes.sort((a, b) => b.score - a.score);
    return sortedScoredNodes;
};

module.exports = scoreNodes;
