const http = require('http');
const fs = require('fs');
const Socket = require('socket.io');
const path = require('path');

const executeMethods = require(`${__dirname}/execute-methods.js`);
const executeProposed = executeMethods.executeProposed;
const executeBaseline = executeMethods.executeBaseline;

// .envファイルから環境変数読み込み(APIキー)
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 1. 地図を描画
const setMap = async (port) => {
    // ファイル読み込み
    const indexHTML = fs.readFileSync(`${__dirname}/public/index.html`, 'utf8');
    const indexCSS = fs.readFileSync(`${__dirname}/public/index.css`, 'utf8');
    const mapJS = fs.readFileSync(`${__dirname}/public/map.js`, 'utf8');
    const saveJS = fs.readFileSync(`${__dirname}/public/save.js`, 'utf8');
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

            case '/save.js':
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.write(saveJS);
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
const executeBothMethods = async (io) => {
    io.on('connection', (socket) => {
        socket.on('execute-both-methods', async (parameter) => {
            const proposedResult = await executeProposed(parameter);
            const baselineResult = await executeBaseline(parameter);
            io.emit('emit-proposed-result', proposedResult);
            io.emit('emit-baseline-result', baselineResult);

            console.log('\n-- Check out the results on your browser --\n');
        });
    });
};

// 2.2 提案手法だけ実行する
const executeOnlyProposed = async (io) => {
    io.on('connection', (socket) => {
        socket.on('execute-only-proposed', async (parameter) => {
            const proposedResult = await executeProposed(parameter);
            io.emit('emit-proposed-result', proposedResult);

            console.log('\n-- Check out the results on your browser --\n');
        });
    });
};

// 2.3 ベースライン手法だけ実行する
const executeOnlyBaseline = async (io) => {
    io.on('connection', (socket) => {
        socket.on('execute-only-baseline', async (parameter) => {
            const baselineResult = await executeBaseline(parameter);
            io.emit('emit-baseline-result', baselineResult);

            console.log('\n-- Check out the results on your browser --\n');
        });
    });
};

const main = async (port) => {
    console.log('Your branch: prod');
    const { server, io } = await setMap(port);

    executeBothMethods(io);
    executeOnlyProposed(io);
    executeOnlyBaseline(io);
};

const port = process.env.PORT || 8000;
main(port);
