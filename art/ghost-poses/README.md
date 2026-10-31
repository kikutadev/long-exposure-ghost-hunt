# 第3幕・幽霊の新しい姿勢画像

**目的**：既存の `public/assets/ghost-near.png` と同じ人物を、ポーズそのものが異なる3段階として制作する。時間経過で画像を拡大するのではなく、撮影に気付いて顔を上げる→腕を構える→レンズを掴むという実際の芝居を作る。

- 待機：既存 `ghost-near.png`（俯いている。正本）
- 認識：`recognition-prompt.txt` と `refs/recognition-guide.png` を、元画像と一緒にChatGPT画像生成へ渡す
- 襲撃：`attack-prompt.txt` と `refs/attack-guide.png` を、元画像と一緒にChatGPT画像生成へ渡す。遠近がついた前景の手が主役

**素材受入**：全3枚で顔・髪色・衣装の同一性がある。認識では目線が確実にレンズへ向き、襲撃では肘→手首→指のつながりと前景手の遠近が自然。背景と文字・教室の描き込みは不要。生成後は実画像を3枚並べて比較し、不自然な手や別人化があれば採用しない。採用できてから透過処理し、Rive/Three.jsに統合して等速QAを行う。美術を検証する前に公開しない。

**VM1で生成成功（2026-11-01 JST）**：VM1の既存ログイン済みChromiumを使用。元の幽霊画像とポーズガイドの2枚を新規会話に添付し、認識・襲撃の2画像を実際に生成。独立会話・投稿・生成画像のPNG本体を確認し、ゲストからコピーしたPNGのSHA-256を検証した。

| 生成画像 | 実ファイル | SHA-256 | ChatGPT.comの元会話 |
| --- | --- | --- | --- |
| 認識（顔を上げ、見る） | `generated/recognition.png`（1024×1536） | `f7edf2722789b4bed4c7ae0363925a00713ea0d182c600426b3fc2a3d2b43a5b` | https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae602f0-f7f8-83ee-8ed3-76005581b189 |
| 襲撃（レンズに伸ばす手） | `generated/attack.png`（1024×1536） | `3cae2d7b2cbf6c1e4ae2469ed095dac8dbf529589830a46e9f54d5d0a2bb6acb` | https://chatgpt.com/g/g-p-6ad3c9e81f0081918a0b02e84d2c16b4-parallel/c/6ae60288-3ec8-83e8-8e68-9f9b0ac64f7d |

**2026-11-01 採用手順と実画面検証**：VM1生成の黒背景2枚を `remove-background.swift`（macOS Vision / `VNGenerateForegroundInstanceMaskRequest`）で前景分離し、透明PNG経由でアルファWebP（768×1152）に縮小。公開用は `public/assets/ghost-near-recognition.webp`（約170KB）および `public/assets/ghost-near-attack.webp`（約194KB）。人物の髪の輪郭と手は透過状態・教室背景の両方で確認した。3幕の露光中に認識像が現れ、近距離の攻撃は手と顔がフレームを占め、死亡時にカメラが倒れる。生成画像の衣装は待機素材と完全一致ではなく、同じデザインとして許容する暫定判断。iPhone/Android実機の検証は未実施。

再生成コマンド：

```bash
for pose in recognition attack; do
  swift art/ghost-poses/remove-background.swift "art/ghost-poses/generated/$pose.png" "art/ghost-poses/generated/$pose-cutout.png"
  ffmpeg -y -i "art/ghost-poses/generated/$pose-cutout.png" -vf 'scale=768:1152:flags=lanczos' -c:v libwebp -compression_level 6 -quality 90 "public/assets/ghost-near-$pose.webp"
done
```

上記の `*-cutout.png` は再生成可能な中間素材であり、公開/コミットには含めない。

**原因と修正箇所**：VM3の自動化は「添付候補の選択」と「Sendへのクリック」が実際の投稿成立に至らなかった。VM1でCDP経由の `Attach photos or videos` ファイル入力を使い、最後に `Page.bringToFront` とマウス押下/解放を送ると会話投稿・生成できた。画像生成サーバーそのものの障害ではなかった。送信未確認のジョブで繰り返し送ることは避けた。

公開中の `main` は変更せず、作業は `experiment/exposure-feedback` ブランチに保存する。