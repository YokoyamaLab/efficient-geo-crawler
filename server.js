const http = require('http');
const fs = require('fs');
const path = require('path');

const Socket = require('socket.io');
const mongoClient = require('mongodb').MongoClient;
require('dotenv').config({ path: path.join(__dirname, '.env') });

const executeMethods = require(`${__dirname}/execute-methods.js`);
const executeProposed = executeMethods.executeProposed;
const executeBaseline = executeMethods.executeBaseline;


// 1. 地図を描画
const setMap = async (port) => {
    // ファイル読み込み
    const indexHTML = fs.readFileSync(`${__dirname}/public/index.html`, 'utf8');
    const indexCSS = fs.readFileSync(`${__dirname}/public/index.css`, 'utf8');
    const mapJS = fs.readFileSync(`${__dirname}/public/map.js`, 'utf8');
    const visualizeJS = fs.readFileSync(`${__dirname}/public/visualize.js`, 'utf8');

    // WebServer, WebSocket起動
    const server = await http.createServer();
    const io = await new Socket(server);

    // ポート解放
    server.listen(port, () => {
        console.log(`Ctrl + Click http://localhost:${port}\n`);
    });

    // リクエスト応答
    server.on('request', (req, res) => {
        // ファイル別にヘッダーを変更
        switch (req.url) {
            case '/':
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(indexHTML);
                res.end();
                break;

            case '/index.css':
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.write(indexCSS);
                res.end();
                break;

            case '/map.js':
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.write(mapJS);
                res.end();
                break;

            case '/visualize.js':
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.write(visualizeJS);
                res.end();
                break;

            default:
                break;
        }
    });

    return { server, io };
};


// 2.1 両手法(proposed, baseline)を実行する
const executeBothMethods = async (io, apiKey) => {
    io.on('connection', (socket) => {
        socket.on('execute-both-methods', async (parameter) => {
            const proposedResults = await executeProposed(parameter, apiKey);
            const proposedResult = proposedResults['result-for-web'];
            io.emit('emit-proposed-result', proposedResult);

            const baselineResults = await executeBaseline(parameter, apiKey);
            const baselineResult = baselineResults['result-for-web'];
            io.emit('emit-baseline-result', baselineResult);
            fs.writeFileSync(`${__dirname}/output/${parameter['area-name']}/target-polygon.json`, JSON.stringify(baselineResult['target-polygon'], null, '\t'));

            console.log('\n-- Check out the results on your browser --\n');

            // 両手法で収集した全プレイスデータから固有のプレイスデータだけ抽出する
            const dbAllPlaces = proposedResults['result-for-db'].concat(baselineResults['result-for-db']);
            const dbUniquePlaces = dbAllPlaces.filter((element, index, self) =>
                self.findIndex(e =>
                    e['place_id'] === element['place_id']
                ) === index
            );
            console.log(`proposed:${proposedResults['result-for-db'].length}`);
            console.log(`baseline:${baselineResults['result-for-db'].length}`);
            console.log(`Unique:${dbUniquePlaces.length}`);
            
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
                await collection.insertMany(dbUniquePlaces);

                console.log('Saved all places to MongoDB');
                console.log(`DB Name: ${dbName}`);
                console.log(`Collection Name: ${parameter['area-name']}`);
                client.close();
            });
        });
    });
};

// 2.2 提案手法だけ実行する
const executeOnlyProposed = async (io, apiKey) => {
    io.on('connection', (socket) => {
        socket.on('execute-only-proposed', async (parameter) => {
            const proposedResult = await executeProposed(parameter, apiKey);
            fs.writeFileSync(`${__dirname}/output/${parameter['area-name']}/target-polygon.json`, JSON.stringify(proposedResult['target-polygon'], null, '\t'));
            io.emit('emit-proposed-result', proposedResult);

            console.log('\n-- Check out the results on your browser --\n');
        });
    });
};

// 2.3 ベースライン手法だけ実行する
const executeOnlyBaseline = async (io, apiKey) => {
    io.on('connection', (socket) => {
        socket.on('execute-only-baseline', async (parameter) => {
            const baselineResult = await executeBaseline(parameter, apiKey);
            fs.writeFileSync(`${__dirname}/output/${parameter['area-name']}/target-polygon.json`, JSON.stringify(baselineResult['target-polygon'], null, '\t'));
            io.emit('emit-baseline-result', baselineResult);

            console.log('\n-- Check out the results on your browser --\n');
        });
    });
};

const main = async (port) => {
    console.log('Your branch: dev');
    const { server, io } = await setMap(port);

    // Google Places APIのAPIキー
    const apiKey = process.env.APIKEY;
    executeBothMethods(io, apiKey);
    executeOnlyProposed(io, apiKey);
    executeOnlyBaseline(io, apiKey);
};

const port = process.env.PORT || 8000;
main(port);
