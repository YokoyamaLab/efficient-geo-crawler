const mongoClient = require('mongodb').MongoClient;

const savePlacesToDb = async (parameter, places) => {
    // MongoDB設定
    const dbUrl = 'mongodb://localhost:27017';
    const connectOption = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    };
    const dbName = process.env.DBNAME || 'geo-crawler-db';

    // DBへ接続＋保存
    await mongoClient.connect(dbUrl, connectOption, async (err, client) => {
        if (err) {
            console.log(err);
        }

        const db = client.db(dbName);
        const collection = await db.createCollection(parameter['area-name']);

        // _idにplace_idを挿入してから，DBにinsert
        let dupNumber = 0;
        for (const place of places) {
            place['_id'] = place['place_id'];

            try {
                await collection.insertOne(place);
            } catch (err) {
                if (err.code === 11000) {
                    dupNumber += 1;
                }
            }
        }

        console.log(`Total ${places.length} places`);
        console.log(`Saved ${places.length - dupNumber} places to MongoDB.`);
        console.log(`${dupNumber} places are duplicated.`);
        console.log(`DB Name: ${dbName}`);
        console.log(`Collection Name: ${parameter['area-name']}`);
        client.close();
    });
};

module.exports = savePlacesToDb;
