// scripts/build-demo-archive.mjs
//
// Generate samples/demo-archive-backup.zip containing a synthetic archive
// of ~30 JP-flavored posts (no media) so that screenshots for the Chrome
// Web Store listing can be taken against a non-empty, realistic-looking
// viewer.
//
// Run:   node scripts/build-demo-archive.mjs
// Output: samples/demo-archive-backup.zip
//
// Import the produced zip via the viewer's
//   Settings → Archive maintenance → Restore archive backup
// to populate the local IndexedDB with the demo posts. Use merge mode
// to keep your existing archive untouched.
//
// All handles, display names, and post bodies are invented for screenshot
// purposes only. Any resemblance to real X accounts is coincidental.

import { mkdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import {
  BlobWriter,
  TextReader,
  ZipWriter
} from "@zip.js/zip.js";

// ----- handles ---------------------------------------------------------------

const HANDLES = [
  { display: "ゆきの", username: "yukino_demo" },
  { display: "こたろう", username: "kotaro_demo" },
  { display: "ねこねこ屋", username: "neko_demo" },
  { display: "つみき", username: "tsumiki_demo" },
  { display: "ほしの雑記", username: "hosino_demo" },
  { display: "たまと", username: "tama_demo" },
  { display: "りんた", username: "rinta_demo" }
];

// ----- post body pools -------------------------------------------------------

const SHORT_POSTS = [
  "今日のラーメン、店主の機嫌が良くてチャーシュー多めだった。",
  "プルリク3つ片付けたら金曜の17時で、もうやる気残ってない。",
  "深夜2時に新刊届いて、開封しないで枕元に置いて寝た。",
  "雨。早めに帰る。",
  "コーヒー入れ直したら気分も入れ直せた。",
  "知らない駅で降りるとちょっと得した気持ちになる。",
  "新刊スキャンしてバックアップ取ったので今日は満足。",
  "古本屋の100円コーナーで全集の3巻だけ拾った。",
  "深夜の作業BGMがついにジャズ以外で安定しない。",
  "湯豆腐、雑につくっても旨いから偉い。",
  "週末にやろうと思ってたことが何だったか思い出せない。",
  "三色ボールペンの黒だけがすぐ無くなる。"
];

const MEDIUM_POSTS = [
  "TypeScript の strict を最初に有効化しておくと後で泣かないで済む、というのは何度言っても新しいプロジェクトで忘れがちなので、テンプレートに固定で入れている。",
  "プルリクのレビューで「ここ to be honest 不要では」と書きかけて、結局自分の宿題が増えたので staff engineer 偉い、と思ったあと自分も staff engineer なんだったと気づく。",
  "電子書籍と紙の本どっちか派閥に分かれがちだけど、実物が手元に欲しい本は紙、検索したい本は電子、と本の側で勝手に分かれてくれているので争いは起こらない。",
  "深夜の散歩中、コンビニのおでんの蒸気を見て急に夏が終わったのを実感した。今年もコート出さないとだ。",
  "新しい機械学習モデルが出るたびに「これで翻訳とか要約は終わり」と言われ続けているけど、終わるどころか毎回タスクが増えていて全人類が同じ轍を踏んでいる。",
  "本当に良い UI は何も考えなくてもボタンが手の場所にある UI、というのを最近よく思う。考えさせる UI は誇り高くてもユーザーには遠い。",
  "アーカイブを取るという行為そのものに少し中毒性があって、整理が終わったあとの一覧の眺めの良さが副作用みたいに楽しい。"
];

const LONG_POSTS = [
  "投稿を保存しておきたいと思うのは、後で見返したいというより「無くなったときに後悔したくない」という気持ちのほうが大きい気がする。X が落ちることは滅多にないけど、自分のいいね欄が消えるとかアカウントが凍るとか、そういう「自分のせいじゃない理由で記憶を失う」感じが怖い。だから保存ボタンを押すときの気持ちは、図書館にしまう、というより、紙に書き写して引き出しに入れる、に近い。",
  "「これあとで読みたい」と「これあとで参照したい」は似ているようで全然違くて、前者は読み終わったら削除していい本のメモみたいなもので、後者は仕事の道具箱に入れる工具に近い。後者は減ることがほぼないので、増え続けるのを前提に整理の仕組みを考える必要がある。タグだけだと崩れるので、検索の早さがいちばん効く。",
  "オフラインで全部見られる、というのはここ数年の web サービスではむしろ珍しくなった機能で、サーバ前提の作りに慣れた人にとっては最初は不便に感じるかもしれない。同期しないということは、別の端末からは見えないということで、それは確かに退化に見える。けど、自分の手元のデータが自分の知らないところで動かないというのは、思っているより安心感がある。"
];

const THREAD_POSTS = [
  "今日のコミケ戦利品まとめ。ジャンル散らかってる。",
  "1冊目は落語の薄い本。表紙の藍色が綺麗で買った。中身まだ未読だけど見返しの紙の質感が良くて、それだけで満足してる。",
  "2冊目はタイポグラフィの同人誌。フォント解説が異常に細かくて、ほぼ DTP の参考書だった。次の入稿の前に読み直したい。",
  "3冊目は散歩エッセイ。短編集なので帰り道の電車で半分読んだ。著者が同じルートを2回歩いて違う発見をする話が好きだった。"
];

// ----- helpers ---------------------------------------------------------------

let postIdSeed = 1900000000000000000n;
const nextPostId = () => {
  postIdSeed += 1n + BigInt(Math.floor(Math.random() * 5));
  return postIdSeed.toString();
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const skewedCount = (max) => {
  // bias toward small numbers (most posts have low engagement)
  const r = Math.random();
  return Math.floor(r * r * max);
};

const NOW = Date.now();
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

const randPostedAt = () => NOW - Math.floor(Math.random() * SIX_MONTHS_MS);

// saved_at is between posted_at and now, biased toward "saved shortly after"
const randSavedAt = (postedAt) => {
  const span = NOW - postedAt;
  return postedAt + Math.floor(span * Math.random() * Math.random());
};

const makePost = (overrides) => {
  const handle = overrides.handle ?? pick(HANDLES);
  const postedAt = overrides.posted_at ?? randPostedAt();
  const id = overrides.x_post_id ?? nextPostId();
  return {
    x_post_id: id,
    display_name: handle.display,
    x_username: handle.username,
    post_text: overrides.post_text,
    post_url: `https://x.com/${handle.username}/status/${id}`,
    posted_at: postedAt,
    reply_count: overrides.reply_count ?? skewedCount(40),
    repost_count: overrides.repost_count ?? skewedCount(80),
    like_count: overrides.like_count ?? skewedCount(300),
    in_reply_to_post_id: overrides.in_reply_to_post_id ?? null,
    thread_root_id: overrides.thread_root_id ?? null,
    quoted_post_id: overrides.quoted_post_id ?? null,
    saved_at: overrides.saved_at ?? randSavedAt(postedAt)
  };
};

// ----- build posts -----------------------------------------------------------

const posts = [];

// 12 short
for (const body of SHORT_POSTS) {
  posts.push(makePost({ post_text: body }));
}
// 7 medium
for (const body of MEDIUM_POSTS) {
  posts.push(makePost({ post_text: body }));
}
// 3 long
for (const body of LONG_POSTS) {
  posts.push(makePost({ post_text: body, like_count: randInt(80, 500) }));
}

// OP self-reply chain (1 thread of 4)
{
  const threadHandle = HANDLES[0];
  const rootId = nextPostId();
  const rootPostedAt = NOW - 1000 * 60 * 60 * 24 * 12; // 12 days ago
  const rootSavedAt = rootPostedAt + 1000 * 60 * 30; // saved 30 min later
  let prevId = rootId;
  let prevPostedAt = rootPostedAt;
  posts.push(
    makePost({
      handle: threadHandle,
      x_post_id: rootId,
      post_text: THREAD_POSTS[0],
      posted_at: rootPostedAt,
      saved_at: rootSavedAt,
      thread_root_id: null,
      in_reply_to_post_id: null,
      reply_count: 8,
      repost_count: 4,
      like_count: 64
    })
  );
  for (let i = 1; i < THREAD_POSTS.length; i += 1) {
    const childId = nextPostId();
    prevPostedAt += 1000 * 60 * randInt(2, 8); // 2-8 min later
    posts.push(
      makePost({
        handle: threadHandle,
        x_post_id: childId,
        post_text: THREAD_POSTS[i],
        posted_at: prevPostedAt,
        saved_at: prevPostedAt + 1000 * 60 * 25,
        thread_root_id: rootId,
        in_reply_to_post_id: prevId,
        reply_count: skewedCount(5),
        repost_count: skewedCount(3),
        like_count: skewedCount(40)
      })
    );
    prevId = childId;
  }
}

// shuffle stand-alone posts so authors interleave on the timeline
const standalone = posts.filter((p) => p.thread_root_id === null && p.in_reply_to_post_id === null);
const threadPosts = posts.filter((p) => p.thread_root_id !== null || (p.in_reply_to_post_id !== null && p.x_post_id !== null));
// (threadPosts captured above kept in their original order; standalone shuffled)
for (let i = standalone.length - 1; i > 0; i -= 1) {
  const j = Math.floor(Math.random() * (i + 1));
  [standalone[i], standalone[j]] = [standalone[j], standalone[i]];
}
const orderedPosts = [...standalone, ...threadPosts];

// ----- build manifest --------------------------------------------------------

const manifest = {
  format: "x-post-archive-backup",
  version: 2,
  exported_at: NOW,
  data: {
    posts: orderedPosts,
    media: [],
    tags: [],
    tag_redirects: [],
    post_tags: [],
    files: []
  }
};

// ----- write zip -------------------------------------------------------------

const zipBlobWriter = new BlobWriter("application/zip");
const zipWriter = new ZipWriter(zipBlobWriter);
await zipWriter.add(
  "manifest.json",
  new TextReader(JSON.stringify(manifest, null, 2))
);
const zipBlob = await zipWriter.close();
const zipBytes = Buffer.from(await zipBlob.arrayBuffer());

await mkdir("samples", { recursive: true });
await writeFile("samples/demo-archive-backup.zip", zipBytes);

console.log(
  `wrote samples/demo-archive-backup.zip (${zipBytes.byteLength} bytes, ${orderedPosts.length} posts)`
);
