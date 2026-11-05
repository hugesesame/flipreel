// Help content. This is where on-screen terms (Transition, Cut, Fade, Black…)
// are explained in plain, friendly language. Static HTML only — no user data.

import type { Lang } from './i18n';

export type HelpTopic =
  | 'start'
  | 'photos'
  | 'aspect'
  | 'format'
  | 'duration'
  | 'transition'
  | 'black'
  | 'export'
  | 'browsers'
  | 'trouble';

export const HELP_ORDER: HelpTopic[] = [
  'start',
  'photos',
  'aspect',
  'format',
  'duration',
  'transition',
  'black',
  'export',
  'browsers',
  'trouble',
];

interface Entry {
  title: string;
  body: string;
}

const demoCut = '<span class="demo demo-cut" aria-hidden="true"><i></i><i></i></span>';
const demoFade = '<span class="demo demo-fade" aria-hidden="true"><i></i><i></i></span>';

const en: Record<HelpTopic, Entry> = {
  start: {
    title: 'Getting started',
    body: `
<p>Flipbook turns your photos into a video that shows them one after another — like flipping through a photo album.</p>
<p>You only need to go through 7 short steps. <strong>Every step already has a sensible setting</strong>, so if you're not sure, just press <kbd>Next</kbd>.</p>
<ol class="help-steps">
  <li><strong>Photos</strong> — choose the photos and their order.</li>
  <li><strong>Aspect Ratio</strong> — the shape of the video (wide, square, tall…).</li>
  <li><strong>Format</strong> — the type of video file. MP4 is fine for almost everyone.</li>
  <li><strong>Duration</strong> — how many seconds each photo is shown.</li>
  <li><strong>Transition</strong> — how one photo changes into the next.</li>
  <li><strong>Black</strong> — a moment of black screen at the start and end.</li>
  <li><strong>Export</strong> — watch a preview, then save the video.</li>
</ol>
<p>You can go back to any step at any time with <kbd>Back</kbd> or by clicking the step names at the top. Nothing is lost.</p>
<h3>Made a mistake? Undo it</h3>
<p>Press <kbd>⌘ Command</kbd> + <kbd>Z</kbd> (Mac) or <kbd>Ctrl</kbd> + <kbd>Z</kbd> (Windows) to undo the last change — removing a photo, changing the order, or changing a setting. You can undo again and again.</p>
<p>To redo what you undid, press <kbd>⇧ Shift</kbd> + <kbd>⌘ Command</kbd> + <kbd>Z</kbd> (Mac) or <kbd>Ctrl</kbd> + <kbd>Y</kbd> (Windows). The ↶ ↷ buttons at the top right do the same — on a phone or tablet, use these buttons.</p>
<div class="help-note"><strong>Your photos stay on your computer.</strong> Flipbook works completely offline. Nothing is uploaded anywhere.</div>`,
  },
  photos: {
    title: 'Choosing photos',
    body: `
<p>There are two ways to add photos:</p>
<ul>
  <li><strong>Drag and drop</strong> — drag photos from a folder onto this page.</li>
  <li><strong>Choose photos</strong> — press the button and pick them. To pick several at once, hold <kbd>⌘ Command</kbd> (Mac) or <kbd>Ctrl</kbd> (Windows) while clicking, or press <kbd>⌘A</kbd> / <kbd>Ctrl+A</kbd> to select all.</li>
  <li><strong>On a phone or tablet</strong> — tap <kbd>Choose photos</kbd>. Your photo library opens; tap each photo you want, then tap <em>Add</em> (or <em>Done</em>).</li>
</ul>
<h3>Changing the order</h3>
<p>The video plays the photos from top-left to bottom-right, in the numbered order.</p>
<ul>
  <li>Drag a photo to a new place. <strong>On a phone or tablet</strong>, press and hold the photo until it lifts up, then move your finger. Or,</li>
  <li>use the <kbd>‹</kbd> <kbd>›</kbd> arrows on each photo to move it one place earlier or later.</li>
  <li><strong>Sort by name</strong> puts them in file-name order — handy for camera photos named like <code>IMG_0001</code>, <code>IMG_0002</code>…</li>
</ul>
<p>Press <kbd>×</kbd> on a photo to take it out. This doesn't delete the file on your computer. Removed one by mistake? Press <kbd>Undo</kbd> in the message that appears, or <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd>.</p>
<h3>Which files work?</h3>
<p>JPEG, PNG, WebP, GIF (first frame only) and AVIF work in all supported browsers. <strong>HEIC</strong> (iPhone photos) works in Safari only. In other browsers, convert them to JPEG first — on a Mac, open them in Preview and choose <em>File › Export › JPEG</em>. On iPhone, <em>Settings › Camera › Formats › Most Compatible</em> saves new photos as JPEG.</p>`,
  },
  aspect: {
    title: 'Aspect ratio (shape of the video)',
    body: `
<p>The <strong>aspect ratio</strong> is simply the shape of the video screen — how wide it is compared to how tall.</p>
<ul>
  <li><strong>16:9 Widescreen</strong> — the usual shape for YouTube, TVs and computers. If you're unsure, pick this.</li>
  <li><strong>4:3 Standard</strong> — a bit squarer. Good for older slide shows and older TVs.</li>
  <li><strong>1:1 Square</strong> — for social media posts.</li>
  <li><strong>9:16 Vertical</strong> — tall, for watching on a phone held upright (Instagram Reels, TikTok, YouTube Shorts).</li>
</ul>
<h3>Photo framing: Fit or Fill</h3>
<p>Photos don't always have the same shape as the video. You can choose what happens:</p>
<ul>
  <li><strong>Fit</strong> — the <em>whole</em> photo is shown. Empty space around it is black. Nothing is cut off.</li>
  <li><strong>Fill</strong> — the photo is enlarged to fill the screen. No black bars, but the edges of the photo are cut off.</li>
</ul>
<p>The preview on the screen shows how your first photo will look.</p>`,
  },
  format: {
    title: 'File format',
    body: `
<p>This is the type of video file that will be made.</p>
<ul>
  <li><strong>MP4</strong> — <em>recommended</em>. Plays on almost everything: iPhone, Android, Windows, Mac, TVs, LINE, YouTube, PowerPoint…</li>
  <li><strong>WebM</strong> — popular on websites. Some devices and apps (for example the iPhone Photos app) may not play it.</li>
</ul>
<p>If you're not sure, choose <strong>MP4</strong>.</p>
<p>The video is made at full HD quality (the short side is 1080 pixels) at 30 frames per second.</p>`,
  },
  duration: {
    title: 'Duration (how long each photo shows)',
    body: `
<p>This is how many seconds each photo stays on screen.</p>
<ul>
  <li><strong>2–3 seconds</strong> — lively, good for many photos.</li>
  <li><strong>5 seconds or more</strong> — calm, gives time to look at each photo.</li>
</ul>
<p>Use <kbd>−</kbd> and <kbd>+</kbd>, or tap one of the quick choices. The total length of the video updates as you change it.</p>`,
  },
  transition: {
    title: 'Transition (how photos change)',
    body: `
<p>A <strong>transition</strong> is the way one photo changes into the next.</p>
<div class="help-demo">${demoCut}<div><strong>Cut</strong> — the photo changes <em>instantly</em>, in a snap. Crisp and simple.</div></div>
<div class="help-demo">${demoFade}<div><strong>Fade</strong> — the next photo <em>gently appears</em> while the previous one fades away. Soft and smooth.</div></div>
<h3>Fade duration</h3>
<p>When you choose Fade, you can set how long the gentle change takes. <strong>0.5–1 second</strong> feels natural. The fade can't be longer than the time each photo is shown.</p>
<p>With Fade, the video also fades in from black at the start and out to black at the end (if you have black set in the next step).</p>
<p>Changing the transition doesn't change the total length of the video.</p>`,
  },
  black: {
    title: 'Black (start and end)',
    body: `
<p>"<strong>Black</strong>" means a few moments of plain black screen at the very start and very end of the video.</p>
<p>It gives the viewer a moment to settle before the first photo, and a calm ending after the last one — like the lights going down in a cinema.</p>
<ul>
  <li><strong>Start</strong> — black before the first photo.</li>
  <li><strong>End</strong> — black after the last photo.</li>
</ul>
<p><strong>1 second</strong> at each end is a good choice. Set it to <strong>0</strong> if you want the photos to start and end immediately.</p>
<p>The bar on the screen shows where the black parts sit in your video.</p>`,
  },
  export: {
    title: 'Saving your video',
    body: `
<p>On the last step you can play a preview. When you're happy, press the big button to make the video.</p>
<h3>Choosing where to save</h3>
<p>In <strong>Google Chrome</strong> and <strong>Microsoft Edge</strong>, a "Save as" window opens first. Pick a folder (for example <em>Desktop</em> or <em>Movies</em>), change the name if you like, then press <kbd>Save</kbd>. The video is then made and saved right there.</p>
<h3>On a phone or tablet</h3>
<p>Press <kbd>Create video</kbd>. When it's ready, press <kbd>Save / Share</kbd>:</p>
<ul>
  <li><strong>iPhone / iPad</strong> — choose <em>Save Video</em> to put it in the Photos app. You can also send it with Messages, LINE, Mail and more.</li>
  <li><strong>Android</strong> — choose an app to save or send it (for example Google Photos or Drive). <kbd>Download</kbd> saves it to the Downloads folder.</li>
</ul>
<p>While the video is being made, keep the screen on and stay on this page. If you switch to another app, making the video may pause.</p>
<h3>Safari and Firefox on a computer</h3>
<p>These browsers can't open the "Save as" window from a web page, so the video is saved to your <strong>Downloads</strong> folder. To be asked where to save every time:</p>
<ul>
  <li><strong>Safari</strong> — <em>Safari menu › Settings › General › File download location</em> › choose <em>Ask for each download</em>.</li>
  <li><strong>Firefox</strong> — <em>Settings › General › Files and Applications</em> › turn on <em>Always ask you where to save files</em>.</li>
</ul>
<h3>While the video is being made</h3>
<p>A bar shows how far along it is. Please keep the tab open until it says <strong>Done!</strong>. You can press <kbd>Cancel</kbd> at any time.</p>`,
  },
  browsers: {
    title: 'Browsers, offline use & privacy',
    body: `
<p>Flipbook works best in the latest <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. Recent Safari and Firefox work too, but can only save to the Downloads folder.</p>
<p>On phones and tablets, use <strong>Safari</strong> on iPhone / iPad (iOS 17 or later) or <strong>Chrome</strong> on Android.</p>
<p>Flipbook is a single file. You can keep it on your computer and open it any time — <strong>no internet connection is needed</strong>.</p>
<div class="help-note"><strong>Privacy:</strong> your photos never leave your computer. Everything — reading the photos and making the video — happens inside your browser.</div>`,
  },
  trouble: {
    title: 'Troubleshooting',
    body: `
<h3>A photo won't open</h3>
<p>It may be in a format the browser can't read (often HEIC from an iPhone). See <em>Choosing photos › Which files work?</em></p>
<h3>"This browser can't create this format"</h3>
<p>Try the other format, or use the latest Google Chrome or Microsoft Edge.</p>
<h3>Making the video stops or fails</h3>
<ul>
  <li>Close other tabs and apps, then try again.</li>
  <li>Try with fewer photos to see whether a particular photo causes the problem.</li>
  <li>Try WebM instead of MP4 (or the other way round).</li>
</ul>
<h3>The "Save as" window doesn't appear</h3>
<p>Your browser may not support it — the video goes to Downloads instead. See <em>Saving your video</em>.</p>
<h3>I dropped a photo and nothing happened</h3>
<p>Make sure you drop image files (not folders). You can also use the <kbd>Choose photos</kbd> button.</p>`,
  },
};

