(() => {
  const STORAGE_KEY = "studyflow_orbit_state_v1";

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const moodEmojis = {
    rough: "😣",
    okay: "🙂",
    good: "😄",
    great: "🤩"
  };

  const defaultState = {
    theme: "dark",
    currentPage: "dashboard",
    currentDay: 0,
    syncMode: "cloud",
    profileSet: false,
    profileName: "Student",
    sparks: 84,
    streak: 12,
    selectedMood: "good",
    tasks: {
      Monday: [
        { id: 1, title: "Morning math problem drill", start: "5:45 AM", end: "6:45 AM", tag: "Study", subject: "Math", note: "Coordinate geometry + mixed questions", done: true },
        { id: 2, title: "School hours", start: "8:30 AM", end: "4:00 PM", tag: "School", subject: "General", note: "Classes and review notes in free periods", done: true },
        { id: 3, title: "Workout / calisthenics", start: "5:00 PM", end: "5:40 PM", tag: "Fitness", subject: "General", note: "Push, pull, mobility", done: false },
        { id: 4, title: "Science revision", start: "6:00 PM", end: "7:15 PM", tag: "Study", subject: "Science", note: "Light, pressure, formulas", done: false },
        { id: 5, title: "English + notes cleanup", start: "8:00 PM", end: "8:40 PM", tag: "Notes", subject: "English", note: "Grammar and neat notes", done: false }
      ],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    },
    notes: [
      { id: 101, title: "Newton's laws summary", tag: "Science", body: "1st law: inertia\n2nd law: F=ma\n3rd law: action-reaction", createdAt: Date.now() - 86400000 },
      { id: 102, title: "Math formula list", tag: "Math", body: "Distance formula, midpoint formula, area of triangle", createdAt: Date.now() - 43200000 }
    ],
    exam: {
      name: "Physics Final",
      date: "",
      topics: [
        { id: 201, text: "Units and measurements", done: false },
        { id: 202, text: "Force and laws of motion", done: false },
        { id: 203, text: "Work, energy and power", done: false }
      ]
    },
    focus: {
      mode: "focus",
      secondsLeft: 25 * 60,
      running: false,
      sessionsToday: 0,
      totalMinutes: 0
    },
    reviews: [],
    chat: [
      { role: "ai", text: "Hi! I can help you plan study blocks, improve your timetable, and brainstorm a better daily routine." }
    ]
  };

  const state = loadState();
  let timerInterval = null;
  let activeChatTyping = false;
  let lineChart, doughnutChart, growthLineChart, growthDoughnutChart, growthBarChart, growthRadarChart;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(defaultState);
      return { ...clone(defaultState), ...JSON.parse(raw) };
    } catch {
      return clone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateSyncIndicator(true);
  }

  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function updateSyncIndicator(saved = false) {
    const dot = document.getElementById("syncDot");
    const label = document.getElementById("syncLabel");
    if (!dot || !label) return;
    dot.classList.toggle("busy", state.syncMode !== "cloud");
    label.textContent = state.syncMode === "cloud" ? "Cloud synced" : "Local only";
    if (!saved) {
      dot.classList.add("busy");
      label.textContent = state.syncMode === "cloud" ? "Syncing…" : "Local only";
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    saveState();
    renderCharts();
  }

  function setPage(page) {
    state.currentPage = page;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(`page-${page}`)?.classList.add("active");
    document.querySelectorAll(".nav-btn[data-page]").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
    const titleMap = {
      dashboard: ["Your smart daily cockpit", "A timetable, progress tracking, charts, and a real AI study coach, saved to your account."],
      timetable: ["Timetable planner", "Plan each day of the week. Changes save locally and are ready for cloud sync."],
      charts: ["Growth charts", "Built from your real activity log, not sample data."],
      ai: ["AI Studio", "Chat about study strategy, scheduling, or motivation. History saves automatically."],
      notes: ["Notes hub", "Quick notes and revision summaries, searchable and saved locally."],
      exam: ["Exam sprint", "Set your exam date, track the countdown, and check off your syllabus."],
      focus: ["Focus room", "A Pomodoro-style timer. Completed sessions log automatically and earn sparks."],
      night: ["Night review", "A two-minute end-of-day reflection. Saved to your history below."]
    };
    const [t, s] = titleMap[page] || titleMap.dashboard;
    document.getElementById("topbarTitle").textContent = t;
    document.getElementById("topbarSubtitle").textContent = s;
    saveState();
    renderAll();
  }

  function setDay(index) {
    state.currentDay = index;
    renderTimetable();
    renderDashboard();
    saveState();
  }

  function currentDayName() {
    return days[state.currentDay];
  }

  function getDayTasks(dayIndex = state.currentDay) {
    return state.tasks[days[dayIndex]] || [];
  }

  function setDayTasks(dayIndex, tasks) {
    state.tasks[days[dayIndex]] = tasks;
  }

  function allTasksFlat() {
    return days.flatMap(d => (state.tasks[d] || []).map(t => ({ ...t, day: d })));
  }

  function renderDayTabs() {
    const wrap = document.getElementById("dayTabs");
    if (!wrap) return;
    wrap.innerHTML = "";
    days.forEach((day, i) => {
      const count = getDayTasks(i).length;
      const btn = document.createElement("button");
      btn.className = `day-tab ${i === state.currentDay ? "active" : ""}`;
      btn.innerHTML = `${day} <span class="count">${count}</span>`;
      btn.onclick = () => setDay(i);
      wrap.appendChild(btn);
    });
  }

  function renderDashboard() {
    const tasks = getDayTasks();
    const dashTaskList = document.getElementById("dashTaskList");
    const todayChips = document.getElementById("todayChips");
    const todayBadge = document.getElementById("todayBadge");

    if (todayBadge) todayBadge.textContent = currentDayName();

    if (todayChips) {
      todayChips.innerHTML = "";
      const chips = [...new Set(tasks.map(t => t.tag))].slice(0, 6);
      chips.forEach(ch => {
        const s = document.createElement("span");
        s.className = "chip active";
        s.textContent = ch;
        todayChips.appendChild(s);
      });
      if (!chips.length) {
        const s = document.createElement("span");
        s.className = "chip";
        s.textContent = "No blocks yet";
        todayChips.appendChild(s);
      }
    }

    if (dashTaskList) {
      dashTaskList.innerHTML = "";
      if (!tasks.length) {
        dashTaskList.innerHTML = `<div class="empty-state"><div class="glyph">🌟</div><div>No blocks for ${currentDayName()} yet.</div></div>`;
      } else {
        tasks.slice(0, 5).forEach(task => dashTaskList.appendChild(taskCard(task, state.currentDay)));
      }
    }

    const doneCount = tasks.filter(t => t.done).length;
    const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
    document.getElementById("completionRate").textContent = `${completion}%`;
    document.getElementById("todayHours").textContent = `${(tasks.filter(t => t.tag === "Study" || t.tag === "School").length * 1.1).toFixed(1)} hrs`;
    document.getElementById("sparkCount").textContent = state.sparks;
    document.getElementById("streakCount").textContent = `${state.streak} days`;

    const studyTasks = tasks.filter(t => t.tag === "Study");
    document.getElementById("bestZone").textContent = studyTasks.length ? "Evening" : "Morning";
    document.getElementById("focusScore").textContent = `${Math.min(100, 60 + completion + state.streak)} / 100`;
  }

  function taskCard(task, dayIndex) {
    const wrap = document.createElement("div");
    wrap.className = "task-item";
    wrap.innerHTML = `
      <div class="task-left">
        <button class="check ${task.done ? "done" : ""}" aria-label="Toggle task">${task.done ? "✓" : ""}</button>
        <div>
          <h4>${escapeHtml(task.title)}</h4>
          <p>${escapeHtml(task.note || "")}</p>
          <div class="task-meta">
            <span>${task.start} - ${task.end}</span>
            <span>•</span>
            <span>${escapeHtml(task.tag)}</span>
            <span>•</span>
            <span>${escapeHtml(task.subject || "General")}</span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn edit-task" title="Edit">✏️</button>
        <button class="icon-btn delete-task" title="Delete">🗑️</button>
      </div>
    `;
    wrap.querySelector(".check").onclick = () => {
      task.done = !task.done;
      if (task.done) state.sparks += 3;
      saveState();
      renderAll();
    };
    wrap.querySelector(".edit-task").onclick = () => openTaskForm(task, dayIndex);
    wrap.querySelector(".delete-task").onclick = () => {
      setDayTasks(dayIndex, getDayTasks(dayIndex).filter(t => t.id !== task.id));
      state.sparks = Math.max(0, state.sparks - 1);
      saveState();
      renderAll();
      toast("Task deleted");
    };
    return wrap;
  }

  function renderTimetable() {
    renderDayTabs();
    const title = document.getElementById("dayTitle");
    const list = document.getElementById("timetableTaskList");
    if (title) title.textContent = currentDayName();

    if (!list) return;
    const tasks = getDayTasks();
    list.innerHTML = "";

    if (!tasks.length) {
      list.innerHTML = `<div class="empty-state"><div class="glyph">🗓️</div><div>No blocks yet for ${currentDayName()}.</div></div>`;
      return;
    }

    tasks.forEach(task => list.appendChild(taskCard(task, state.currentDay)));
  }

  function openTaskForm(task = null, dayIndex = state.currentDay) {
    const card = document.getElementById("taskFormCard");
    if (!card) return;
    card.classList.remove("hidden");
    card.dataset.editing = task ? String(task.id) : "";
    card.dataset.day = String(dayIndex);
    document.getElementById("taskTitle").value = task?.title || "";
    document.getElementById("taskStart").value = task?.start || "";
    document.getElementById("taskEnd").value = task?.end || "";
    document.getElementById("taskTag").value = task?.tag || "Study";
    document.getElementById("taskSubject").value = task?.subject || "General";
    document.getElementById("taskNote").value = task?.note || "";
  }

  function closeTaskForm() {
    const card = document.getElementById("taskFormCard");
    if (card) card.classList.add("hidden");
  }

  function saveTaskFromForm() {
    const card = document.getElementById("taskFormCard");
    const dayIndex = Number(card.dataset.day || state.currentDay);
    const editing = card.dataset.editing;
    const task = {
      id: editing ? Number(editing) : Date.now(),
      title: document.getElementById("taskTitle").value.trim() || "Untitled block",
      start: document.getElementById("taskStart").value.trim() || "—",
      end: document.getElementById("taskEnd").value.trim() || "—",
      tag: document.getElementById("taskTag").value,
      subject: document.getElementById("taskSubject").value,
      note: document.getElementById("taskNote").value.trim(),
      done: false
    };
    const tasks = getDayTasks(dayIndex).slice();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) tasks[idx] = { ...tasks[idx], ...task };
    else tasks.push(task);
    setDayTasks(dayIndex, tasks);
    saveState();
    closeTaskForm();
    renderAll();
    toast(editing ? "Task updated" : "Task added");
  }

  function renderNotes() {
    const grid = document.getElementById("noteGrid");
    const search = document.getElementById("noteSearch")?.value.toLowerCase() || "";
    if (!grid) return;
    grid.innerHTML = "";
    const notes = state.notes.filter(n =>
      !search ||
      n.title.toLowerCase().includes(search) ||
      n.tag.toLowerCase().includes(search) ||
      n.body.toLowerCase().includes(search)
    );

    if (!notes.length) {
      grid.innerHTML = `<div class="empty-state"><div class="glyph">📝</div><div>No matching notes yet.</div></div>`;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement("div");
      card.className = "note-card";
      card.innerHTML = `
        <span class="note-tag">${escapeHtml(note.tag)}</span>
        <h4>${escapeHtml(note.title)}</h4>
        <p>${escapeHtml(note.body)}</p>
        <div class="note-foot">
          <small>${new Date(note.createdAt).toLocaleString()}</small>
          <div>
            <button class="icon-btn edit-note" title="Edit">✏️</button>
            <button class="icon-btn delete-note" title="Delete">🗑️</button>
          </div>
        </div>
      `;
      card.querySelector(".edit-note").onclick = () => openNoteForm(note);
      card.querySelector(".delete-note").onclick = () => {
        state.notes = state.notes.filter(n => n.id !== note.id);
        saveState();
        renderNotes();
        toast("Note deleted");
      };
      grid.appendChild(card);
    });
  }

  function openNoteForm(note = null) {
    const card = document.getElementById("noteFormCard");
    if (!card) return;
    card.classList.remove("hidden");
    card.dataset.editing = note ? String(note.id) : "";
    document.getElementById("noteTitle").value = note?.title || "";
    document.getElementById("noteTag").value = note?.tag || "";
    document.getElementById("noteBody").value = note?.body || "";
  }

  function closeNoteForm() {
    const card = document.getElementById("noteFormCard");
    if (card) card.classList.add("hidden");
  }

  function saveNoteFromForm() {
    const editing = document.getElementById("noteFormCard").dataset.editing;
    const note = {
      id: editing ? Number(editing) : Date.now(),
      title: document.getElementById("noteTitle").value.trim() || "Untitled note",
      tag: document.getElementById("noteTag").value.trim() || "General",
      body: document.getElementById("noteBody").value.trim(),
      createdAt: editing ? (state.notes.find(n => n.id === Number(editing))?.createdAt || Date.now()) : Date.now()
    };
    const idx = state.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) state.notes[idx] = note;
    else state.notes.unshift(note);
    saveState();
    closeNoteForm();
    renderNotes();
    toast(editing ? "Note updated" : "Note saved");
  }

  function renderExam() {
    document.getElementById("examName").value = state.exam.name || "";
    document.getElementById("examDate").value = state.exam.date || "";
    document.getElementById("examCountdown").textContent = examCountdownText();
    const progress = syllabusProgress();
    document.getElementById("examProgressLabel").textContent = `${progress}%`;
    document.getElementById("examProgressFill").style.width = `${progress}%`;

    const list = document.getElementById("topicList");
    if (!list) return;
    list.innerHTML = "";
    state.exam.topics.forEach(topic => {
      const row = document.createElement("div");
      row.className = `topic-row ${topic.done ? "done" : ""}`;
      row.innerHTML = `
        <div class="topic-left">
          <input type="checkbox" ${topic.done ? "checked" : ""} />
          <span class="title">${escapeHtml(topic.text)}</span>
        </div>
        <button class="icon-btn delete-topic" title="Delete">🗑️</button>
      `;
      row.querySelector("input").onchange = e => {
        topic.done = e.target.checked;
        saveState();
        renderExam();
      };
      row.querySelector(".delete-topic").onclick = () => {
        state.exam.topics = state.exam.topics.filter(t => t.id !== topic.id);
        saveState();
        renderExam();
        toast("Topic deleted");
      };
      list.appendChild(row);
    });
  }

  function syllabusProgress() {
    const arr = state.exam.topics || [];
    if (!arr.length) return 0;
    return Math.round((arr.filter(t => t.done).length / arr.length) * 100);
  }

  function examCountdownText() {
    if (!state.exam.date) return "—";
    const diff = new Date(state.exam.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.max(0, Math.ceil(diff / 86400000)).toString();
  }

  function renderFocus() {
    const secs = state.focus.secondsLeft;
    document.getElementById("timerDisplay").textContent = formatTime(secs);
    document.getElementById("focusToday").textContent = `${Math.round(state.focus.sessionsToday * 25)} min`;
    document.getElementById("focusSessions").textContent = `${state.focus.sessionsToday}`;
    document.getElementById("focusAllTime").textContent = `${state.focus.totalMinutes} min`;
  }

  function setFocusMode(mode, mins) {
    state.focus.mode = mode;
    state.focus.secondsLeft = mins * 60;
    state.focus.running = false;
    clearInterval(timerInterval);
    timerInterval = null;
    document.querySelectorAll(".timer-mode button").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode && Number(btn.dataset.mins) === mins));
    renderFocus();
    saveState();
  }

  function startFocusTimer() {
    if (state.focus.running) return;
    state.focus.running = true;
    saveState();
    timerInterval = setInterval(() => {
      if (state.focus.secondsLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        state.focus.running = false;
        state.focus.sessionsToday += 1;
        state.focus.totalMinutes += state.focus.mode === "focus" ? 25 : 5;
        state.sparks += 5;
        toast("Timer completed!");
        renderAll();
        saveState();
        return;
      }
      state.focus.secondsLeft -= 1;
      renderFocus();
      document.getElementById("timerDisplay").textContent = formatTime(state.focus.secondsLeft);
    }, 1000);
  }

  function pauseFocusTimer() {
    state.focus.running = false;
    clearInterval(timerInterval);
    timerInterval = null;
    saveState();
  }

  function resetFocusTimer() {
    pauseFocusTimer();
    const mins = state.focus.mode === "break" ? 5 : state.focus.mode === "long" ? 50 : 25;
    state.focus.secondsLeft = mins * 60;
    renderFocus();
    saveState();
  }

  function renderNight() {
    const moods = document.querySelectorAll(".mood-btn");
    moods.forEach(btn => btn.classList.toggle("active", btn.dataset.mood === state.selectedMood));

    const list = document.getElementById("reviewList");
    if (!list) return;
    list.innerHTML = "";
    if (!state.reviews.length) {
      list.innerHTML = `<div class="empty-state"><div class="glyph">🌙</div><div>No reviews yet.</div></div>`;
      return;
    }
    state.reviews.slice(0, 6).forEach(review => {
      const entry = document.createElement("div");
      entry.className = "review-entry";
      entry.innerHTML = `
        <div class="rev-head">
          <strong>${moodEmojis[review.mood] || "🙂"} ${review.mood}</strong>
          <small>${new Date(review.createdAt).toLocaleDateString()}</small>
        </div>
        <div><strong>Wins:</strong> ${escapeHtml(review.wins)}</div>
        <div><strong>Challenges:</strong> ${escapeHtml(review.challenges)}</div>
        <div><strong>Tomorrow:</strong> ${escapeHtml(review.plan)}</div>
      `;
      list.appendChild(entry);
    });
  }

  function saveReview() {
    const review = {
      mood: state.selectedMood,
      wins: document.getElementById("reviewWins").value.trim(),
      challenges: document.getElementById("reviewChallenges").value.trim(),
      plan: document.getElementById("reviewPlan").value.trim(),
      createdAt: Date.now()
    };
    state.reviews.unshift(review);
    document.getElementById("reviewWins").value = "";
    document.getElementById("reviewChallenges").value = "";
    document.getElementById("reviewPlan").value = "";
    saveState();
    renderNight();
    toast("Review saved");
  }

  function renderChat() {
    const thread = document.getElementById("chatThread");
    if (!thread) return;
    thread.innerHTML = "";
    state.chat.forEach(msg => {
      const el = document.createElement("div");
      el.className = `chat-msg ${msg.role}`;
      el.innerHTML = escapeHtml(msg.text);
      thread.appendChild(el);
    });
    thread.scrollTop = thread.scrollHeight;
  }

  async function sendChat() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;
    state.chat.push({ role: "user", text });
    input.value = "";
    renderChat();
    saveState();

    activeChatTyping = true;
    const typing = document.createElement("div");
    typing.className = "chat-msg ai";
    typing.id = "typingMsg";
    typing.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
    document.getElementById("chatThread").appendChild(typing);

    setTimeout(() => {
      document.getElementById("typingMsg")?.remove();
      const reply = generateAiReply(text);
      state.chat.push({ role: "ai", text: reply });
      renderChat();
      saveState();
      activeChatTyping = false;
    }, 700);
  }

  function generateAiReply(text) {
    const t = text.toLowerCase();
    if (t.includes("timetable") || t.includes("schedule")) {
      return "Try placing the hardest subject in your best energy hour, keep a short break after school, and use one evening block for revision.";
    }
    if (t.includes("stress") || t.includes("tired")) {
      return "Take a small reset: water, a 5-minute walk, and then one easy task. Small progress is better than no progress.";
    }
    if (t.includes("math")) {
      return "For math, do 10 minutes of formulas, then 20 minutes of questions, then review mistakes immediately.";
    }
    if (t.includes("science")) {
      return "Science improves fastest when you mix reading with recall. Read one section, close the book, and write what you remember.";
    }
    return "Good question. Keep your answer simple, focus on one goal, and make the next action very small so you actually start.";
  }

  function applyQuickAiEdit() {
    const prompt = document.getElementById("assistantPrompt").value.toLowerCase();
    if (!prompt) {
      toast("Type a request first");
      return;
    }
    let tasks = getDayTasks().slice();
    if (prompt.includes("break")) {
      tasks.splice(Math.min(2, tasks.length), 0, {
        id: Date.now(),
        title: "Break / reset",
        start: "5:40 PM",
        end: "6:00 PM",
        tag: "Rest",
        subject: "General",
        note: "Hydrate, breathe, no phone overload",
        done: false
      });
    }
    if (prompt.includes("math")) {
      const idx = tasks.findIndex(t => t.subject === "Math");
      if (idx >= 0) tasks[idx].start = "7:30 PM";
    }
    if (prompt.includes("science")) {
      const idx = tasks.findIndex(t => t.subject === "Science");
      if (idx >= 0) tasks[idx].start = "7:30 PM";
    }
    if (prompt.includes("done")) {
      const idx = tasks.findIndex(t => !t.done);
      if (idx >= 0) tasks[idx].done = true;
    }
    setDayTasks(state.currentDay, tasks);
    state.sparks += 2;
    saveState();
    renderAll();
    toast("AI-style edit applied");
  }

  function renderCharts() {
    const allTasks = allTasksFlat();
    const studyByDay = days.map((day, i) => (state.tasks[day] || []).filter(t => t.tag === "Study").length * 1.25 + (state.tasks[day] || []).filter(t => t.tag === "School").length * 0.7);
    const completionByDay = days.map(day => {
      const arr = state.tasks[day] || [];
      return arr.length ? Math.round((arr.filter(t => t.done).length / arr.length) * 100) : 0;
    });
    const subjectCounts = {};
    const subjectCounts2 = {};
    allTasks.forEach(t => {
      subjectCounts[t.subject || "General"] = (subjectCounts[t.subject || "General"] || 0) + 1;
      subjectCounts2[t.tag || "General"] = (subjectCounts2[t.tag || "General"] || 0) + 1;
    });
    const subjects = Object.keys(subjectCounts2);

    const lineCtx = document.getElementById("lineChart");
    const doughnutCtx = document.getElementById("doughnutChart");
    const gLineCtx = document.getElementById("growthLineChart");
    const gDoughnutCtx = document.getElementById("growthDoughnutChart");
    const gBarCtx = document.getElementById("growthBarChart");
    const gRadarCtx = document.getElementById("growthRadarChart");

    destroyCharts();

    if (lineCtx) {
      lineChart = new Chart(lineCtx, {
        type: "line",
        data: {
          labels: days,
          datasets: [{
            label: "Study hours",
            data: studyByDay,
            borderColor: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
            backgroundColor: "rgba(124,130,255,.2)",
            fill: true,
            tension: .35,
            pointRadius: 4
          }]
        },
        options: chartOptions()
      });
    }

    if (doughnutCtx) {
      doughnutChart = new Chart(doughnutCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(subjectCounts).slice(0, 6),
          datasets: [{
            data: Object.values(subjectCounts).slice(0, 6),
            backgroundColor: ["#7c82ff", "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#f87171"]
          }]
        },
        options: chartDoughnutOptions()
      });
    }

    if (gLineCtx) {
      growthLineChart = new Chart(gLineCtx, {
        type: "line",
        data: {
          labels: days,
          datasets: [{
            label: "Study hours",
            data: studyByDay,
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96,165,250,.2)",
            fill: true,
            tension: .35
          }]
        },
        options: chartOptions()
      });
    }

    if (gDoughnutCtx) {
      growthDoughnutChart = new Chart(gDoughnutCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(subjectCounts2).slice(0, 6),
          datasets: [{
            data: Object.values(subjectCounts2).slice(0, 6),
            backgroundColor: ["#7c82ff", "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#f87171"]
          }]
        },
        options: chartDoughnutOptions()
      });
    }

    if (gBarCtx) {
      growthBarChart = new Chart(gBarCtx, {
        type: "bar",
        data: {
          labels: days,
          datasets: [{
            label: "Completion %",
            data: completionByDay,
            backgroundColor: ["#34d399", "#60a5fa", "#f59e0b", "#7c82ff", "#a78bfa", "#f87171", "#10b981"],
            borderRadius: 12
          }]
        },
        options: chartOptions()
      });
    }

    if (gRadarCtx) {
      growthRadarChart = new Chart(gRadarCtx, {
        type: "radar",
        data: {
          labels: ["Focus", "Memory", "Consistency", "Fitness", "Notes", "Rest"],
          datasets: [{
            label: "Your balance",
            data: [
              Math.min(100, 50 + state.streak * 2),
              Math.min(100, 45 + (state.notes.length * 8)),
              Math.min(100, 50 + (state.reviews.length * 5)),
              Math.min(100, 35 + (state.tasks[days[state.currentDay]] || []).filter(t => t.tag === "Fitness").length * 20),
              Math.min(100, 40 + (state.notes.length * 10)),
              Math.min(100, 40 + (state.reviews.length * 4))
            ],
            backgroundColor: "rgba(96,165,250,.16)",
            borderColor: "#60a5fa",
            pointBackgroundColor: "#60a5fa"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: chartTextColor() } } },
          scales: {
            r: {
              angleLines: { color: "rgba(148,163,184,.15)" },
              grid: { color: "rgba(148,163,184,.15)" },
              pointLabels: { color: chartMutedColor() },
              ticks: { color: chartMutedColor(), backdropColor: "transparent" }
            }
          }
        }
      });
    }

    renderHeatmap(completionByDay);
  }

  function renderHeatmap(completionByDay) {
    const heatmap = document.getElementById("heatmap");
    if (!heatmap) return;
    heatmap.innerHTML = "";
    const values = Array.from({ length: 28 }, (_, i) => {
      const dayValue = completionByDay[i % 7] || 0;
      return Math.min(100, Math.max(0, dayValue + (i % 4) * 8 - 10));
    });
    values.forEach((v, i) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.tip = `${v}% · day ${i + 1}`;
      const c = v < 20 ? "var(--color-surface-offset)" :
                v < 40 ? "color-mix(in srgb, var(--color-primary) 25%, var(--color-surface-offset))" :
                v < 60 ? "color-mix(in srgb, var(--color-primary) 45%, var(--color-surface-offset))" :
                v < 80 ? "color-mix(in srgb, var(--color-primary) 65%, var(--color-surface-offset))" :
                         "var(--color-primary)";
      cell.style.background = c;
      heatmap.appendChild(cell);
    });
  }

  function chartTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim();
  }

  function chartMutedColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text-muted").trim();
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: chartTextColor(), font: { family: "Plus Jakarta Sans" } } } },
      scales: {
        x: { ticks: { color: chartMutedColor() }, grid: { color: "rgba(148,163,184,.12)" } },
        y: { ticks: { color: chartMutedColor() }, grid: { color: "rgba(148,163,184,.12)" } }
      }
    };
  }

  function chartDoughnutOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: chartTextColor() } } }
    };
  }

  function destroyCharts() {
    [lineChart, doughnutChart, growthLineChart, growthDoughnutChart, growthBarChart, growthRadarChart].forEach(c => c && c.destroy && c.destroy());
    lineChart = doughnutChart = growthLineChart = growthDoughnutChart = growthBarChart = growthRadarChart = null;
  }

  function renderAll() {
    document.documentElement.setAttribute("data-theme", state.theme || "dark");
    document.querySelector(".toggle[data-theme-toggle]")?.replaceChildren(document.createTextNode(state.theme === "dark" ? "🌙 Theme" : "☀️ Theme"));
    document.getElementById("profileLabel").textContent = state.profileSet ? state.profileName : "Set up profile";
    document.getElementById("syncStatus").title = state.syncMode === "cloud" ? "Cloud sync ready" : "Local only";
    document.querySelectorAll(".nav-btn[data-page]").forEach(btn => btn.classList.toggle("active", btn.dataset.page === state.currentPage));
    renderDashboard();
    renderTimetable();
    renderNotes();
    renderExam();
    renderFocus();
    renderNight();
    renderChat();
    renderCharts();
    updateSyncIndicator(true);
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "studyflow-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Progress exported");
  }

  function setProfile() {
    const name = prompt("Enter your profile name", state.profileName || "Student");
    if (!name) return;
    state.profileName = name.trim().slice(0, 32) || "Student";
    state.profileSet = true;
    saveState();
    renderAll();
    toast("Profile saved");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function bindEvents() {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.onclick = () => setTheme(state.theme === "dark" ? "light" : "dark");
    });

    document.querySelectorAll(".nav-btn[data-page], [data-goto]").forEach(btn => {
      btn.onclick = () => setPage(btn.dataset.page || btn.dataset.goto);
    });

    document.getElementById("menuBtn").onclick = () => document.getElementById("sidebar").classList.toggle("open");

    document.getElementById("claimSpark").onclick = () => {
      state.sparks += 5;
      saveState();
      renderAll();
      toast("Spark claimed");
    };

    document.getElementById("profileBtn").onclick = setProfile;
    document.getElementById("exportBtn").onclick = exportProgress;
    document.getElementById("syncStatus").onclick = () => {
      state.syncMode = state.syncMode === "cloud" ? "local" : "cloud";
      saveState();
      updateSyncIndicator(true);
      toast(state.syncMode === "cloud" ? "Cloud sync enabled" : "Local only mode");
    };

    document.getElementById("showAddTask").onclick = () => openTaskForm(null, state.currentDay);
    document.getElementById("cancelTask").onclick = closeTaskForm;
    document.getElementById("saveTask").onclick = saveTaskFromForm;

    document.getElementById("showAddNote").onclick = () => openNoteForm(null);
    document.getElementById("cancelNote").onclick = closeNoteForm;
    document.getElementById("saveNote").onclick = saveNoteFromForm;
    document.getElementById("noteSearch").oninput = renderNotes;

    document.getElementById("saveExam").onclick = () => {
      state.exam.name = document.getElementById("examName").value.trim() || "Exam";
      state.exam.date = document.getElementById("examDate").value;
      saveState();
      renderExam();
      toast("Exam saved");
    };

    document.getElementById("showAddTopic").onclick = () => openTopicForm();
    document.getElementById("cancelTopic").onclick = () => document.getElementById("topicFormCard").classList.add("hidden");
    document.getElementById("saveReview").onclick = saveReview;

    document.getElementById("brainstormBtn").onclick = () => {
      document.getElementById("assistantResponse").textContent =
        "Try keeping your hardest subject in your highest-energy time, and use a 5–10 minute break between study blocks.";
    };

    document.getElementById("applyAi").onclick = applyQuickAiEdit;

    document.getElementById("chatSend").onclick = sendChat;
    document.getElementById("chatInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });

    document.querySelectorAll(".mood-btn").forEach(btn => {
      btn.onclick = () => {
        state.selectedMood = btn.dataset.mood;
        saveState();
        renderNight();
        toast(`Mood set: ${btn.dataset.mood}`);
      };
    });

    document.querySelectorAll(".timer-mode button").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".timer-mode button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const mins = Number(btn.dataset.mins);
        state.focus.mode = btn.dataset.mode;
        state.focus.secondsLeft = mins * 60;
        pauseFocusTimer();
        renderFocus();
        saveState();
      };
    });

    document.getElementById("timerStart").onclick = startFocusTimer;
    document.getElementById("timerPause").onclick = pauseFocusTimer;
    document.getElementById("timerReset").onclick = resetFocusTimer;

    document.getElementById("showAddTopic").onclick = () => {
      document.getElementById("topicFormCard").classList.remove("hidden");
      document.getElementById("topicInput").value = "";
    };

    document.getElementById("saveTask").addEventListener("click", saveTaskFromForm);
    document.getElementById("saveNote").addEventListener("click", saveNoteFromForm);
    document.getElementById("saveTask").addEventListener("touchstart", saveTaskFromForm, { passive: true });
    document.getElementById("saveNote").addEventListener("touchstart", saveNoteFromForm, { passive: true });

    document.getElementById("saveTask").disabled = false;
    document.getElementById("saveNote").disabled = false;

    document.getElementById("saveExam").disabled = false;
    document.getElementById("chatSend").disabled = false;

    document.getElementById("saveTask").onclick = saveTaskFromForm;
    document.getElementById("saveNote").onclick = saveNoteFromForm;
    document.getElementById("saveExam").onclick = () => {
      state.exam.name = document.getElementById("examName").value.trim() || "Exam";
      state.exam.date = document.getElementById("examDate").value;
      saveState();
      renderExam();
      toast("Exam saved");
    };

    document.getElementById("saveTopic").onclick = () => {
      const text = document.getElementById("topicInput").value.trim();
      if (!text) return;
      state.exam.topics.push({ id: Date.now(), text, done: false });
      document.getElementById("topicFormCard").classList.add("hidden");
      saveState();
      renderExam();
      toast("Topic added");
    };

    document.getElementById("cancelTopic").onclick = () => document.getElementById("topicFormCard").classList.add("hidden");
  }

  function openTopicForm() {
    const card = document.getElementById("topicFormCard");
    if (card) card.classList.remove("hidden");
  }

  function syncTimerModeButtons() {
    const mins = state.focus.mode === "break" ? 5 : state.focus.mode === "long" ? 50 : 25;
    document.querySelectorAll(".timer-mode button").forEach(btn => {
      const active = btn.dataset.mode === state.focus.mode && Number(btn.dataset.mins) === mins;
      btn.classList.toggle("active", active);
    });
  }

  function init() {
    document.documentElement.setAttribute("data-theme", state.theme || "dark");
    syncTimerModeButtons();
    bindEvents();
    renderAll();
    if (state.focus.running) startFocusTimer();
    updateSyncIndicator(true);
    saveState();
  }

  init();
})();
