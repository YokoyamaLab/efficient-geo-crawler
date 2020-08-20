const turf = require('@turf/turf');


const calcPointGrid = (bbox, cellSide, crawlingArea) => {
    const pointGrid = turf.pointGrid(bbox, cellSide, { units: 'meters', mask: crawlingArea }); // ユーザ指定ポリゴン内のみ
    return pointGrid;
};

module.exports = calcPointGrid;