const ja: Record<HelpTopic, Entry> = {
  start: {
    title: 'はじめに',
    body: `
<p>Flipbook（フリップブック）は、写真を 1 枚ずつ順番に見せる動画を作るアプリです。アルバムをめくっていくような動画ができます。</p>
<p>やることは 7 つの短いステップだけです。<strong>どのステップにも最初からちょうどよい設定が入っている</strong>ので、迷ったら <kbd>次へ</kbd> を押すだけで大丈夫です。</p>
<ol class="help-steps">
  <li><strong>写真</strong> — 使う写真と、その順番を決めます。</li>
  <li><strong>アスペクト比</strong> — 動画の画面の形（横長・正方形・縦長など）を選びます。</li>
  <li><strong>ファイル形式</strong> — 動画ファイルの種類です。ほとんどの方は MP4 で大丈夫です。</li>
  <li><strong>表示時間</strong> — 写真 1 枚を何秒見せるかです。</li>
  <li><strong>トランジション</strong> — 写真から次の写真への切り替え方です。</li>
  <li><strong>黒み</strong> — 最初と最後に入れる黒い画面の時間です。</li>
  <li><strong>書き出し</strong> — プレビューを見て、動画を保存します。</li>
</ol>
<p><kbd>戻る</kbd> ボタンや、画面上部のステップ名を押せば、いつでも前のステップに戻れます。設定が消えることはありません。</p>
<h3>まちがえたときは「取り消し」</h3>
<p><kbd>⌘ Command</kbd> + <kbd>Z</kbd>（Mac）か <kbd>Ctrl</kbd> + <kbd>Z</kbd>（Windows）を押すと、直前の操作を取り消して元に戻せます。写真の削除や並べ替え、設定の変更など、何回でもさかのぼれます。</p>
<p>取り消した操作をもう一度やり直したいときは、<kbd>⇧ Shift</kbd> + <kbd>⌘ Command</kbd> + <kbd>Z</kbd>（Mac）か <kbd>Ctrl</kbd> + <kbd>Y</kbd>（Windows）を押します。画面右上の ↶ ↷ ボタンでも同じことができます。スマホ・タブレットではこのボタンを使ってください。</p>
<div class="help-note"><strong>写真はお使いのパソコンの中だけで扱われます。</strong>Flipbook はインターネットにつながっていなくても動き、写真がどこかに送られることはありません。</div>`,
  },
  photos: {
    title: '写真の選び方',
    body: `
<p>写真の追加のしかたは 2 通りあります。</p>
<ul>
  <li><strong>ドラッグ＆ドロップ</strong> — フォルダの中の写真を、マウスでつかんでこの画面の上に落とします。</li>
  <li><strong>「写真を選ぶ」ボタン</strong> — ボタンを押して写真を選びます。何枚かまとめて選ぶときは、<kbd>⌘ Command</kbd>（Mac）か <kbd>Ctrl</kbd>（Windows）を押しながらクリックします。<kbd>⌘A</kbd> / <kbd>Ctrl+A</kbd> で全部選ぶこともできます。</li>
  <li><strong>スマホ・タブレットの場合</strong> — <kbd>写真を選ぶ</kbd> を押すと写真ライブラリが開きます。使いたい写真を順にタップして、<em>追加</em>（または <em>完了</em>）を押します。</li>
</ul>
<h3>順番を変えるには</h3>
<p>動画では、写真についている番号の順（左上から右下へ）に表示されます。</p>
<ul>
  <li>写真をつかんで、好きな場所へ動かします。<strong>スマホ・タブレットでは</strong>、写真を少し長めに押して、浮き上がったらそのまま指を動かします。または、</li>
  <li>写真の <kbd>‹</kbd> <kbd>›</kbd> ボタンで、1 つ前・1 つ後ろへ動かせます。</li>
  <li><strong>「名前順に並べる」</strong>を押すと、ファイル名の順に並びます。カメラの写真（<code>IMG_0001</code>、<code>IMG_0002</code>…）なら撮った順になることが多いです。</li>
</ul>
<p>写真の <kbd>×</kbd> を押すと、その写真を動画から外せます。パソコンの中の写真が消えることはありません。まちがえて外したときは、表示されるメッセージの <kbd>取り消す</kbd> を押すか、<kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> で元に戻せます。</p>
<h3>使えるファイル</h3>
<p>JPEG・PNG・WebP・GIF（最初のコマだけ）・AVIF が使えます。iPhone の写真に多い <strong>HEIC</strong> は Safari でだけ使えます。ほかのブラウザでは、先に JPEG に変換してください。Mac なら「プレビュー」で開いて <em>ファイル › 書き出す › JPEG</em> で変換できます。iPhone の <em>設定 › カメラ › フォーマット › 互換性優先</em> にすると、これから撮る写真が JPEG で保存されます。</p>`,
  },
  aspect: {
    title: 'アスペクト比（画面の形）',
    body: `
<p><strong>アスペクト比</strong>とは、動画の画面の形のことです。横の長さと縦の長さの比率で表します。</p>
<ul>
  <li><strong>16:9 ワイド</strong> — YouTube やテレビ、パソコンでいちばん一般的な横長の形です。迷ったらこれを選んでください。</li>
  <li><strong>4:3 スタンダード</strong> — 少し正方形に近い横長です。昔のテレビやスライドの形です。</li>
  <li><strong>1:1 スクエア</strong> — 正方形です。SNS の投稿に向いています。</li>
  <li><strong>9:16 縦長</strong> — スマホを縦に持って見る形です。Instagram のリール、TikTok、YouTube ショートなどに使います。</li>
</ul>
<h3>写真の収め方：フィット と フィル</h3>
<p>写真の形と動画の画面の形が違うとき、どう見せるかを選べます。</p>
<ul>
  <li><strong>フィット</strong> — 写真の<em>全体</em>を表示します。まわりのすき間は黒になります。写真が切れることはありません。</li>
  <li><strong>フィル</strong> — 写真を大きくして、画面いっぱいに表示します。黒いすき間はできませんが、写真の端が少し切れます。</li>
</ul>
<p>画面のプレビューで、1 枚目の写真がどう見えるかを確認できます。</p>`,
  },
  format: {
    title: 'ファイル形式',
    body: `
<p>作る動画ファイルの種類です。</p>
<ul>
  <li><strong>MP4</strong> — <em>おすすめ</em>。iPhone、Android、Windows、Mac、テレビ、LINE、YouTube、PowerPoint など、ほとんどの機器やアプリで再生できます。</li>
  <li><strong>WebM</strong> — Web サイトでよく使われる形式です。機器やアプリによっては再生できないことがあります（たとえば iPhone の「写真」アプリ）。</li>
</ul>
<p>迷ったら <strong>MP4</strong> を選んでください。</p>
<p>動画はフル HD の画質（短い辺が 1080 ピクセル）、1 秒あたり 30 コマで作られます。</p>`,
  },
  duration: {
    title: '表示時間（1 枚を見せる長さ）',
    body: `
<p>写真 1 枚を何秒間表示するかを決めます。</p>
<ul>
  <li><strong>2〜3 秒</strong> — テンポよく進みます。写真が多いときに向いています。</li>
  <li><strong>5 秒以上</strong> — ゆったり進みます。1 枚ずつじっくり見てもらえます。</li>
</ul>
<p><kbd>−</kbd> と <kbd>＋</kbd> で調整するか、下の数字のボタンを押してください。動画全体の長さもすぐに表示されます。</p>`,
  },
  transition: {
    title: 'トランジション（写真の切り替え方）',
    body: `
<p><strong>トランジション</strong>とは、写真から次の写真へ切り替わるときの見せ方のことです。</p>
<div class="help-demo">${demoCut}<div><strong>カット</strong> — 次の写真に<em>パッと一瞬で</em>切り替わります。すっきりした印象になります。</div></div>
<div class="help-demo">${demoFade}<div><strong>フェード</strong> — 前の写真がうすくなりながら、次の写真が<em>ふわっと</em>浮かび上がります。やわらかい印象になります。</div></div>
<h3>フェードの長さ</h3>
<p>フェードを選ぶと、ふわっと切り替わるのにかける時間を決められます。<strong>0.5〜1 秒</strong>くらいが自然です。写真 1 枚の表示時間より長くはできません。</p>
<p>フェードのときは、動画の最初は黒い画面からふわっと始まり、最後はふわっと黒い画面になって終わります（次のステップの「黒み」を 0 秒より長くした場合）。</p>
<p>トランジションを変えても、動画全体の長さは変わりません。</p>`,
  },
  black: {
    title: '黒み（最初と最後の黒い時間）',
    body: `
<p>「<strong>黒み</strong>」とは、動画のいちばん最初と最後に入れる、真っ黒な画面のことです。</p>
<p>最初に少し黒い画面があると、見る人が落ち着いてから 1 枚目の写真を見られます。最後にあると、映画館で照明が落ちるように、静かに終わることができます。</p>
<ul>
  <li><strong>最初</strong> — 1 枚目の写真の前に入る黒い時間です。</li>
  <li><strong>最後</strong> — 最後の写真の後に入る黒い時間です。</li>
</ul>
<p>どちらも <strong>1 秒</strong>くらいがおすすめです。すぐに写真から始めたいとき・すぐに終わりたいときは <strong>0</strong> にしてください。</p>
<p>画面の帯の図で、動画のどこに黒い時間が入るかを確認できます。</p>`,
  },
  export: {
    title: '動画の保存',
    body: `
<p>最後のステップでは、プレビューを再生して確認できます。よければ大きなボタンを押して動画を作りましょう。</p>
<h3>保存する場所を選ぶ</h3>
<p><strong>Google Chrome</strong> と <strong>Microsoft Edge</strong> では、最初に「名前を付けて保存」の画面が開きます。保存したいフォルダ（たとえば「デスクトップ」や「ムービー」）を選び、必要ならファイル名を変えて <kbd>保存</kbd> を押してください。そのあと動画が作られ、選んだ場所に保存されます。</p>
<h3>スマホ・タブレットの場合</h3>
<p><kbd>動画を作る</kbd> を押します。できあがったら <kbd>保存・共有</kbd> を押してください。</p>
<ul>
  <li><strong>iPhone / iPad</strong> — <em>ビデオを保存</em> を選ぶと「写真」アプリに保存されます。メッセージや LINE、メールで送ることもできます。</li>
  <li><strong>Android</strong> — 保存先や送り先のアプリ（Google フォトやドライブなど）を選びます。<kbd>ダウンロード</kbd> を押すと「ダウンロード」フォルダに保存されます。</li>
</ul>
<p>動画を作っている間は、画面をつけたまま、この画面から離れないでください。ほかのアプリに切り替えると、作成が止まることがあります。</p>
<h3>パソコンの Safari と Firefox の場合</h3>
<p>この 2 つのブラウザでは、Web ページから「名前を付けて保存」の画面を開けないため、<strong>「ダウンロード」フォルダ</strong>に保存されます。毎回保存先を聞いてほしいときは、次のように設定してください。</p>
<ul>
  <li><strong>Safari</strong> — <em>Safari メニュー › 設定 › 一般 › ファイルのダウンロード先</em> で <em>ダウンロードごとに確認</em> を選びます。</li>
  <li><strong>Firefox</strong> — <em>設定 › 一般 › ファイルとプログラム</em> で <em>ファイルごとに保存先を指定する</em> をオンにします。</li>
</ul>
<h3>動画を作っている間</h3>
<p>どこまで進んだかがバーで表示されます。<strong>「完成しました！」</strong>と表示されるまで、タブを閉じずにお待ちください。<kbd>キャンセル</kbd> でいつでも中止できます。</p>`,
  },
  browsers: {
    title: '対応ブラウザ・オフライン・プライバシー',
    body: `
<p>Flipbook は、最新の <strong>Google Chrome</strong> か <strong>Microsoft Edge</strong> でいちばんよく動きます。新しい Safari や Firefox でも使えますが、保存先は「ダウンロード」フォルダになります。</p>
<p>スマホ・タブレットでは、iPhone / iPad の <strong>Safari</strong>（iOS 17 以降）か、Android の <strong>Chrome</strong> をお使いください。</p>
<p>Flipbook は 1 つのファイルだけでできています。パソコンに保存しておけば、いつでも開いて使えます。<strong>インターネットへの接続は必要ありません。</strong></p>
<div class="help-note"><strong>プライバシーについて：</strong>写真がお使いのパソコンの外に出ることはありません。写真の読み込みも動画づくりも、すべてブラウザの中で行われます。</div>`,
  },
  trouble: {
    title: '困ったときは',
    body: `
<h3>写真が開けない</h3>
<p>ブラウザが読めない形式の写真かもしれません（iPhone の HEIC 形式が多いです）。「写真の選び方 › 使えるファイル」をご覧ください。</p>
<h3>「このブラウザではこの形式を作れません」と出る</h3>
<p>もう一方の形式を選ぶか、最新の Google Chrome か Microsoft Edge をお使いください。</p>
<h3>動画づくりが止まる・失敗する</h3>
<ul>
  <li>ほかのタブやアプリを閉じてから、もう一度お試しください。</li>
  <li>写真の枚数を減らして試すと、特定の写真が原因かどうかがわかります。</li>
  <li>MP4 のかわりに WebM を（またはその逆を）お試しください。</li>
</ul>
<h3>「名前を付けて保存」の画面が出ない</h3>
<p>お使いのブラウザが対応していない可能性があります。その場合は「ダウンロード」フォルダに保存されます。「動画の保存」をご覧ください。</p>
<h3>写真をドロップしても何も起きない</h3>
<p>フォルダではなく、写真のファイルをドロップしてください。「写真を選ぶ」ボタンからも追加できます。</p>`,
  },
};

export function helpEntry(lang: Lang, topic: HelpTopic): Entry {
  return (lang === 'ja' ? ja : en)[topic];
}
