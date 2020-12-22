// Socket.IOインスタンスの宣言
const socket = io();

// デフォルト地図の設定プロパティ
const defaultMapSetting = {
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center:
        // [2.298175, 48.871922], // シャンゼリゼ通り周辺
    // [139.699717, 35.696015], // 歌舞伎町周辺
    [139.366775, 35.661760], // 日野キャン周辺
    zoom: 15,
    accessToken: 'pk.eyJ1IjoiaWppbWFzbyIsImEiOiJja2FtMmE1dzMwbGZkMndwaWJjdDMya2lxIn0.xO0kj2WxicRuCv-O8sirtQ'
};

// デフォルト地図定義
const map = new mapboxgl.Map(defaultMapSetting);

// Mapboxプラグイン定義
const draw = new MapboxDraw({
    // displayControlsDefault: true,
    displayControlsDefault: false,
    controls: {
        polygon: true,
        trash: true
    }
});
const geocoder = new MapboxGeocoder({
    accessToken: defaultMapSetting.accessToken,
    mapboxgl: mapboxgl,
    marker: false,
    placeholder: "Search"
});
map.addControl(geocoder);
map.addControl(draw);

// メソッドの種類でフォームを無効化する
const methodType = document.getElementById('method-select');
methodType.addEventListener('change', () => {
    const pagingMethodSwitch = document.getElementById('paging-method-switch');
    const thresholdPInput = document.getElementById('threshold-p');
    const cellSizeInput = document.getElementById('cell-size');

    // ページングメソッドスイッチ・閾値Pチェック
    if (pagingMethodSwitch.disabled === true) {
        pagingMethodSwitch.disabled = false;
    }
    if (thresholdPInput.disabled === true) {
        thresholdPInput.disabled = false;
    }

    if (methodType.value === 'proposed') {
        pagingMethodSwitch.disabled = true;
        thresholdPInput.disabled = true;
    }
    if (methodType.value === 'paging-baseline') {
        pagingMethodSwitch.disabled = true;
        thresholdPInput.disabled = true;
    }
    if (methodType.value === 'baseline') {
        pagingMethodSwitch.disabled = true;
        thresholdPInput.disabled = true;
    }

    // セルサイズチェック
    if (cellSizeInput.disabled = true) {
        cellSizeInput.disabled = false;
    }
    if (methodType.value === 'paging-proposed' || methodType.value === 'proposed') {
        cellSizeInput.disabled = true;
    }
});

// メソッドタイプ: paging-proposed, ページングメソッドスイッチ: false → 閾値Pフォームを無効にする
const pagingMethodSwitch = document.getElementById('paging-method-switch');
pagingMethodSwitch.addEventListener('click', () => {
    const thresholdPInput = document.getElementById('threshold-p');

    if (pagingMethodSwitch.checked === false) {
        thresholdPInput.disabled = true;
    }
    if (pagingMethodSwitch.checked === true) {
        thresholdPInput.disabled = false;
    }
});

// クローリングボタン
const crawlButton = document.getElementById('crawl-button');
crawlButton.addEventListener('click', () => {
    // パラメータ設定
    let polygon
    // 一度使ったエリアを再利用
    if (uploadArea) {
        polygon = turf.featureCollection([uploadArea]);
    }
    // 描画ツールで指定
    if (draw.getAll()['features'].length !== 0) {
        polygon = draw.getAll();
    }
    const methodType = document.getElementById('method-select').value;
    const areaName = document.getElementById('area-name').value;
    const placeType = document.getElementById('place-type').value;

    // ページングの有無
    let pagingIsOn;
    if (methodType === 'paging-proposed' || methodType === 'paging-baseline') {
        pagingIsOn = true;
    } else {
        pagingIsOn = false;
    }

    // セルサイズ
    let cellSize;
    if (methodType === 'paging-baseline' || methodType === 'baseline') {
        cellSize = document.getElementById('cell-size').value;
    }

    // 未入力チェック
    if (!areaName || areaName === '/') {
        alert('Set valid area name.');
        return;
    }
    if (!placeType) {
        alert('Set place type.');
        return;
    }
    if (!cellSize && methodType !== 'paging-proposed' && methodType !== 'proposed' ) {
        alert('Set cell size.');
        return;
    }

    const parameter = {
        "polygon": polygon,
        "area-name": areaName,
        "place-type": placeType,
        "paging-is-on": pagingIsOn,
    };
    switch (methodType) {
        case 'paging-proposed':
            // ページングアルゴリズムの有無
            const pagingMethodIsOn = document.getElementById('paging-method-switch').checked;
            parameter['paging-method-is-on'] = pagingMethodIsOn

            // ページングアルゴリズムオン → 閾値Pを付与
            if (pagingMethodIsOn) {
                const thresholdP = document.getElementById('threshold-p').value;
                parameter['threshold-p'] = thresholdP;
            }
            socket.emit('execute-only-proposed', parameter);
            break;
        case 'paging-baseline':
            parameter["cell-size"] = cellSize;
            socket.emit('execute-only-baseline', parameter);
            break;
        case 'proposed':
            socket.emit('execute-only-proposed', parameter);
            break;
        case 'baseline':
            parameter["cell-size"] = cellSize;
            socket.emit('execute-only-baseline', parameter);
            break;
    }

    console.log(parameter);
    crawlButton.classList.add('is-loading');
});

