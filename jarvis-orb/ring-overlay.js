
(() => {
  "use strict";

  const root = document.getElementById("overlay");
  const orb = document.getElementById("orb-hit");
  const tooltip = document.getElementById("tooltip");
  const reply = document.getElementById("reply");
  const chatLog = document.getElementById("chat-log");
  const chatEmpty = document.getElementById("chat-empty");
  const chatClear = document.getElementById("chat-clear");
  const askInput = document.getElementById("ask-input");
  const askForm = document.getElementById("ask-form");

  const reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Your existing Electron preload can expose this API.
  // These hooks deliberately do not access Node directly.
  const getBridge = () => window.jarvisOverlay || null;

  // SINGLE SOURCE OF TRUTH FOR VISUAL STATE
  let state = "standby";

  const stateLabels = {
    standby: "Standby",
    listening: "Listening…",
    thinking: "Thinking…",
    done: "Done",
    recording: "Recording",
    error: "Error"
  };

  let liveEnabled = false;
  let recording = false;
  let askOpen = false;
  let visible = true;
  let doneTimer = null;
  let replyTimer = null;
  let tooltipOwner = null;

  // Audio level is supplied by your recording system.
  let audioLevel = 0;
  let smoothLevel = 0;
  let audioFrame = null;

  // --------------------------------------------------
  // CENTRAL STATUS CONTROLLER
  // --------------------------------------------------

  function setState(next) {
    if (!Object.hasOwn(stateLabels, next)) return;

    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = null;

    state = next;
    root.dataset.state = state;

    orb.setAttribute(
      "aria-label",
      "Jarvis orb — " + stateLabels[state]
    );

    if (tooltipOwner === orb) {
      showTooltip(orb, stateLabels[state]);
    }

    if (next === "done") {
      doneTimer = setTimeout(() => {
        if (state === "done") setState("standby");
      }, reducedMotion ? 1000 : 1250);
    }

    if (next === "listening" || next === "recording") {
      startAudioArc();
    } else {
      stopAudioArc();
    }

    dispatch("statechange", { state });
  }

  function dispatch(type, detail = {}) {
    window.dispatchEvent(
      new CustomEvent("jarvis:" + type, { detail })
    );
  }

  // --------------------------------------------------
  // TOOLTIP — ONE SHARED ELEMENT
  // --------------------------------------------------

  function showTooltip(target, label) {
    tooltipOwner = target;

    tooltip.textContent = label;

    // Show first to measure.
    tooltip.classList.add("visible");

    const bounds = root.getBoundingClientRect();
    const rect = target.getBoundingClientRect();

    const tipWidth = tooltip.offsetWidth;
    const tipHeight = tooltip.offsetHeight;

    const targetX =
      rect.left - bounds.left + rect.width / 2;
    const targetY =
      rect.top - bounds.top + rect.height / 2;

    let x = targetX + 23;
    let y = targetY - tipHeight / 2;

    // Automatically flip at right edge.
    if (x + tipWidth > 408) {
      x = targetX - tipWidth - 23;
    }

    x = Math.max(8, Math.min(
      412 - tipWidth, x
    ));

    y = Math.max(4, Math.min(
      416 - tipHeight, y
    ));

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip(target) {
    if (target && tooltipOwner !== target) return;
    tooltipOwner = null;
    tooltip.classList.remove("visible");
  }

  function attachTooltip(el, getLabel) {
    el.addEventListener("pointerenter", () => {
      root.classList.add("pause-orbit");
      showTooltip(el, getLabel());
    });

    el.addEventListener("pointerleave", () => {
      root.classList.remove("pause-orbit");
      hideTooltip(el);
    });

    el.addEventListener("focus", () => {
      root.classList.add("pause-orbit");
      showTooltip(el, getLabel());
    });

    el.addEventListener("blur", () => {
      root.classList.remove("pause-orbit");
      hideTooltip(el);
    });
  }

  document.querySelectorAll("[data-action]").forEach(el => {
    attachTooltip(el, () => {
      if (el.dataset.action === "record") {
        return recording
          ? "Stop Recording"
          : "Record Audio — only with everyone's consent";
      }

      if (el.dataset.action === "live" && liveEnabled) {
        return "Disable Live Commands";
      }

      return el.dataset.tip;
    });
  });

  document.querySelectorAll("[data-directive]").forEach(el => {
    attachTooltip(el, () => el.dataset.directive);
  });

  attachTooltip(orb, () => stateLabels[state]);

  orb.addEventListener("pointerenter", () => {
    root.classList.add("orb-hover");
  });

  orb.addEventListener("pointerleave", () => {
    root.classList.remove("orb-hover");
  });

  // --------------------------------------------------
  // ACTIONS
  // --------------------------------------------------

  function setRecording(enabled) {
    recording = Boolean(enabled);

    const button = document.querySelector(
      '[data-action="record"]'
    );

    button.classList.toggle("active", recording);
    button.setAttribute(
      "aria-pressed", String(recording)
    );

    if (recording) {
      setState("recording");
    } else if (state === "recording") {
      setState("standby");
    }

    dispatch("record", { enabled: recording });
  }

  function setLive(enabled) {
    liveEnabled = Boolean(enabled);

    const button = document.querySelector(
      '[data-action="live"]'
    );

    button.classList.toggle("active", liveEnabled);
    button.setAttribute(
      "aria-pressed", String(liveEnabled)
    );

    if (liveEnabled && state === "standby") {
      setState("listening");
    } else if (!liveEnabled && state === "listening") {
      setState("standby");
    }

    dispatch("live", { enabled: liveEnabled });
  }

  function setAskOpen(next) {
    askOpen = Boolean(next);
    root.classList.toggle("ask-open", askOpen);

    document.querySelector(
      '[data-action="ask"]'
    ).setAttribute(
      "aria-expanded", String(askOpen)
    );

    if (askOpen) {
      requestAnimationFrame(() => askInput.focus());
    } else {
      askInput.blur();
    }

    dispatch("asktoggle", { open: askOpen });
  }

  function performAction(action) {
    switch (action) {
      case "record":
        setRecording(!recording);
        break;

      case "watch":
        dispatch("watch");
        break;

      case "look":
        dispatch("look");
        break;

      case "live":
        setLive(!liveEnabled);
        break;

      case "ask":
        setAskOpen(!askOpen);
        break;

      case "clear":
        askInput.value = "";
        clearReply();
        dispatch("clear");
        break;
    }
  }

  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      performAction(btn.dataset.action);
    });
  });

  document.querySelectorAll("[data-directive]").forEach(btn => {
    btn.addEventListener("click", () => {
      const directive = btn.dataset.directive;

      dispatch("directive", { directive });
      setAskOpen(false);
    });
  });

  // --------------------------------------------------
  // ASK / REPLY
  // --------------------------------------------------

  askForm.addEventListener("submit", event => {
    event.preventDefault();

    const message = askInput.value.trim();
    if (!message) return;

    dispatch("ask", { message });

    askInput.value = "";
    setAskOpen(false);
  });

  function addMessage(role, text) {
    if (!chatLog) return null;
    chatEmpty?.remove();
    const message = document.createElement("article");
    const who = role === "user" ? "user" : "jarvis";
    message.className = `chat-message ${who}`;
    const label = document.createElement("span");
    label.className = "chat-speaker";
    label.textContent = who === "user" ? "You" : "Jarvis";
    const body = document.createElement("div");
    body.className = "chat-message-text";
    body.textContent = String(text || "");
    message.append(label, body);
    chatLog.appendChild(message);
    chatLog.scrollTop = chatLog.scrollHeight;
    return message;
  }

  function updateMessage(message, text) {
    if (!message) return;
    const body = message.querySelector(".chat-message-text");
    if (body) body.textContent = String(text || "");
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
  }

  function clearChat() {
    if (chatLog && chatEmpty) chatLog.replaceChildren(chatEmpty);
    showReply("Visible chat cleared.", 1800);
  }

  function showReply(text, duration = 0) {
    clearTimeout(replyTimer);
    replyTimer = null;
    reply.textContent = String(text || "");
    reply.classList.toggle("visible", Boolean(text));
    if (duration > 0 && text) replyTimer = setTimeout(clearReply, duration);
  }

  function clearReply() {
    clearTimeout(replyTimer);
    replyTimer = null;
    reply.classList.remove("visible");
    reply.textContent = "";
  }

  chatClear?.addEventListener("click", clearChat);
  // "New chat" also opens the ask line so you can type straight away.
  chatClear?.addEventListener("click", () => { askInput.value = ""; setAskOpen(true); });

  // --------------------------------------------------
  // AUDIO WAVEFORM ARC
  // --------------------------------------------------

  const path = document.getElementById("audio-path");

  function setAudioLevel(level) {
    if (!Number.isFinite(level)) return;
    audioLevel = Math.max(0, Math.min(1, level));
  }

  function drawArc() {
    // Damped signal for graceful movement.
    smoothLevel += (audioLevel - smoothLevel) * .18;

    const points = [];
    const n = 48;

    for (let i = 0; i <= n; i++) {
      const x = (i / n) * 180;

      // Curved arc beneath original orb.
      const normalized = x / 90 - 1;
      const base = 14 + 17 * (1 - normalized * normalized);

      const envelope = Math.sin(Math.PI * i / n);
      const phase = performance.now() * .009;

      const wave = Math.sin(i * .85 + phase)
        * smoothLevel * 10 * envelope;

      points.push([
        x.toFixed(2),
        (base + wave).toFixed(2)
      ]);
    }

    path.setAttribute(
      "d",
      points.map((p, i) =>
        (i === 0 ? "M" : "L") + p[0] + " " + p[1]
      ).join(" ")
    );
  }

  function audioTick() {
    audioFrame = null;
    if (
      state !== "listening" &&
      state !== "recording"
    ) return;

    drawArc();

    if (!reducedMotion && !document.hidden && visible) {
      audioFrame = requestAnimationFrame(audioTick);
    }
  }

  function startAudioArc() {
    if (audioFrame !== null) return;

    if (reducedMotion) {
      path.setAttribute("d", "M0 15 Q90 40 180 15");
      return;
    }

    audioFrame = requestAnimationFrame(audioTick);
  }

  function stopAudioArc() {
    if (audioFrame !== null) {
      cancelAnimationFrame(audioFrame);
      audioFrame = null;
    }
    audioLevel = 0;
    smoothLevel = 0;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopAudioArc();
    else if (state === "listening" || state === "recording") {
      startAudioArc();
    }
  });

  // --------------------------------------------------
  // VISIBILITY & SHORTCUTS
  // --------------------------------------------------

  function setVisible(next) {
    visible = Boolean(next);
    root.classList.toggle("is-hidden", !visible);

    if (!visible) {
      hideTooltip();
      setAskOpen(false);
      stopAudioArc();
    } else if (
      state === "listening" ||
      state === "recording"
    ) {
      startAudioArc();
    }

    dispatch("visibility", { visible });

    // Optional: preload forwards visibility to
    // Electron's native window management.
    getBridge()?.setVisible?.(visible);
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (askOpen) setAskOpen(false);
      else setVisible(false);
      return;
    }

    if (
      event.metaKey &&
      event.shiftKey &&
      event.key.toLowerCase() === "a"
    ) {
      event.preventDefault();
      setAskOpen(true);
      return;
    }

    if (
      event.metaKey &&
      event.shiftKey &&
      event.key.toLowerCase() === "j"
    ) {
      event.preventDefault();
      setVisible(!visible);
      return;
    }

    // No single-key shortcuts while typing.
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.metaKey || event.ctrlKey ||
      event.altKey
    ) return;

    if (event.key.toLowerCase() === "r") {
      performAction("record");
    }

    if (event.key.toLowerCase() === "l") {
      performAction("look");
    }
  });

  // Electron's global shortcut handler may send
  // a message through the preload to toggle us.
  window.addEventListener("jarvis:togglevisibility", () => {
    setVisible(!visible);
  });

  // --------------------------------------------------
  // DRAG BY THE ORB
  // --------------------------------------------------

  let drag = null;

  orb.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;

    drag = {
      id: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      lastX: event.screenX,
      lastY: event.screenY,
      moved: false
    };

    orb.setPointerCapture(event.pointerId);
  });

  orb.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;

    const dx = event.screenX - drag.lastX;
    const dy = event.screenY - drag.lastY;

    if (
      Math.abs(event.screenX - drag.startX) > 4 ||
      Math.abs(event.screenY - drag.startY) > 4
    ) {
      drag.moved = true;
      orb.classList.add("dragging");
    }

    if (drag.moved && (dx || dy)) {
      // The preload should move the actual Electron
      // BrowserWindow. The DOM cannot move an OS window.
      getBridge()?.moveBy?.(dx, dy);
    }

    drag.lastX = event.screenX;
    drag.lastY = event.screenY;
  });

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;

    const moved = drag.moved;
    drag = null;
    orb.classList.remove("dragging");

    if (!moved && event.type === "pointerup") {
      dispatch("orbclick");
    }
  }

  orb.addEventListener("pointerup", endDrag);
  orb.addEventListener("pointercancel", endDrag);

  orb.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dispatch("orbclick");
    }
  });

  // --------------------------------------------------
  // ELECTRON CLICK-THROUGH HINT
  // --------------------------------------------------

  // CSS makes blank space non-interactive within
  // this document. For genuine OS desktop click-through,
  // the Electron main process must use
  // BrowserWindow.setIgnoreMouseEvents().
  //
  // When the preload supports it, this reports whether
  // the pointer is over an interactive control.
  //
  // The preload/main process needs forwarded mousemove
  // events to recover from click-through mode.

  const INTERACTIVE_SELECTOR =
    ".orb-hit, .action, .directive, .ask-area, #reply, #chat-panel";

  let lastInteractive = null;

  function updateHitTest(x, y) {
    if (!getBridge()?.setInteractive) return;

    const target = document.elementFromPoint(x, y);

    const isInteractive = Boolean(
      visible &&
      target &&
      target.closest(INTERACTIVE_SELECTOR) &&
      (
        askOpen ||
        !target.closest(".directive, .ask-area")
      )
    );

    if (isInteractive === lastInteractive) return;

    lastInteractive = isInteractive;

    getBridge().setInteractive(isInteractive);
  }

  document.addEventListener("pointermove", event => {
    updateHitTest(event.clientX, event.clientY);
  }, { passive: true });

  window.addEventListener("blur", () => {
    // Return to click-through after losing focus.
    lastInteractive = false;
    getBridge()?.setInteractive?.(false);
  });

  // --------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------

  window.JarvisStandby = {
    setState,
    getState: () => state,
    setAudioLevel,
    showReply,
    clearReply,
    addMessage,
    updateMessage,
    clearChat,
    setRecording,
    setLive,
    setVisible,
    setAskOpen,
    get visible() { return visible; }
  };

  // Ready for existing Jarvis integration.
  dispatch("ready", { state });

})();
