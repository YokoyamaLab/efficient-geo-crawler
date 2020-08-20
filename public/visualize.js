// 収集結果ファイルアップロード → 可視化
const reader = new FileReader();
const resultUploadButton = document.getElementById('result-upload');

resultUploadButton.addEventListener('change', (e) => {
    if (map.getLayer('query-circles-fill')) {
        map.removeLayer('query-circles-fill');
    }
    if (map.getLayer('query-circles-outline')) {
        map.removeLayer('query-circles-outline');
    }
    if (map.getLayer('target-polygon')) {
        map.removeLayer('target-polygon');
    }
    if (map.getLayer('query-points')) {
        map.removeLayer('query-points');
    }
    if (map.getSource('load-result')) {
        map.removeSource('load-result');
    }
    if (map.getSource('load-target-polygon')) {
        map.removeSource('load-target-polygon');
    }
    if (resultContent.innerHTML) {
        resultContent.innerHTML = null;
    }
    if (proposedToggle.checked) {
        proposedToggle.checked = null;
    }

    const file = e.target.files[0];
    reader.readAsText(file);

    reader.onload = () => {
        console.log(`upload ${file['name']}`);
        const uploadResult = JSON.parse(reader.result);
        const detailResult = uploadResult['detail'];
        const mapResult = uploadResult['map'];
        const targetPolygon = uploadResult['target-polygon'];

        // 結果に合わせて地図をパンする
        const centerOfTargetPolygon = turf.center(targetPolygon)['geometry']['coordinates'];
        centerOfTargetPolygon[0] -= 0.004;
        map.panTo(centerOfTargetPolygon);

        // データ読み込み
        map.addSource('load-result', {
            'type': 'geojson',
            'data': mapResult
        });
        map.addSource('load-target-polygon', {
            'type': 'geojson',
            'data': targetPolygon
        });

        // 描画
        map.addLayer({
            'id': 'query-circles-fill',
            'type': 'fill',
            'source': 'load-result',
            'paint': {
                'fill-color': '#90A4AE',
                'fill-opacity': 0.2
            },
            'filter': ['==', '$type', 'Polygon']
        });
        map.addLayer({
            'id': 'query-circles-outline',
            'type': 'line',
            'source': 'load-result',
            'paint': {
                'line-color': '#78909C',
                'line-width': 2
            },
            'filter': ['==', '$type', 'Polygon']
        });
        map.addLayer({
            'id': 'target-polygon',
            'type': 'line',
            'source': 'load-target-polygon',
            'paint': {
                'line-color': '#03A9F4',
                'line-width': 2.5
            },
            'filter': ['==', '$type', 'Polygon']
        });
        map.addLayer({
            'id': 'query-points',
            'type': 'circle',
            'source': 'load-result',
            'paint': {
                'circle-color': '#00c300',
                'circle-radius': 5
            },
            'filter': ['==', '$type', 'Point']
        });

        // クエリ点にマーカー設置
        // プレゼン資料用
        // for (let feature of mapResult['features']) {
        //     const type = feature['geometry']['type'];
        //     if (type === 'Polygon') {
        //         continue;
        //     }

        //     const coordinates = feature['geometry']['coordinates'];
        //     const marker = new mapboxgl.Marker()
        //         .setLngLat(coordinates)
        //         .addTo(map);
        //     console.log(marker);
        // }

        if (file['name'] === 'proposed-result.json') {
            proposedToggle.checked = true;
            resultContent.innerHTML = `
                                <table class="table">
                                    <thead>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Place Type</th>
                                            <td>${detailResult['Place Type']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Query-Points</th>
                                            <td>${detailResult['Total Query-Points']}</td>
                                        </tr>
                                        <tr>
                                            <th>Used Query-Points</th>
                                            <td>${detailResult['Used Query-Points']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Query-Times</th>
                                            <td>${detailResult['Total Query-Times']}</td>
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
                                            <td>${detailResult['Total']['Total']}</td>
                                            <td>${detailResult['Total']['Unique']}</td>
                                            <td>${detailResult['Total']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>In</th>
                                            <td>${detailResult['In']['Total']}</td>
                                            <td>${detailResult['In']['Unique']}</td>
                                            <td>${detailResult['In']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>Out</th>
                                            <td>${detailResult['Out']['Total']}</td>
                                            <td>${detailResult['Out']['Unique']}</td>
                                            <td>${detailResult['Out']['Duplicated']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                `;
        }

        if (file['name'].endsWith('baseline-result.json')) {
            baselineToggle.checked = true;
            resultContent.innerHTML = `
                                <table class="table">
                                    <thead>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th>Place Type</th>
                                            <td>${detailResult['Place Type']}</td>
                                        </tr>
                                        <tr>
                                            <th>Cell Size</th>
                                            <td>${detailResult['Cell Size']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Cells</th>
                                            <td>${detailResult['Total Cells']}</td>
                                        </tr>
                                        <tr>
                                            <th>Total Query-Times</th>
                                            <td>${detailResult['Total Query-Times']}</td>
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
                                            <td>${detailResult['Total']['Total']}</td>
                                            <td>${detailResult['Total']['Unique']}</td>
                                            <td>${detailResult['Total']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>In</th>
                                            <td>${detailResult['In']['Total']}</td>
                                            <td>${detailResult['In']['Unique']}</td>
                                            <td>${detailResult['In']['Duplicated']}</td>
                                        </tr>
                                        <tr>
                                            <th>Out</th>
                                            <td>${detailResult['Out']['Total']}</td>
                                            <td>${detailResult['Out']['Unique']}</td>
                                            <td>${detailResult['Out']['Duplicated']}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                `;
        }
    }
});

// クエリ点をクリックしたら，ポップアップ表示
map.on('click', 'query-points', (e) => {
    const coordinates = e.features[0]['geometry']['coordinates'];
    const name = e.features[0]['properties']['name'];
    const id = e.features[0]['properties']['id'];

    let popupHTML;
    if (name === 'intersection') {
        const score = e.features[0]['properties']['score'];
        popupHTML = `<br><strong>${name} #${id}</strong><p>score: ${score}</p>`;
    }

    if (name === 'cell') {
        popupHTML = `<strong>${name} #${id}</strong>`;
    }

    new mapboxgl.Popup({
        closeOnMove: true
    })
        .setLngLat(coordinates)
        .setHTML(popupHTML)
        .addTo(map);
});

// 対象レイヤーにカーソルが移動したら，カーソルをポインターに変更する
map.on('mouseenter', 'query-points', () => {
    map.getCanvas().style.cursor = 'pointer';
});

// 離れたら，カーソルを元に戻す
map.on('mouseleave', 'query-points', () => {
    map.getCanvas().style.cursor = '';
});
