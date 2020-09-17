const mongoClient = require('mongodb').MongoClient;

const savePlacesToDb = async (parameter, places) => {
    // 重複データは排除する
    const uniquePlaces = places.filter((element, index, self) =>
        self.findIndex(e => e['place_id'] === element['place_id']) === index);

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

        console.log("Connected successfully to server");
        const db = client.db(dbName);
        const collection = await db.createCollection(parameter['area-name']);

        // TODO: 既にコレクションが存在する場合の例外処理
        // TODO: コレクションが存在する場合は，データを上書きする

        await collection.insertMany(uniquePlaces);

        console.log('Saved unique places to MongoDB');
        console.log(`DB Name: ${dbName}`);
        console.log(`Collection Name: ${parameter['area-name']}`);
        client.close();
    });
};

module.exports = savePlacesToDb;