// 収集データ読み込み(提案手法)
let proposedDetailResult;
socket.on('emit-proposed-result', (output) => {
    console.log(output);

    // 既に可視化している場合，データを削除
    if (resultContent.innerHTML) {
        resultContent.innerHTML = null;
    }
    if (map.getLayer('proposed-query-circles-fill')) {
        map.removeLayer('proposed-query-circles-fill');
    }
    if (map.getLayer('proposed-query-circles-outline')) {
        map.removeLayer('proposed-query-circles-outline');
    }
    if (map.getLayer('intersections')) {
        map.removeLayer('intersections');
    }
    if (map.getSource('proposed-result')) {
        map.removeSource('proposed-result');
    }
    if (document.getElementById('proposed').checked) {
        document.getElementById('proposed').checked = false;
    }

    proposedDetailResult = output['detail'];
    map.addSource('proposed-result', {
        'type': 'geojson',
        'data': output['map']
    });

    const methodType = document.getElementById('method-select').value;
    if (methodType === 'paging-proposed' || methodType === 'proposed') {
        crawlButton.classList.remove('is-loading');
    }
});

// 収集データを読み込み(ベースライン手法)
let baselineDetailResult;
socket.on('emit-baseline-result', (output) => {
    console.log(output);

    if (resultContent.innerHTML) {
        resultContent.innerHTML = null;
    }
    if (map.getLayer('baseline-query-circles-fill')) {
        map.removeLayer('baseline-query-circles-fill');
    }
    if (map.getLayer('baseline-query-circles-outline')) {
        map.removeLayer('baseline-query-circles-outline');
    }
    if (map.getLayer('cells')) {
        map.removeLayer('cells');
    }
    if (map.getSource('baseline-result')) {
        map.removeSource('baseline-result');
    }
    if (document.getElementById('baseline').checked) {
        document.getElementById('baseline').checked = false;
    }

    baselineDetailResult = output['detail'];
    map.addSource('baseline-result', {
        'type': 'geojson',
        'data': output['map']
    });

    const methodType = document.getElementById('method-select').value;
    if (methodType === 'paging-baseline' || methodType === 'baseline') {
        crawlButton.classList.remove('is-loading');
    }
});

// トグルが押されたら，それぞれ可視化
const proposedToggle = document.getElementById('proposed');
const baselineToggle = document.getElementById('baseline');
const resultContent = document.getElementById('result-content');

