const calcBbox = (coordinates, apiName) => {
    const lats = [];
    const lngs = [];

    for (let coordinate of coordinates) {
        const lat = coordinate[1];
        const lng = coordinate[0];
        lats.push(lat);
        lngs.push(lng);
    }

    // lat,lngの最大値・最小値をそれぞれ求める
    const maxLat = lats.reduce((a, b) => a > b ? a : b); // 最大値
    const minLat = lats.reduce((a, b) => a < b ? a : b); // 最小値
    const maxLng = lngs.reduce((a, b) => a > b ? a : b);
    const minLng = lngs.reduce((a, b) => a < b ? a : b);

    let bbox;

    if (apiName === "overpass") {
        bbox = [[minLat, minLng], [maxLat, maxLng]];
    }

    if (apiName === "turf") {
        bbox = [minLng, minLat, maxLng, maxLat];
    }

    if (!apiName) {
        throw 'API Name is not defined or that API is not registered.';
    }

    return bbox;
};

module.exports = calcBbox;

