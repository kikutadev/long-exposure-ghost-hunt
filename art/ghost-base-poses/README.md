# 第1幕：ノートに触れている幽霊

- 顔・衣装の基準：`public/assets/ghost-base.png`
- 生成原画：`generated/reading.png` と `generated/noticed.png`（各1024×1536）
- ゲーム用：`public/assets/ghost-base-reading.webp` と `public/assets/ghost-base-noticed.webp`（各768×1152、透過）
- ガイド：`refs/reading-guide.png` と `refs/noticed-guide.png`。ラフであり、完成原画ではない。
- [俯きポーズの生成会話](https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae6ac2a-0d88-83ee-a00b-4faad698ee9a)
- [目線が向くポーズの生成会話](https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae6ac60-0ddc-83ec-a5f5-b558994ebeaa)

既存VM1で元の幽霊とポーズガイドを2枚添付して生成。完成PNGをホストへ転送、原画・透過画像を目視。撮影中にはBlenderのノートページアニメーションを露光時刻で1回再生し、紙音→人影の顔が上がるという順番にする。露光の前は既存のページ動作が周期的に続く。幽霊の撮影像は同じThree.js描画からキャプチャされる。

再書き出し：

```bash
for pose in reading noticed; do
  swift art/ghost-poses/remove-background.swift "art/ghost-base-poses/generated/$pose.png" "art/ghost-base-poses/generated/$pose-cutout.png"
  ffmpeg -y -i "art/ghost-base-poses/generated/$pose-cutout.png" -vf 'scale=768:1152:flags=lanczos' -c:v libwebp -compression_level 6 -quality 90 "public/assets/ghost-base-$pose.webp"
done
```

`*-cutout.png` は再生成可能な中間ファイルで、ソース管理に含めない。検証は390×844、360×720のブラウザ縦画面、3幕完走と死亡経路、Chrome残留を確認。実機Safari/Androidの最終評価は未実施。
