# Efficient Crawling GIS
## UI
![image](https://user-images.githubusercontent.com/38425740/91004413-18037880-e60f-11ea-9ba8-ddea62b38bbf.png)

# How to Use
## クローリング設定
### 環境変数(.envファイル)
1. Google Places APIのAPIキー

### UI上のフォーム
1. Area Name: 結果を保存するoutputディレクトリ直下のサブディレクトリ名
2. Place Type: 収集するプレイスデータの種類([参考](https://developers.google.com/places/web-service/supported_types))
3. Cell Size(m): Grid-based Method(ベースライン手法)で用いるセルの大きさ

## コマンド例
```
# ユーザ用
$ npm start

# 開発者用
$ npm run dev
```