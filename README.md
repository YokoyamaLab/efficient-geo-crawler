# How to Use
## パラメータ
### 環境変数(.envファイル)
1. Google Places APIのAPIキー

### UI
1. Area Name: 結果を保存するoutputディレクトリ直下のサブディレクトリ名
2. Place Type: 収集するプレイスデータの種類([参考](https://developers.google.com/places/web-service/supported_types))
3. Cell Size(m): Grid-based Method(ベースライン手法)で用いるセルの大きさ

## コマンド例
```
// intersection-based-method/new-system
$ node server.js

// intersection-based-method/
// intersection-based-method/new-system
// どちらも可
$ npm run start
```