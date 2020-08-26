// クローリング → 収集結果保存(ユーザ用)
const saveButton = document.getElementById('save-button');
saveButton.addEventListener('click', (e) => {
    e.preventDefault();

    // 提案手法の場合
    if (document.getElementById('proposed').checked === true) {
        const blob = new Blob([proposedResult], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.download = 'proposed-result.json';
        a.href = url;
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ベースライン手法の場合
    if (document.getElementById('baseline').checked === true) {
        const blob = new Blob([baselineResult], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.download = `${JSON.parse(baselineResult)['detail']['Cell Size']}-baseline-result.json`;
        a.href = url;
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
});
