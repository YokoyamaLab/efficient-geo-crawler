const fs = require('fs');
const makeDir = require('make-dir');

const createSubdirectory = async (areaName) => {
    try {
        fs.statSync(`${__dirname}/../output/${areaName}`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await makeDir(`${__dirname}/../output/${areaName}`);
        }
    }
};

module.exports = createSubdirectory;
