# LONG EXPOSURE: GHOST HUNT

SLAPJAM #2（テーマ **Speed**）向け、スマホ縦画面の短編3D心霊写真ゲーム。**実装済みのプレイアブル版**。デスクトップChromeのスマホ画面エミュレーションで3幕の完走とリプレイを確認。iPhone Safari／Android Chromeの実機検証・itch.io提出は未実施。

## 何を遊ぶか

暗い教室で物音や動く小物から幽霊を探す。シャッターを長押しすると、肉眼では見えない幽霊の像が露光で浮かぶ。**指を離して金属羽根を閉じる瞬間**に写真を確定する。速い霊ほど短い露光、遅い霊ほど長い露光が必要。撮れた写真がそのままコレクションになる。

- 目標：速度特性の異なる3体を撮影して、3枚の心霊写真をアルバムに収める。
- 体験：探索 → 狙う → 長押し露光 → 指を離す → シャッター閉鎖 → 写真現像。
- 想定プレイ時間：初見3〜6分。軽い失敗はその場で撮り直せるが、露光過多・幽霊接近では死亡して第1幕からやり直し。
- 舞台：単一の廃校教室。異変の段階演出で3幕を見せる。
- 方向性：純粋な恐怖よりも、カメラの操作感・捕まえる達成感・奇妙な写真の発見を優先する。

## 設計の正本

- [docs/SPEC.md](docs/SPEC.md)：現行のゲーム仕様（入力、状態、撮影判定、各幕、UI、映像・音、技術案、受入条件）。
- [docs/PLAN.md](docs/PLAN.md)：締切を踏まえた制作順序、削る基準、確認すること。
- [STORY.md](STORY.md)：1987年の怪異調査という世界観、フレーバーテキスト原案、未実装の死亡演出案。
- [docs/adr/0001-core-camera-loop.md](docs/adr/0001-core-camera-loop.md)：固定視点・露光式撮影に決めた理由と却下案。

3幕まで実装しGitHub Pages上でクリアとリプレイを確認。残作業はiPhone Safari／Android Chrome実機での手触り確認とitch.io提出。

## ジャム要件（2026-10-30確認）

- 公式テーマ：Speed（レースである必要はない）。
- 48時間：2026-10-29 15:00 UTC〜10-31 15:00 UTC（**日本時間11月1日 00:00締切**）。
- 提出：itch.io のジャムページ経由で、スマホ縦画面で動くブラウザ版 HTML5。
- 審査：Fun / Visual Appeal / Theme Following の等重み。
- AIツールを使い、提出ページで実際に使用したツールを申告する。締切後にビルドは更新できない。
- 公式：https://itch.io/jam/slapjam-ai-2 / https://slapjam.ai/

## GitHub Pages 試遊版

公開先: https://kikutadev.github.io/long-exposure-ghost-hunt/

ソース: https://github.com/kikutadev/long-exposure-ghost-hunt

実行ファイルを gh-pages ブランチ直下に公開する。GitHub Actionsを使用しない。公開更新は、originを設定したこのリポジトリで scripts/publish-pages.sh を実行する。

## 起動・提出用ビルド

macOSの当該フォルダ内で実行する。

```bash
pnpm install
pnpm dev
pnpm build
./scripts/build-itch.sh
```

最後のコマンドで `release/long-exposure-slapjam2.zip` を生成する（zip内の直下にindex.html）。itch.ioに公開するまで提出完了ではない。

## Blenderの小道具

ノートと壁時計はBlender 4.5で制作。GUIを使わずart/build-motion.pyをbpyヘッドレスで実行し、紙と椅子の名前付きアニメーションをGLBへ書き出す。編集元は art/classroom-dress.blend、ゲーム用は public/assets/classroom-dress.glb（約211KB）。スクリーンショットは art/preview-*.png。モデルはThree.jsで描画する。Rive CLIのシャッター試作は art/rive-shutter に置くが、現行サイトは引き続きSVGシャッター。詳細は art/README.md。

## 撮影リスクとゲームオーバー

写真が暗い・ぶれた・画角外なら同じ幽霊に再挑戦できる。一方、露光が危険な白飛びに達する／シャッターを開け続ける／第3幕で幽霊が接近限界に達すると死亡する。GAME OVER画面からRESTARTすると第1幕へ戻り、撮影記録はリセット。露光中は数値の正解表示を出さず、幽霊の姿・色・機械音から判断する。

## コード構成

`src/main.ts` は3幕の状態遷移と描画ループを担当。UIの静的マークアップは `view.ts`、効果音は `audio.ts`、タッチ・マウス操作は `input.ts`、6枚羽根は `iris.ts`、撮影評価・死亡判定は `shot.ts`、30Hzの露光サンプル収集は `exposure-session.ts`、死亡画面の表示は `death-screen.ts` に分割。教室の描画とBlenderモーション再生は `world.ts` と `atmosphere.ts` に置く。

撮影評価のテスト：`pnpm test`。型チェックとビルド：`pnpm build`。

## 現状

- [x] コンセプト・ループ・目標・失敗条件・最小スコープを文章化
- [x] シャッター操作・露光判定・3幕・画面レイアウトを設計
- [x] 既存ChatGPT VM上の「パラレル」で3つの幽霊原画を生成・ローカル保存（全て1024×1536、RGBA透明背景を実測、原画像の目視と仮教室背景で縮小確認）
- [x] Three.jsで3体を配置。撮影画面・残像・写真表示をChromeスマホ画面サイズで目視確認
- [x] 3幕を通して撮影・評価・アルバム・エンディング・リプレイの自動操作を確認
- [x] 長押し解除・画面外解放・キャンセル・回転・連続撮影をChromeで確認
- [x] 教室の質感、幽霊の発見の手がかり、露光中の視覚信号、シャッター反動、現像演出、環境音を改良
- [x] GitHub Pagesへ静的ビルドを公開し、公開URLから3幕を完走・リプレイまで検証
- [ ] iPhone Safari / Android Chrome実機での調整
- [ ] 完成版・itch.io上での実プレイ確認・提出
