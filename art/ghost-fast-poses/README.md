# 第2幕の横向き走行差分

現行の第2幕は**横滑りを廃止**し、右→左へ走る幽霊の2姿勢をThree.jsで切り替える。難しい3Dリグを足すのではなく、実際のポーズの違いを使う。

- 元の人物・衣装：`public/assets/ghost-fast.png`
- 生成正本：`generated/launch.png`（右から走り出す）、`generated/stride.png`（大股のストライド）
- 公開素材：`public/assets/ghost-fast-launch.webp`、`public/assets/ghost-fast-stride.webp`（768×864、透明）
- 姿勢ガイド：`refs/*.svg`、`refs/*.png`。スクリプト `make-guides.py` で再生成（macOS sips）
- 元生成会話：
  - [launch](https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae6a2b7-a1d0-83ee-b040-fa7004c5eb89)
  - [stride](https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae6a2cf-1fe0-83ee-8ec7-9e1ed2c865e2)

VM1では既存プロジェクトの会話に触れず、2つの専用タブから元画像・ガイドを添付して生成した。取得した1024×1536 PNGは画面で確認済み。生成終了後、所有タブだけ閉じた。

再書き出し：

```bash
for pose in launch stride; do
  swift art/ghost-poses/remove-background.swift "art/ghost-fast-poses/generated/$pose.png" "art/ghost-fast-poses/generated/$pose-cutout.png"
  ffmpeg -y -i "art/ghost-fast-poses/generated/$pose-cutout.png" \
    -vf 'crop=1024:1152:0:128,scale=768:864:flags=lanczos' \
    -c:v libwebp -compression_level 6 -quality 90 "public/assets/ghost-fast-$pose.webp"
done
```

中間の `*-cutout.png` はコミットせず、必要時に再生成。ゲーム内では `src/world.ts` の2.6秒周期の横断位置と同じ時刻からフレームを選び、露光履歴の各残像にも対応する素材を設定する。写真を後で合成して成功したように見せない。

390×844のMetal描画Chromeで、横断中の連続フレーム、約0.42秒での走行写真、3幕完走と死亡を確認。高負荷のSwiftShaderでは入力解放が遅延したため、Metal描画に切り替えた。実機iOS Safari・Android Chromeは未検証。

残課題：2ポーズの切り替えはまだランニングサイクルの完全な滑らかさではなく、髪の動きも独立制御していない。実際の等速プレイで気になる場合は次の姿勢を撮り直す。数値だけ増やさない。
