/**
 * Dev-only seed: 20 flavored users, three groups with chat history, friend
 * requests, follows, public works with reviews and saves, presence, and
 * notifications — wired around the existing demo accounts
 * (test@example.com and chris@example.com) so signing in as either shows
 * the full experience.
 *
 * Idempotent: seeded rows key off fixed emails/names and are skipped when
 * they already exist. Never run against production.
 *
 *   DATABASE_URL=postgresql://... node scripts/seed-dev.mjs
 */

import pg from "pg";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
if (/railway|rlwy\.net|storageapi/.test(DATABASE_URL)) {
  throw new Error("This looks like a production database — refusing to seed.");
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const id = () => randomUUID();
const now = Date.now();
const minutes = (n) => new Date(now - n * 60_000);
const hours = (n) => new Date(now - n * 3_600_000);
const days = (n) => new Date(now - n * 86_400_000);

const PASSWORD = "vellum-demo-123!";
const passwordHash = await hashPassword(PASSWORD);

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const PEOPLE = [
  ["Rowan Blackwood", "rowan", "Chronicler of the northern campaigns. DM for 12 years.", 1],
  ["Maeve Thornwick", "maeve", "I write the villains everyone loves to hate.", 3],
  ["Cassian Vale", "cassian", "Audiobook narrator. Voice of a dozen dead kings.", 8],
  ["Isolde Fenn", "isolde", "Cartographer of imaginary places.", 25],
  ["Bram Holloway", "bram", "Tavern keeper of the Dragonfeast. Ask about the stew.", 50],
  ["Lyra Ashgrove", "lyra", "Elven chronicles, mostly. Some sad poetry.", 2],
  ["Edmund Grave", "edmund", "Horror one-shots and haunted dungeons.", 90],
  ["Seraphine Dusk", "seraphine", "Warlock main. My patron makes me write these.", 15],
  ["Finnian Moss", "finn", "Halfling cook, part-time adventurer, full-time journal keeper.", 300],
  ["Odette Marsh", "odette", "Swamp witch aesthetics, cottagecore heart.", 45],
  ["Percival Crane", "percy", "Paladin oaths taken very, very seriously.", 200],
  ["Wren Nightingale", "wren", "Bard college dropout. The songs were too powerful.", 5],
  ["Gideon Frost", "gideon", "Ice mage theorycrafter and reluctant party leader.", 600],
  ["Thessaly Reed", "thessaly", "I archive campaign journals from tables that ended.", 30],
  ["Caspian Mourne", "caspian", "Sea shanties and saltwater tragedy.", 120],
  ["Elowen Bright", "elowen", "New here! Binding my first campaign journal.", 10],
  ["Dorian Vex", "dorian", "Artificer builds nobody asked for.", 400],
  ["Sabine Larke", "sabine", "Reading everything tagged mystery. Everything.", 20],
  ["Osric Pale", "osric", "Necromancy apologist (fictional contexts only).", 700],
  ["Juniper Hale", "juniper", "Cozy campaigns and long rests.", 60],
];

async function ensureUser(name, username, bio, lastSeenMinutesAgo, createdDaysAgo) {
  const email = `${username}@vellum.demo`;
  const existing = await client.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;
  const uid = id();
  await client.query(
    `INSERT INTO "user" (id, name, email, email_verified, username, bio, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $7)`,
    [uid, name, email, username, bio, minutes(lastSeenMinutesAgo), days(createdDaysAgo)]
  );
  await client.query(
    `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
     VALUES ($1, $2, 'credential', $2, $3, now(), now())`,
    [id(), uid, passwordHash]
  );
  return uid;
}

const demoRow = await client.query(
  `SELECT id FROM "user" WHERE email = 'test@example.com'`
);
const chrisRow = await client.query(
  `SELECT id FROM "user" WHERE email = 'chris@example.com'`
);
const demo = demoRow.rows[0]?.id;
const chris = chrisRow.rows[0]?.id;
if (!demo || !chris) {
  throw new Error("Expected test@example.com and chris@example.com to exist.");
}

const uids = {};
for (let i = 0; i < PEOPLE.length; i++) {
  const [name, username, bio, lastSeen] = PEOPLE[i];
  uids[username] = await ensureUser(name, username, bio, lastSeen, 7 + i * 3);
}
console.log(`users: ${PEOPLE.length} ensured (password: ${PASSWORD})`);

// ---------------------------------------------------------------------------
// Friendships & follows
// ---------------------------------------------------------------------------

async function friendship(a, b, status, daysAgo) {
  await client.query(
    `INSERT INTO friendships (id, requester_id, addressee_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [id(), a, b, status, days(daysAgo)]
  );
}
async function follow(follower, following, daysAgo) {
  await client.query(
    `INSERT INTO follows (follower_id, following_id, created_at)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [follower, following, days(daysAgo)]
  );
}

await friendship(chris, demo, "accepted", 30);
for (const u of ["rowan", "maeve", "cassian", "lyra", "seraphine", "wren"]) {
  await friendship(uids[u], demo, "accepted", 5 + Math.floor(Math.random() * 20));
}
for (const u of ["bram", "isolde", "odette", "sabine"]) {
  await friendship(uids[u], chris, "accepted", 5 + Math.floor(Math.random() * 20));
}
// Two incoming requests waiting on the demo account.
await friendship(uids["elowen"], demo, "pending", 1);
await friendship(uids["thessaly"], demo, "pending", 2);

for (const u of ["rowan", "maeve", "lyra", "wren", "juniper", "sabine", "finn", "percy"]) {
  await follow(uids[u], demo, 3 + Math.floor(Math.random() * 30));
}
for (const u of ["bram", "edmund", "gideon", "dorian"]) {
  await follow(uids[u], chris, 3 + Math.floor(Math.random() * 30));
}
await follow(demo, uids["rowan"], 12);
await follow(demo, uids["maeve"], 9);
await follow(chris, uids["cassian"], 7);
console.log("friendships + follows seeded");

// ---------------------------------------------------------------------------
// Groups, channels, ranks, members, messages
// ---------------------------------------------------------------------------

async function ensureGroup({ name, ownerId, icon, description, welcome, channels }) {
  const existing = await client.query(`SELECT id FROM groups WHERE name = $1`, [name]);
  if (existing.rows[0]) {
    const gid = existing.rows[0].id;
    const chans = await client.query(
      `SELECT id, name FROM group_channels WHERE group_id = $1 ORDER BY sort_index`,
      [gid]
    );
    return { gid, channelIds: Object.fromEntries(chans.rows.map((c) => [c.name, c.id])), fresh: false };
  }
  const gid = id();
  await client.query(
    `INSERT INTO groups (id, owner_id, name, description, icon, visibility, welcome_message, created_at)
     VALUES ($1, $2, $3, $4, $5, 'public', $6, $7)`,
    [gid, ownerId, name, description, icon, welcome, days(40)]
  );
  const channelIds = {};
  for (let i = 0; i < channels.length; i++) {
    const cid = id();
    channelIds[channels[i]] = cid;
    await client.query(
      `INSERT INTO group_channels (id, group_id, name, sort_index, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [cid, gid, channels[i], i, days(40)]
    );
  }
  return { gid, channelIds, fresh: true };
}

async function member(gid, userId, role, rankId = null) {
  await client.query(
    `INSERT INTO group_members (group_id, user_id, role, rank_id, created_at)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [gid, userId, role, rankId, days(35)]
  );
}

async function say(channelId, userId, body, at) {
  await client.query(
    `INSERT INTO group_messages (id, channel_id, user_id, body, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id(), channelId, userId, body, at]
  );
}

const athenaeum = await ensureGroup({
  name: "The Midnight Athenaeum",
  ownerId: demo,
  icon: "📚",
  description: "A reading circle for campaign journals and long-form lore.",
  welcome: "Welcome to the Athenaeum. Shelve your tomes, keep your voice low, and spoil nothing without a flag.",
  channels: ["general", "book-club", "night-owls"],
});
const tavern = await ensureGroup({
  name: "Dragonfeast Tavern",
  ownerId: uids["bram"],
  icon: "🐉",
  description: "Loud tables, hot stew, and session recaps from every corner of the realm.",
  welcome: "Pull up a chair. First bowl of stew is free if you post a session recap.",
  channels: ["tavern-hall", "quest-board"],
});
const scribes = await ensureGroup({
  name: "Scribes of the Silver Quill",
  ownerId: uids["isolde"],
  icon: "✒️",
  description: "Critique circle for works in progress. Be kind, be specific.",
  welcome: "Post a draft in #drafts, leave two critiques for every one you receive.",
  channels: ["critiques", "drafts"],
});

if (athenaeum.fresh) {
  const archivist = id();
  const lorekeeper = id();
  await client.query(
    `INSERT INTO group_ranks (id, group_id, name, color, sort_index) VALUES
     ($1, $3, 'Archivist', '#e0be6a', 0), ($2, $3, 'Lorekeeper', '#a78bfa', 1)`,
    [archivist, lorekeeper, athenaeum.gid]
  );
  await member(athenaeum.gid, demo, "owner", archivist);
  await member(athenaeum.gid, chris, "admin", lorekeeper);
  for (const u of ["rowan", "maeve", "cassian", "lyra", "seraphine", "wren", "sabine", "thessaly", "juniper", "edmund"]) {
    await member(athenaeum.gid, uids[u], "member", u === "rowan" ? lorekeeper : null);
  }
}
if (tavern.fresh) {
  await member(tavern.gid, uids["bram"], "owner");
  await member(tavern.gid, demo, "member");
  await member(tavern.gid, chris, "member");
  for (const u of ["finn", "percy", "gideon", "dorian", "caspian", "odette", "rowan", "elowen"]) {
    await member(tavern.gid, uids[u], "member");
  }
}
if (scribes.fresh) {
  await member(scribes.gid, uids["isolde"], "owner");
  await member(scribes.gid, demo, "member");
  for (const u of ["maeve", "lyra", "wren", "osric", "elowen", "sabine"]) {
    await member(scribes.gid, uids[u], "member");
  }
}

if (athenaeum.fresh) {
  const c = athenaeum.channelIds;
  const t0 = 60 * 26; // minutes ago, walking forward
  const talk = [
    ["rowan", "Finished the third volume of the Ashen March last night. The siege chapter is brutal."],
    ["maeve", "Brutal how? Spoil it in #book-club, not here."],
    ["rowan", "Fine, fine. Flagging it over there."],
    ["cassian", "Recording the audio edition this month — any pronunciation rulings on 'Vhaeloth'?"],
    ["lyra", "VAY-loth. The author confirmed it in the margins of volume two."],
    ["cassian", "Blessed. Thank you."],
    ["wren", "New here — @testauthor this place is exactly what I needed, thanks for the invite."],
    ["sabine", "Has anyone shelved anything decent tagged mystery lately? My list ran dry."],
    ["thessaly", "The Hollow Lighthouse. It's short but it sticks to your ribs."],
    ["juniper", "Seconding the Lighthouse. Read it with tea."],
    ["seraphine", "My patron says hello and also that the book-club pick is overdue."],
    ["chris", "Book-club pick goes up Friday. Nominations close tomorrow night."],
    ["maeve", "Nominating the Ashen March so Rowan finally has someone to talk to."],
    ["rowan", "I heard that."],
    ["edmund", "Nominating something with at least one ghost, as is tradition."],
    ["demo", "Noted, all three nominations in. Poll goes up in #book-club tomorrow."],
    ["wren", "🗳️ ready"],
    ["lyra", "Same. Also @chris the night-owls channel icon is perfect."],
    ["chris", "It found me. I take no credit."],
    ["cassian", "Last call from me — pressing record on chapter one at midnight."],
  ];
  for (let i = 0; i < talk.length; i++) {
    const [who, body] = talk[i];
    const userId = who === "demo" ? demo : who === "chris" ? chris : uids[who];
    await say(c["general"], userId, body, minutes(t0 - i * 67));
  }
  const bookClub = [
    ["rowan", "SPOILERS from here down for the Ashen March vol. 3."],
    ["rowan", "The siege chapter: they lose the wall because the sapper was the innkeeper the whole time. I yelled."],
    ["maeve", "I clocked the innkeeper in vol. 1 and nobody believed me. Vindication."],
    ["thessaly", "The margin notes in my copy just say 'oh no. oh NO.' in shakier and shakier handwriting."],
    ["demo", "Poll for next month's pick is open — vote by Sunday."],
    ["juniper", "Voted. Team Lighthouse."],
  ];
  for (let i = 0; i < bookClub.length; i++) {
    const [who, body] = bookClub[i];
    const userId = who === "demo" ? demo : uids[who];
    await say(c["book-club"], userId, body, minutes(60 * 9 - i * 41));
  }
  const owls = [
    ["seraphine", "who's up. it's reading hours."],
    ["edmund", "Always. Halfway through a haunted-dungeon one-shot that's actually scary."],
    ["wren", "up, regrettably. the songs demanded it"],
    ["seraphine", "@testauthor your last chapter kept me up past three. compliment and complaint."],
    ["demo", "That's the nicest complaint I've had all month."],
  ];
  for (let i = 0; i < owls.length; i++) {
    const [who, body] = owls[i];
    const userId = who === "demo" ? demo : uids[who];
    await say(c["night-owls"], userId, body, minutes(60 * 3 - i * 23));
  }
}

if (tavern.fresh) {
  const c = tavern.channelIds;
  const hall = [
    ["bram", "STEW'S ON. Post your session recaps, heroes."],
    ["percy", "We negotiated with the dragon. Lawfully. I have never been prouder of this table."],
    ["gideon", "We did NOT negotiate. We paid protection money with extra steps."],
    ["percy", "Lawful protection money."],
    ["finn", "Our rogue stole a door. Not what was behind it. The door."],
    ["dorian", "In the rogue's defense, it was a very well-made door. I've since improved it."],
    ["caspian", "Ran a sea-cursed one-shot — half the table is still humming the shanty."],
    ["odette", "My swamp coven adopted the party's warlock. He seems fine with it."],
    ["elowen", "First session EVER last night. I rolled a 1 on my first attack and I'm still thinking about it."],
    ["bram", "That's the tavern initiation, @elowen. First stew's yours."],
    ["chris", "@testauthor the door story needs to be a journal entry. I'll review it five stars, blind."],
    ["demo", "Already drafting it. Working title: 'Unhinged.'"],
    ["finn", "I hate how good that is."],
    ["rowan", "Quest board's getting stale — who's posting next?"],
    ["gideon", "On it tonight. Bring a party that reads the brief this time."],
  ];
  for (let i = 0; i < hall.length; i++) {
    const [who, body] = hall[i];
    const userId = who === "demo" ? demo : who === "chris" ? chris : uids[who];
    await say(c["tavern-hall"], userId, body, minutes(60 * 14 - i * 53));
  }
  const quests = [
    ["gideon", "QUEST: The Frostgate seals are failing. Need 4-6 heroes, level 5-ish, Saturday evening."],
    ["percy", "Sword and oath, reporting in."],
    ["finn", "I'll bring snacks and a suspiciously good knife."],
    ["elowen", "Can a level-1 tag along if she promises not to roll a 1?"],
    ["gideon", "No promises required. Welcome aboard."],
  ];
  for (let i = 0; i < quests.length; i++) {
    await say(c["quest-board"], uids[quests[i][0]] ?? demo, quests[i][1], minutes(60 * 5 - i * 31));
  }
}

if (scribes.fresh) {
  const c = scribes.channelIds;
  const crit = [
    ["isolde", "Reminder: two critiques per draft you post. The quill keeps score."],
    ["maeve", "Left notes on Lyra's chapter — the ending lands, the middle wanders."],
    ["lyra", "Fair. The middle wandered off and I followed it."],
    ["osric", "Requesting eyes on my necromancer's redemption arc. It's tasteful, I swear."],
    ["sabine", "On it. If it's not tasteful I'm saying so in bold."],
    ["demo", "Posting the door heist chapter to #drafts tonight — be merciless."],
    ["wren", "Merciless AND musical. I critique in verse now."],
  ];
  for (let i = 0; i < crit.length; i++) {
    const [who, body] = crit[i];
    const userId = who === "demo" ? demo : uids[who];
    await say(c["critiques"], userId, body, minutes(60 * 20 - i * 71));
  }
}
console.log("groups + chat history seeded");

// ---------------------------------------------------------------------------
// Works, content, tags, reviews, saves, reading activity
// ---------------------------------------------------------------------------

const WORKS = [
  ["rowan", "The Ashen March: Volume III", "the-ashen-march-iii", "The siege of Coldbarrow, told from the wall. A campaign journal that reads like a war memoir.", ["fantasy", "campaign journal"], "ancient-tome"],
  ["maeve", "A Taxonomy of Villains", "a-taxonomy-of-villains", "Every antagonist I have ever run, classified by what they wanted and what it cost.", ["fantasy", "drama"], "witch-grimoire"],
  ["edmund", "The Hollow Lighthouse", "the-hollow-lighthouse", "A one-shot horror journal. The light still turns. Nobody tends it.", ["horror", "mystery"], "witch-grimoire"],
  ["lyra", "Leaves of the Elder Court", "leaves-of-the-elder-court", "Elven chronicles gathered over three campaigns, with the sad poetry left in.", ["fantasy"], "elven-chronicle"],
  ["caspian", "Saltwater Ledger", "saltwater-ledger", "A captain's log of the voyage that should not have returned.", ["adventure"], "captains-log"],
  ["thessaly", "Tables That Ended", "tables-that-ended", "An archive of final sessions — how twelve campaigns chose to say goodbye.", ["campaign journal", "drama"], "ancient-tome"],
  ["odette", "The Bog Witch's Almanac", "the-bog-witchs-almanac", "Recipes, hexes, and gentle advice from the wetlands.", ["fantasy", "comedy"], "witch-grimoire"],
  ["finn", "Second Breakfast, Third Dungeon", "second-breakfast-third-dungeon", "A halfling's culinary campaign journal. Every dungeon rated by its pantry.", ["comedy", "adventure"], "ancient-tome"],
];

const workIds = {};
for (const [owner, title, slug, description, tagNames, theme] of WORKS) {
  const existing = await client.query(`SELECT id FROM journals WHERE slug = $1`, [slug]);
  if (existing.rows[0]) {
    workIds[slug] = existing.rows[0].id;
    continue;
  }
  const jid = id();
  workIds[slug] = jid;
  await client.query(
    `INSERT INTO journals (id, owner_id, title, description, author, slug, theme, source_type, visibility, listed, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'write', 'public', true, $8)`,
    [jid, uids[owner], title, description, PEOPLE.find((p) => p[1] === owner)[0], slug, theme, days(10 + Math.floor(Math.random() * 50))]
  );
  const html = `<h1>${title}</h1><p>${description}</p><p>The first entry begins, as these things always do, with someone rolling initiative at the worst possible moment. What follows is the honest record — the victories, the retreats, and the arguments about rations.</p><p>Further chapters were bound by hand and are being transcribed as the ink allows.</p>`;
  await client.query(
    `INSERT INTO journal_content (journal_id, html, plain_length, updated_at)
     VALUES ($1, $2, $3, now())`,
    [jid, html, html.replace(/<[^>]+>/g, "").length]
  );
  for (const tagName of tagNames) {
    let tag = await client.query(`SELECT id FROM tags WHERE name = $1`, [tagName]);
    if (!tag.rows[0]) {
      tag = await client.query(
        `INSERT INTO tags (id, name) VALUES ($1, $2) RETURNING id`,
        [id(), tagName]
      );
    }
    await client.query(
      `INSERT INTO journal_tags (journal_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [jid, tag.rows[0].id]
    );
  }
}

const REVIEW_BODIES = [
  [5, "Read it in one sitting. The margin notes alone are worth the shelf space."],
  [4, "Strong throughout — a couple of chapters wander, but the landing is clean."],
  [5, "This is the standard other campaign journals should be judged against."],
  [3, "Good bones, uneven pacing. I'll still read the next volume."],
  [4, "The table talk feels real in the best way. You can hear the dice."],
  [5, "I did not expect to feel feelings about a door. Here we are."],
];
const reviewerPool = ["rowan", "maeve", "cassian", "isolde", "bram", "lyra", "edmund", "seraphine", "finn", "odette", "percy", "wren", "sabine", "juniper", "gideon"];
let reviewCount = 0;
for (const [owner, , slug] of WORKS.map((w) => [w[0], w[1], w[2]])) {
  const jid = workIds[slug];
  const reviewers = reviewerPool.filter((r) => r !== owner).slice(0, 3 + (reviewCount % 3));
  for (let i = 0; i < reviewers.length; i++) {
    const [rating, body] = REVIEW_BODIES[(reviewCount + i) % REVIEW_BODIES.length];
    await client.query(
      `INSERT INTO reviews (id, user_id, kind, item_id, rating, body, created_at, updated_at)
       VALUES ($1, $2, 'journal', $3, $4, $5, $6, $6)
       ON CONFLICT DO NOTHING`,
      [id(), uids[reviewers[i]], jid, rating, body, days(1 + ((reviewCount + i) % 20))]
    );
  }
  reviewCount++;
}
// The demo accounts have opinions too.
await client.query(
  `INSERT INTO reviews (id, user_id, kind, item_id, rating, body, created_at, updated_at)
   VALUES ($1, $2, 'journal', $3, 5, 'The lighthouse chapter cost me a night of sleep. Worth it.', $4, $4)
   ON CONFLICT DO NOTHING`,
  [id(), demo, workIds["the-hollow-lighthouse"], days(3)]
);
await client.query(
  `INSERT INTO reviews (id, user_id, kind, item_id, rating, body, created_at, updated_at)
   VALUES ($1, $2, 'journal', $3, 4, 'Rated four stars only because my stew was cold by the time I stopped reading.', $4, $4)
   ON CONFLICT DO NOTHING`,
  [id(), chris, workIds["second-breakfast-third-dungeon"], days(5)]
);

async function save(userId, slug, icon, daysAgo) {
  await client.query(
    `INSERT INTO saved_items (user_id, kind, item_id, icon, created_at)
     VALUES ($1, 'journal', $2, $3, $4) ON CONFLICT DO NOTHING`,
    [userId, workIds[slug], icon, days(daysAgo)]
  );
}
await save(demo, "the-ashen-march-iii", "🏰", 8);
await save(demo, "the-hollow-lighthouse", "🕯️", 3);
await save(demo, "the-bog-witchs-almanac", "🐸", 6);
await save(chris, "second-breakfast-third-dungeon", "🍳", 5);
await save(chris, "saltwater-ledger", "⚓", 9);
for (const [i, u] of ["wren", "sabine", "juniper", "percy", "gideon", "elowen"].entries()) {
  await save(uids[u], WORKS[i % WORKS.length][2], null, 2 + i);
}

async function reading(userId, slug, mode, minutesAgo) {
  await client.query(
    `INSERT INTO reading_activity (user_id, kind, item_id, mode, updated_at)
     VALUES ($1, 'journal', $2, $3, $4)
     ON CONFLICT (user_id, kind, item_id) DO UPDATE SET updated_at = $4, mode = $3`,
    [userId, workIds[slug], mode, minutes(minutesAgo)]
  );
}
await reading(uids["rowan"], "a-taxonomy-of-villains", "read", 1);
await reading(uids["maeve"], "the-hollow-lighthouse", "read", 4);
await reading(uids["lyra"], "the-ashen-march-iii", "read", 2);
await reading(uids["wren"], "saltwater-ledger", "read", 8);
await reading(uids["seraphine"], "the-bog-witchs-almanac", "read", 12);
await reading(demo, "the-hollow-lighthouse", "read", 30);
console.log(`works: ${WORKS.length} seeded with content, tags, reviews, saves`);

// ---------------------------------------------------------------------------
// Notifications for the demo accounts
// ---------------------------------------------------------------------------

async function notifyRow(userId, type, actorId, kind, itemId, minutesAgo) {
  await client.query(
    `INSERT INTO notifications (id, user_id, type, actor_id, kind, item_id, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
    [id(), userId, type, actorId, kind, itemId, minutes(minutesAgo)]
  );
}
const demoNotifs = await client.query(
  `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`,
  [demo]
);
if (demoNotifs.rows[0].n < 5) {
  await notifyRow(demo, "friend_request", uids["elowen"], null, null, 60 * 24);
  await notifyRow(demo, "friend_request", uids["thessaly"], null, null, 60 * 48);
  await notifyRow(demo, "new_follower", uids["juniper"], null, null, 60 * 30);
  await notifyRow(demo, "new_follower", uids["percy"], null, null, 60 * 52);
  await notifyRow(demo, "mention", uids["wren"], "group", athenaeum.gid, 60 * 20);
  await notifyRow(demo, "mention", uids["seraphine"], "group", athenaeum.gid, 60 * 2);
  await notifyRow(demo, "mention", chris, "group", tavern.gid, 60 * 13);
  await notifyRow(demo, "review", uids["cassian"], "journal", workIds["the-ashen-march-iii"], 60 * 6);
  await notifyRow(chris, "mention", uids["lyra"], "group", athenaeum.gid, 60 * 22);
  await notifyRow(chris, "new_follower", uids["gideon"], null, null, 60 * 40);
}

console.log("notifications seeded");
await client.end();
console.log("Done — sign in as test@example.com or chris@example.com to see it all.");