proposedToggle.onclick = () => {
    if (!proposedDetailResult) {
        alert('Execute crawling');
        proposedToggle.checked = false;
        return;
    }

    if (resultContent.innerHTML) {
        resultContent.innerHTML = null;
    }
    if (map.getLayer('baseline-query-circles-fill')) {
        map.removeLayer('baseline-query-circles-fill');
    }
    if (map.getLayer('baseline-query-circles-outline')) {
        map.removeLayer('baseline-query-circles-outline');
    }
    if (map.getLayer('cells')) {
        map.removeLayer('cells');
    }

    // 詳細結果表示
    resultContent.innerHTML = `
                                <table class="table">
                                    <thead>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Total Query-Points</th>
                                            <td>${proposedDetailResult['Total Query-Points']}</td>
                                        </tr>
                                        <tr>
                                            <th>Used Query-Points</th>
                                            <td>${proposedDetailResult['Used Query-Points']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Query-Times(Q)</th>
                                            <td>${proposedDetailResult['Total Query-Times']}</td>
                                        </tr>
                                        <tr>
                                            <th>Efficiency(E)</th>
                                            <td>${proposedDetailResult['Efficiency']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Total</th>
                                            <th>Unique</th>
                                            <th>Duplicated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Total</th>
                                            <td>${proposedDetailResult['Total']['Total']}</td>
                                            <td>${proposedDetailResult['Total']['Unique']}</td>
                                            <td>${proposedDetailResult['Total']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>In</th>
                                            <td>${proposedDetailResult['In']['Total']}</td>
                                            <td>${proposedDetailResult['In']['Unique']}</td>
                                            <td>${proposedDetailResult['In']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>Out</th>
                                            <td>${proposedDetailResult['Out']['Total']}</td>
                                            <td>${proposedDetailResult['Out']['Unique']}</td>
                                            <td>${proposedDetailResult['Out']['Duplicated']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                `;

    // 地図表示
    map.addLayer({
        'id': 'proposed-query-circles-fill',
        'type': 'fill',
        'source': 'proposed-result',
        'paint': {
            'fill-color': '#90A4AE',
            'fill-opacity': 0.2
        },
        'filter': ['==', '$type', 'Polygon'] // Polygon(クエリ円)の場合
    });
    map.addLayer({
        'id': 'proposed-query-circles-outline',
        'type': 'line',
        'source': 'proposed-result',
        'paint': {
            'line-color': '#78909C',
            'line-width': 2
        },
        'filter': ['==', '$type', 'Polygon']
    });
    map.addLayer({
        'id': 'intersections',
        'type': 'circle',
        'source': 'proposed-result',
        'paint': {
            'circle-color': '#00c300',
            'circle-radius': 5
        },
        'filter': ['==', '$type', 'Point'] // Point(クエリ点)の場合
    });

    // クリックされたら，ポップアップ表示
    map.on('click', 'intersections', (e) => {
        const coordinates = e.features[0]['geometry']['coordinates'];
        const name = e.features[0]['properties']['name'];
        const id = e.features[0]['properties']['id'];
        const score = e.features[0]['properties']['score'];

        new mapboxgl.Popup({
            closeOnMove: true
        })
            .setLngLat(coordinates)
            .setHTML(`<br><strong>${name} #${id}</strong><p>score: ${score}</p>`)
            .addTo(map);
    });

    // 対象レイヤーにカーソルが移動したら，カーソルをポインターに変更する
    map.on('mouseenter', 'intersections', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    // 離れたら，カーソルを元に戻す
    map.on('mouseleave', 'intersections', () => {
        map.getCanvas().style.cursor = '';
    });
};

baselineToggle.onclick = () => {
    if (!baselineDetailResult) {
        alert('Execute crawling');
        baselineToggle.checked = false;
        return;
    }

    if (resultContent.innerHTML) {
        resultContent.innerHTML = null;
    }
    if (map.getLayer('proposed-query-circles-fill')) {
        map.removeLayer('proposed-query-circles-fill');
    }
    if (map.getLayer('proposed-query-circles-outline')) {
        map.removeLayer('proposed-query-circles-outline');
    }
    if (map.getLayer('intersections')) {
        map.removeLayer('intersections');
    }

    resultContent.innerHTML = `
                                <table class="table">
                                    <thead>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Cell Size</th>
                                            <td>${baselineDetailResult['Cell Size']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Cells</th>
                                            <td>${baselineDetailResult['Total Cells']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Query-Times</th>
                                            <td>${baselineDetailResult['Total Query-Times']}</td>
                                        </tr>
                                        <tr>
                                            <th>Efficiency(E)</th>
                                            <td>${baselineDetailResult['Efficiency']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th>Total</th>
                                            <th>Unique</th>
                                            <th>Duplicated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Total</th>
                                            <td>${baselineDetailResult['Total']['Total']}</td>
                                            <td>${baselineDetailResult['Total']['Unique']}</td>
                                            <td>${baselineDetailResult['Total']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>In</th>
                                            <td>${baselineDetailResult['In']['Total']}</td>
                                            <td>${baselineDetailResult['In']['Unique']}</td>
                                            <td>${baselineDetailResult['In']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>Out</th>
                                            <td>${baselineDetailResult['Out']['Total']}</td>
                                            <td>${baselineDetailResult['Out']['Unique']}</td>
                                            <td>${baselineDetailResult['Out']['Duplicated']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                `;

    map.addLayer({
        'id': 'baseline-query-circles-fill',
        'type': 'fill',
        'source': 'baseline-result',
        'paint': {
            'fill-color': '#90A4AE',
            'fill-opacity': 0.2
        },
        'filter': ['==', '$type', 'Polygon']
    });
    map.addLayer({
        'id': 'baseline-query-circles-outline',
        'type': 'line',
        'source': 'baseline-result',
        'paint': {
            'line-color': '#78909C',
            'line-width': 2
        },
        'filter': ['==', '$type', 'Polygon']
    });
    map.addLayer({
        'id': 'cells',
        'type': 'circle',
        'source': 'baseline-result',
        'paint': {
            'circle-color': '#00c300',
            'circle-radius': 5
        },
        'filter': ['==', '$type', 'Point']
    });

    map.on('click', 'cells', (e) => {
        const coordinates = e.features[0]['geometry']['coordinates'];
        const name = e.features[0]['properties']['name'];
        const id = e.features[0]['properties']['id'];

        new mapboxgl.Popup({
            closeOnMove: true
        })
            .setLngLat(coordinates)
            .setHTML(`<strong>${name} #${id}</strong>`)
            .addTo(map);
    });

    // 対象レイヤーにカーソルが移動したら，カーソルをポインターに変更する
    map.on('mouseenter', 'cells', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    // 離れたら，カーソルを元に戻す
    map.on('mouseleave', 'cells', () => {
        map.getCanvas().style.cursor = '';
    });
};
