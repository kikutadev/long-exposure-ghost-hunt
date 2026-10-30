# Blender制作メモ（LONG EXPOSURE）

**用途**：スマホ縦画面向けThree.jsゴーストハント。幽霊の行動を示す手掛かりを3D化する。

**現在の制作方法**：Blender 4.5をヘッドレスで起動し、bpyでシーンを直接編集・レンダリング・GLB書き出しする。GUIは使用しない。再現可能なビルドは `art/build-notebook.py`。旧MCP作業の記述は履歴であり、現行の作業指示ではない。

**Production Brief**
- 種別：小道具（hero clue）、ゲーム用、暗い廃校のスタイライズドホラー。
- 対象：古い学習ノート（ページが浮く）、ひび割れた壁掛け時計。
- 予算：両小道具合わせて3000 triangles以下（現行2,812 triangles）、テクスチャ不要、GLBのPBR材質中心。
- 寸法：ノート幅約0.9m、時計直径約0.7m。Three.js世界座標の配置先はノート (-1.15, 1.47, -3.3) 付近、時計 (2.1, 2.65, -8.2)。
- Blender中の位置はGLTF座標変換に合わせ (x, -z, y) を使用。
- 作業ファイル：art/classroom-dress.blend、ランタイム用：public/assets/classroom-dress.glb。
- 作業範囲：造形・マテリアル・シルエット・モデル書き出し。背景・幽霊3枚のPNGと撮影判定は改変しない。
- 受け入れ：Blenderのビューポート・レンダリングで輪郭が読め、GLBを読み込んだ実画面でも既存教室に馴染むこと。検証前に完成とは扱わない。

**旧制作時の検証結果**：Blenderの実操作で44メッシュを作成して保存。レンダリングを確認して表紙の回転を修正、時計部品へDecimateを適用して5,152→2,108三角形に調整。ゲーム実画面では最初のノートが机に隠れる問題があったためBlender上で配置修正。Chrome縦画面で3幕クリア・リプレイ・長押しキャンセルを確認済み。実機タッチ検証は未実施。


## 2026-10-30 視認性修正・QA引き継ぎ（過去のGUI/MCP方式）

専用GUIの9877で保存済みblendを再オープンしてから修正。9876は使用していない。

- ノート：全体を手前へ20度傾け、世界座標Xを+0.25m、高さを+0.12m移動。黄ばんだ紙と暗い赤茶の表紙の差を強め、浮いたページの隙間・角度・薄い湾曲を調整。ページのSimple DeformとDecimateはblend内で編集可能、GLBでは適用済み。
- 時計：世界座標Xを3.8→2.1mへ移動。390×844初期画角の右端から内側に収めた。緑灰色の外縁、古い真鍮の内縁、象牙色の文字盤、太くした黒い針。時刻とひびを保持。
- 発光は紙0.055、紙端0.025、文字盤0.045のみ。全体露出やゲーム照明は変更していない。
- 書き出し：選択したBOOK_* / CLOCK_* の44メッシュのみ。BOOK_Page_Turningを維持。2,812三角形、248,152 bytes、8材質、GLB 2。カメラ・ライト・画像・アニメーションを含めない。ヘッダ、bufferView範囲、ノード名、indicesから三角形数を検査済み。

プレビュー：
- `preview-book-front.png`：修正後の本全体。正面上方、切れなし。
- `preview-clock-front.png`：修正後の時計正面。針・目盛り・外縁を確認。
- `preview-game-default-models.png`：修正後モデルだけのBlenderレンダー、390×844。ゲームのカメラ位置(0,1.65,5.7)、縦FOV62度、yaw=-0.07、pitch=-0.025を再現。背景・霧・ゲーム照明は含まないため実ゲームの合格証ではない。
- `preview-game-reference-before.png`：ユーザー提供の修正前実ゲーム画像 `.qa/v2-look.png` の参照コピー。
- `preview-book-before.png`：保存済みモデルを正しいカメラから撮った修正前比較。

**残るQA**：最新GLBを再読み込みした実ゲーム390×844で、机や黒板との重なり、幽霊より目立ちすぎないか、ページのランタイム回転、時計の読め方をQA担当が確認する。今回の修正後について実ゲーム合格・実機合格は未宣言。ソースコード変更、コミット、デプロイなし。

## 2026-10-31 Headless bpy：ノートの紙を蝶番でめくる

- コマンド：`/Applications/Blender.app/Contents/MacOS/Blender --background art/classroom-dress.blend --threads 3 --python art/build-notebook.py`
- `BOOK_Page_Turning` を背表紙に原点を持つ12×10分割の湾曲した一枚紙メッシュに置換し、筆記線を子として連動。唐突に大きくなる `BOOK_Page_Floating` は廃止。
- bpyのEEVEEで `art/preview-hinged-page.png` にレンダリングして形を目視確認。更新した `.blend` と `public/assets/classroom-dress.glb` を保存（GLB 47メッシュ、約211KB）。Three.jsでは本の軸回転でページをめくる。
- Chrome縦390×844の実ゲーム画面で紙の動きと撮影結果を確認。撮影判定18件、3幕完走・過露光死・接近死・RESTARTを確認。実機Safari/Androidは未検証。
- 以後のBlender修正はこの方式のみ。旧GUI/MCPスクリプトを新規制作に使わない。

## Rive CLI試作

- `art/rive-shutter/scene.rml` に6枚のベクター羽根の開閉アニメーションとステートマシンの初期試作を作成。`rive art/rive-shutter --verify` は0 errors / 0 warnings。開閉プレビューは `art/rive-shutter/preview-open.png` と `preview-closed.png`。
- **現段階はCLI内の試作であり、ゲームへのRive実装完了ではない。** 未署名のローカル `.riv` はWebランタイムにそのまま組み込まない。Riveアカウントで署名したビルドを得られ、指の押下・解放・中断と正しく同期することを実測してから現行SVG羽根と切り替える。
