
const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL";
const SUPABASE_KEY = "PASTE_YOUR_PUBLISHABLE_KEY";

const statusText = document.getElementById("connectionStatus");
const postsContainer = document.getElementById("posts");
const postForm = document.getElementById("postForm");
const postText = document.getElementById("postText");
const postButton = document.getElementById("postButton");
const postStatus = document.getElementById("postStatus");
const charCount = document.getElementById("charCount");

const profileName = document.getElementById("profileName");
const profileHandle = document.getElementById("profileHandle");
const settingsDialog = document.getElementById("settingsDialog");
const usernameInput = document.getElementById("usernameInput");

let username = localStorage.getItem("larp_username") || "Penguin";
const seenPosts = new Set();
let supabase;
let channel;
let isReady = false;

function setUsername(name) {
  username = name.trim().slice(0, 20) || "Penguin";
  localStorage.setItem("larp_username", username);

  profileName.textContent = username;
  profileHandle.textContent = username.toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20) || "penguin";
}

setUsername(username);

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderPost(post, prepend = false) {
  if (!post || !post.id || seenPosts.has(String(post.id))) return;

  seenPosts.add(String(post.id));

  const article = document.createElement("article");
  article.className = "post";

  const head = document.createElement("div");
  head.className = "post-head";

  const name = document.createElement("strong");
  name.className = "post-name";
  name.textContent = post.username;

  const handle = document.createElement("span");
  handle.className = "post-handle";
  handle.textContent = "@" + post.username.toLowerCase()
    .replace(/[^a-z0-9_]/g, "").slice(0, 20);

  const time = document.createElement("span");
  time.className = "post-time";
  time.textContent = "· " + formatTime(post.created_at);

  const body = document.createElement("div");
  body.className = "post-body";
  body.textContent = post.body;

  head.append(name, handle, time);
  article.append(head, body);

  const empty = postsContainer.querySelector(".empty");
  if (empty) empty.remove();

  if (prepend) {
    postsContainer.prepend(article);
  } else {
    postsContainer.append(article);
  }

  // Keep the timeline from growing endlessly.
  while (postsContainer.children.length > 100) {
    const last = postsContainer.lastElementChild;
    if (!last) break;
    seenPosts.delete(last.dataset?.postId);
    last.remove();
  }
  article.dataset.postId = String(post.id);
}

async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, username, body, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  postsContainer.replaceChildren();
  seenPosts.clear();

  if (!data || data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No tweets yet. Be the first to post!";
    postsContainer.append(empty);
    return;
  }

  for (const post of data) {
    renderPost(post);
  }
}

async function startLarpwitter() {
  if (
    !SUPABASE_URL.startsWith("https://") ||
    SUPABASE_KEY.startsWith("PASTE_")
  ) {
    statusText.textContent = "Setup needed";
    postsContainer.replaceChildren();

    const info = document.createElement("div");
    info.className = "empty";
    info.textContent =
      "Add your Supabase project URL and publishable key in script.js.";
    postsContainer.append(info);
    return;
  }

  try {
    supabase = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    await loadPosts();

    channel = supabase
      .channel("larpw itter-live-timeline")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts"
        },
        payload => {
          renderPost(payload.new, true);
        }
      )
      .subscribe(state => {
        if (state === "SUBSCRIBED") {
          isReady = true;
          statusText.textContent = "Live";
          postButton.disabled = false;
        } else if (
          state === "CHANNEL_ERROR" ||
          state === "TIMED_OUT" ||
          state === "CLOSED"
        ) {
          isReady = false;
          statusText.textContent = "Reconnecting...";
          postButton.disabled = true;
        }
      });
  } catch (error) {
    console.error("Larpwitter error:", error);
    statusText.textContent = "Connection failed";
    postStatus.textContent =
      "Couldn't connect. Check your Supabase setup and refresh.";
  }
}

postButton.disabled = true;

postText.addEventListener("input", () => {
  charCount.textContent = 140 - postText.value.length;
});

postForm.addEventListener("submit", async event => {
  event.preventDefault();

  const body = postText.value.trim();
  if (!body || !isReady) return;

  postButton.disabled = true;
  postStatus.textContent = "Posting...";

  try {
    const { error } = await supabase
      .from("posts")
      .insert({
        username: username,
        body: body
      });

    if (error) throw error;

    postText.value = "";
    charCount.textContent = "140";
    postStatus.textContent = "Tweet posted!";
  } catch (error) {
    console.error("Post error:", error);
    postStatus.textContent =
      "Couldn't post. Please try again.";
  } finally {
    postButton.disabled = !isReady;
  }
});

document.querySelectorAll('a[href="#settings"]').forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    usernameInput.value = username;
    settingsDialog.showModal();
  });
});

document.getElementById("cancelSettings").addEventListener("click", () => {
  settingsDialog.close();
});

document.getElementById("settingsForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = usernameInput.value.trim();
  if (!name) return;

  setUsername(name);
  settingsDialog.close();
});

document.querySelectorAll('a[href="#profile"]').forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

startLarpwitter();
