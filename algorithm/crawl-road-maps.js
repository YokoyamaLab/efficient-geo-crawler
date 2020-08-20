const queryOverpass = require('@derhuerst/query-overpass');

const crawlRoadMaps = async (bbox) => {
    const q = `
            [out:json];
            way["highway"](${bbox});
            foreach(
            (
                ._;
                >;
            );
            out;
            );
            `;

    const roadMaps = await queryOverpass(q);

    return roadMaps;
};

module.exports = crawlRoadMaps;
